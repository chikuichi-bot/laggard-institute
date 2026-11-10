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
  EMPTY_STATION,
  STATIONS,
  TIME_OPTIONS,
  walkRadiusKm,
  bikePlacesByKind,
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
  isLikelyOpen,
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
import {
  DeviceGeoError,
  geoFailureMessage,
  startDevicePosition,
} from "@/lib/mishiranu-device-geo";
import { findNearestStation } from "@/lib/mishiranu-geo";
import { arrivalFragment, spotTrace } from "@/lib/mishiranu-lore";
import {
  findSavedStation,
  loadStationLibrary,
  mergeCatalog,
  removeStationFromLibrary,
  saveStationToLibrary,
  stableStationId,
} from "@/lib/mishiranu-station-library";
import {
  CourseIcon,
  DayPartIcon,
  GuideKindIcon,
  IconBike,
  IconBinoculars,
  IconClock,
  IconHistory,
  IconLocate,
  IconMapPin,
  IconMore,
  IconSearch,
  IconSpark,
  IconTour,
  IconWalk,
  StayIcon,
} from "./MishiranuIcons";
import { IosInstallCard } from "./IosInstall";
import { PlaceBoard } from "./PlaceBoard";
import { StationChrome } from "./StationChrome";
import {
  loadMishiranuSkin,
  MISHIRANU_SKINS,
  saveMishiranuSkin,
  type MishiranuSkin,
} from "./mishiranu-skin";
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
type GuideTabId = GuideKind | "bike";
const BIKE_GUIDE_COLOR = "#5f7d6a";
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
  { id: "more", label: "設定" },
];

function mealMetaLine(spot: Spot): string {
  const solo = soloOkFor(spot) ? SOLO_OK_LABEL.yes : SOLO_OK_LABEL.no;
  return `${solo} · ${budgetYenFor(spot)} · ${MEAL_TIER_LABEL[mealTierFor(spot)]}`;
}

