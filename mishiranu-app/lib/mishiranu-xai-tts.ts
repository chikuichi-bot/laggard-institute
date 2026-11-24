/**
 * 見知らぬ駅 · 土地案内の xVoice（xAI TTS）。
 * キーはサーバー側のみ（XAI_API_KEY）。端末には置かない。
 */

const XAI_TTS_URL = "https://api.x.ai/v1/tts";

/** 土地案内向け。eve で落ち着きつつ、句点後が間延びしない速度。 */
export const MISHIRANU_XVOICE_DEFAULT = {
  voiceId: "eve",
  speed: 1.05,
} as const;

export type MishiranuXvoiceOptions = {
  voiceId?: string;
  speed?: number;
};

export function isXaiTtsConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

/**
 * @returns MP3 bytes
 */
export async function synthesizeXaiTts(
  text: string,
  options: MishiranuXvoiceOptions = {},
): Promise<Buffer> {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) {
    throw new Error("XAI_API_KEY missing");
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("empty text");
  }
  if (trimmed.length > 1200) {
    throw new Error("text too long");
  }

  const voiceId = (options.voiceId || MISHIRANU_XVOICE_DEFAULT.voiceId)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const speed = clampSpeed(options.speed ?? MISHIRANU_XVOICE_DEFAULT.speed);

  const payload = {
    text: trimmed,
    voice_id: voiceId || MISHIRANU_XVOICE_DEFAULT.voiceId,
    language: "ja",
    speed,
    output_format: {
      codec: "mp3",
      sample_rate: 24000,
      bit_rate: 128000,
    },
  };

  const res = await fetch(XAI_TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      Accept: "audio/mpeg, application/json",
    },
    body: JSON.stringify(payload),
  });

  const ctype = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    const hint = buf.subarray(0, 400).toString("utf8");
    throw new Error(`xAI TTS HTTP ${res.status}: ${hint}`);
  }
  if (buf.length < 64) {
    throw new Error("xAI TTS empty audio");
  }

  if (ctype.includes("application/json") || buf[0] === 0x7b || buf[0] === 0x5b) {
    const data = JSON.parse(buf.toString("utf8")) as {
      audio?: string;
      audioContent?: string;
    };
    const b64 = data.audio || data.audioContent || "";
    if (!b64) throw new Error("xAI TTS JSON without audio");
    const decoded = Buffer.from(b64, "base64");
    if (decoded.length < 64) throw new Error("xAI TTS decode failed");
    return decoded;
  }

  return buf;
}

function clampSpeed(n: number): number {
  if (!Number.isFinite(n)) return MISHIRANU_XVOICE_DEFAULT.speed;
  return Math.min(1.5, Math.max(0.7, n));
}
