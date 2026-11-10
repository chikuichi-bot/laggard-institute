"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  GUIDE_COLOR,
  GUIDE_LABEL,
  GUIDE_ORDER,
  MEAL_TIER_LABEL,
  SOLO_OK_LABEL,
  STATIONS,
  TIME_OPTIONS,
  bikeRentalFor,
  budgetYenFor,
  hoursFor,
  mealTierFor,
  pickSecret,
  soloOkFor,
  spotGuide,
  spotsForTime,
  type GuideKind,
  type Spot,
  type StationSeed,
  type TimeOptionId,
} from "@/data/mishiranu-stations";
import type { TourCopy } from "@/lib/mishiranu-copy";
import {
  BUDGET_PREF_OPTIONS,
  DAY_PART_OPTIONS,
  SOLO_PREF_OPTIONS,
  buildCoursesForStation,
  dayPartFromHour,
  dayPartLabel,
  matchBudgetPref,
  matchDayPart,
  matchSoloPref,
  mealPrefScore,
  type BudgetPref,
  type DayPart,
  type MealPrefs,
  type SoloPref,
  type WalkCourse,
} from "@/lib/mishiranu-courses";
import { paragraphsFrom, withAreaDepth } from "@/lib/mishiranu-area-depth";
import { findNearestStation } from "@/lib/mishiranu-geo";
import {
  CourseIcon,
  DayPartIcon,
  GuideKindIcon,
  IconBinoculars,
  IconBike,
  IconClock,
  IconHistory,
  IconLocate,
  IconSearch,
  IconSpark,
  IconTour,
  IconWalk,
  StayIcon,
} from "./MishiranuIcons";
import "./mishiranu.css";

const StationMap = dynamic(() => import("./StationMap"), {
  ssr: false,
  loading: () => (
    <div className="mishiranu-map mishiranu-map--live" aria-hidden="true">
      <div className="mishiranu-leaflet" />
    </div>
  ),
});

type Step = "hero" | "pick" | "tour";
type ChatPhase =
  | "station"
  | "clock"
  | "stay"
  | "mealSolo"
  | "mealBudget"
  | "course"
  | "ready";

/** iPhone-friendly tour pages (bottom tabs) */
type TourTab = "map" | "course" | "guide" | "place" | "more";

const TOUR_TABS: Array<{
  id: TourTab;
  label: string;
}> = [
  { id: "map", label: "地図" },
  { id: "place", label: "土地" },
  { id: "course", label: "歩く" },
  { id: "guide", label: "案内" },
  { id: "more", label: "ほか" },
];

function mealMetaLine(spot: Spot): string {
  const solo = soloOkFor(spot) ? SOLO_OK_LABEL.yes : SOLO_OK_LABEL.no;
  return `${solo} · ${budgetYenFor(spot)} · ${MEAL_TIER_LABEL[mealTierFor(spot)]}`;
}

type ChatMsg = {
  id: string;
  role: "guide" | "you";
  text: string;
};

function seedTourCopy(station: StationSeed): TourCopy {
  return {
    tourTitle: station.tourTitle,
    catchCopy: station.catchCopy,
    emptyHeadline: station.emptyCopy?.headline,
    emptyBody: station.emptyCopy?.body,
    source: "seed",
  };
}

function parseFocusList(raw: string[] | undefined): GuideKind[] {
  if (!raw || raw.length === 0) return [];
  const allowed = new Set<GuideKind>(GUIDE_ORDER);
  return raw.filter((f): f is GuideKind => allowed.has(f as GuideKind));
}

function matchStation(text: string): StationSeed | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const byName = STATIONS.find(
    (s) => t.includes(s.name) || s.name.includes(t.replace(/駅$/, "")),
  );
  if (byName) return byName;
  return STATIONS.find(
    (s) =>
      t.includes(s.prefecture) ||
      t.includes(s.line) ||
      s.line.split(/[\/・]/).some((part) => part && t.includes(part.trim())),
  );
}

function matchTime(text: string): TimeOptionId | undefined {
  const t = text.trim();
  if (/半日|午後いっぱい|半にち/.test(t)) return "half";
  if (/3\s*時間|三時間|さんじかん|半日未満|ゆっくり/.test(t)) return "3h";
  if (/1\s*時間|一時間|ひと時間|ちょっと|短め|すぐ/.test(t)) return "1h";
  const hit = TIME_OPTIONS.find((opt) => t.includes(opt.label));
  return hit?.id;
}

type Props = {
  initialStep?: Step;
  initialStationId?: string;
  initialTimeId?: TimeOptionId;
  initialFocus?: string[];
};

let chatSeq = 0;
function nextMsgId(prefix: string) {
  chatSeq += 1;
  return `${prefix}-${chatSeq}`;
}

const OPENING_GUIDE =
  "知らない駅に到着しましたね。まず現在地から最寄りの駅名を探すか、駅名を教えてください。見つかったら、いま何時か・滞在・ご飯は一人で入れるか／予算を聞いて、3つのコースを組み立てます。";

