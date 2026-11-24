<?php
/**
 * 見知らぬ駅 · 1年利用後アンケート投稿口
 * POST JSON → responses.jsonl に1行追記
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function fail(int $code, string $reason): never
{
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $reason], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'method');
}

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    fail(400, 'empty');
}
if (strlen($raw) > 200000) {
    fail(413, 'too_large');
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    fail(400, 'json');
}

// 最低限の同意チェック
if (($data['consent'] ?? '') !== '同意する') {
    fail(400, 'no_consent');
}
if (($data['screen_app'] ?? '') !== 'はい、見知らぬ駅です') {
    fail(400, 'not_target');
}

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
$ua = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 240);

$record = [
    'id' => bin2hex(random_bytes(8)),
    'received_at' => gmdate('c'),
    'ip_hash' => hash('sha256', $ip . '|mishiranu-survey-year1'),
    'ua' => $ua,
    'answers' => $data,
];

$path = __DIR__ . '/responses.jsonl';
$line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($line === false) {
    fail(500, 'encode');
}

$fh = fopen($path, 'ab');
if ($fh === false) {
    fail(500, 'open');
}
if (!flock($fh, LOCK_EX)) {
    fclose($fh);
    fail(500, 'lock');
}
fwrite($fh, $line . "\n");
fflush($fh);
flock($fh, LOCK_UN);
fclose($fh);

echo json_encode(['ok' => true, 'id' => $record['id']], JSON_UNESCAPED_UNICODE);
