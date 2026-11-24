<?php
/**
 * 見知らぬ駅 · 案内キャッシュの書き込み口（さくらのレンタルサーバ用）
 *
 * 置き場所: public_html/mishiranu-cache/put.php
 * 読み出しはこの PHP を通さない。v1/<鍵>.json を普通に GET する。
 *
 * 合言葉はこのファイルの隣の cache-token.txt に1行で書く（公開領域の外が望ましいが、
 * .htaccess で遮ってあるので隣でもよい）。アプリ側の MISHIRANU_CACHE_TOKEN と同じ文字列。
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const SCHEMA_DIR = 'v1';
const MAX_BYTES = 524288; // 512KB

function fail(int $status, string $reason): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'reason' => $reason], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'method');
}

$tokenFile = __DIR__ . '/cache-token.txt';
if (!is_readable($tokenFile)) {
    fail(503, 'no_token_file');
}
$expected = trim((string) file_get_contents($tokenFile));
if (strlen($expected) < 16) {
    fail(503, 'weak_token');
}

$given = trim((string) ($_SERVER['HTTP_X_MISHIRANU_CACHE_TOKEN'] ?? ''));
if ($given === '' || !hash_equals($expected, $given)) {
    fail(401, 'token');
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) === 0) {
    fail(400, 'empty');
}
if (strlen($raw) > MAX_BYTES) {
    fail(413, 'too_large');
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    fail(400, 'json');
}

$key = (string) ($payload['key'] ?? '');
// 鍵は sha256 の16進だけ。ここを緩めるとディレクトリを抜けられる。
if (preg_match('/\A[0-9a-f]{64}\z/', $key) !== 1) {
    fail(400, 'key');
}

$entry = $payload['entry'] ?? null;
if (!is_array($entry) || !isset($entry['station']) || !is_array($entry['station'])) {
    fail(400, 'entry');
}

$dir = __DIR__ . '/' . SCHEMA_DIR;
if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
    fail(500, 'mkdir');
}

$encoded = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($encoded === false) {
    fail(400, 'encode');
}

// 書きかけを読ませない。同じ名前へ置き換える。
$target = $dir . '/' . $key . '.json';
$tmp = $target . '.' . getmypid() . '.tmp';
if (file_put_contents($tmp, $encoded, LOCK_EX) === false) {
    fail(500, 'write');
}
if (!rename($tmp, $target)) {
    @unlink($tmp);
    fail(500, 'rename');
}
@chmod($target, 0644);

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
