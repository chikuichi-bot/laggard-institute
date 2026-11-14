/**
 * Native iOS が見知らぬ駅 API を叩くときの端末トークン。
 * Cursor Apps の identity ヘッダが無い代わりに使う。
 * 本番では MISHIRANU_DEVICE_TOKEN を優先。未設定時は内蔵トークン（Lagado 私用）。
 */
import type { VerifiedIdentity } from "../cursor/identity";
import { getIdentity } from "../cursor/identity";

const BUILTIN_IOS_DEVICE_TOKEN = "mishiranu-ios-lagado-2026";
const DEVICE_SUB = "device:ios";

export type StationViewer = {
  sub: string;
  via: "identity" | "device";
};

function expectedDeviceToken(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.MISHIRANU_DEVICE_TOKEN?.trim()
      : "";
  return fromEnv || BUILTIN_IOS_DEVICE_TOKEN;
}

function headerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    return token || null;
  }
  const custom = request.headers.get("x-mishiranu-device-token")?.trim();
  return custom || null;
}

export function acceptDeviceToken(request: Request): StationViewer | null {
  const token = headerToken(request);
  if (!token) return null;
  if (token !== expectedDeviceToken()) return null;
  return { sub: DEVICE_SUB, via: "device" };
}

/** Cursor identity、なければ端末トークン。どちらも無ければ 401 Response。 */
export async function requireStationViewer(
  request: Request,
): Promise<StationViewer | Response> {
  const identity = await getIdentity(request);
  if (identity.verified) {
    return { sub: identity.sub, via: "identity" };
  }
  const device = acceptDeviceToken(request);
  if (device) return device;
  return Response.json(
    {
      error: "unauthorized",
      reason: identity.reason,
      message: "サインイン、または端末トークンが必要です。",
    },
    { status: 401, headers: { "cache-control": "private, no-store" } },
  );
}

/** 型ガード用（identity の VerifiedIdentity をそのまま使う場合） */
export function asVerifiedSub(identity: VerifiedIdentity): string {
  return identity.sub;
}
