import { requireStationViewer } from "@/lib/mishiranu-device-auth";
import { allowViewerRequest } from "@/lib/mishiranu-rate-limit";
import { requireJsonContentType } from "@/lib/mishiranu-request";
import {
  isXaiTtsConfigured,
  synthesizeXaiTts,
} from "@/lib/mishiranu-xai-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  text?: string;
  /** xAI voice_id。未指定は土地案内の既定（eve）。 */
  voice?: string;
  speed?: number;
};

const RATE_WINDOW_MS = 60_000;
/** 本再生＋先読みで約2倍消費するので余裕を取る。 */
const RATE_MAX = 48;

const NO_STORE = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  const viewer = await requireStationViewer(request);
  if (viewer instanceof Response) return viewer;

  const media = requireJsonContentType(request);
  if (media) return media;

  if (!allowViewerRequest(`tts:${viewer.sub}`, RATE_MAX, RATE_WINDOW_MS)) {
    return Response.json(
      {
        error: "rate_limited",
        message: "いま混み合っています。少し待ってから、もう一度どうぞ。",
      },
      { status: 429, headers: NO_STORE },
    );
  }

  if (!isXaiTtsConfigured()) {
    return Response.json(
      {
        error: "no_api_key",
        message: "xVoice の設定がまだです。",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json(
      { error: "invalid_json" },
      { status: 400, headers: NO_STORE },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return Response.json(
      { error: "empty_text" },
      { status: 400, headers: NO_STORE },
    );
  }
  if (text.length > 1200) {
    return Response.json(
      { error: "text_too_long" },
      { status: 413, headers: NO_STORE },
    );
  }

  const voice =
    typeof body.voice === "string" && body.voice.trim()
      ? body.voice.trim()
      : undefined;
  const speed =
    typeof body.speed === "number" && Number.isFinite(body.speed)
      ? body.speed
      : undefined;

  try {
    const mp3 = await synthesizeXaiTts(text, { voiceId: voice, speed });
    return new Response(new Uint8Array(mp3), {
      status: 200,
      headers: {
        ...NO_STORE,
        "content-type": "audio/mpeg",
        "content-length": String(mp3.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "tts_failed";
    console.error("[mishiranu/tts]", message);
    return Response.json(
      {
        error: "tts_failed",
        message: "読み上げ音声をつくれませんでした。もう一度どうぞ。",
      },
      { status: 502, headers: NO_STORE },
    );
  }
}
