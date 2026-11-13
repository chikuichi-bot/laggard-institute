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
  walkRadiusKmForCourse,
  bikePlacesByKind,
  bikeRentalFor,
  budgetYenFor,
  hoursFor,
  mealTierFor,
  soloOkFor,
  spotGuide,
  type AreaHistoryNote,
  type GuideKind,
  type Spot,
  type StationSeed,
  type TimeOptionId,
} from "@/data/mishiranu-stations";
import {
  loadAtmosphereFirst,
  saveAtmosphereFirst,
} from "@/lib/mishiranu-atmosphere";
import {
  STORY_PEEK_EMPTY_BODY,
  STORY_PEEK_WALK_INVITE,
  bodyHasWalkInvite,
  ensureStoryPeekWalkInvite,
  storyNotesForName,
} from "@/lib/mishiranu-story-notes";
import type { TourCopy } from "@/lib/mishiranu-copy";
import {
  BUDGET_PREF_OPTIONS,
  DAY_PART_OPTIONS,
  SOLO_PREF_OPTIONS,
  buildCoursesForStation,
  buildFirstVisitOrdinaryCourses,
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
import {
  allowsOnMap,
  mapTrustedSpots,
  sealMapCoordinates,
} from "@/lib/mishiranu-map-trust";
import {
  DeviceGeoError,
  geoFailureMessage,
  startDevicePosition,
} from "@/lib/mishiranu-device-geo";
import {
  findNearestStation,
  haversineKm,
  stationLatLng,
} from "@/lib/mishiranu-geo";
import {
  arrivalFragment,
  guideCatalogSpots,
} from "@/lib/mishiranu-lore";
import {
  findSavedStation,
  loadStationLibrary,
  mergeCatalog,
  removeStationFromLibrary,
  saveStationToLibrary,
  stableStationId,
} from "@/lib/mishiranu-station-library";
import {
  BYOK_PRODUCT,
  grantCoinPack,
  loadBillingState,
  refundGenerationCoin,
  saveBillingState,
  setBillingApiKey,
  setByokOpenAiSettings,
  setByokProvider,
  setPreferCoinOverByok,
  tryConsumeGenerationCoin,
  unlockByok,
  usesByokForGeneration,
  userAiConfigFromBilling,
  type BillingState,
} from "@/lib/mishiranu-billing";
import { PricingBoard } from "./PricingBoard";
import TutorialBoard from "./TutorialBoard";
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
import HeroRoadMap from "./HeroRoadMap";
import { IosInstallCard } from "./IosInstall";
import {
  PlaceBoard,
  placeScript,
  type PlaceSpeakSection,
} from "./PlaceBoard";
import { prepareSpeakableText } from "@/lib/mishiranu-speech-speakable";
import { stationNameReading } from "@/data/mishiranu-station-readings";
import { StationChrome, chromeStationLabel } from "./StationChrome";
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
type ChatPhase = "station" | "ready";

/** iPhone-friendly tour pages (bottom tabs) */
type TourTab = "map" | "course" | "guide" | "place" | "more";

const TOUR_TABS: Array<{
  id: TourTab;
  label: string;
}> = [
  { id: "place", label: "土地" },
  { id: "map", label: "地図" },
  { id: "guide", label: "案内" },
  { id: "course", label: "歩く" },
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

function CandidateConfirmSheet({
  queryLabel,
  items,
  onConfirm,
  onCancel,
}: {
  queryLabel: string;
  items: Array<{
    id: string;
    name: string;
    detail: string;
    station?: StationSeed;
  }>;
  onConfirm: (item: {
    id: string;
    name: string;
    detail: string;
    station?: StationSeed;
  }) => void;
  onCancel: () => void;
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = items.find((i) => i.id === selectedId) ?? items[0];
  useEffect(() => {
    if (!items.some((i) => i.id === selectedId)) {
      setSelectedId(items[0]?.id ?? "");
    }
  }, [items, selectedId]);

  return (
    <div
      className="mishiranu-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mishiranu-candidate-title"
    >
      <button
        type="button"
        className="mishiranu-confirm-backdrop"
        aria-label="閉じる"
        onClick={onCancel}
      />
      <div className="mishiranu-confirm-panel">
        <p className="mishiranu-confirm-eyebrow">見知らぬ駅 · 候補</p>
        <hr className="mishiranu-confirm-rule" />
        <h4 id="mishiranu-candidate-title" className="mishiranu-confirm-title">
          {`「${queryLabel}」の候補`}
        </h4>
        <p className="mishiranu-confirm-body">
          駅を選ぶと、まず物語のゆかりを無料でみます。
        </p>
        <ul className="mishiranu-candidate-list">
          {items.map((item) => {
            const active = item.id === selected?.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={
                    active
                      ? "mishiranu-candidate-row mishiranu-candidate-row--active"
                      : "mishiranu-candidate-row"
                  }
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="mishiranu-candidate-name">{item.name}</span>
                  <span className="mishiranu-candidate-detail">{item.detail}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {selected ? (
          <p className="mishiranu-confirm-body mishiranu-confirm-body--after-list">
            {`「${selected.name.replace(/駅$/u, "")}」の物語のゆかりをみますか？`}
          </p>
        ) : null}
        <div className="mishiranu-confirm-actions">
          <button
            type="button"
            className="mishiranu-btn mishiranu-btn--primary"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
          >
            みる
          </button>
          <button type="button" className="mishiranu-btn" onClick={onCancel}>
            やめる
          </button>
        </div>
      </div>
    </div>
  );
}

function StoryPeekSheet({
  stationLabel,
  notes,
  coinAsk,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  stationLabel: string;
  notes: AreaHistoryNote[];
  coinAsk: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="mishiranu-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mishiranu-story-peek-title"
    >
      <button
        type="button"
        className="mishiranu-confirm-backdrop"
        aria-label="閉じる"
        onClick={onCancel}
      />
      <div className="mishiranu-confirm-panel mishiranu-story-peek-panel">
        <p className="mishiranu-confirm-eyebrow">見知らぬ駅 · 物語のゆかり</p>
        <hr className="mishiranu-confirm-rule" />
        <h4 id="mishiranu-story-peek-title" className="mishiranu-confirm-title">
          {`「${stationLabel}」`}
        </h4>
        <p className="mishiranu-confirm-body">まずは無料で、物語のゆかりだけ。</p>
        {notes.length === 0 ? (
          <p className="mishiranu-confirm-body">{STORY_PEEK_EMPTY_BODY}</p>
        ) : (
          <ul className="mishiranu-story-peek-list">
            {notes.slice(0, 4).map((note) => (
              <li key={note.title}>
                <p className="mishiranu-story-peek-note-title">{note.title}</p>
                <p className="mishiranu-story-peek-note-body">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
        {notes.length > 0 &&
        !bodyHasWalkInvite(notes[notes.length - 1]?.body ?? "") ? (
          <p className="mishiranu-story-peek-walk-invite">
            {STORY_PEEK_WALK_INVITE}
          </p>
        ) : null}
        <p className="mishiranu-confirm-body mishiranu-confirm-body--after-list">
          {coinAsk}
        </p>
        <div className="mishiranu-confirm-actions">
          <button
            type="button"
            className="mishiranu-btn mishiranu-btn--primary"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button type="button" className="mishiranu-btn" onClick={onCancel}>
            やめる
          </button>
        </div>
      </div>
    </div>
  );
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
  "知らない駅に到着しましたね。現在地から探すか、駅名を入力してください。決まると、その土地の案内を開きます。一度見た駅は、この端末に残ります。";

export default function MishiranuApp({
  initialStep = "hero",
  initialStationId,
  initialTimeId = "1h",
  initialFocus,
}: Props) {
  const [step, setStep] = useState<Step>(
    initialStep === "pick" ? "hero" : initialStep,
  );
  const [stationId, setStationId] = useState<string>(initialStationId ?? "");
  const [dynamicStation, setDynamicStation] = useState<StationSeed | null>(null);
  const [savedStations, setSavedStations] = useState<StationSeed[]>([]);
  const [stationLoading, setStationLoading] = useState(false);
  const [timeId, setTimeId] = useState<TimeOptionId>(
    initialTimeId === "1h" || initialTimeId === "3h" ? "half" : initialTimeId,
  );
  const [focusKinds, setFocusKinds] = useState<GuideKind[]>(() =>
    parseFocusList(initialFocus),
  );
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [showStationSearch, setShowStationSearch] = useState(true);
  const [heroNote, setHeroNote] = useState<string | null>(null);
  const [settingsPane, setSettingsPane] = useState<
    "home" | "pricing" | "tutorial"
  >("home");
  const [billing, setBilling] = useState<BillingState>(() => loadBillingState());
  const [billingBusyId, setBillingBusyId] = useState<string | null>(null);
  const [billingNote, setBillingNote] = useState<string | null>(null);
  /** 試験中は毎回表示。本番は localStorage TUTORIAL_SEEN_KEY で一度きりに戻す。 */
  const [showTutorial, setShowTutorial] = useState(true);
  const [atmosphereFirst, setAtmosphereFirst] = useState(true);
  const [rebuildConfirmOpen, setRebuildConfirmOpen] = useState(false);
  /** GPS など、すでに駅が決まっているときの確認（「ここは」は現在地だけ） */
  const [pendingConfirm, setPendingConfirm] = useState<{
    kind: "locate" | "open";
    station: StationSeed;
  } | null>(null);
  /** 駅名検索の候補一覧。選んでから物語peekへ */
  const [candidateSheet, setCandidateSheet] = useState<{
    query: string;
    items: Array<{
      id: string;
      name: string;
      detail: string;
      station?: StationSeed;
    }>;
  } | null>(null);
  /** 無料の物語のゆかり → コインで散歩道 */
  const [storyPeek, setStoryPeek] = useState<{
    bare: string;
    spoken?: string;
    notes: AreaHistoryNote[];
  } | null>(null);
  const [storyPeekLoading, setStoryPeekLoading] = useState(false);
  const [skin, setSkin] = useState<MishiranuSkin>("ma");
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
  const [tourTab, setTourTab] = useState<TourTab>("place");
  const [placeSpeaking, setPlaceSpeaking] =
    useState<PlaceSpeakSection | null>(null);
  const [guideTab, setGuideTab] = useState<GuideTabId>("sight");
  const [spotSheetOpen, setSpotSheetOpen] = useState(false);
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
    setAtmosphereFirst(loadAtmosphereFirst());
    const nextBilling = loadBillingState();
    setBilling(nextBilling);
    saveBillingState(nextBilling);
  }, []);

  useEffect(() => {
    saveBillingState(billing);
  }, [billing]);

  function finishTutorial() {
    // 試験中: 見たフラグを書かない（リロード／再入場でまた出る）
    setShowTutorial(false);
  }

  function chooseSkin(next: MishiranuSkin) {
    setSkin(next);
    saveMishiranuSkin(next);
  }

  function updateBilling(next: BillingState) {
    setBilling(next);
    saveBillingState(next);
  }

  async function buyCoinPack(packId: string) {
    setBillingBusyId(packId);
    setBillingNote(null);
    try {
      // Webラボ: App Store / 決済接続前は端末内で反映（仕組みの正）。
      await new Promise((r) => setTimeout(r, 350));
      updateBilling(grantCoinPack(billing, packId));
      setBillingNote("コインを追加しました。");
    } finally {
      setBillingBusyId(null);
    }
  }

  async function buyByokUnlock() {
    setBillingBusyId(BYOK_PRODUCT.id);
    setBillingNote(null);
    try {
      await new Promise((r) => setTimeout(r, 350));
      updateBilling(unlockByok(billing));
      setBillingNote("買い切りを有効にしました。API キーを入力してください。");
    } finally {
      setBillingBusyId(null);
    }
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
    return sealMapCoordinates(withAreaDepth(raw));
  }, [stationId, dynamicStation, catalog, savedStations]);
  const bikeRental = useMemo(() => bikeRentalFor(station), [station]);
  const areaParagraphs = useMemo(
    () => paragraphsFrom(station.areaAbout),
    [station.areaAbout],
  );

  function stopPlaceSpeech() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlaceSpeaking(null);
  }

  function togglePlaceSpeak(section: PlaceSpeakSection) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (placeSpeaking === section) {
      stopPlaceSpeech();
      return;
    }
    window.speechSynthesis.cancel();
    const text = placeScript(station, section);
    if (!text) return;
    const spoken = prepareSpeakableText(text, {
      stationName: station.name,
      stationReading: stationNameReading(station),
      extraNames: [
        ...(station.spots ?? []).map((sp) => sp.name),
        ...(station.sightseeingNotes ?? []).map((n) => n.title),
        ...(station.historyNotes ?? []).map((n) => n.title),
        ...(station.storyNotes ?? []).map((n) => n.title),
      ],
    });
    const utter = new SpeechSynthesisUtterance(spoken || text);
    utter.lang = "ja-JP";
    utter.rate = 0.88;
    utter.onend = () => setPlaceSpeaking(null);
    utter.onerror = () => setPlaceSpeaking(null);
    setPlaceSpeaking(section);
    window.speechSynthesis.speak(utter);
  }

  // 駅が変わった／ツアーを出たときだけ止める。タブ切替では止めない（聴きながら散策）。
  useEffect(() => {
    stopPlaceSpeech();
  }, [station.id]);

  useEffect(() => {
    if (step !== "tour") stopPlaceSpeech();
  }, [step]);

  // Static host (lagado.jp) では searchParams がビルド時固定なので、URL をクライアントで読む
  useEffect(() => {
    if (urlBootstrapped.current) return;
    urlBootstrapped.current = true;
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const stationParam = params.get("station");
    const timeParam = params.get("time");
    const focusParam = params.get("focus");
    if (view === "pick") {
      setStep("hero");
    } else if (view === "hero" || view === "tour") {
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
    } else if (view === "tour") {
      // 駅が決まったあとの既定は土地（地図ではない）
      setTourTab("place");
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
    const bare = q.endsWith("駅") ? q.slice(0, -1) : q;
    const savedIds = new Set(savedStations.map((s) => s.id));
    const pool = q
      ? catalog.filter((s) => {
          const nameBare = s.name.endsWith("駅") ? s.name.slice(0, -1) : s.name;
          return (
            s.name.includes(q) ||
            s.name.includes(bare) ||
            nameBare.includes(bare) ||
            bare.includes(nameBare) ||
            s.prefecture.includes(q) ||
            s.line.includes(q) ||
            s.tourTitle.includes(q)
          );
        })
      : catalog.filter((s) => savedIds.has(s.id));
    return pool.slice(0, 8);
  }, [query, catalog, savedStations]);

  const time = TIME_OPTIONS.find((t) => t.id === timeId) ?? TIME_OPTIONS[0];
  const mealPrefs = useMemo<MealPrefs>(
    () => ({ solo: mealSolo, budget: mealBudget }),
    [mealSolo, mealBudget],
  );
  // 案内用（未確定も含む・店も厚く）。地図用は mapSpots。
  const guidePool = useMemo(() => {
    const base = guideCatalogSpots(station);
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
  }, [station, selectedCourse]);
  // 地図は lock / Apple 確定のみ（Apple は駅から 1.5km 以内）
  const spots = useMemo(() => {
    const center =
      station.lat != null && station.lng != null
        ? { lat: station.lat, lng: station.lng }
        : null;
    return mapTrustedSpots(guidePool, station.name, center);
  }, [guidePool, station.name, station.lat, station.lng]);
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
    nextTab: TourTab = "place",
  ) {
    const params = new URLSearchParams();
    params.set("view", nextStep);
    if (nextStep === "tour") {
      params.set("station", nextStationId);
      params.set("time", nextTimeId);
      params.set("tab", nextTab);
      if (kinds.length > 0) params.set("focus", kinds.join(","));
    }
    window.history.pushState({}, "", `?${params.toString()}`);
  }

  function goHero() {
    setStep("hero");
    syncUrl("hero", stationIdRef.current, timeIdRef.current, focusKinds);
  }

  function goChat(reset = false) {
    // 到着チャットは廃止。トップで現在地／駅名検索する。
    if (reset) {
      setChatPhase("station");
      setShowStationSearch(true);
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
      setHeroNote(null);
    }
    goHero();
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
    const nowPart = dayPartFromHour(new Date().getHours());
    const stayId: TimeOptionId = "half";
    setDynamicStation(toSave);
    setSavedStations(saveStationToLibrary(toSave));
    setStationId(toSave.id);
    setShowStationSearch(false);
    setQuery("");
    setDraft("");
    setMealSolo("either");
    setMealBudget("either");
    setDayPart(nowPart);
    setTimeId(stayId);
    const prefs = { solo: "either" as SoloPref, budget: "either" as BudgetPref };
    const deep = withAreaDepth(toSave);
    const ordinary = buildFirstVisitOrdinaryCourses(deep, nowPart, stayId);
    const ordinaryIds = new Set(ordinary.map((c) => c.id));
    const built = buildCoursesForStation(deep, stayId, nowPart, prefs).filter(
      (c) => !ordinaryIds.has(c.id),
    );
    setSelectedCourse(ordinary[0] ?? null);
    setCourses([...ordinary, ...built]);
    if (!opts?.omitYou) {
      pushMessages({ role: "you", text: spoken ?? `${toSave.name}駅です` });
    }
    pushMessages({
      role: "guide",
      text: `${toSave.name}（${toSave.prefecture}・${toSave.line}）。土地の案内を開きます。`,
    });
    goTour(toSave.id, stayId, focusKinds, "place");
  }

  function matchStation(text: string): StationSeed | undefined {
    return matchStationIn(text, catalog);
  }

  function locateHere() {
    if (geoLoading || stationLoading) return;

    // Start GPS in this same tap turn (required by iOS Safari), before setState.
    const pending = startDevicePosition();

    setGeoLoading(true);
    setStep("hero");
    // 読み込み文はボタン側だけ。heroNote と重ねない。
    setHeroNote(null);

    void (async () => {
      try {
        const { lat, lng } = await pending;
        // Precise GPS never leaves the browser. Match against seed + saved library only.
        const local = findNearestStation(lat, lng, catalog);
        if (local && local.km <= 3.5) {
          setHeroNote(null);
          // いきなり開かず、確認してから案内へ。
          setPendingConfirm({ kind: "locate", station: local.station });
          return;
        }

        const nearestHint = local
          ? `いちばん近い保存済みの駅は${local.station.name}（約${local.km < 1 ? `${Math.round(local.km * 1000)}m` : `${local.km.toFixed(1)}km`}）ですが、徒歩圏外です。`
          : "";
        setHeroNote(
          `${nearestHint}駅名を入力すれば、全国どこでも徒歩圏の案内をつくれます。`.trim(),
        );
      } catch (err) {
        const failure =
          err instanceof DeviceGeoError ? err.failure : "unknown";
        setHeroNote(geoFailureMessage(failure));
      } finally {
        setGeoLoading(false);
      }
    })();
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

  /** 新規は無料の物語peekへ。作り直し・確認後だけコイン消費。 */
  async function requestAiStation(
    rawName: string,
    spoken?: string,
    opts?: { forceRefresh?: boolean },
  ) {
    const name = rawName.trim();
    if (!name || stationLoading || storyPeekLoading) return;
    const bare = name.replace(/駅$/u, "");

    // 一度調べた駅は端末から開く（毎回 API しない）。作り直しだけ forceRefresh。
    if (!opts?.forceRefresh) {
      const saved =
        findSavedStation(bare, savedStations) ??
        findSavedStation(bare, catalog) ??
        findSavedStation(bare);
      if (saved) {
        setChatPhase("station");
        setDraft("");
        setQuery("");
        setHeroNote(null);
        setStoryPeek(null);
        chooseStation(saved, spoken, { omitYou: true });
        return;
      }

      // 無料: 物語のゆかりだけ。正本が無ければ API で調べる（コインなし）。
      setChatPhase("station");
      setStep("hero");
      setDraft("");
      setQuery(name);
      setHeroNote(null);
      const localNotes = ensureStoryPeekWalkInvite(
        storyNotesForName(bare) ?? [],
      );
      if (localNotes.length > 0) {
        setStoryPeek({ bare, spoken, notes: localNotes });
        return;
      }
      setStoryPeek(null);
      setStoryPeekLoading(true);
      setHeroNote(`「${bare}」の物語のゆかりを、無料で調べています…`);
      try {
        const userAi = userAiConfigFromBilling(billing);
        const res = await fetch("/api/mishiranu/story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            name: bare,
            ...(userAi ? { userAi } : {}),
          }),
        });
        const raw = await res.text();
        let data: {
          storyNotes?: AreaHistoryNote[];
          error?: string;
          message?: string;
        } = {};
        try {
          data = raw ? (JSON.parse(raw) as typeof data) : {};
        } catch {
          setHeroNote(stationLookupErrorMessage(res.status, {}, raw));
          setStoryPeek({ bare, spoken, notes: [] });
          return;
        }
        if (!res.ok) {
          setHeroNote(stationLookupErrorMessage(res.status, data, raw));
          setStoryPeek({ bare, spoken, notes: [] });
          return;
        }
        setHeroNote(null);
        setStoryPeek({
          bare,
          spoken,
          notes: Array.isArray(data.storyNotes) ? data.storyNotes : [],
        });
      } catch {
        setHeroNote("物語の通信に失敗しました。通信状況をみて、もう一度どうぞ。");
        setStoryPeek({ bare, spoken, notes: [] });
      } finally {
        setStoryPeekLoading(false);
      }
      return;
    }

    await runPaidStationGeneration(bare, spoken, { forceRefresh: true });
  }

  async function runPaidStationGeneration(
    bare: string,
    spoken?: string,
    opts?: { forceRefresh?: boolean },
  ) {
    if (!bare || stationLoading) return;

    const spend = tryConsumeGenerationCoin(billing);
    if (!spend.ok) {
      const label = bare.endsWith("駅") ? bare : `${bare}駅`;
      setHeroNote(`「${label}」の案内：${spend.reason ?? "コインが足りません。"}`);
      setQuery(bare);
      setChatPhase("station");
      setStep("hero");
      setStoryPeek(null);
      return;
    }
    updateBilling(spend.next);
    setStoryPeek(null);

    setStationLoading(true);
    setChatPhase("station");
    setStep("hero");
    setHeroNote(`「${bare}」のまわりを調べて、散歩道の案内をつくっています…`);
    setDraft("");
    setQuery(bare);
    try {
      const userAi = userAiConfigFromBilling(spend.next);
      const res = await fetch("/api/mishiranu/station", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: bare,
          ...(opts?.forceRefresh ? { forceRefresh: true } : {}),
          ...(userAi ? { userAi } : {}),
        }),
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
        updateBilling(refundGenerationCoin(spend.next, spend.usedCoin));
        setHeroNote(stationLookupErrorMessage(res.status, {}, raw));
        return;
      }
      if (!res.ok || !data.station) {
        updateBilling(refundGenerationCoin(spend.next, spend.usedCoin));
        setHeroNote(stationLookupErrorMessage(res.status, data, raw));
        return;
      }
      const next: StationSeed = {
        ...data.station,
        id: stableStationId(data.station.name, data.station.id),
        source: data.source ?? data.station.source ?? "ai",
      };
      setHeroNote(null);
      chooseStation(next, spoken, { omitYou: true });
    } catch {
      updateBilling(refundGenerationCoin(spend.next, spend.usedCoin));
      setHeroNote("案内の通信に失敗しました。通信状況をみて、もう一度どうぞ。");
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
    const tab = openTab ?? "place";
    setStationId(nextStationId);
    setTimeId(nextTimeId);
    setFocusKinds(kinds);
    setActiveSpotId(null);
    setSpotSheetOpen(false);
    setTourTab(tab);
    setGuideTab(kinds[0] ?? "sight");
    setStep("tour");
    setChatPhase("ready");
    syncUrl("tour", nextStationId, nextTimeId, kinds, tab);
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
    const nowPart = dayPartFromHour(new Date().getHours());
    const ordinary = buildFirstVisitOrdinaryCourses(sealed, nowPart, "half");
    setDayPart(nowPart);
    setTimeId("half");
    setSelectedCourse(ordinary[0] ?? null);
    setCourses(ordinary);
    goTour(sealed.id, "half", focusKinds, "place");
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
    // 歩く・案内・土地から地点を選んだら地図へ移してその場所を見せる
    setTourTab(opts?.tab ?? "map");
  }

  function handleComposerSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || chatPhase !== "station") return;
    void requestAiStation(text, text);
  }

  async function shareTour() {
    const lines = [
      `【見知らぬ駅】${station.name}`,
      shownCopy.tourTitle,
      shownCopy.catchCopy,
      `徒歩圏 約 ${walkRadiusKmForCourse(selectedCourse)} km`,
    ];
    if (focusKinds.length > 0) {
      lines.push(`案内の重点: ${focusKinds.map((k) => GUIDE_LABEL[k]).join("・")}`);
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

  return (
    <div className="mishiranu" data-skin={skin}>
      <div
        className={
          step === "pick" ? "mishiranu-shell mishiranu-shell--chat" : "mishiranu-shell"
        }
      >
        {step === "hero" ? (
          <section
            className="mishiranu-hero mishiranu-hero--ma"
            aria-label="見知らぬ駅"
          >
            <div className="mishiranu-hero-copy">
              <div className="mishiranu-hero-stage">
              <h1 className="mishiranu-brand mishiranu-brand--vertical">見知らぬ駅</h1>
              <HeroRoadMap />

              <div className="mishiranu-cta-row mishiranu-hero-arrive">
                <button
                  type="button"
                  className="mishiranu-btn mishiranu-btn--locate-text"
                  disabled={geoLoading || stationLoading || storyPeekLoading}
                  onClick={() => locateHere()}
                >
                  {geoLoading
                    ? "調べています…"
                    : stationLoading
                      ? "案内をつくっています…"
                      : storyPeekLoading
                        ? "物語を調べています…"
                        : "この駅について"}
                </button>
                {!geoLoading && !stationLoading && heroNote ? (
                  <p
                    className="mishiranu-note mishiranu-note--above-search"
                    role="status"
                  >
                    {heroNote}
                  </p>
                ) : null}
                {pendingConfirm ? (
                  <div
                    className="mishiranu-confirm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="mishiranu-locate-title"
                  >
                    <button
                      type="button"
                      className="mishiranu-confirm-backdrop"
                      aria-label="閉じる"
                      onClick={() => setPendingConfirm(null)}
                    />
                    <div className="mishiranu-confirm-panel">
                      <p className="mishiranu-confirm-eyebrow">見知らぬ駅 · 案内</p>
                      <hr className="mishiranu-confirm-rule" />
                      <h4
                        id="mishiranu-locate-title"
                        className="mishiranu-confirm-title"
                      >
                        {pendingConfirm.kind === "locate"
                          ? `ここは${pendingConfirm.station.name.replace(/駅$/u, "")}駅です`
                          : `「${pendingConfirm.station.name.replace(/駅$/u, "")}駅」ですか？`}
                      </h4>
                      <p className="mishiranu-confirm-body">
                        この駅の徒歩圏の案内を開きますか？
                      </p>
                      <div className="mishiranu-confirm-actions">
                        <button
                          type="button"
                          className="mishiranu-btn mishiranu-btn--primary"
                          onClick={() => {
                            const next = pendingConfirm.station;
                            setPendingConfirm(null);
                            chooseStation(next, undefined, { omitYou: true });
                          }}
                        >
                          調べる
                        </button>
                        <button
                          type="button"
                          className="mishiranu-btn"
                          onClick={() => setPendingConfirm(null)}
                        >
                          やめる
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {candidateSheet ? (
                  <CandidateConfirmSheet
                    queryLabel={candidateSheet.query}
                    items={candidateSheet.items}
                    onCancel={() => setCandidateSheet(null)}
                    onConfirm={(item) => {
                      setCandidateSheet(null);
                      if (item.station && (item.station.spots?.length ?? 0) >= 3) {
                        chooseStation(item.station, undefined, { omitYou: true });
                      } else {
                        void requestAiStation(
                          item.name.replace(/駅$/u, ""),
                          item.name,
                        );
                      }
                    }}
                  />
                ) : null}
                {storyPeek ? (
                  <StoryPeekSheet
                    stationLabel={
                      storyPeek.bare.endsWith("駅")
                        ? storyPeek.bare
                        : `${storyPeek.bare}駅`
                    }
                    notes={storyPeek.notes}
                    coinAsk={
                      usesByokForGeneration(billing)
                        ? "この先は散歩道の案内です。自分の API でつくります（コイン不要）。"
                        : `この先は散歩道の案内です。コインを1枚使います（残り ${billing.coins} 枚）。`
                    }
                    confirmLabel={
                      usesByokForGeneration(billing)
                        ? "散歩道をつくる"
                        : "コインで散歩道をつくる"
                    }
                    onConfirm={() => {
                      const peek = storyPeek;
                      setStoryPeek(null);
                      void runPaidStationGeneration(peek.bare, peek.spoken);
                    }}
                    onCancel={() => setStoryPeek(null)}
                  />
                ) : null}
                <form
                  className="mishiranu-hero-search mishiranu-hero-search--line"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const text = query.trim();
                    if (!text || stationLoading) return;
                    const bare = text.endsWith("駅") ? text.slice(0, -1) : text;
                    const matches = filteredStations.slice(0, 8);
                    const items =
                      matches.length > 0
                        ? matches.map((s) => ({
                            id: s.id,
                            name: s.name.endsWith("駅") ? s.name : `${s.name}駅`,
                            detail: `${s.prefecture} · ${s.line}`,
                            station: s,
                          }))
                        : [
                            {
                              id: `typed-${bare}`,
                              name: `${bare}駅`,
                              detail: "入力した名前のまま調べる",
                            },
                          ];
                    setCandidateSheet({ query: bare, items });
                  }}
                >
                  <label className="mishiranu-search mishiranu-search--line">
                    <span className="mishiranu-search-label">駅名</span>
                    <input
                      id="mishiranu-station-search-input"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="例: 藤森 / 出町柳"
                      autoComplete="off"
                      disabled={stationLoading}
                    />
                  </label>
                  {query.trim() ? (
                    <button
                      type="submit"
                      className="mishiranu-btn mishiranu-btn--search-line"
                      disabled={stationLoading}
                    >
                      開く
                    </button>
                  ) : null}
                </form>
              </div>
              {query.trim() && filteredStations.length > 0 ? (
                <ul className="mishiranu-chat-station-list mishiranu-hero-station-list">
                  {filteredStations.slice(0, 8).map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={stationLoading}
                        onClick={() => {
                          const bare = query.trim().endsWith("駅")
                            ? query.trim().slice(0, -1)
                            : query.trim();
                          setCandidateSheet({
                            query: bare || s.name.replace(/駅$/u, ""),
                            items: filteredStations.slice(0, 8).map((row) => ({
                              id: row.id,
                              name: row.name.endsWith("駅")
                                ? row.name
                                : `${row.name}駅`,
                              detail: `${row.prefecture} · ${row.line}`,
                              station: row,
                            })),
                          });
                        }}
                      >
                        <span className="mishiranu-station-name">{s.name}</span>
                        <span className="mishiranu-station-meta">
                          {s.prefecture} · {s.line}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              </div>
              {savedStations.length > 0 ? (
                <p className="mishiranu-fallback-links">
                  {`保存 ${savedStations.length} 駅 · 検索した駅だけがここに残ります`}
                </p>
              ) : null}
              <div className="mishiranu-hero-install">
                <IosInstallCard compact />
              </div>
            </div>
          </section>
        ) : null}

        {false && step === "pick" ? (
          <section className="mishiranu-chat" aria-labelledby="chat-title">
            <header className="mishiranu-chat-head">
              <p className="mishiranu-kicker">
                {savedStations.length > 0
                  ? `ARRIVAL · 保存 ${savedStations.length} 駅 · 全国検索可`
                  : "ARRIVAL · 全国の駅を検索"}
              </p>
              <h2 id="chat-title" className="mishiranu-h2 mishiranu-h2--chat">
                駅が決まると、土地の案内へ
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

              {chatPhase === "ready" ? (
                <p className="mishiranu-chat-opening">土地の案内を開いています…</p>
              ) : null}

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
              label={chromeStationLabel(station.name, station.line)}
              onBack={() => goChat(true)}
            />

            <div className="mishiranu-tour-pages">
              {tourTab === "map" ? (
                <div className="mishiranu-tour-page" role="tabpanel" aria-label="地図">
                  <StationMap
                    key={`${station.id}-${skin}`}
                    station={station}
                    spots={spots}
                    radiusKm={walkRadiusKmForCourse(selectedCourse)}
                    corridors={selectedCourse?.corridors ?? null}
                    activeSpotId={activeSpotId ?? activeSpot?.id ?? null}
                    courseStopIds={courseStopIds}
                    onSelect={(id) => openSpot(id)}
                  />
                  <div className="mishiranu-map-foot">
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
                          {kind === "rest" ? "休む" : GUIDE_LABEL[kind]}
                        </li>
                      ))}
                    </ul>
                    <p className="mishiranu-map-meta">
                      {[
                        `徒歩圏 約 ${walkRadiusKmForCourse(selectedCourse)} km`,
                        selectedCourse
                          ? `${selectedCourse.title} · 番号順`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              ) : null}

              {tourTab === "course" ? (
                <div className="mishiranu-tour-page" role="tabpanel" aria-label="歩く">
                  {selectedCourse ? (
                    <section
                      className="mishiranu-course-itinerary mishiranu-course-itinerary--wayfind"
                      aria-labelledby="course-itinerary-title"
                    >
                      <p className="mishiranu-kicker">
                        <IconTour />
                        駅から、駅まで
                      </p>
                      <h3
                        id="course-itinerary-title"
                        className="mishiranu-course-itinerary-title"
                      >
                        <CourseIcon courseId={selectedCourse.id} />
                        {selectedCourse.title}
                      </h3>
                      <button
                        type="button"
                        className={`mishiranu-walk-listen${placeSpeaking ? " mishiranu-walk-listen--on" : ""}`}
                        onClick={() => togglePlaceSpeak("all")}
                        aria-pressed={Boolean(placeSpeaking)}
                      >
                        <strong>
                          {placeSpeaking
                            ? "ガイダンスを止める"
                            : "ガイダンスを聴きながら歩く"}
                        </strong>
                        <small>
                          {placeSpeaking
                            ? "歴史と今の読み上げ中 · 散策はそのまま"
                            : "土地の歴史と今を耳でたどります"}
                        </small>
                      </button>
                      {(() => {
                        const variants = courses.filter(
                          (c) =>
                            c.id.includes("ordinary-short") ||
                            c.id.includes("ordinary-long"),
                        );
                        if (variants.length < 2) return null;
                        return (
                          <div
                            className="mishiranu-wayfind-length"
                            role="tablist"
                            aria-label="歩く長さ"
                          >
                            {variants.map((option) => {
                              const on = option.id === selectedCourse.id;
                              const label = option.id.includes("long")
                                ? "大回り"
                                : "小回り";
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  role="tab"
                                  aria-selected={on}
                                  className={
                                    on
                                      ? "mishiranu-wayfind-length-btn mishiranu-wayfind-length-btn--on"
                                      : "mishiranu-wayfind-length-btn"
                                  }
                                  onClick={() => setSelectedCourse(option)}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                      {selectedCourse.corridors &&
                      selectedCourse.corridors.length > 0 ? (
                        <div className="mishiranu-atmosphere-list">
                          <p className="mishiranu-atmosphere-kicker">空気の道</p>
                          {selectedCourse.corridors.map((corridor) => (
                            <div
                              key={corridor.id}
                              className="mishiranu-atmosphere-item"
                            >
                              <strong>{corridor.name}</strong>
                              <p>{corridor.blurb}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="mishiranu-wayfind-summary">
                        <div className="mishiranu-wayfind-chips">
                          <div>
                            <span>所要</span>
                            <strong>約{selectedCourse.totalMinutes}分</strong>
                          </div>
                          <div>
                            <span>目の置きどころ</span>
                            <strong>{selectedCourse.stopCount}か所</strong>
                          </div>
                          <div>
                            <span>帰り</span>
                            <strong>同じ駅へ</strong>
                          </div>
                        </div>
                        <div className="mishiranu-wayfind-strip" aria-label="立ち寄り順">
                          <span className="mishiranu-wayfind-dot">出</span>
                          {selectedCourse.stops.map((stop, index) => (
                            <span key={stop.spotId} className="mishiranu-wayfind-strip-item">
                              <span className="mishiranu-wayfind-chevron" aria-hidden>
                                ›
                              </span>
                              <span className="mishiranu-wayfind-dot">
                                {index + 1}
                              </span>
                              <span className="mishiranu-wayfind-dot-name">
                                {stop.name}
                              </span>
                            </span>
                          ))}
                          <span className="mishiranu-wayfind-strip-item">
                            <span className="mishiranu-wayfind-chevron" aria-hidden>
                              ›
                            </span>
                            <span className="mishiranu-wayfind-dot">着</span>
                          </span>
                        </div>
                        <p className="mishiranu-wayfind-hint">
                          同じ道はなるべく通らず、駅へ帰ります。どこからでも駅まで歩いて戻れます。
                        </p>
                      </div>
                      <ol className="mishiranu-course-itinerary-list">
                        <li>
                          <div className="mishiranu-course-stop mishiranu-course-stop--departure">
                            <span className="mishiranu-course-stop-index" aria-hidden>
                              出
                            </span>
                            <span className="mishiranu-course-stop-body">
                              <span className="mishiranu-course-stop-leg">出発</span>
                              <span className="mishiranu-course-stop-name">
                                {(station.name.endsWith("駅")
                                  ? station.name.slice(0, -1)
                                  : station.name)}
                                駅
                              </span>
                              <span className="mishiranu-course-stop-meta">
                                改札を出て、ぶらりと
                              </span>
                            </span>
                          </div>
                        </li>
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
                                <span className="mishiranu-course-stop-leg">
                                  {index === 0 ? "駅から徒歩 約" : "次まで 徒歩約"}
                                  {stop.walkMinutes}分
                                  {index > 0 ? (
                                    <span className="mishiranu-course-stop-back">
                                      {" · "}駅まで約
                                      {Math.max(
                                        1,
                                        station.spots.find((s) => s.id === stop.spotId)
                                          ?.walkMinutes ?? stop.walkMinutes,
                                      )}
                                      分
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mishiranu-course-stop-name">
                                  {stop.name}
                                </span>
                                <span className="mishiranu-course-stop-meta">
                                  {stop.clockLabel ? (
                                    <span>{stop.clockLabel}</span>
                                  ) : null}
                                  <span style={{ color: GUIDE_COLOR[stop.guide] }}>
                                    {GUIDE_LABEL[stop.guide]}
                                  </span>
                                  <span>滞在 約{stop.dwellMinutes}分</span>
                                  <span className="mishiranu-course-stop-map">地図</span>
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                        <li>
                          <div className="mishiranu-course-stop mishiranu-course-stop--departure">
                            <span className="mishiranu-course-stop-index" aria-hidden>
                              着
                            </span>
                            <span className="mishiranu-course-stop-body">
                              <span className="mishiranu-course-stop-leg">
                                {selectedCourse.returnClockLabel
                                  ? `到着 · ${selectedCourse.returnClockLabel}`
                                  : "到着"}
                              </span>
                              <span className="mishiranu-course-stop-name">
                                {(station.name.endsWith("駅")
                                  ? station.name.slice(0, -1)
                                  : station.name)}
                                駅
                              </span>
                              <span className="mishiranu-course-stop-meta">
                                {selectedCourse.returnWalkMinutes
                                  ? `駅へ帰る · 徒歩約 ${selectedCourse.returnWalkMinutes} 分`
                                  : "駅が終点です"}
                              </span>
                            </span>
                          </div>
                        </li>
                      </ol>
                    </section>
                  ) : (
                    <section className="mishiranu-course-empty" aria-label="ベタなまわり方なし">
                      <p className="mishiranu-kicker">
                        <IconTour />
                        駅から、駅まで
                      </p>
                      <h3 className="mishiranu-course-itinerary-title">
                        駅から、小回り
                      </h3>
                      <p className="mishiranu-note">
                        寄る場所の名前は、まだ少ないようです。地図で駅のまわりを見て、気の向く方へ少し歩き、同じ駅へ帰ってくれば、それで一周です。
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
                          },
                          {
                            kind: "app" as const,
                            title: "アプリで借りる",
                            hint: "会員登録のあと、ポートで解錠",
                          },
                        ] as const
                      ).map((group) => {
                        const places = bikePlacesByKind(
                          bikeRental.places,
                          group.kind,
                        );
                        if (places.length === 0) return null;
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
                        // 案内は土地の顔全体（未確定含む）。地図用 spots とは分ける。
                        const edibleOmiyage = (s: Spot) =>
                          /ふたば|みたらし|だんご|団子|豆餅|阿闍梨|最中|羊羹|もみじ饅頭|赤福/.test(
                            s.name,
                          );
                        const base = guidePool.filter(
                          (s) => spotGuide(s) === kind,
                        );
                        const rawItems =
                          kind === "souvenir"
                            ? [
                                ...base,
                                ...guidePool.filter(
                                  (s) =>
                                    spotGuide(s) !== "souvenir" &&
                                    edibleOmiyage(s),
                                ),
                              ].filter(
                                (s, i, arr) =>
                                  arr.findIndex((x) => x.id === s.id) === i,
                              )
                            : [...base];
                        // 案内は駅から近い順（信頼ピンは座標、未確定は後ろへ）
                        let origin: { lat: number; lng: number } | null = null;
                        try {
                          origin = stationLatLng(station);
                        } catch {
                          origin =
                            station.lat != null && station.lng != null
                              ? { lat: station.lat, lng: station.lng }
                              : null;
                        }
                        const metersFromStation = (s: Spot) => {
                          if (!allowsOnMap(s, station.name, origin)) {
                            return 50_000 + Math.max(s.walkMinutes, 1) * 80;
                          }
                          if (
                            origin &&
                            s.lat != null &&
                            s.lng != null &&
                            Number.isFinite(s.lat) &&
                            Number.isFinite(s.lng)
                          ) {
                            const km = haversineKm(origin, {
                              lat: s.lat,
                              lng: s.lng,
                            });
                            if (km < 0.02 && s.walkMinutes > 0) {
                              return s.walkMinutes * 80;
                            }
                            return km * 1000;
                          }
                          return Math.max(s.walkMinutes, 1) * 80;
                        };
                        const items = rawItems.sort((a, b) => {
                          const dm =
                            metersFromStation(a) - metersFromStation(b);
                          if (Math.abs(dm) > 25) return dm;
                          if (a.walkMinutes !== b.walkMinutes) {
                            return a.walkMinutes - b.walkMinutes;
                          }
                          if (kind === "meal") {
                            const d =
                              mealPrefScore(b, mealPrefs) -
                              mealPrefScore(a, mealPrefs);
                            if (d) return d;
                          }
                          return a.name.localeCompare(b.name, "ja");
                        });
                        if (items.length === 0) {
                          const emptyCopy =
                            kind === "meal"
                              ? "この駅の徒歩圏に、案内できる店はまだありません。店がない駅として、地形や神社・公園を歩く案内をご覧ください。"
                              : kind === "souvenir"
                                ? "お土産の候補はありません。門前や社務所の授与品は、現地で見つかることがあります。"
                                : kind === "rest"
                                  ? "屋内の休み場は少なめです。川べりや公園のベンチなど、景色の休みを土地・観光からどうぞ。"
                                  : "この徒歩圏ではまだ少なめです。土地の話や、別の案内タブも見てみてください。";
                          return (
                            <p className="mishiranu-guide-empty">{emptyCopy}</p>
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
                    speakingSection={placeSpeaking}
                    onToggleSpeak={togglePlaceSpeak}
                  />
                </div>
              ) : null}

              {tourTab === "more" ? (
                <div
                  className="mishiranu-tour-page mishiranu-settings"
                  role="tabpanel"
                  aria-label={
                    settingsPane === "pricing"
                      ? "料金"
                      : settingsPane === "tutorial"
                        ? "見知らぬ駅について"
                        : "設定"
                  }
                >
                  {settingsPane === "pricing" ? (
                    <PricingBoard
                      billing={billing}
                      busyPackId={billingBusyId}
                      note={billingNote}
                      onBack={() => {
                        setSettingsPane("home");
                        setBillingNote(null);
                      }}
                      onBuyPack={(id) => void buyCoinPack(id)}
                      onBuyByok={() => void buyByokUnlock()}
                      onApiKeyChange={(key) =>
                        updateBilling(setBillingApiKey(billing, key))
                      }
                      onProviderChange={(provider) =>
                        updateBilling(setByokProvider(billing, provider))
                      }
                      onOpenAiSettingsChange={(patch) =>
                        updateBilling(setByokOpenAiSettings(billing, patch))
                      }
                      onPreferCoinChange={(prefer) =>
                        updateBilling(setPreferCoinOverByok(billing, prefer))
                      }
                    />
                  ) : settingsPane === "tutorial" ? (
                    <TutorialBoard
                      finishLabel="とじる"
                      onBack={() => setSettingsPane("home")}
                      onFinished={() => setSettingsPane("home")}
                    />
                  ) : (
                    <>
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
                        onClick={() => setRebuildConfirmOpen(true)}
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
                    aria-label="散歩道"
                  >
                    <p className="mishiranu-settings-group-label">散歩道</p>
                    <div className="mishiranu-settings-card">
                      <label className="mishiranu-settings-row mishiranu-settings-toggle">
                        <span>
                          空気の道を主に歩く
                          <span className="mishiranu-settings-detail">
                            商店街・街並み・川辺など、点では表せない区間を散歩の芯にする
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={atmosphereFirst}
                          onChange={(event) => {
                            const on = event.target.checked;
                            setAtmosphereFirst(on);
                            saveAtmosphereFirst(on);
                            if (station.id === "__empty__") return;
                            const nowPart = dayPartFromHour(
                              new Date().getHours(),
                            );
                            const ordinary = buildFirstVisitOrdinaryCourses(
                              station,
                              nowPart,
                              "half",
                            );
                            setSelectedCourse(ordinary[0] ?? null);
                            setCourses(ordinary);
                          }}
                        />
                      </label>
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
                    <div className="mishiranu-settings-card">
                      <button
                        type="button"
                        className="mishiranu-settings-action mishiranu-settings-action--nav"
                        onClick={() => setSettingsPane("tutorial")}
                      >
                        <span>見知らぬ駅について</span>
                        <span className="mishiranu-settings-detail">
                          チュートリアル · なにができるか
                        </span>
                      </button>
                    </div>
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

                  <section className="mishiranu-settings-group" aria-label="料金">
                    <p className="mishiranu-settings-group-label">料金</p>
                    <div className="mishiranu-settings-card">
                      <button
                        type="button"
                        className="mishiranu-settings-action mishiranu-settings-action--nav"
                        onClick={() => {
                          setBillingNote(null);
                          setSettingsPane("pricing");
                        }}
                      >
                        <span>料金</span>
                        <span className="mishiranu-settings-detail">
                          コイン {billing.coins} ·{" "}
                          {billing.byokUnlocked ? "BYOK" : "続きへ"}
                        </span>
                      </button>
                    </div>
                  </section>
                    </>
                  )}
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
                    {GUIDE_LABEL[spotGuide(activeSpot)]} · 駅から徒歩約{" "}
                    {activeSpot.walkMinutes} 分（約{" "}
                    {activeSpot.walkMinutes * 80} m）
                  </p>
                  {["meal", "souvenir"].includes(spotGuide(activeSpot)) ||
                  (spotGuide(activeSpot) === "rest" &&
                    !(hoursFor(activeSpot) ?? "").includes("屋外")) ? (
                    <p className="mishiranu-spot-hours-note">
                      ※営業状況は現地またはマップでご確認ください
                    </p>
                  ) : null}
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
                  <a
                    className="mishiranu-btn mishiranu-btn--ghost mishiranu-spot-sheet-maps"
                    href={`https://maps.apple.com/?q=${encodeURIComponent(
                      `${activeSpot.name} ${station.name}駅`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Appleマップで開く
                  </a>
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

            {rebuildConfirmOpen ? (
              <div
                className="mishiranu-confirm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mishiranu-rebuild-title"
              >
                <button
                  type="button"
                  className="mishiranu-confirm-backdrop"
                  aria-label="閉じる"
                  onClick={() => setRebuildConfirmOpen(false)}
                />
                <div className="mishiranu-confirm-panel">
                  <p className="mishiranu-confirm-eyebrow">見知らぬ駅 · 案内</p>
                  <hr className="mishiranu-confirm-rule" />
                  <h4 id="mishiranu-rebuild-title" className="mishiranu-confirm-title">
                    {`ここは${station.name.replace(/駅$/u, "")}駅です`}
                  </h4>
                  <p className="mishiranu-confirm-body">
                    {usesByokForGeneration(billing)
                      ? "この駅の案内を、もう一度調べますか？\n自分の API で作り直します（コインは使いません）。"
                      : `この駅の案内を、もう一度調べますか？\nコインを1枚使います（残り ${billing.coins} 枚）。`}
                  </p>
                  <div className="mishiranu-confirm-actions">
                    <button
                      type="button"
                      className="mishiranu-btn mishiranu-btn--primary"
                      onClick={() => {
                        setRebuildConfirmOpen(false);
                        void requestAiStation(station.name, undefined, {
                          forceRefresh: true,
                        });
                      }}
                    >
                      調べる
                    </button>
                    <button
                      type="button"
                      className="mishiranu-btn"
                      onClick={() => setRebuildConfirmOpen(false)}
                    >
                      やめる
                    </button>
                  </div>
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

      {showTutorial ? (
        <div className="mishiranu-tutorial-overlay" role="presentation">
          <TutorialBoard
            showSkip
            finishLabel="はじめる"
            onFinished={finishTutorial}
          />
        </div>
      ) : null}
    </div>
  );
}
