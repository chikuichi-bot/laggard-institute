/**
 * 見知らぬ駅 · 課金（道Aコイン / 道B BYOK）
 * 正本: docs/MONETIZATION.md
 */

export const FREE_STARTER_COINS = 3;

export type CoinPack = {
  id: string;
  productId: string;
  label: string;
  coins: number;
  priceYen: number;
};

export const COIN_PACKS: CoinPack[] = [
  {
    id: "coins5",
    productId: "jp.lagado.mishiranueki.coins5",
    label: "入門",
    coins: 5,
    priceYen: 200,
  },
  {
    id: "coins10",
    productId: "jp.lagado.mishiranueki.coins10",
    label: "小",
    coins: 10,
    priceYen: 370,
  },
  {
    id: "coins30",
    productId: "jp.lagado.mishiranueki.coins30",
    label: "中",
    coins: 30,
    priceYen: 980,
  },
  {
    id: "coins50",
    productId: "jp.lagado.mishiranueki.coins50",
    label: "大",
    coins: 50,
    priceYen: 1500,
  },
];

export const BYOK_PRODUCT = {
  id: "unlock_byok",
  productId: "jp.lagado.mishiranueki.unlock_byok",
  label: "自分の API で使い放題",
  priceYen: 980,
} as const;

/** 買い切りで使える自分の AI。Gemini でも OpenAI 互換でもよい。 */
export type ByokProvider = "gemini" | "openai";

export const BYOK_PROVIDERS: Array<{
  id: ByokProvider;
  label: string;
  hint: string;
}> = [
  {
    id: "gemini",
    label: "Gemini",
    hint: "Google AI Studio の API キー",
  },
  {
    id: "openai",
    label: "OpenAI 互換",
    hint: "OpenAI / OpenRouter / ほか Chat Completions 互換",
  },
];

export const DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

const STORAGE_KEY = "mishiranu.billing.v1";
/** 試作中はコイン経路で見る。買い切りフラグを一度だけ落とす。 */
const FORCE_COIN_MODE_KEY = "mishiranu.billing.forceCoinMode.20261111";

export type BillingState = {
  coins: number;
  freeGranted: boolean;
  byokUnlocked: boolean;
  /** 買い切り＋API設定済みでもコイン経路を選ぶ */
  preferCoinOverByok: boolean;
  /** 端末内のみ */
  byokProvider: ByokProvider;
  apiKey: string;
  /** OpenAI 互換のとき。末尾スラッシュなしの /v1 まで */
  apiBaseUrl: string;
  apiModel: string;
};

/** サーバーへ渡す BYOK 設定（保存しない） */
export type UserAiConfig = {
  provider: ByokProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
};

function defaultState(): BillingState {
  return {
    coins: 0,
    freeGranted: false,
    byokUnlocked: false,
    preferCoinOverByok: false,
    byokProvider: "gemini",
    apiKey: "",
    apiBaseUrl: DEFAULT_OPENAI_BASE,
    apiModel: DEFAULT_OPENAI_MODEL,
  };
}

export function loadBillingState(): BillingState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Partial<BillingState>)
      : null;
    const provider: ByokProvider =
      parsed?.byokProvider === "openai" ? "openai" : "gemini";
    let state = ensureFreeStarter({
      coins: typeof parsed?.coins === "number" ? Math.max(0, parsed.coins) : 0,
      freeGranted: parsed?.freeGranted === true,
      byokUnlocked: parsed?.byokUnlocked === true,
      preferCoinOverByok: parsed?.preferCoinOverByok === true,
      byokProvider: provider,
      apiKey: typeof parsed?.apiKey === "string" ? parsed.apiKey : "",
      apiBaseUrl:
        typeof parsed?.apiBaseUrl === "string" && parsed.apiBaseUrl.trim()
          ? parsed.apiBaseUrl.trim().replace(/\/$/, "")
          : DEFAULT_OPENAI_BASE,
      apiModel:
        typeof parsed?.apiModel === "string" && parsed.apiModel.trim()
          ? parsed.apiModel.trim()
          : DEFAULT_OPENAI_MODEL,
    });
    // いまはコイン利用のてい。試作でオンにした買い切りを一度だけ外す。
    if (window.localStorage.getItem(FORCE_COIN_MODE_KEY) !== "1") {
      state = { ...state, byokUnlocked: false, apiKey: "" };
      if (state.coins < 1) {
        state = { ...state, coins: FREE_STARTER_COINS };
      }
      window.localStorage.setItem(FORCE_COIN_MODE_KEY, "1");
      saveBillingState(state);
    }
    return state;
  } catch {
    return ensureFreeStarter(defaultState());
  }
}

