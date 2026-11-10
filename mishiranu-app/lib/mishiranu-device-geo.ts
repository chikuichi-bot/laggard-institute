/**
 * Device GPS for 見知らぬ駅.
 * iOS Safari requires getCurrentPosition to start in the same user-gesture turn.
 * Call startDevicePosition() synchronously from the click handler before setState.
 */

export type DeviceCoords = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

export type DeviceGeoFailure =
  | "secure"
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unknown";

export class DeviceGeoError extends Error {
  readonly failure: DeviceGeoFailure;

  constructor(failure: DeviceGeoFailure, message?: string) {
    super(message ?? failure);
    this.name = "DeviceGeoError";
    this.failure = failure;
  }
}

function nativeBridge():
  | { isNativePlatform: () => boolean }
  | undefined {
  if (typeof window === "undefined") return undefined;
  const cap = (
    window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean };
    }
  ).Capacitor;
  if (!cap || typeof cap.isNativePlatform !== "function") return undefined;
  return { isNativePlatform: () => Boolean(cap.isNativePlatform?.()) };
}

function mapBrowserError(err: unknown): DeviceGeoError {
  const code =
    err && typeof err === "object" && "code" in err
      ? Number((err as { code: number }).code)
      : NaN;
  if (code === 1) return new DeviceGeoError("denied");
  if (code === 2) return new DeviceGeoError("unavailable");
  if (code === 3) return new DeviceGeoError("timeout");
  return new DeviceGeoError("unknown");
}

function readBrowserPosition(options: PositionOptions): Promise<DeviceCoords> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy:
            typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
        });
      },
      (err) => reject(mapBrowserError(err)),
      options,
    );
  });
}

async function readNativePosition(
  options: PositionOptions,
): Promise<DeviceCoords> {
  const { Geolocation } = await import("@capacitor/geolocation");
  try {
    const current = await Geolocation.checkPermissions();
    if (current.location !== "granted") {
      const asked = await Geolocation.requestPermissions({
        permissions: ["location", "coarseLocation"],
      });
      if (asked.location !== "granted") {
        throw new DeviceGeoError("denied");
      }
    }
  } catch (err) {
    if (err instanceof DeviceGeoError) throw err;
    // Some platforms throw when Location Services are off.
    throw new DeviceGeoError("unavailable");
  }

  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 15_000,
      maximumAge: options.maximumAge ?? 60_000,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy:
        typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
    };
  } catch (err) {
    throw mapBrowserError(err);
  }
}

/**
 * Start a location read. Must be invoked synchronously from a click/tap handler
 * on iOS Safari (before awaits / React state updates).
 */
export function startDevicePosition(
  options?: PositionOptions,
): Promise<DeviceCoords> {
  if (typeof window === "undefined") {
    return Promise.reject(new DeviceGeoError("unsupported"));
  }
  if (!window.isSecureContext) {
    return Promise.reject(new DeviceGeoError("secure"));
  }

  const bridge = nativeBridge();
  if (bridge?.isNativePlatform()) {
    return readNativePosition({
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 60_000,
      ...options,
    });
  }

  if (!navigator.geolocation) {
    return Promise.reject(new DeviceGeoError("unsupported"));
  }

  const primary: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 12_000,
    maximumAge: 60_000,
    ...options,
  };

  // Kick off getCurrentPosition in this synchronous turn.
  const first = readBrowserPosition(primary);
  return first.catch((err: unknown) => {
    if (err instanceof DeviceGeoError && err.failure === "denied") {
      throw err;
    }
    // Desktop / Preview often reject high-accuracy GPS; retry quietly.
    return readBrowserPosition({
      enableHighAccuracy: false,
      timeout: 20_000,
      maximumAge: 120_000,
    });
  });
}

export function geoFailureMessage(failure: DeviceGeoFailure): string {
  switch (failure) {
    case "secure":
      return "位置情報は https か localhost でのみ使えます。駅名で探してください。";
    case "unsupported":
      return "この端末では現在地が使えません。駅名を入力するか、「駅名で探す」から選んでください。";
    case "denied":
      return "位置情報の許可がオフです。iPhoneなら「設定 → プライバシーとセキュリティ → 位置情報サービス」でオンにし、Safari（またはこのアプリ）を「使用中のみ許可／確認」にしてから、もう一度「現在地で駅を探す」を押してください。駅名でも探せます。";
    case "timeout":
      return "現在地の確認がタイムアウトしました。もう一度試すか、駅名で探してください。";
    case "unavailable":
      return "いま位置が取れませんでした。屋外でもう一度試すか、駅名で探してください。";
    default:
      return "現在地を取得できませんでした。駅名で探すか、もう一度どうぞ。";
  }
}
