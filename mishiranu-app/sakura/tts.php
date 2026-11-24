<?php
/**
 * 見知らぬ駅 · 土地案内 xVoice（xAI TTS）プロキシ
 *
 * 置き場所: public_html/mishiranu-cache/tts.php
 * 秘密:
 *   - xai-api-key.txt（隣 · .htaccess で遮断）
 *   - device-token.txt（iOS の x-mishiranu-device-token と同じ · .htaccess で遮断）
 *
 * POST JSON: { "text": "...", "voice"?: "eve", "speed"?: 0.96 }
 * 成功: audio/mpeg
 */

declare(strict_types=1);

header('Cache-Control: no-store');

const MAX_CHARS = 1200;
const DEFAULT_VOICE = 'eve';
const DEFAULT_SPEED = 1.05;

function fail_json(int $status, string $reason, string $message = ''): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    $out = ['ok' => false, 'error' => $reason];
    if ($message !== '') {
        $out['message'] = $message;
    }
    echo json_encode($out, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Mishiranu-Device-Token, Authorization');
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail_json(405, 'method');
}

header('Access-Control-Allow-Origin: *');

$tokenFile = __DIR__ . '/device-token.txt';
if (!is_readable($tokenFile)) {
    fail_json(503, 'no_token_file', 'xVoice の端末合言葉が未設定です。');
}
$expected = trim((string) file_get_contents($tokenFile));
if (strlen($expected) < 8) {
    fail_json(503, 'weak_token');
}

$given = trim((string) ($_SERVER['HTTP_X_MISHIRANU_DEVICE_TOKEN'] ?? ''));
if ($given === '') {
    $auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (stripos($auth, 'Bearer ') === 0) {
        $given = trim(substr($auth, 7));
    }
}
if ($given === '' || !hash_equals($expected, $given)) {
    fail_json(401, 'token', '端末トークンが必要です。');
}

$keyFile = __DIR__ . '/xai-api-key.txt';
if (!is_readable($keyFile)) {
    fail_json(503, 'no_api_key', 'xVoice の設定がまだです。');
}
$apiKey = trim((string) file_get_contents($keyFile));
if ($apiKey === '') {
    fail_json(503, 'no_api_key', 'xVoice の設定がまだです。');
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) === 0) {
    fail_json(400, 'empty');
}
if (strlen($raw) > 65536) {
    fail_json(413, 'too_large');
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    fail_json(400, 'json');
}

$text = trim((string) ($payload['text'] ?? ''));
if ($text === '') {
    fail_json(400, 'empty_text');
}
if (mb_strlen($text) > MAX_CHARS) {
    fail_json(413, 'text_too_long');
}

$voiceRaw = strtolower(trim((string) ($payload['voice'] ?? DEFAULT_VOICE)));
$voice = preg_replace('/[^a-z0-9_-]/', '', $voiceRaw) ?: DEFAULT_VOICE;
$speed = isset($payload['speed']) ? (float) $payload['speed'] : DEFAULT_SPEED;
if (!is_finite($speed)) {
    $speed = DEFAULT_SPEED;
}
$speed = max(0.7, min(1.5, $speed));

$ttsBody = json_encode([
    'text' => $text,
    'voice_id' => $voice,
    'language' => 'ja',
    'speed' => $speed,
    'output_format' => [
        'codec' => 'mp3',
        'sample_rate' => 24000,
        'bit_rate' => 128000,
    ],
], JSON_UNESCAPED_UNICODE);

$ch = curl_init('https://api.x.ai/v1/tts');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
        'Accept: audio/mpeg, application/json',
    ],
    CURLOPT_POSTFIELDS => $ttsBody,
    CURLOPT_TIMEOUT => 45,
    CURLOPT_USERAGENT => 'mishiranu-eki/xvoice (+sakura)',
]);
$body = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$ctype = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if ($body === false) {
    fail_json(502, 'tts_failed', '読み上げ音声をつくれませんでした。');
}
if ($code >= 400) {
    fail_json(502, 'tts_failed', '読み上げ音声をつくれませんでした。');
}
$bin = (string) $body;
if (strlen($bin) < 64) {
    fail_json(502, 'tts_failed', '読み上げ音声をつくれませんでした。');
}

if (str_contains($ctype, 'application/json') || ($bin[0] === '{' || $bin[0] === '[')) {
    $data = json_decode($bin, true);
    $b64 = is_array($data) ? (string) ($data['audio'] ?? $data['audioContent'] ?? '') : '';
    if ($b64 === '') {
        fail_json(502, 'tts_failed', '読み上げ音声をつくれませんでした。');
    }
    $decoded = base64_decode($b64, true);
    if ($decoded === false || strlen($decoded) < 64) {
        fail_json(502, 'tts_failed', '読み上げ音声をつくれませんでした。');
    }
    $bin = $decoded;
}

header('Content-Type: audio/mpeg');
header('Content-Length: ' . strlen($bin));
echo $bin;