type ChatMsg = {
  id: string;
  role: "guide" | "you";
  text: string;
  /** 案内をつくっている待ち時間（Thinking time） */
  thinking?: boolean;
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

function matchStationIn(
  text: string,
  catalog: StationSeed[],
): StationSeed | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const bare = t.replace(/駅$/u, "");
  const byName = catalog.find(
    (s) => t.includes(s.name) || s.name.includes(bare),
  );
  if (byName) return byName;
  return catalog.find(
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
  "知らない駅に到着しましたね。駅名を教えるか、現在地から近い保存済みの駅を探します。どの駅も検索でき、初めての駅は徒歩圏の案内をその場でつくります。一度見た駅は、この端末に少しずつ残ります。";

export default function MishiranuApp({
  initialStep = "hero",
  initialStationId,
  initialTimeId = "1h",
  initialFocus,
}: Props) {
  const [step, setStep] = useState<Step>(initialStep);
  const [stationId, setStationId] = useState<string>(initialStationId ?? "");
  const [dynamicStation, setDynamicStation] = useState<StationSeed | null>(null);
  const [savedStations, setSavedStations] = useState<StationSeed[]>([]);
  const [stationLoading, setStationLoading] = useState(false);
  const [timeId, setTimeId] = useState<TimeOptionId>(initialTimeId);
  const [focusKinds, setFocusKinds] = useState<GuideKind[]>(() =>
    parseFocusList(initialFocus),
  );
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [showStationSearch, setShowStationSearch] = useState(false);
  const [skin, setSkin] = useState<MishiranuSkin>("board");
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
  const [guideTab, setGuideTab] = useState<GuideTabId>("sight");
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

  useEffect(() => {
    setSavedStations(loadStationLibrary());
    setSkin(loadMishiranuSkin());
  }, []);

  function chooseSkin(next: MishiranuSkin) {
    setSkin(next);
    saveMishiranuSkin(next);
  }

  const catalog = useMemo(
    () => mergeCatalog(STATIONS, savedStations),
    [savedStations],
  );

  const station = useMemo(() => {
    const raw =
      dynamicStation && dynamicStation.id === stationId
        ? dynamicStation
        : (catalog.find((s) => s.id === stationId) ??
          savedStations.find((s) => s.id === stationId) ??
          EMPTY_STATION);
    return withAreaDepth(raw);
  }, [stationId, dynamicStation, catalog, savedStations]);
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
    const tabParam = params.get("tab");
    if (
      tabParam === "map" ||
      tabParam === "place" ||
      tabParam === "course" ||
      tabParam === "guide" ||
      tabParam === "more"
    ) {
      setTourTab(tabParam);
    }
    if (stationParam) {
      const fromLib = loadStationLibrary().find((s) => s.id === stationParam);
      if (fromLib) {
        setSavedStations(loadStationLibrary());
        setDynamicStation(fromLib);
        setStationId(stationParam);
      } else if (STATIONS.some((s) => s.id === stationParam)) {
        setStationId(stationParam);
      }
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
    const savedIds = new Set(savedStations.map((s) => s.id));
    const pool = q
      ? catalog.filter(
          (s) =>
            s.name.includes(q) ||
            s.prefecture.includes(q) ||
            s.line.includes(q) ||
            s.tourTitle.includes(q),
        )
      : catalog.filter((s) => savedIds.has(s.id));
    return pool.slice(0, 8);
  }, [query, catalog, savedStations]);

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

  function tapChoice(action: () => void, opts?: { keepFocus?: boolean }) {
    return (event: MouseEvent<HTMLButtonElement>) => {
      // iOS Safari drops the geolocation user-gesture if we blur first.
      if (!opts?.keepFocus) event.currentTarget.blur();
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

  function finishThinking(successText: string) {
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.thinking);
      if (idx < 0) return prev;
      const real = prev.length - 1 - idx;
      return prev.map((m, i) =>
        i === real ? { ...m, thinking: false, text: successText } : m,
      );
    });
  }

  function clearThinkingMessages() {
    setMessages((prev) => prev.filter((m) => !m.thinking));
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
    // 一度選んだ駅は端末（localStorage）に残す
    const toSave: StationSeed = {
      ...next,
      id: stableStationId(next.name, next.id),
      source: next.source ?? "ai",
    };
    setDynamicStation(toSave);
    setSavedStations(saveStationToLibrary(toSave));
    setStationId(toSave.id);
    setShowStationSearch(false);
    setQuery("");
    setDraft("");
    setCourses([]);
    setSelectedCourse(null);
    setMealSolo("either");
    setMealBudget("either");
    setChatPhase("clock");
    const guideText = `${toSave.name}ですね。${toSave.prefecture}・${toSave.line}。いま何時ごろですか？ 時刻に合わせて、まわり方を組み立てます。`;
    const fragment = arrivalFragment(withAreaDepth(toSave));
    const fragmentMessages = fragment
      ? [
          {
            role: "guide" as const,
            text: fragment.line,
          },
        ]
      : [];
    if (opts?.omitYou) {
      pushMessages(...fragmentMessages, { role: "guide", text: guideText });
    } else {
      pushMessages(
        { role: "you", text: spoken ?? `${toSave.name}駅です` },
        ...fragmentMessages,
        { role: "guide", text: guideText },
      );
    }
  }

  function matchStation(text: string): StationSeed | undefined {
    return matchStationIn(text, catalog);
  }

  function locateHere() {
    if (geoLoading || stationLoading) return;

    // Start GPS in this same tap turn (required by iOS Safari), before setState.
    const pending = startDevicePosition();

    setGeoLoading(true);
    pushMessages(
      { role: "you", text: "現在地から駅を探す" },
      {
        role: "guide",
        text: "いまの位置から、いちばん近い駅名を調べています…",
      },
    );

    void (async () => {
      try {
        const { lat, lng } = await pending;
        // Precise GPS never leaves the browser. Match against seed + saved library only.
        const local = findNearestStation(lat, lng, catalog);
        if (local && local.km <= 3.5) {
          chooseStation(
            local.station,
            `現在地（${local.station.name}・約${local.km < 1 ? `${Math.round(local.km * 1000)}m` : `${local.km.toFixed(1)}km`}）`,
            { omitYou: true },
          );
          return;
        }

        setShowStationSearch(true);
        const nearestHint = local
          ? `いちばん近い保存済みの駅は${local.station.name}（約${local.km < 1 ? `${Math.round(local.km * 1000)}m` : `${local.km.toFixed(1)}km`}）ですが、徒歩圏外です。`
          : "";
        pushMessages({
          role: "guide",
          text:
            `${nearestHint}位置情報は端末の外に送っていません。駅名を入力すれば、全国どこでも Gemini が案内を編集します。`.trim(),
        });
      } catch (err) {
        setShowStationSearch(true);
        const failure =
          err instanceof DeviceGeoError ? err.failure : "unknown";
        pushMessages({
          role: "guide",
          text: geoFailureMessage(failure),
        });
      } finally {
        setGeoLoading(false);
      }
    })();
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
            ? `${dayPartLabel(dayPart)}・${TIME_OPTIONS.find((t) => t.id === timeIdRef.current)?.label ?? ""}・${soloLabel}・${label}向けです。まずは「まわり方は決めない」で自由に歩くか、下の${built.length}つのまわり方から選んでください。`
            : "この条件ではまわり方を組めませんでした。まずは「まわり方は決めない」で案内を開くか、滞在時間を変えてみてください。",
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
      { role: "you", text: spoken ?? "まわり方は決めない" },
      {
        role: "guide",
        text: `まわり方なしで、${named}の案内を開きます。地図と観光から、好きなだけ寄り道してください。`,
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
      /まわり方\s*(は)?\s*(決めない|作らない|なし|要らない|いらない)/u.test(t) ||
      /自由に歩く/u.test(t) ||
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
    const bare = name.replace(/駅$/u, "");

    // 一度調べた駅は端末から開く（毎回 API しない）
    const saved =
      findSavedStation(bare, savedStations) ??
      findSavedStation(bare, catalog) ??
      findSavedStation(bare);
    if (saved) {
      setStep("pick");
      setChatPhase("station");
      setShowStationSearch(false);
      setDraft("");
      setQuery("");
      pushMessages(
        { role: "you", text: spoken ?? `${bare}駅です` },
        {
          role: "guide",
          text: `「${bare}」は、この端末に残っていた案内を開きます。`,
        },
      );
      chooseStation(saved, spoken, { omitYou: true });
      return;
    }

    setStationLoading(true);
    setStep("pick");
    setChatPhase("station");
    setShowStationSearch(true);
    pushMessages(
      { role: "you", text: spoken ?? `${name}駅です` },
      {
        role: "guide",
        text: `「${bare}」のまわりを調べて、徒歩圏の案内をつくっています。`,
        thinking: true,
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
        clearThinkingMessages();
        pushMessages({
          role: "guide",
          text: stationLookupErrorMessage(res.status, {}, raw),
        });
        return;
      }
      if (!res.ok || !data.station) {
        clearThinkingMessages();
        pushMessages({
          role: "guide",
          text: stationLookupErrorMessage(res.status, data, raw),
        });
        return;
      }
      const next: StationSeed = {
        ...data.station,
        id: stableStationId(data.station.name, data.station.id),
        source: data.source ?? data.station.source ?? "ai",
      };
      finishThinking(`「${bare}」の案内ができました。この端末に残します。`);
      chooseStation(next, spoken, { omitYou: true });
    } catch {
      clearThinkingMessages();
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

  /** 設定の「調べた駅」から、保存済みの案内を思い出す。 */
  function recallSavedStation(next: StationSeed) {
    const sealed = {
      ...next,
      id: stableStationId(next.name, next.id),
      source: next.source ?? "ai",
    };
    setDynamicStation(sealed);
    setSavedStations(saveStationToLibrary(sealed));
    setCourses([]);
    setSelectedCourse(null);
    goTour(sealed.id, timeId, focusKinds, "map");
  }

  function forgetSavedStation(id: string) {
    const next = removeStationFromLibrary(id);
    setSavedStations(next);
    if (stationId === id) {
      const fallback = next[0]?.id ?? "";
      setStationId(fallback);
      if (fallback) goTour(fallback, timeId, focusKinds, "more");
    }
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
      // 保存済みなら端末から開き、なければ調べて残す
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
            text: "下のまわり方から選ぶか、「まわり方は決めない」と入力してください。",
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
      `${time.label} · 徒歩圏 約 ${walkRadiusKm(time.id)} km`,
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
                ? "例: 散歩中心 / 食べ物中心 / まわり方は決めない"
                : "";

  return (
    <div className="mishiranu" data-skin={skin}>
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
                知らない駅にも、その駅の歴史がある。降りた場所の記憶をひとかけらずつ手渡して、予定のない散歩にする。
              </p>
              <div className="mishiranu-cta-row">
                <button
                  type="button"
                  className="mishiranu-btn mishiranu-btn--primary"
                  onClick={() => goChat(true)}
                >
                  知らない駅に到着
                </button>
              </div>
              <p className="mishiranu-fallback-links">
                押せないとき: <a href="?view=pick">到着の会話へ</a>
                {savedStations.length > 0
                  ? ` · 保存 ${savedStations.length} 駅`
                  : " · 検索した駅だけがここに残ります"}
              </p>
              <div className="mishiranu-hero-install">
                <IosInstallCard compact />
              </div>
            </div>
          </section>
        ) : null}

        {step === "pick" ? (
          <section className="mishiranu-chat" aria-labelledby="chat-title">
            <header className="mishiranu-chat-head">
              <p className="mishiranu-kicker">
                {savedStations.length > 0
                  ? `ARRIVAL · 保存 ${savedStations.length} 駅 · 全国検索可`
                  : "ARRIVAL · 全国の駅を検索"}
              </p>
              <h2 id="chat-title" className="mishiranu-h2 mishiranu-h2--chat">
                知らない駅から、まわり方をつくる
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
                      ? `mishiranu-chat-bubble mishiranu-chat-bubble--guide${msg.thinking ? " mishiranu-chat-bubble--thinking" : ""}`
                      : "mishiranu-chat-bubble mishiranu-chat-bubble--you"
                  }
                  aria-label={msg.thinking ? `Thinking time。${msg.text}` : undefined}
                >
                  <span className="mishiranu-chat-role">
                    {msg.role === "guide" ? "案内" : "あなた"}
                  </span>
                  {msg.thinking ? (
                    <span className="mishiranu-thinking-time" aria-hidden="true">
                      Thinking time
                      <span className="mishiranu-thinking-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                  ) : null}
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
                    onClick={tapChoice(() => locateHere(), { keepFocus: true })}
                  >
                    <IconLocate />
                    {geoLoading ? "現在地を確認中…" : "現在地で駅を探す"}
                  </button>
                  <button
                    type="button"
                    className="mishiranu-chat-chip"
                    onClick={tapChoice(() => {
                      setShowStationSearch(true);
                      requestAnimationFrame(() => {
                        document
                          .getElementById("mishiranu-station-search-input")
                          ?.focus();
                      });
                    })}
                  >
                    <IconSearch />
                    駅名で探す
                  </button>
                  {showStationSearch ? (
                    <div className="mishiranu-chat-search">
                      <form
                        className="mishiranu-chat-search-row"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const text = query.trim();
                          if (!text || stationLoading) return;
                          void requestAiStation(text, text);
                        }}
                      >
                        <label className="mishiranu-search">
                          <span className="mishiranu-search-label">駅名・路線</span>
                          <input
                            id="mishiranu-station-search-input"
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="例: 出町柳 / 二ノ瀬 / 中書島"
                            autoComplete="off"
                          />
                        </label>
                        <button
                          type="submit"
                          className="mishiranu-btn mishiranu-btn--primary"
                          disabled={!query.trim() || stationLoading}
                        >
                          送る
                        </button>
                      </form>
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
                      {!query.trim() && filteredStations.length === 0 ? (
                        <p className="mishiranu-note">
                          駅名を入れると全国から探せます。初めての駅は徒歩圏の案内をつくり、この端末に残ります。
                        </p>
                      ) : null}
                      {query.trim() && filteredStations.length === 0 ? (
                        <div className="mishiranu-ai-station-ask">
                          <p className="mishiranu-note">
                            まだ保存されていません。徒歩圏の案内をつくれます。
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
                              ? "Thinking time…"
                              : `「${query.trim().replace(/駅$/u, "")}」の案内をつくる`}
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
                    className="mishiranu-chat-chip"
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
                <div className="mishiranu-course-choose" aria-label="まわり方の候補">
                  <p className="mishiranu-course-choose-hint">
                    下のカードから、まわり方を1つ選ぶ
                  </p>
                  <div className="mishiranu-course-picks">
                    {courses.map((course, index) => (
                      <button
                        key={course.id}
                        type="button"
                        className={`mishiranu-course-card mishiranu-course-card--${index % 3}`}
                        onClick={tapChoice(() => chooseCourse(course))}
                      >
                        <span className="mishiranu-course-card-head">
                          <span className="mishiranu-course-card-num" aria-hidden="true">
                            {index + 1}
                          </span>
                          <span className="mishiranu-course-card-head-copy">
                            <span className="mishiranu-course-card-index">
                              <CourseIcon courseId={course.id} />
                              まわり {index + 1}
                            </span>
                            <span className="mishiranu-course-card-title">
                              {course.title}
                            </span>
                          </span>
                        </span>
                        <span className="mishiranu-course-card-meta">
                          <span className="mishiranu-course-chip">
                            約{course.totalMinutes}分
                          </span>
                          <span className="mishiranu-course-chip">
                            {course.stopCount}か所
                          </span>
                          <span className="mishiranu-course-card-sub">
                            {course.subtitle}
                          </span>
                        </span>
                        <span className="mishiranu-course-card-vibe">
                          {course.vibe}
                        </span>
                        <ol className="mishiranu-course-card-stops">
                          {course.stops.map((stop) => (
                            <li key={stop.spotId}>
                              <span className="mishiranu-course-stop-time">
                                {stop.clockLabel || "—"}
                              </span>
                              <span
                                className="mishiranu-guide-kind-icon"
                                style={{ color: GUIDE_COLOR[stop.guide] }}
                              >
                                <GuideKindIcon kind={stop.guide} />
                              </span>
                              <span className="mishiranu-course-stop-name">
                                {stop.name}
                              </span>
                            </li>
                          ))}
                        </ol>
                        <span className="mishiranu-course-card-cta">
                          タップして、このまわり方へ
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="mishiranu-chat-chip mishiranu-course-skip"
                      onClick={tapChoice(() => skipCourse())}
                    >
                      <IconWalk />
                      まわり方は決めない（自由に歩く）
                    </button>
                  </div>
                </div>
              ) : null}

              {chatPhase === "ready" ? (
                <p className="mishiranu-chat-opening">案内を開いています…</p>
              ) : chatPhase === "station" ? null : (
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
            className={`mishiranu-section mishiranu-tour-app${
              tourTab === "place" ? " mishiranu-tour-app--place" : ""
            }${tourTab === "map" ? " mishiranu-tour-app--map" : ""}`}
            aria-labelledby="tour-title"
          >
            <StationChrome
              stationName={station.name}
              courseTitle={
                selectedCourse ? selectedCourse.title : shownCopy.tourTitle
              }
              metaLine={`${dayPartLabel(dayPart)} · ${time.label}`}
              onBack={() => goChat(true)}
            />

            <div className="mishiranu-tour-pages">
              {tourTab === "map" ? (
                <div className="mishiranu-tour-page" role="tabpanel" aria-label="地図">
                  <StationMap
                    key={`${station.id}-${skin}`}
                    station={station}
                    spots={spots}
                    radiusKm={walkRadiusKm(time.id)}
                    activeSpotId={activeSpotId ?? activeSpot?.id ?? null}
                    courseStopIds={courseStopIds}
                    onSelect={(id) => openSpot(id)}
                  />
                  <div className="mishiranu-map-foot">
                    <p className="mishiranu-tour-catch">{shownCopy.catchCopy}</p>
                    <p className="mishiranu-radius">
                      徒歩圏 約 {walkRadiusKm(time.id)} km
                    </p>
                    {selectedCourse ? (
                      <p className="mishiranu-map-course-note">
                        線は「{selectedCourse.title}」の徒歩ルート（道なり・駅→
                        {selectedCourse.stopCount}か所）
                      </p>
                    ) : null}
                    <ul className="mishiranu-legend">
                      {GUIDE_ORDER.map((kind) => (
                        <li
                          key={kind}
                          className="mishiranu-legend-chip"
                          style={
                            {
                              "--legend-color": GUIDE_COLOR[kind],
                            } as React.CSSProperties
                          }
                        >
                          <span className="mishiranu-legend-icon">
                            <GuideKindIcon kind={kind} />
                          </span>
                          {GUIDE_LABEL[kind]}
                        </li>
                      ))}
                    </ul>
                  </div>
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
                        WALK
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
                                {(() => {
                                  const spot = station.spots.find(
                                    (s) => s.id === stop.spotId,
                                  );
                                  const trace = spot ? spotTrace(spot, station) : null;
                                  return trace ? (
                                    <span className="mishiranu-lore-trace">
                                      <span className="mishiranu-lore-trace-label">
                                        土地の記憶
                                      </span>
                                      {trace}
                                    </span>
                                  ) : null;
                                })()}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ) : (
                    <section className="mishiranu-course-empty" aria-label="まわり方なし">
                      <p className="mishiranu-kicker">
                        <IconTour />
                        FREE WALK
                      </p>
                      <h3 className="mishiranu-course-itinerary-title">
                        まわり方は、まだ決めていません
                      </h3>
                      <p className="mishiranu-note">
                        地図と観光から、気になった場所だけ寄り道できます。あとから会話をやり直して、まわり方を選ぶこともできます。
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
                    <button
                      type="button"
                      role="tab"
                      aria-selected={guideTab === "bike"}
                      className={
                        guideTab === "bike"
                          ? "mishiranu-guide-segment mishiranu-guide-segment--active"
                          : "mishiranu-guide-segment"
                      }
                      style={{
                        color: guideTab === "bike" ? BIKE_GUIDE_COLOR : undefined,
                      }}
                      onClick={() => setGuideTab("bike")}
                    >
                      <IconBike />
                      レンタサイクル
                    </button>
                  </div>

                  {guideTab === "bike" ? (
                    <div className="mishiranu-bike-rental-stack">
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
                      </section>

                      {(
                        [
                          {
                            kind: "local" as const,
                            title: "地元のレンタサイクル",
                            hint: "店頭で借りる半日〜1日向き",
                            empty:
                              "地元店の具体名は、まだ少なめです。観光案内所や駅掲示も見てください。",
                          },
                          {
                            kind: "app" as const,
                            title: "アプリで借りる",
                            hint: "会員登録のあと、ポートで解錠",
                            empty:
                              "アプリ型のポート情報は、まだ少なめです。HELLO CYCLING など地域のアプリを確認してください。",
                          },
                        ] as const
                      ).map((group) => {
                        const places = bikePlacesByKind(
                          bikeRental.places,
                          group.kind,
                        );
                        return (
                          <section
                            key={group.kind}
                            className="mishiranu-bike-rental mishiranu-bike-rental--group"
                            aria-label={group.title}
                          >
                            <h4 className="mishiranu-bike-rental-group-title">
                              {group.title}
                            </h4>
                            <p className="mishiranu-bike-rental-group-hint">
                              {group.hint}
                            </p>
                            {places.length === 0 ? (
                              <p className="mishiranu-bike-rental-summary">
                                {group.empty}
                              </p>
                            ) : (
                              <ul className="mishiranu-bike-rental-places">
                                {places.map((place) => (
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
                            )}
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <>
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
                            BUDGET_PREF_OPTIONS.find(
                              (o) => o.id === mealPrefs.budget,
                            )?.label
                          }
                        </p>
                      ) : null}
                      {(() => {
                        const kind = guideTab;
                        // 案内タブは滞在時間で切らない（ご飯・土産が消えるのを防ぐ）
                        const edibleOmiyage = (s: (typeof station.spots)[number]) =>
                          /ふたば|みたらし|だんご|団子|豆餅|阿闍梨|最中|羊羹|もみじ饅頭|赤福/.test(
                            s.name,
                          );
                        const guidePool = station.spots;
                        const openEnough = (s: (typeof station.spots)[number]) =>
                          kind === "sight" || kind === "tip"
                            ? true
                            : isLikelyOpen(s, dayPart);
                        const base = guidePool.filter(
                          (s) => spotGuide(s) === kind && openEnough(s),
                        );
                        const items =
                          kind === "souvenir"
                            ? [
                                ...base,
                                ...guidePool.filter(
                                  (s) =>
                                    spotGuide(s) !== "souvenir" &&
                                    edibleOmiyage(s) &&
                                    openEnough(s),
                                ),
                              ]
                                .filter(
                                  (s, i, arr) =>
                                    arr.findIndex((x) => x.id === s.id) === i,
                                )
                                .sort(
                                  (a, b) =>
                                    a.walkMinutes - b.walkMinutes ||
                                    a.name.localeCompare(b.name, "ja"),
                                )
                            : [...base].sort(
                                (a, b) =>
                                  a.walkMinutes - b.walkMinutes ||
                                  (kind === "meal"
                                    ? mealPrefScore(b, mealPrefs) -
                                      mealPrefScore(a, mealPrefs)
                                    : 0) ||
                                  a.name.localeCompare(b.name, "ja"),
                              );
                        if (items.length === 0) {
                          return (
                            <p className="mishiranu-guide-empty">
                              まだこの分類の店が少ないです。設定から「案内を作り直す（AI）」を試してください。
                            </p>
                          );
                        }
                        return (
                          <ul className="mishiranu-guide-list mishiranu-guide-list--compact">
                            {items.map((item) => {
                              const score =
                                kind === "meal"
                                  ? mealPrefScore(item, mealPrefs)
                                  : 0;
                              const muted = kind === "meal" && score < 0;
                              const match = kind === "meal" && score > 0;
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
                                        style={{ color: GUIDE_COLOR[kind] }}
                                      >
                                        <GuideKindIcon kind={kind} />
                                      </span>
                                      {item.name}
                                    </span>
                                    <span className="mishiranu-guide-item-meta">
                                      徒歩約 {item.walkMinutes} 分
                                    </span>
                                    {hoursFor(item) ? (
                                      <span className="mishiranu-guide-item-hours">
                                        営業 {hoursFor(item)}
                                      </span>
                                    ) : null}
                                    {kind === "meal" ? (
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
                    </>
                  )}
                </div>
              ) : null}

              {tourTab === "place" ? (
                <div className="mishiranu-tour-page mishiranu-tour-page--place" role="tabpanel" aria-label="土地">
                  <PlaceBoard
                    station={station}
                    tourTitle={
                      selectedCourse ? selectedCourse.title : shownCopy.tourTitle
                    }
                    onOpenVisit={(spot) => {
                      setActiveSpotId(spot.id);
                      setTourTab("map");
                      setSpotSheetOpen(true);
                    }}
                  />
                </div>
              ) : null}

              {tourTab === "more" ? (
                <div
                  className="mishiranu-tour-page mishiranu-settings"
                  role="tabpanel"
                  aria-label="設定"
                >
                  <h3 className="mishiranu-settings-title">設定</h3>

                  <section className="mishiranu-settings-group" aria-label="この駅">
                    <p className="mishiranu-settings-group-label">この駅</p>
                    <div className="mishiranu-settings-card">
                      <div className="mishiranu-settings-row">
                        <span>いまの駅</span>
                        <span className="mishiranu-settings-detail">
                          {station.name} · {station.prefecture}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="mishiranu-settings-action"
                        disabled={stationLoading || station.id === "__empty__"}
                        onClick={() => void requestAiStation(station.name)}
                      >
                        案内を作り直す（AI）
                      </button>
                      <button
                        type="button"
                        className="mishiranu-settings-action"
                        onClick={() => goChat(true)}
                      >
                        駅を探し直す
                      </button>
                    </div>
                  </section>

                  <section
                    className="mishiranu-settings-group"
                    aria-label="調べた駅"
                  >
                    <p className="mishiranu-settings-group-label">調べた駅</p>
                    <div className="mishiranu-settings-card">
                      {savedStations.length === 0 ? (
                        <p className="mishiranu-settings-empty">
                          まだありません。駅を調べると、ここに残ります。あとから思い出して開けます。
                        </p>
                      ) : (
                        <>
                          <div className="mishiranu-settings-row">
                            <span>{savedStations.length}駅</span>
                            <span className="mishiranu-settings-detail">
                              新しいものが上
                            </span>
                          </div>
                          {savedStations.map((saved) => {
                            const on = saved.id === station.id;
                            const bare = saved.name.replace(/駅$/u, "");
                            return (
                              <div
                                key={saved.id}
                                className={
                                  on
                                    ? "mishiranu-saved-station mishiranu-saved-station--on"
                                    : "mishiranu-saved-station"
                                }
                              >
                                <button
                                  type="button"
                                  className="mishiranu-saved-station-open"
                                  onClick={() => recallSavedStation(saved)}
                                  aria-current={on ? "true" : undefined}
                                >
                                  <span className="mishiranu-saved-station-name">
                                    {bare}
                                    {on ? " · いま" : ""}
                                  </span>
                                  <span className="mishiranu-settings-detail">
                                    {saved.prefecture} · {saved.line}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className="mishiranu-saved-station-forget"
                                  onClick={() => forgetSavedStation(saved.id)}
                                  aria-label={`${bare}をリストから外す`}
                                >
                                  外す
                                </button>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </section>

                  <section
                    className="mishiranu-settings-group"
                    aria-label="物語・寄り道"
                  >
                    <p className="mishiranu-settings-group-label">物語・寄り道</p>
                    <div className="mishiranu-settings-card">
                      <button
                        type="button"
                        className="mishiranu-settings-action"
                        onClick={drawSecret}
                      >
                        とりあえずここに行け
                      </button>
                      <button
                        type="button"
                        className="mishiranu-settings-action"
                        disabled={copyLoading}
                        onClick={() => void loadCopy(station, timeId)}
                      >
                        コピーを引き直す
                      </button>
                      <button
                        type="button"
                        className="mishiranu-settings-action"
                        onClick={() => void shareTour()}
                      >
                        物語をコピー
                      </button>
                    </div>
                  </section>

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

                  <section
                    className="mishiranu-settings-group"
                    aria-label="見た目"
                  >
                    <p className="mishiranu-settings-group-label">見た目</p>
                    <div className="mishiranu-settings-card mishiranu-settings-card--skin">
                      <p className="mishiranu-settings-skin-lead">案内の色と空気</p>
                      <div className="mishiranu-skin-picks" role="radiogroup" aria-label="見た目">
                        {MISHIRANU_SKINS.map((item) => {
                          const on = skin === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              className={
                                on
                                  ? "mishiranu-skin-pick mishiranu-skin-pick--on"
                                  : "mishiranu-skin-pick"
                              }
                              onClick={() => chooseSkin(item.id)}
                            >
                              <span className="mishiranu-skin-pick-title">
                                {item.code} · {item.label}
                              </span>
                              <span className="mishiranu-skin-pick-blurb">
                                {item.blurb}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  <section
                    className="mishiranu-settings-group"
                    aria-label="表示"
                  >
                    <p className="mishiranu-settings-group-label">表示</p>
                    <div className="mishiranu-settings-card">
                      <div className="mishiranu-settings-row">
                        <span>文字の大きさ</span>
                        <span className="mishiranu-settings-detail">
                          システム設定に合わせる
                        </span>
                      </div>
                      <div className="mishiranu-settings-row">
                        <span>地図の詳細</span>
                        <span className="mishiranu-settings-detail">準備中</span>
                      </div>
                    </div>
                  </section>

                  <IosInstallCard />

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

                  <section
                    className="mishiranu-settings-group"
                    aria-label="このアプリについて"
                  >
                    <p className="mishiranu-settings-group-label">
                      このアプリについて
                    </p>
                    <p className="mishiranu-foot">
                      地図は OpenStreetMap。ピンは検索した駅の座標です。
                      ピクトグラム素材提供：日本デザインセンター／
                      <a
                        href="https://experience-japan.info/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        EXPERIENCE JAPAN PICTOGRAMS
                      </a>
                      。
                    </p>
                  </section>
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
                  </p>
                  {hoursFor(activeSpot) ? (
                    <p className="mishiranu-spot-hours">
                      営業 {hoursFor(activeSpot)}
                    </p>
                  ) : null}
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
                      <IconMapPin />
                    ) : tab.id === "course" ? (
                      <IconTour />
                    ) : tab.id === "guide" ? (
                      <IconBinoculars />
                    ) : tab.id === "place" ? (
                      <IconHistory />
                    ) : (
                      <IconMore />
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