export function saveBillingState(state: BillingState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureFreeStarter(state: BillingState): BillingState {
  if (state.freeGranted) return state;
  return {
    ...state,
    coins: state.coins + FREE_STARTER_COINS,
    freeGranted: true,
  };
}

export function isByokConfigured(state: BillingState): boolean {
  if (!state.byokUnlocked) return false;
  if (state.apiKey.trim().length < 8) return false;
  if (state.byokProvider === "openai") {
    return state.apiBaseUrl.trim().startsWith("http");
  }
  return true;
}

/** 今回の生成で自分の API を使うか（コイン不要）。 */
export function usesByokForGeneration(state: BillingState): boolean {
  return (
    state.byokUnlocked &&
    isByokConfigured(state) &&
    !state.preferCoinOverByok
  );
}

export function billingModeLabel(state: BillingState): string {
  if (usesByokForGeneration(state)) {
    return `自分の API（${state.byokProvider === "openai" ? "OpenAI互換" : "Gemini"}）`;
  }
  if (state.byokUnlocked && isByokConfigured(state) && state.preferCoinOverByok) {
    return "コインで案内（買い切りと併用）";
  }
  if (state.byokUnlocked && !isByokConfigured(state)) {
    return "コインで案内 · API 未設定でも可";
  }
  return "コインで案内を生成";
}

export function userAiConfigFromBilling(
  state: BillingState,
): UserAiConfig | null {
  if (!usesByokForGeneration(state)) return null;
  if (state.byokProvider === "openai") {
    return {
      provider: "openai",
      apiKey: state.apiKey.trim(),
      baseUrl: state.apiBaseUrl.trim().replace(/\/$/, "") || DEFAULT_OPENAI_BASE,
      model: state.apiModel.trim() || DEFAULT_OPENAI_MODEL,
    };
  }
  return {
    provider: "gemini",
    apiKey: state.apiKey.trim(),
  };
}

/** 自分の API 利用時は消費なし。それ以外（買い切り後のコイン選択含む）は1コイン。 */
export function tryConsumeGenerationCoin(state: BillingState): {
  ok: boolean;
  next: BillingState;
  usedCoin: boolean;
  reason?: string;
} {
  if (usesByokForGeneration(state)) {
    return { ok: true, next: state, usedCoin: false };
  }
  if (state.coins < 1) {
    let reason = "コインが足りません。設定の「料金」から補充できます。";
    if (state.byokUnlocked && isByokConfigured(state)) {
      reason =
        "コインが足りません。自分の API に切り替えるか、設定の「料金」から補充できます。";
    } else if (state.byokUnlocked) {
      reason =
        "コインが足りません。API を設定するか、設定の「料金」から補充できます。";
    }
    return { ok: false, next: state, usedCoin: false, reason };
  }
  return {
    ok: true,
    next: { ...state, coins: state.coins - 1 },
    usedCoin: true,
  };
}

export function refundGenerationCoin(
  state: BillingState,
  usedCoin = true,
): BillingState {
  if (!usedCoin) return state;
  return { ...state, coins: state.coins + 1 };
}

export function setPreferCoinOverByok(
  state: BillingState,
  preferCoinOverByok: boolean,
): BillingState {
  return { ...state, preferCoinOverByok };
}

export function grantCoinPack(
  state: BillingState,
  packId: string,
): BillingState {
  const pack = COIN_PACKS.find((p) => p.id === packId);
  if (!pack) return state;
  return { ...state, coins: state.coins + pack.coins };
}

export function unlockByok(state: BillingState): BillingState {
  return { ...state, byokUnlocked: true };
}

export function setBillingApiKey(
  state: BillingState,
  apiKey: string,
): BillingState {
  return { ...state, apiKey };
}

export function setByokProvider(
  state: BillingState,
  byokProvider: ByokProvider,
): BillingState {
  return { ...state, byokProvider };
}

export function setByokOpenAiSettings(
  state: BillingState,
  patch: { apiBaseUrl?: string; apiModel?: string },
): BillingState {
  return {
    ...state,
    apiBaseUrl:
      patch.apiBaseUrl !== undefined
        ? patch.apiBaseUrl.trim().replace(/\/$/, "") || DEFAULT_OPENAI_BASE
        : state.apiBaseUrl,
    apiModel:
      patch.apiModel !== undefined
        ? patch.apiModel.trim() || DEFAULT_OPENAI_MODEL
        : state.apiModel,
  };
}

export function formatYen(yen: number): string {
  return `¥${yen.toLocaleString("ja-JP")}`;
}