export default function MishiranuApp({
  initialStep = "hero",
  initialStationId,
  initialTimeId = "1h",
  initialFocus,
}: Props) {
  const startStationId =
    initialStationId && STATIONS.some((s) => s.id === initialStationId)
      ? initialStationId
      : STATIONS[0].id;

  const [step, setStep] = useState<Step>(initialStep);
  const [stationId, setStationId] = useState<string>(startStationId);
  const [dynamicStation, setDynamicStation] = useState<StationSeed | null>(null);
  const [stationLoading, setStationLoading] = useState(false);
  const [timeId, setTimeId] = useState<TimeOptionId>(initialTimeId);
  const [focusKinds, setFocusKinds] = useState<GuideKind[]>(() =>
    parseFocusList(initialFocus),
  );
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [showStationSearch, setShowStationSearch] = useState(false);
  const [chatPhase, setChatPhase] = useState<ChatPhase>("station");
  const [messages, setMessages] = useState<ChatMsg[]>(() => [
    {
      id: "g-open",
      role: "guide",
      text: OPENING_GUIDE,
    },
  ]);
  const [dayPart, setDayPart] = useState<DayPart>(() =>
    dayPartFromHour(new Date().getHours()),
  );
  const [courses, setCourses] = useState<WalkCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<WalkCourse | null>(null);
  const [mealSolo, setMealSolo] = useState<SoloPref>("either");
  const [mealBudget, setMealBudget] = useState<BudgetPref>("either");
  const [geoLoading, setGeoLoading] = useState(false);
  const mealSoloRef = useRef(mealSolo);
  const mealBudgetRef = useRef(mealBudget);
  mealSoloRef.current = mealSolo;
  mealBudgetRef.current = mealBudget;
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [tourTab, setTourTab] = useState<TourTab>("map");
  const [guideTab, setGuideTab] = useState<GuideKind>("sight");
  const [spotSheetOpen, setSpotSheetOpen] = useState(false);
  const [secret, setSecret] = useState<Spot | null>(null);
  const [secretOpen, setSecretOpen] = useState(false);
  const [copy, setCopy] = useState<TourCopy | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);
  const stationIdRef = useRef(stationId);
  const timeIdRef = useRef(timeId);
  const dynamicStationRef = useRef<StationSeed | null>(null);
  const urlBootstrapped = useRef(false);
  stationIdRef.current = stationId;
  timeIdRef.current = timeId;
  dynamicStationRef.current = dynamicStation;

  const station = useMemo(() => {
    const raw =
      dynamicStation && dynamicStation.id === stationId
        ? dynamicStation
        : (STATIONS.find((s) => s.id === stationId) ?? STATIONS[0]);
    return withAreaDepth(raw);
  }, [stationId, dynamicStation]);
  const bikeRental = useMemo(() => bikeRentalFor(station), [station]);
  const areaParagraphs = useMemo(
    () => paragraphsFrom(station.areaAbout),
    [station.areaAbout],
  );

  // Static host (lagado.jp) では searchParams がビルド時固定なので、URL をクライアントで読む
  useEffect(() => {
    if (urlBootstrapped.current) return;
    urlBootstrapped.current = true;
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const stationParam = params.get("station");
    const timeParam = params.get("time");
    const focusParam = params.get("focus");
    if (view === "hero" || view === "pick" || view === "tour") {
      setStep(view);
    }
    if (stationParam && STATIONS.some((s) => s.id === stationParam)) {
      setStationId(stationParam);
    }
    if (timeParam === "1h" || timeParam === "3h" || timeParam === "half") {
      setTimeId(timeParam);
    }
    if (focusParam) {
      setFocusKinds(
        parseFocusList(
          focusParam.split(",").map((f) => f.trim()).filter(Boolean),
        ),
      );
    }
  }, []);

  const filteredStations = useMemo(() => {
    const q = query.trim();
    return STATIONS.filter((s) => {
      if (!q) return true;
      return (
        s.name.includes(q) ||
        s.prefecture.includes(q) ||
        s.line.includes(q) ||
        s.tourTitle.includes(q)
      );
    }).slice(0, 8);
  }, [query]);

  const time = TIME_OPTIONS.find((t) => t.id === timeId) ?? TIME_OPTIONS[0];
  const mealPrefs = useMemo<MealPrefs>(
    () => ({ solo: mealSolo, budget: mealBudget }),
    [mealSolo, mealBudget],
  );
  // ご飯・お土産・観光・休むところ・寄り道は常に全部出す（コース選択時は立ち寄り順を優先）
  const spots = useMemo(() => {
    const base = spotsForTime(station, time.index);
    if (!selectedCourse || selectedCourse.stops.length === 0) return base;
    const byId = new Map(base.map((s) => [s.id, s]));
    const ordered: Spot[] = [];
    for (const stop of selectedCourse.stops) {
      const hit = byId.get(stop.spotId);
      if (hit) {
        ordered.push(hit);
        byId.delete(stop.spotId);
      }
    }
    for (const rest of byId.values()) ordered.push(rest);
    return ordered;
  }, [station, time.index, selectedCourse]);
  const courseStopIds = useMemo(
    () =>
      selectedCourse && selectedCourse.stops.length > 0
        ? selectedCourse.stops.map((stop) => stop.spotId)
        : null,
    [selectedCourse],
  );
  const activeSpot =
    spots.find((s) => s.id === activeSpotId) ??
    (activeSpotId ? null : spots[0] ?? null);
  const shownCopy = copy ?? seedTourCopy(station);

  function scrollChatToLatest() {
    const thread = chatThreadRef.current;
    if (!thread) return;
    // Instant jump inside the thread only — smooth + window scrollIntoView hides
    // the newest bubble under the dock on Safari.
    thread.scrollTop = thread.scrollHeight;
  }

  useLayoutEffect(() => {
    if (step !== "pick") return;
    scrollChatToLatest();
    const t1 = window.setTimeout(scrollChatToLatest, 40);
    const t2 = window.setTimeout(scrollChatToLatest, 280);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [messages, showStationSearch, chatPhase, step]);

  function tapChoice(action: () => void) {
    return (event: MouseEvent<HTMLButtonElement>) => {
      event.currentTarget.blur();
      action();
    };
  }

  async function loadCopy(nextStation: StationSeed, nextTimeId: TimeOptionId) {
    setCopyLoading(true);
    setCopy(seedTourCopy(nextStation));
    if (nextStation.source === "ai" || nextStation.id.startsWith("ai-")) {
      setCopyLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/mishiranu/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId: nextStation.id,
          timeId: nextTimeId,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as TourCopy;
      if (data.tourTitle && data.catchCopy) {
        setCopy(data);
      }
    } catch {
      // keep seed fallback
    } finally {
      setCopyLoading(false);
    }
  }

  useEffect(() => {
    if (step !== "tour") return;
    void loadCopy(station, timeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when entering tour via URL/state
  }, [step, stationId, timeId]);

  function pushMessages(...next: Omit<ChatMsg, "id">[]) {
    setMessages((prev) => [
      ...prev,
      ...next.map((m) => ({ ...m, id: nextMsgId(m.role) })),
    ]);
  }

  function syncUrl(
    nextStep: Step,
    nextStationId: string,
    nextTimeId: TimeOptionId,
    kinds: GuideKind[],
  ) {
    const params = new URLSearchParams();
    params.set("view", nextStep);
    if (nextStep === "tour") {
      params.set("station", nextStationId);
      params.set("time", nextTimeId);
      if (kinds.length > 0) params.set("focus", kinds.join(","));
    }
    window.history.pushState({}, "", `?${params.toString()}`);
  }

  function goHero() {
    setStep("hero");
    syncUrl("hero", stationIdRef.current, timeIdRef.current, focusKinds);
  }

  function goChat(reset = false) {
    setStep("pick");
    if (reset) {
      setChatPhase("station");
      setShowStationSearch(false);
      setStationLoading(false);
      setGeoLoading(false);
      setDynamicStation(null);
      setCourses([]);
      setSelectedCourse(null);
      setMealSolo("either");
      setMealBudget("either");
      setDayPart(dayPartFromHour(new Date().getHours()));
      setQuery("");
      setDraft("");
      setMessages([
        {
          id: nextMsgId("guide"),
          role: "guide",
          text: OPENING_GUIDE,
        },
      ]);
    }
    syncUrl("pick", stationIdRef.current, timeIdRef.current, focusKinds);
  }

  function chooseStation(
    next: StationSeed,
    spoken?: string,
    opts?: { omitYou?: boolean },
  ) {
    if (next.source === "ai" || next.id.startsWith("ai-")) {
      setDynamicStation(next);
    } else {
      setDynamicStation(null);
    }
    setStationId(next.id);
    setShowStationSearch(false);
    setQuery("");
    setDraft("");
    setCourses([]);
    setSelectedCourse(null);
    setMealSolo("either");
    setMealBudget("either");
    setChatPhase("clock");
    const aiNote =
      next.source === "ai"
        ? " Gemini が徒歩圏の下地をつくりました。時間は目安なので、現地でも確認を。"
        : "";
    const guideText = `${next.name}ですね。${next.prefecture}・${next.line}。${aiNote}いま何時ごろですか？ 時刻に合わせてコースを組み立てます。`;
    if (opts?.omitYou) {
      pushMessages({ role: "guide", text: guideText });
    } else {
      pushMessages(
        { role: "you", text: spoken ?? `${next.name}駅です` },
        { role: "guide", text: guideText },
      );
    }
  }

  function readDevicePosition(options: PositionOptions) {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  async function locateHere() {
    if (geoLoading || stationLoading) return;
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setShowStationSearch(true);
      pushMessages({
        role: "guide",
        text: "位置情報は https か localhost でのみ使えます。Ports の Open in Browser か、駅名で探してください。",
      });
      return;
    }
    if (!navigator.geolocation) {
      setShowStationSearch(true);
      pushMessages({
        role: "guide",
        text: "この端末では現在地が使えません。駅名を入力するか、「駅名で探す」から選んでください。",
      });
      return;
    }
    setGeoLoading(true);
    pushMessages(
      { role: "you", text: "現在地から駅を探す" },
      {
        role: "guide",
        text: "いまの位置から、いちばん近い駅名を調べています…",
      },
    );
    try {
      let position: GeolocationPosition;
      try {
        position = await readDevicePosition({
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 60_000,
        });
      } catch {
        // Desktop / Preview often reject high-accuracy GPS; retry quietly.
        position = await readDevicePosition({
          enableHighAccuracy: false,
          timeout: 20_000,
          maximumAge: 120_000,
        });
      }
      const { latitude: lat, longitude: lng } = position.coords;
      // Precise GPS never leaves the browser. Only curated matching runs locally.
      const local = findNearestStation(lat, lng, STATIONS);
      if (local && local.km <= 3.5) {
        chooseStation(
          local.station,
          `現在地（${local.station.name}・約${local.km < 1 ? `${Math.round(local.km * 1000)}m` : `${local.km.toFixed(1)}km`}）`,
          { omitYou: true },
        );
        return;
      }

      // Far from curated stations: do not upload coordinates. Ask for a name.
      setShowStationSearch(true);
      const nearestHint = local
        ? `いちばん近い編集駅は${local.station.name}（約${local.km < 1 ? `${Math.round(local.km * 1000)}m` : `${local.km.toFixed(1)}km`}）ですが、徒歩圏外です。`
        : "";
      pushMessages({
        role: "guide",
        text:
          `${nearestHint}位置情報は端末の外に送っていません。駅名を入力するか、「駅名で探す」から選んでください。`.trim(),
      });
    } catch (err) {
      setShowStationSearch(true);
      const code =
        err && typeof err === "object" && "code" in err
          ? Number((err as { code: number }).code)
          : NaN;
      const denied = code === 1;
      const unavailable = code === 2;
      const timedOut = code === 3;
      pushMessages({
        role: "guide",
        text: denied
          ? "位置情報の許可が必要です。ブラウザで許可するか、駅名で探してください。"
          : timedOut
            ? "現在地の確認がタイムアウトしました。もう一度試すか、駅名で探してください。"
            : unavailable
              ? "このプレビューでは位置が取れないことがあります。Ports の Open in Browser、または実機の Safari で開くか、駅名で探してください。"
              : "現在地を取得できませんでした。駅名で探すか、もう一度どうぞ。",
      });
    } finally {
      setGeoLoading(false);
    }
  }

  function chooseClock(next: DayPart, spoken?: string) {
    setDayPart(next);
    setDraft("");
    setChatPhase("stay");
    pushMessages(
      { role: "you", text: spoken ?? `${dayPartLabel(next)}ごろ` },
      {
        role: "guide",
        text: `${dayPartLabel(next)}ですね。どのくらい滞在する予定ですか？`,
      },
    );
  }

  function chooseStay(nextId: TimeOptionId, spoken?: string) {
    const t = TIME_OPTIONS.find((opt) => opt.id === nextId) ?? TIME_OPTIONS[0];
    setTimeId(t.id);
    setDraft("");
    setCourses([]);
    setSelectedCourse(null);
    setChatPhase("mealSolo");
    pushMessages(
      { role: "you", text: spoken ?? `${t.label}くらい` },
      {
        role: "guide",
        text: `${t.label}ですね。ご飯屋は、一人で入りたいですか？`,
      },
    );
  }

  function chooseMealSolo(next: SoloPref, spoken?: string) {
    setMealSolo(next);
    setDraft("");
    setChatPhase("mealBudget");
    const label =
      SOLO_PREF_OPTIONS.find((o) => o.id === next)?.label ?? next;
    pushMessages(
      { role: "you", text: spoken ?? label },
      {
        role: "guide",
        text: "予算の目安はどれくらいですか？",
      },
    );
  }

  function chooseMealBudget(next: BudgetPref, spoken?: string) {
    setMealBudget(next);
    setDraft("");
    const prefs: MealPrefs = {
      solo: mealSoloRef.current,
      budget: next,
    };
    const current =
      dynamicStationRef.current?.id === stationIdRef.current
        ? dynamicStationRef.current
        : (STATIONS.find((s) => s.id === stationIdRef.current) ?? station);
    const built = buildCoursesForStation(
      current,
      timeIdRef.current,
      dayPart,
      prefs,
    );
    setCourses(built);
    setSelectedCourse(null);
    setChatPhase("course");
    const label =
      BUDGET_PREF_OPTIONS.find((o) => o.id === next)?.label ?? next;
    const soloLabel =
      SOLO_PREF_OPTIONS.find((o) => o.id === prefs.solo)?.label ?? prefs.solo;
    pushMessages(
      { role: "you", text: spoken ?? label },
      {
        role: "guide",
        text:
          built.length > 0
            ? `${dayPartLabel(dayPart)}・${TIME_OPTIONS.find((t) => t.id === timeIdRef.current)?.label ?? ""}・${soloLabel}・${label}向けに、${built.length}つのコースを用意しました。選ぶか、「コースは作らない」でも進めます。`
            : "この条件ではコースを組めませんでした。滞在時間を変えるか、「コースは作らない」で案内だけ開いてください。",
      },
    );
  }

  function chooseCourse(course: WalkCourse, spoken?: string) {
    const nextStationId = stationIdRef.current;
    const nextTimeId = timeIdRef.current;
    setSelectedCourse(course);
    setFocusKinds([]);
    setDraft("");
    setChatPhase("ready");
    setTourTab("course");
    const named =
      (dynamicStationRef.current?.id === nextStationId
        ? dynamicStationRef.current.name
        : null) ??
      STATIONS.find((s) => s.id === nextStationId)?.name ??
      station.name;
    pushMessages(
      { role: "you", text: spoken ?? course.title },
      {
        role: "guide",
        text: `「${course.title}」で、${named}の案内を開きます。立ち寄りは${course.stopCount}か所、だいたい${course.totalMinutes}分の想定です。`,
      },
    );
    window.setTimeout(() => {
      goTour(nextStationId, nextTimeId, [], "course");
    }, 450);
  }

  function skipCourse(spoken?: string) {
    const nextStationId = stationIdRef.current;
    const nextTimeId = timeIdRef.current;
    setSelectedCourse(null);
    setFocusKinds([]);
    setDraft("");
    setChatPhase("ready");
    setTourTab("map");
    const named =
      (dynamicStationRef.current?.id === nextStationId
        ? dynamicStationRef.current.name
        : null) ??
      STATIONS.find((s) => s.id === nextStationId)?.name ??
      station.name;
    pushMessages(
      { role: "you", text: spoken ?? "コースは作らない" },
      {
        role: "guide",
        text: `コースなしで、${named}の案内を開きます。地図と観光から、好きなだけ寄り道してください。`,
      },
    );
    window.setTimeout(() => {
      goTour(nextStationId, nextTimeId, [], "map");
    }, 450);
  }

  function matchesSkipCourse(text: string): boolean {
    const t = text.trim();
    return (
      /コース\s*(は)?\s*(作らない|なし|要らない|いらない)/u.test(t) ||
      /^(なし|作らない|スキップ|フリー|自由に|行程なし)$/u.test(t)
    );
  }

  function stationLookupErrorMessage(
    status: number,
    data: { error?: string; message?: string; reason?: string },
    raw: string,
  ): string {
    if (data.message) return data.message;
    if (
      data.error === "sign_in_required" ||
      data.error === "unauthorized" ||
      data.reason === "missing_header"
    ) {
      return "サインインが必要です。ページを再読み込みしてから、もう一度どうぞ。";
    }
    if (
      data.error === "rate_limited" ||
      /too many requests/i.test(raw)
    ) {
      return "いま混み合っています。少し待ってから、もう一度どうぞ。";
    }
    if (!raw.trim() || status >= 502) {
      return "案内の応答が途切れました。もう一度どうぞ。";
    }
    return "その名前では案内をつくれませんでした。別の駅名でもう一度どうぞ。";
  }

  async function requestAiStation(rawName: string, spoken?: string) {
    const name = rawName.trim();
    if (!name || stationLoading) return;
    setStationLoading(true);
    pushMessages(
      { role: "you", text: spoken ?? `${name}駅です` },
      {
        role: "guide",
        text: `「${name.replace(/駅$/u, "")}」の徒歩圏を、Gemini 3.1 Flash-Lite で調べています…`,
      },
    );
    setDraft("");
    setQuery(name);
    try {
      const res = await fetch("/api/mishiranu/station", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name }),
      });
      const raw = await res.text();
      let data: {
        station?: StationSeed;
        source?: "ai" | "seed";
        error?: string;
        message?: string;
        reason?: string;
      } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        pushMessages({
          role: "guide",
          text: stationLookupErrorMessage(res.status, {}, raw),
        });
        return;
      }
      if (!res.ok || !data.station) {
        pushMessages({
          role: "guide",
          text: stationLookupErrorMessage(res.status, data, raw),
        });
        return;
      }
      const next: StationSeed = {
        ...data.station,
        source: data.source ?? data.station.source ?? "ai",
      };
      chooseStation(next, spoken, { omitYou: true });
    } catch {
      pushMessages({
        role: "guide",
        text: "案内の通信に失敗しました。通信状況をみて、もう一度どうぞ。",
      });
    } finally {
      setStationLoading(false);
    }
  }

  function goTour(
    nextStationId: string,
    nextTimeId: TimeOptionId = timeIdRef.current,
    kinds: GuideKind[] = focusKinds,
    openTab?: TourTab,
  ) {
    setStationId(nextStationId);
    setTimeId(nextTimeId);
    setFocusKinds(kinds);
    setActiveSpotId(null);
    setSpotSheetOpen(false);
    setTourTab(openTab ?? "map");
    setGuideTab(kinds[0] ?? "sight");
    setSecret(null);
    setSecretOpen(false);
    setStep("tour");
    setChatPhase("ready");
    syncUrl("tour", nextStationId, nextTimeId, kinds);
  }

  function openSpot(spotId: string, opts?: { tab?: TourTab }) {
    setActiveSpotId(spotId);
    setSpotSheetOpen(true);
    if (opts?.tab) setTourTab(opts.tab);
  }

  function handleComposerSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || chatPhase === "ready") return;

    if (chatPhase === "station") {
      const hit = matchStation(text);
      if (hit) {
        chooseStation(hit, text);
        return;
      }
      void requestAiStation(text, text);
      return;
    }

    if (chatPhase === "clock") {
      const hit = matchDayPart(text);
      if (!hit) {
        pushMessages(
          { role: "you", text },
          {
            role: "guide",
            text: "いまの時間帯は「朝」「昼まえ」「昼すぎ」「夕方」「夜」、または「14時」のように教えてください。",
          },
        );
        setDraft("");
        return;
      }
      chooseClock(hit, text);
      return;
    }

    if (chatPhase === "stay") {
      const hit = matchTime(text);
      if (!hit) {
        pushMessages(
          { role: "you", text },
          {
            role: "guide",
            text: "滞在は「1時間」「3時間」「半日」のどれかで教えてください。",
          },
        );
        setDraft("");
        return;
      }
      chooseStay(hit, text);
      return;
    }

    if (chatPhase === "mealSolo") {
      const hit = matchSoloPref(text);
      if (!hit) {
        pushMessages(
          { role: "you", text },
          {
            role: "guide",
            text: "「一人で入りたい」「人数は気にしない」「みんなで寄りたい」のどれかで教えてください。",
          },
        );
        setDraft("");
        return;
      }
      chooseMealSolo(hit, text);
      return;
    }

    if (chatPhase === "mealBudget") {
      const hit = matchBudgetPref(text);
      if (!hit) {
        pushMessages(
          { role: "you", text },
          {
            role: "guide",
            text: "予算は「気軽に」「少し奮発」「どちらでも」のどれかで教えてください。",
          },
        );
        setDraft("");
        return;
      }
      chooseMealBudget(hit, text);
      return;
    }

    if (chatPhase === "course") {
      if (matchesSkipCourse(text)) {
        skipCourse(text);
        return;
      }
      const hit = courses.find(
        (c) => text.includes(c.title) || c.title.includes(text),
      );
      if (!hit) {
        pushMessages(
          { role: "you", text },
          {
            role: "guide",
            text: "下のコースから選ぶか、「コースは作らない」と入力してください。",
          },
        );
        setDraft("");
        return;
      }
      chooseCourse(hit, text);
    }
  }

  function drawSecret() {
    const next = pickSecret(spots);
    setSecret(next ?? null);
    setSecretOpen(true);
    setTourTab("more");
    if (next) {
      setActiveSpotId(next.id);
      setSpotSheetOpen(true);
    }
  }

  async function shareTour() {
    const lines = [
      `【見知らぬ駅】${station.name}`,
      shownCopy.tourTitle,
      shownCopy.catchCopy,
      `${time.label} · 徒歩圏 約 ${station.radiiKm[time.index]} km`,
    ];
    if (focusKinds.length > 0) {
      lines.push(`案内の重点: ${focusKinds.map((k) => GUIDE_LABEL[k]).join("・")}`);
    }
    if (secret) {
      lines.push(`シークレット: ${secret.name}`);
    }
    const text = lines.join("\n");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareNote("物語テキストをコピーしました");
        return;
      }
    } catch {
      // fall through
    }
    setShareNote(text);
  }

  const composerPlaceholder =
    chatPhase === "station"
      ? "例: 中書島にいます"
      : chatPhase === "clock"
        ? "例: いま14時ごろ / 夕方"
        : chatPhase === "stay"
          ? "例: 3時間くらい"
          : chatPhase === "mealSolo"
            ? "例: 一人で入りたい"
            : chatPhase === "mealBudget"
              ? "例: 気軽に / 少し奮発"
              : chatPhase === "course"
                ? "例: ゆる歩きコース / コースは作らない"
                : "";

  return (
    <div className="mishiranu">
      <div
        className={
          step === "pick" ? "mishiranu-shell mishiranu-shell--chat" : "mishiranu-shell"
        }
      >
        {step === "hero" ? (
          <section className="mishiranu-hero" aria-label="見知らぬ駅">
            <div className="mishiranu-hero-copy">
              <p className="mishiranu-kicker">LAGADO LAB</p>
              <h1 className="mishiranu-brand">見知らぬ駅</h1>
              <p className="mishiranu-lead">
                降りた駅の、徒歩圏だけを、物語にする。予定のない寄り道を、いまここから。
              </p>
              <div className="mishiranu-cta-row">
                <button
                  type="button"
                  className="mishiranu-btn mishiranu-btn--primary"
                  onClick={() => goChat(true)}
                >
                  知らない駅に到着
                </button>
                <button
                  type="button"
                  className="mishiranu-btn"
                  onClick={() => goTour("demachiyanagi", "1h", [])}
                >
                  出町柳ですぐ見る
                </button>
              </div>
              <p className="mishiranu-fallback-links">
                押せないとき:{" "}
                <a href="?view=pick">到着の会話へ</a>
                {" · "}
                <a href="?view=tour&station=demachiyanagi&time=1h">出町柳の物語へ</a>
              </p>
            </div>
          </section>
        ) : null}

        {step === "pick" ? (
          <section className="mishiranu-chat" aria-labelledby="chat-title">
            <header className="mishiranu-chat-head">
              <p className="mishiranu-kicker">ARRIVAL · 編集 {STATIONS.length} 駅</p>
              <h2 id="chat-title" className="mishiranu-h2 mishiranu-h2--chat">
                知らない駅から、コースをつくる
              </h2>
            </header>

            <div
              className="mishiranu-chat-thread"
              role="log"
              aria-live="polite"
              ref={chatThreadRef}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={
                    msg.role === "guide"
                      ? "mishiranu-chat-bubble mishiranu-chat-bubble--guide"
                      : "mishiranu-chat-bubble mishiranu-chat-bubble--you"
                  }
                >
                  <span className="mishiranu-chat-role">
                    {msg.role === "guide" ? "案内" : "あなた"}
                  </span>
                  <p>{msg.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="mishiranu-chat-dock">
              {chatPhase === "station" ? (
                <div className="mishiranu-chat-replies" aria-label="駅の答え">
                  <button
                    type="button"
                    className="mishiranu-chat-chip mishiranu-chat-chip--primary"
                    disabled={geoLoading || stationLoading}
                    onClick={tapChoice(() => void locateHere())}
                  >
                    <IconLocate />
                    {geoLoading ? "現在地を確認中…" : "現在地で駅を探す"}
                  </button>
                  <button
                    type="button"
                    className="mishiranu-chat-chip"
                    onClick={tapChoice(() => setShowStationSearch((v) => !v))}
                  >
                    <IconSearch />
                    駅名で探す
                  </button>
                  {showStationSearch ? (
                    <div className="mishiranu-chat-search">
                      <label className="mishiranu-search">
                        <span className="mishiranu-search-label">駅名・路線</span>
                        <input
                          type="search"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="例: 出町柳 / 叡山 / 京都"
                          autoComplete="off"
                        />
                      </label>
                      <ul className="mishiranu-chat-station-list">
                        {filteredStations.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={tapChoice(() => chooseStation(s))}
                            >
                              <span className="mishiranu-station-name">{s.name}</span>
                              <span className="mishiranu-station-meta">
                                {s.prefecture} · {s.line}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {query.trim() &&
                      filteredStations.length === 0 &&
                      !matchStation(query) ? (
                        <div className="mishiranu-ai-station-ask">
                          <p className="mishiranu-note">
                            編集リストにはありません。Gemini に観光案内を頼めます。
                          </p>
                          <button
                            type="button"
                            className="mishiranu-chat-chip mishiranu-chat-chip--primary"
                            disabled={stationLoading}
                            onClick={tapChoice(() =>
                              void requestAiStation(query.trim()),
                            )}
                          >
                            <IconSpark />
                            {stationLoading
                              ? "案内をつくっています…"
                              : `「${query.trim().replace(/駅$/u, "")}」で案内をつくる`}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {chatPhase === "clock" ? (
                <div className="mishiranu-chat-replies" aria-label="いまの時間帯">
                  <button
                    type="button"
                    className="mishiranu-chat-chip mishiranu-chat-chip--primary"
                    onClick={tapChoice(() =>
                      chooseClock(
                        dayPartFromHour(new Date().getHours()),
                        "いまの時刻で",
                      ),
                    )}
                  >
                    <IconClock />
                    いまの時刻で
                  </button>
                  {DAY_PART_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="mishiranu-chat-chip"
                      onClick={tapChoice(() => chooseClock(opt.id))}
                      title={opt.hint}
                    >
                      <DayPartIcon part={opt.id} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {chatPhase === "stay" ? (
                <div className="mishiranu-chat-replies" aria-label="滞在時間">
                  {TIME_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="mishiranu-chat-chip"
                      onClick={tapChoice(() => chooseStay(t.id))}
                    >
                      <StayIcon id={t.id} />
                      {t.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {chatPhase === "mealSolo" ? (
                <div className="mishiranu-chat-replies" aria-label="一人で入れるか">
                  {SOLO_PREF_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={
                        opt.id === "solo"
                          ? "mishiranu-chat-chip mishiranu-chat-chip--primary"
                          : "mishiranu-chat-chip"
                      }
                      title={opt.hint}
                      onClick={tapChoice(() => chooseMealSolo(opt.id))}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {chatPhase === "mealBudget" ? (
                <div className="mishiranu-chat-replies" aria-label="予算の目安">
                  {BUDGET_PREF_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={
                        opt.id === "casual"
                          ? "mishiranu-chat-chip mishiranu-chat-chip--primary"
                          : "mishiranu-chat-chip"
                      }
                      title={opt.hint}
                      onClick={tapChoice(() => chooseMealBudget(opt.id))}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {chatPhase === "course" ? (
                <div className="mishiranu-course-picks" aria-label="コースの候補">
                  {courses.map((course, index) => (
                    <button
                      key={course.id}
                      type="button"
                      className="mishiranu-course-card"
                      onClick={tapChoice(() => chooseCourse(course))}
                    >
                      <span className="mishiranu-course-card-index">
                        <CourseIcon courseId={course.id} />
                        コース {index + 1}
                      </span>
                      <span className="mishiranu-course-card-title">
                        {course.title}
                      </span>
                      <span className="mishiranu-course-card-sub">
                        {course.subtitle} · 約{course.totalMinutes}分 ·{" "}
                        {course.stopCount}か所
                      </span>
                      <span className="mishiranu-course-card-vibe">
                        {course.vibe}
                      </span>
                      <ol className="mishiranu-course-card-stops">
                        {course.stops.map((stop) => (
                          <li key={stop.spotId}>
                            <span
                              className="mishiranu-guide-kind-icon"
                              style={{ color: GUIDE_COLOR[stop.guide] }}
                            >
                              <GuideKindIcon kind={stop.guide} />
                            </span>
                            {stop.clockLabel ? `${stop.clockLabel} ` : ""}
                            {stop.name}
                          </li>
                        ))}
                      </ol>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="mishiranu-chat-chip mishiranu-course-skip"
                    onClick={tapChoice(() => skipCourse())}
                  >
                    コースは作らない
                  </button>
                </div>
              ) : null}

              {chatPhase === "ready" ? (
                <p className="mishiranu-chat-opening">案内を開いています…</p>
              ) : (
                <form
                  className="mishiranu-chat-composer"
                  onSubmit={handleComposerSubmit}
                >
                  <label className="mishiranu-search">
                    <span className="mishiranu-search-label">メッセージ</span>
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={composerPlaceholder}
                      autoComplete="off"
                    />
                  </label>
                  <button
                    type="submit"
                    className="mishiranu-btn mishiranu-btn--primary"
                    disabled={!draft.trim()}
                  >
                    送る
                  </button>
                </form>
              )}

              <div className="mishiranu-actions mishiranu-actions--chat">
                <button
                  type="button"
                  className="mishiranu-btn mishiranu-btn--ghost"
                  onClick={tapChoice(goHero)}
                >
                  はじめに戻る
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {step === "tour" ? (
          <section
            className="mishiranu-section mishiranu-tour-app"
            aria-labelledby="tour-title"
          >
            <header className="mishiranu-tour-top">
              <button
                type="button"
                className="mishiranu-tour-back"
                onClick={() => goChat(true)}
              >
                ← 駅を探し直す
              </button>
              <div className="mishiranu-tour-top-copy">
                <p className="mishiranu-kicker mishiranu-tour-top-kicker">
                  {station.prefecture} · {station.line} · {dayPartLabel(dayPart)} ·{" "}
                  {time.label}
                </p>
                <h2 id="tour-title" className="mishiranu-tour-top-title">
                  {station.name}
                </h2>
                <p className="mishiranu-tour-top-sub">
                  {selectedCourse ? selectedCourse.title : shownCopy.tourTitle}
                </p>
              </div>
            </header>

            <div className="mishiranu-tour-pages">
              {tourTab === "map" ? (
                <div className="mishiranu-tour-page" role="tabpanel" aria-label="地図">
                  <div className="mishiranu-tour">
                    <p className="mishiranu-guide-eyebrow">{station.name}駅 · 観光案内</p>
                    <h3
                      className={`mishiranu-tour-title${copyLoading ? " mishiranu-tour-title--loading" : ""}`}
                    >
                      {shownCopy.tourTitle}
                    </h3>
                    <p className="mishiranu-tour-catch">{shownCopy.catchCopy}</p>
                    <p className="mishiranu-radius">
                      徒歩圏 約 {station.radiiKm[time.index]} km · 案内ピン{" "}
                      {spots.length} 件
                    </p>
                  </div>
                  <StationMap
                    station={station}
                    spots={spots}
                    radiusKm={station.radiiKm[time.index]}
                    activeSpotId={activeSpotId ?? activeSpot?.id ?? null}
                    courseStopIds={courseStopIds}
                    onSelect={(id) => openSpot(id)}
                  />
                  {selectedCourse ? (
                    <p className="mishiranu-map-course-note">
                      地図の線は「{selectedCourse.title}」の歩き順（駅→
                      {selectedCourse.stopCount}か所）です。
                    </p>
                  ) : null}
                  <ul className="mishiranu-legend">
                    {GUIDE_ORDER.map((kind) => (
                      <li key={kind}>
                        <span
                          className="mishiranu-legend-icon"
                          style={{ color: GUIDE_COLOR[kind] }}
                        >
                          <GuideKindIcon kind={kind} />
                        </span>
                        {GUIDE_LABEL[kind]}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {tourTab === "course" ? (
                <div className="mishiranu-tour-page" role="tabpanel" aria-label="歩く">
                  {selectedCourse ? (
                    <section
                      className="mishiranu-course-itinerary"
                      aria-labelledby="course-itinerary-title"
                    >
                      <p className="mishiranu-kicker">
                        <IconTour />
                        COURSE
                      </p>
                      <h3
                        id="course-itinerary-title"
                        className="mishiranu-course-itinerary-title"
                      >
                        <CourseIcon courseId={selectedCourse.id} />
                        {selectedCourse.title}
                      </h3>
                      <p className="mishiranu-course-itinerary-meta">
                        {selectedCourse.subtitle} · {dayPartLabel(dayPart)}スタート · 約
                        {selectedCourse.totalMinutes}分 · {selectedCourse.stopCount}
                        か所
                      </p>
                      <p className="mishiranu-course-itinerary-vibe">
                        {selectedCourse.vibe}
                      </p>
                      <ol className="mishiranu-course-itinerary-list">
                        {selectedCourse.stops.map((stop, index) => (
                          <li key={stop.spotId}>
                            <button
                              type="button"
                              className={
                                activeSpotId === stop.spotId
                                  ? "mishiranu-course-stop mishiranu-course-stop--active"
                                  : "mishiranu-course-stop"
                              }
                              onClick={() => openSpot(stop.spotId)}
                            >
                              <span className="mishiranu-course-stop-index">
                                {index + 1}
                              </span>
                              <span className="mishiranu-course-stop-body">
                                <span className="mishiranu-course-stop-name">
                                  {stop.clockLabel ? `${stop.clockLabel} · ` : ""}
                                  {stop.name}
                                </span>
                                <span className="mishiranu-course-stop-meta">
                                  <span
                                    className="mishiranu-guide-kind-icon"
                                    style={{ color: GUIDE_COLOR[stop.guide] }}
                                  >
                                    <GuideKindIcon kind={stop.guide} />
                                  </span>
                                  {GUIDE_LABEL[stop.guide]} · 徒歩約 {stop.walkMinutes}{" "}
                                  分 · 滞在目安 {stop.dwellMinutes} 分
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ) : (
                    <section className="mishiranu-course-empty" aria-label="コースなし">
                      <p className="mishiranu-kicker">
                        <IconTour />
                        FREE WALK
                      </p>
                      <h3 className="mishiranu-course-itinerary-title">
                        コースは作っていません
                      </h3>
                      <p className="mishiranu-note">
                        地図と観光から、気になった場所だけ寄り道できます。あとから会話をやり直してコースを選ぶこともできます。
                      </p>
                    </section>
                  )}
                </div>
              ) : null}

              {tourTab === "guide" ? (
                <div className="mishiranu-tour-page" role="tabpanel" aria-label="案内">
                  <div
                    className="mishiranu-guide-segments"
                    role="tablist"
                    aria-label="案内の種類"
                  >
                    {GUIDE_ORDER.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        role="tab"
                        aria-selected={guideTab === kind}
                        className={
                          guideTab === kind
                            ? "mishiranu-guide-segment mishiranu-guide-segment--active"
                            : "mishiranu-guide-segment"
                        }
                        style={{
                          color:
                            guideTab === kind ? GUIDE_COLOR[kind] : undefined,
                        }}
                        onClick={() => setGuideTab(kind)}
                      >
                        <GuideKindIcon kind={kind} />
                        {GUIDE_LABEL[kind]}
                      </button>
                    ))}
                  </div>
                  {guideTab === "meal" &&
                  (mealPrefs.solo !== "either" ||
                    mealPrefs.budget !== "either") ? (
                    <p className="mishiranu-guide-pref-note">
                      希望:{" "}
                      {
                        SOLO_PREF_OPTIONS.find((o) => o.id === mealPrefs.solo)
                          ?.label
                      }
                      {" · "}
                      {
                        BUDGET_PREF_OPTIONS.find((o) => o.id === mealPrefs.budget)
                          ?.label
                      }
                    </p>
                  ) : null}
                  {(() => {
                    const items =
                      guideTab === "meal"
                        ? [...spots.filter((s) => spotGuide(s) === guideTab)].sort(
                            (a, b) =>
                              mealPrefScore(b, mealPrefs) -
                              mealPrefScore(a, mealPrefs),
                          )
                        : spots.filter((s) => spotGuide(s) === guideTab);
                    if (items.length === 0) {
                      return (
                        <p className="mishiranu-guide-empty">
                          この徒歩圏・時間ではまだ少なめです。時間を延ばすと増えることがあります。
                        </p>
                      );
                    }
                    return (
                      <ul className="mishiranu-guide-list mishiranu-guide-list--compact">
                        {items.map((item) => {
                          const score =
                            guideTab === "meal"
                              ? mealPrefScore(item, mealPrefs)
                              : 0;
                          const muted = guideTab === "meal" && score < 0;
                          const match = guideTab === "meal" && score > 0;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                className={[
                                  "mishiranu-guide-item",
                                  "mishiranu-guide-item--compact",
                                  activeSpotId === item.id
                                    ? "mishiranu-guide-item--active"
                                    : "",
                                  muted ? "mishiranu-guide-item--muted" : "",
                                  match ? "mishiranu-guide-item--match" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                aria-pressed={activeSpotId === item.id}
                                onClick={() => openSpot(item.id)}
                              >
                                <span className="mishiranu-guide-item-name">
                                  <span
                                    className="mishiranu-guide-kind-icon"
                                    style={{ color: GUIDE_COLOR[guideTab] }}
                                  >
                                    <GuideKindIcon kind={guideTab} />
                                  </span>
                                  {item.name}
                                </span>
                                <span className="mishiranu-guide-item-meta">
                                  徒歩約 {item.walkMinutes} 分
                                  {hoursFor(item) ? ` · ${hoursFor(item)}` : ""}
                                </span>
                                {guideTab === "meal" ? (
                                  <span className="mishiranu-guide-item-meal">
                                    {mealMetaLine(item)}
                                    {match ? " · 希望に近い" : ""}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>
              ) : null}

              {tourTab === "place" ? (
                <div className="mishiranu-tour-page" role="tabpanel" aria-label="土地">
                  {station.stationIntro ? (
                    <p className="mishiranu-station-intro">{station.stationIntro}</p>
                  ) : null}
                  {station.walkGuide ? (
                    <div className="mishiranu-walk-guide">
                      <h3 className="mishiranu-walk-guide-title">
                        <IconWalk />
                        歩き方の目安
                      </h3>
                      <p>{station.walkGuide}</p>
                    </div>
                  ) : null}
                  {station.mood === "empty" &&
                  (shownCopy.emptyHeadline || shownCopy.emptyBody) ? (
                    <div className="mishiranu-empty">
                      {shownCopy.emptyHeadline ? (
                        <h3>{shownCopy.emptyHeadline}</h3>
                      ) : null}
                      {shownCopy.emptyBody ? <p>{shownCopy.emptyBody}</p> : null}
                    </div>
                  ) : null}
                  {areaParagraphs.length > 0 ||
                  (station.historyNotes && station.historyNotes.length > 0) ? (
                    <section
                      className="mishiranu-area-story"
                      aria-labelledby="area-story-title"
                    >
                      <p className="mishiranu-kicker">
                        <IconHistory />
                        AREA · HISTORY
                      </p>
                      <h3
                        id="area-story-title"
                        className="mishiranu-area-story-title"
                      >
                        <IconHistory />
                        このエリアのこと・歴史
                      </h3>
                      {areaParagraphs.map((para) => (
                        <p key={para.slice(0, 24)} className="mishiranu-area-about">
                          {para}
                        </p>
                      ))}
                      {station.historyNotes && station.historyNotes.length > 0 ? (
                        <ol className="mishiranu-history-list">
                          {station.historyNotes.map((note) => (
                            <li key={note.title}>
                              <h4>{note.title}</h4>
                              <p>{note.body}</p>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </section>
                  ) : null}
                  {station.sightseeingNotes &&
                  station.sightseeingNotes.length > 0 ? (
                    <section
                      className="mishiranu-sight-notes"
                      aria-labelledby="sight-notes-title"
                    >
                      <p className="mishiranu-kicker">
                        <IconBinoculars />
                        SIGHTSEEING
                      </p>
                      <h3
                        id="sight-notes-title"
                        className="mishiranu-sight-notes-title"
                      >
                        <IconBinoculars />
                        観光案内メモ
                      </h3>
                      <ol className="mishiranu-history-list">
                        {station.sightseeingNotes.map((note) => (
                          <li key={note.title}>
                            <h4>{note.title}</h4>
                            <p>{note.body}</p>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ) : null}
                  {!station.stationIntro &&
                  areaParagraphs.length === 0 &&
                  !(station.historyNotes && station.historyNotes.length) &&
                  !(station.sightseeingNotes && station.sightseeingNotes.length) ? (
                    <p className="mishiranu-note">この駅の土地メモはまだ少なめです。</p>
                  ) : null}
                </div>
              ) : null}

              {tourTab === "more" ? (
                <div className="mishiranu-tour-page" role="tabpanel" aria-label="ほか">
                  <section
                    className="mishiranu-bike-rental"
                    aria-labelledby="bike-rental-title"
                  >
                    <p className="mishiranu-kicker">
                      <IconBike />
                      MOBILITY
                    </p>
                    <h3
                      id="bike-rental-title"
                      className="mishiranu-bike-rental-title"
                    >
                      <IconBike />
                      レンタサイクル
                    </h3>
                    <p
                      className={
                        bikeRental.available
                          ? "mishiranu-bike-rental-status mishiranu-bike-rental-status--yes"
                          : "mishiranu-bike-rental-status"
                      }
                    >
                      {bikeRental.available
                        ? "駅周辺で借りられます"
                        : "いまは未確認／少なめ"}
                    </p>
                    <p className="mishiranu-bike-rental-summary">
                      {bikeRental.summary}
                    </p>
                    {bikeRental.places && bikeRental.places.length > 0 ? (
                      <ul className="mishiranu-bike-rental-places">
                        {bikeRental.places.map((place) => (
                          <li key={place.name}>
                            <span className="mishiranu-bike-rental-place-name">
                              {place.name}
                            </span>
                            {typeof place.walkMinutes === "number" ? (
                              <span className="mishiranu-bike-rental-place-meta">
                                徒歩約 {place.walkMinutes} 分
                              </span>
                            ) : null}
                            {place.note ? (
                              <span className="mishiranu-bike-rental-place-note">
                                {place.note}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>

                  <div className="mishiranu-actions mishiranu-actions--stack">
                    <button
                      type="button"
                      className="mishiranu-btn mishiranu-btn--primary"
                      onClick={drawSecret}
                    >
                      とりあえずここに行け
                    </button>
                    <button
                      type="button"
                      className="mishiranu-btn"
                      disabled={copyLoading}
                      onClick={() => void loadCopy(station, timeId)}
                    >
                      コピーを引き直す
                    </button>
                    <button
                      type="button"
                      className="mishiranu-btn"
                      onClick={() => void shareTour()}
                    >
                      物語をコピー
                    </button>
                    <button
                      type="button"
                      className="mishiranu-btn mishiranu-btn--ghost"
                      onClick={() => goChat(true)}
                    >
                      駅を探し直す
                    </button>
                  </div>

                  {shareNote ? (
                    <p className="mishiranu-share-note" aria-live="polite">
                      {shareNote}
                    </p>
                  ) : null}

                  {secretOpen && secret ? (
                    <div className="mishiranu-secret" aria-live="polite">
                      <p className="mishiranu-secret-label">SECRET DESTINATION</p>
                      <h3 className="mishiranu-spot-name">{secret.name}</h3>
                      <p className="mishiranu-spot-blurb">{secret.blurb}</p>
                      <div className="mishiranu-actions">
                        <button
                          type="button"
                          className="mishiranu-btn"
                          onClick={drawSecret}
                        >
                          もう一回ひく
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {messages.length > 1 ? (
                    <details className="mishiranu-chat-summary">
                      <summary>これまでの会話</summary>
                      <div className="mishiranu-chat-thread mishiranu-chat-thread--compact">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={
                              msg.role === "guide"
                                ? "mishiranu-chat-bubble mishiranu-chat-bubble--guide"
                                : "mishiranu-chat-bubble mishiranu-chat-bubble--you"
                            }
                          >
                            <span className="mishiranu-chat-role">
                              {msg.role === "guide" ? "案内" : "あなた"}
                            </span>
                            <p>{msg.text}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}

                  <p className="mishiranu-foot">
                    地図は OpenStreetMap。出町柳ピンは実座標寄り。
                    GEMINI_API_KEY があれば Gemini 3.1 Flash-Lite、なければ編集文です。
                  </p>
                </div>
              ) : null}
            </div>

            {spotSheetOpen && activeSpot ? (
              <div className="mishiranu-spot-sheet" role="dialog" aria-modal="true">
                <button
                  type="button"
                  className="mishiranu-spot-sheet-backdrop"
                  aria-label="詳細を閉じる"
                  onClick={() => setSpotSheetOpen(false)}
                />
                <div className="mishiranu-spot-sheet-panel">
                  <div className="mishiranu-spot-sheet-handle" aria-hidden="true" />
                  <p className="mishiranu-spot-genre">
                    <span
                      className="mishiranu-guide-kind-icon"
                      style={{ color: GUIDE_COLOR[spotGuide(activeSpot)] }}
                    >
                      <GuideKindIcon kind={spotGuide(activeSpot)} />
                    </span>
                    {GUIDE_LABEL[spotGuide(activeSpot)]} · 徒歩約{" "}
                    {activeSpot.walkMinutes} 分
                    {hoursFor(activeSpot) ? ` · ${hoursFor(activeSpot)}` : ""}
                  </p>
                  {spotGuide(activeSpot) === "meal" ? (
                    <p className="mishiranu-spot-meal-meta">
                      {mealMetaLine(activeSpot)}
                    </p>
                  ) : null}
                  <h3 className="mishiranu-spot-name">{activeSpot.name}</h3>
                  <p className="mishiranu-spot-blurb">{activeSpot.blurb}</p>
                  {activeSpot.detail ? (
                    <p className="mishiranu-spot-detail">{activeSpot.detail}</p>
                  ) : null}
                  <button
                    type="button"
                    className="mishiranu-btn mishiranu-btn--primary mishiranu-spot-sheet-close"
                    onClick={() => setSpotSheetOpen(false)}
                  >
                    閉じる
                  </button>
                </div>
              </div>
            ) : null}

            <nav className="mishiranu-tour-tabs" aria-label="案内のページ">
              {TOUR_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={
                    tourTab === tab.id
                      ? "mishiranu-tour-tab mishiranu-tour-tab--active"
                      : "mishiranu-tour-tab"
                  }
                  aria-current={tourTab === tab.id ? "page" : undefined}
                  onClick={() => {
                    setTourTab(tab.id);
                    setSpotSheetOpen(false);
                  }}
                >
                  <span className="mishiranu-tour-tab-icon" aria-hidden="true">
                    {tab.id === "map" ? (
                      <IconLocate />
                    ) : tab.id === "course" ? (
                      <IconTour />
                    ) : tab.id === "guide" ? (
                      <IconBinoculars />
                    ) : tab.id === "place" ? (
                      <IconHistory />
                    ) : (
                      <IconBike />
                    )}
                  </span>
                  <span className="mishiranu-tour-tab-label">{tab.label}</span>
                </button>
              ))}
            </nav>
          </section>
        ) : null}
      </div>
    </div>
  );
}
