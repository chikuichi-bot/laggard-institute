"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AbstractMap,
  type Point,
  type Segment,
  DEFAULT_MAP,
  VIEW,
  cloneMap,
  riversPath,
  segmentPath,
} from "./defaultMap";

const STORAGE_KEY = "mishiranu-hero-map-editor-v1";

type Sel =
  | { kind: "river"; id: string; point: "a" | "c1" | "c2" | "b" }
  | { kind: "segment"; id: string; point: "a" | "b" }
  | { kind: "block"; id: string; mode: "move" | "resize" }
  | { kind: "station"; mode: "move" | "resize" }
  | null;

type Drag = {
  sel: Exclude<Sel, null>;
  start: Point;
  origin: AbstractMap;
};

function snapVal(n: number, on: boolean): number {
  if (!on) return Math.round(n * 10) / 10;
  return Math.round(n);
}

function MapArtContent({ map }: { map: AbstractMap }) {
  const riverD = riversPath(map.rivers);
  return (
    <>
      <path
        className="hme-river"
        d={riverD}
        style={{ strokeWidth: map.style.riverWidth }}
      />
      <path
        className="hme-bank"
        d={riverD}
        style={{ strokeWidth: map.style.bankWidth }}
      />
      {map.segments.map((s) => (
        <path
          key={s.id}
          className={
            s.kind === "bridge"
              ? "hme-bridge"
              : s.kind === "alley"
                ? "hme-street hme-street--dash"
                : "hme-street"
          }
          d={segmentPath(s)}
          style={{
            strokeWidth:
              s.kind === "bridge"
                ? map.style.bridgeWidth
                : s.kind === "alley"
                  ? map.style.alleyWidth
                  : map.style.streetWidth,
          }}
        />
      ))}
      {map.blocks.map((b) => (
        <rect
          key={b.id}
          className="hme-block"
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={map.style.blockRadius}
        />
      ))}
      <rect
        className="hme-station"
        x={map.station.x - map.station.size / 2}
        y={map.station.y - map.station.size / 2}
        width={map.station.size}
        height={map.station.size}
        rx="1"
      />
    </>
  );
}

function MapArt({
  map,
  className,
}: {
  map: AbstractMap;
  className?: string;
}) {
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className={className} aria-hidden>
      <MapArtContent map={map} />
    </svg>
  );
}

export default function HeroMapEditor() {
  const [map, setMap] = useState<AbstractMap>(() => cloneMap(DEFAULT_MAP));
  const [history, setHistory] = useState<AbstractMap[]>([cloneMap(DEFAULT_MAP)]);
  const [histIndex, setHistIndex] = useState(0);
  const [sel, setSel] = useState<Sel>(null);
  const [snap, setSnap] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [exportText, setExportText] = useState("");
  const [copied, setCopied] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const mapRef = useRef(map);
  const snapRef = useRef(snap);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragListenersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: () => void;
  } | null>(null);
  mapRef.current = map;
  snapRef.current = snap;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as AbstractMap;
      if (parsed?.rivers?.length) {
        setMap(parsed);
        setHistory([cloneMap(parsed)]);
        setHistIndex(0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }, [map]);

  const pushHistory = useCallback((next: AbstractMap) => {
    setHistory((prev) => {
      const cut = prev.slice(0, histIndex + 1);
      const stacked = [...cut, cloneMap(next)].slice(-40);
      setHistIndex(stacked.length - 1);
      return stacked;
    });
  }, [histIndex]);

  function undo() {
    if (histIndex <= 0) return;
    const i = histIndex - 1;
    setHistIndex(i);
    setMap(cloneMap(history[i]));
  }

  function redo() {
    if (histIndex >= history.length - 1) return;
    const i = histIndex + 1;
    setHistIndex(i);
    setMap(cloneMap(history[i]));
  }

  function reset() {
    const next = cloneMap(DEFAULT_MAP);
    setMap(next);
    pushHistory(next);
    setSel(null);
  }

  const clientToSvg = useCallback((e: { clientX: number; clientY: number }): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const localX = ((e.clientX - rect.left) / rect.width) * VIEW.w;
    const localY = ((e.clientY - rect.top) / rect.height) * VIEW.h;
    const on = snapRef.current;
    return {
      x: snapVal(Math.min(VIEW.w, Math.max(0, localX)), on),
      y: snapVal(Math.min(VIEW.h, Math.max(0, localY)), on),
    };
  }, []);

  const applyDrag = useCallback((point: Point, drag: Drag) => {
    const next = cloneMap(drag.origin);
    const on = snapRef.current;
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    const s = drag.sel;

    if (s.kind === "river") {
      const river = next.rivers.find((r) => r.id === s.id);
      const orig = drag.origin.rivers.find((r) => r.id === s.id);
      if (!river || !orig) return;
      river[s.point] = {
        x: snapVal(orig[s.point].x + dx, on),
        y: snapVal(orig[s.point].y + dy, on),
      };
    } else if (s.kind === "segment") {
      const seg = next.segments.find((r) => r.id === s.id);
      const orig = drag.origin.segments.find((r) => r.id === s.id);
      if (!seg || !orig) return;
      seg[s.point] = {
        x: snapVal(orig[s.point].x + dx, on),
        y: snapVal(orig[s.point].y + dy, on),
      };
    } else if (s.kind === "block") {
      const block = next.blocks.find((b) => b.id === s.id);
      const orig = drag.origin.blocks.find((b) => b.id === s.id);
      if (!block || !orig) return;
      if (s.mode === "move") {
        block.x = snapVal(orig.x + dx, on);
        block.y = snapVal(orig.y + dy, on);
      } else {
        block.w = Math.max(4, snapVal(orig.w + dx, on));
        block.h = Math.max(4, snapVal(orig.h + dy, on));
      }
    } else if (s.kind === "station") {
      if (s.mode === "move") {
        next.station.x = snapVal(drag.origin.station.x + dx, on);
        next.station.y = snapVal(drag.origin.station.y + dy, on);
      } else {
        next.station.size = Math.max(
          3,
          snapVal(drag.origin.station.size + dx * 0.35, on),
        );
      }
    }
    setMap(next);
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      const point = clientToSvg(e);
      if (!point) return;
      applyDrag(point, drag);
    };
    const up = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      pushHistory(mapRef.current);
    };
    dragListenersRef.current = { move, up };
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [applyDrag, clientToSvg, pushHistory]);

  function onPointerDown(
    e: React.PointerEvent,
    nextSel: Exclude<Sel, null>,
  ) {
    e.stopPropagation();
    e.preventDefault();
    const point = clientToSvg(e);
    if (!point) return;
    setSel(nextSel);
    dragRef.current = {
      sel: nextSel,
      start: point,
      origin: cloneMap(mapRef.current),
    };
    const listeners = dragListenersRef.current;
    if (!listeners) return;
    window.addEventListener("pointermove", listeners.move, { passive: false });
    window.addEventListener("pointerup", listeners.up);
    window.addEventListener("pointercancel", listeners.up);
  }

  function updateStyle<K extends keyof AbstractMap["style"]>(
    key: K,
    value: number,
  ) {
    const next = {
      ...map,
      style: { ...map.style, [key]: value },
    };
    setMap(next);
    pushHistory(next);
  }

  function updateSelectedNumber(field: string, value: number) {
    if (!sel) return;
    const next = cloneMap(map);
    if (sel.kind === "station") {
      if (field === "x") next.station.x = value;
      if (field === "y") next.station.y = value;
      if (field === "size") next.station.size = Math.max(3, value);
    } else if (sel.kind === "block") {
      const b = next.blocks.find((x) => x.id === sel.id);
      if (!b) return;
      if (field === "x") b.x = value;
      if (field === "y") b.y = value;
      if (field === "w") b.w = Math.max(4, value);
      if (field === "h") b.h = Math.max(4, value);
    } else if (sel.kind === "segment") {
      const s = next.segments.find((x) => x.id === sel.id);
      if (!s) return;
      if (field === "ax") s.a.x = value;
      if (field === "ay") s.a.y = value;
      if (field === "bx") s.b.x = value;
      if (field === "by") s.b.y = value;
    } else if (sel.kind === "river") {
      const r = next.rivers.find((x) => x.id === sel.id);
      if (!r) return;
      const p = r[sel.point];
      if (field === "x") p.x = value;
      if (field === "y") p.y = value;
    }
    setMap(next);
    pushHistory(next);
  }

  function addStreet(kind: Segment["kind"]) {
    const id = `${kind}-${Date.now()}`;
    const next = cloneMap(map);
    next.segments.push({
      id,
      label: kind === "bridge" ? "橋" : kind === "alley" ? "路地" : "道",
      kind,
      a: { x: 20, y: 80 },
      b: { x: 60, y: 80 },
    });
    setMap(next);
    pushHistory(next);
    setSel({ kind: "segment", id, point: "b" });
  }

  function addBlock() {
    const id = `b-${Date.now()}`;
    const next = cloneMap(map);
    next.blocks.push({
      id,
      label: "区画",
      x: 20,
      y: 20,
      w: 20,
      h: 14,
    });
    setMap(next);
    pushHistory(next);
    setSel({ kind: "block", id, mode: "move" });
  }

  function removeSelected() {
    if (!sel) return;
    const next = cloneMap(map);
    if (sel.kind === "segment") {
      next.segments = next.segments.filter((s) => s.id !== sel.id);
    } else if (sel.kind === "block") {
      next.blocks = next.blocks.filter((b) => b.id !== sel.id);
    } else {
      return;
    }
    setMap(next);
    pushHistory(next);
    setSel(null);
  }

  const exportPayload = useMemo(
    () =>
      JSON.stringify(
        {
          ...map,
          paths: {
            rivers: riversPath(map.rivers),
            segments: map.segments.map((s) => ({
              id: s.id,
              kind: s.kind,
              d: segmentPath(s),
            })),
          },
        },
        null,
        2,
      ),
    [map],
  );

  function copyExport() {
    setExportText(exportPayload);
    void navigator.clipboard.writeText(exportPayload).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  const selectedLabel = useMemo(() => {
    if (!sel) return "未選択";
    if (sel.kind === "station") return "駅";
    if (sel.kind === "river") {
      return map.rivers.find((r) => r.id === sel.id)?.label ?? sel.id;
    }
    if (sel.kind === "segment") {
      return map.segments.find((s) => s.id === sel.id)?.label ?? sel.id;
    }
    return map.blocks.find((b) => b.id === sel.id)?.label ?? sel.id;
  }, [sel, map]);

  return (
    <div className="hme">
      <header className="hme-top">
        <div>
          <p className="hme-kicker">見知らぬ駅 · トップ余白</p>
          <h1>街区マップ編集</h1>
        </div>
        <div className="hme-actions">
          <button type="button" onClick={undo} disabled={histIndex <= 0}>
            戻す
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={histIndex >= history.length - 1}
          >
            進む
          </button>
          <button type="button" onClick={reset}>
            街区に戻す
          </button>
          <button type="button" className={snap ? "is-on" : ""} onClick={() => setSnap((v) => !v)}>
            1px吸着 {snap ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            className={showGuides ? "is-on" : ""}
            onClick={() => setShowGuides((v) => !v)}
          >
            ハンドル
          </button>
          <button type="button" onClick={copyExport}>
            {copied ? "コピーした" : "JSONコピー"}
          </button>
        </div>
      </header>

      <div className="hme-body">
        <aside className="hme-preview">
          <h2>トップでの見え方</h2>
          <div className="hme-phone">
            <div className="hme-notch" aria-hidden />
            <div className="hme-screen">
              <div className="hme-hero">
                <h1>見知らぬ駅</h1>
                <div className="hme-map-slot">
                  <MapArt map={map} className="hme-fig" />
                </div>
                <div className="hme-dock">
                  <button type="button">この場所</button>
                  <label>
                    <span>駅名</span>
                    <input readOnly placeholder="例：藤森 / 出町柳" />
                  </label>
                  <p className="hme-foot">保存 6 駅・検索バーをタップすると一覧が出ます</p>
                </div>
              </div>
            </div>
          </div>
          <p className="hme-note">
            右のキャンバスで点をドラッグすると、左のプレビューが同時に変わります。
          </p>
        </aside>

        <section className="hme-canvas-wrap">
          <h2>編集キャンバス · {selectedLabel}</h2>
          <div className="hme-canvas-bar">
            <button type="button" onClick={() => addStreet("street")}>
              道を足す
            </button>
            <button type="button" onClick={() => addStreet("alley")}>
              路地を足す
            </button>
            <button type="button" onClick={() => addStreet("bridge")}>
              橋を足す
            </button>
            <button type="button" onClick={addBlock}>
              区画を足す
            </button>
            <button type="button" onClick={removeSelected}>
              選択を消す
            </button>
            <label>
              <input
                type="checkbox"
                checked={showGuides}
                onChange={(e) => setShowGuides(e.target.checked)}
              />
              制御点を表示
            </label>
          </div>
          <div className="hme-stage">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
              className="hme-fig hme-fig--edit"
            >
              <MapArtContent map={map} />

              {map.segments.map((s) => (
                <path
                  key={`hit-${s.id}`}
                  className={`hme-hit${sel?.kind === "segment" && sel.id === s.id ? " is-selected" : ""}`}
                  d={segmentPath(s)}
                  onPointerDown={(e) =>
                    onPointerDown(e, { kind: "segment", id: s.id, point: "b" })
                  }
                />
              ))}

              {showGuides
                ? map.rivers.map((r) => (
                    <g key={`g-${r.id}`}>
                      <path
                        className="hme-guide"
                        d={`M${r.a.x} ${r.a.y} L${r.c1.x} ${r.c1.y} M${r.b.x} ${r.b.y} L${r.c2.x} ${r.c2.y}`}
                      />
                      {(
                        [
                          ["a", r.a],
                          ["c1", r.c1],
                          ["c2", r.c2],
                          ["b", r.b],
                        ] as const
                      ).map(([point, p]) => (
                        <circle
                          key={`${r.id}-${point}`}
                          className={`hme-handle${
                            sel?.kind === "river" &&
                            sel.id === r.id &&
                            sel.point === point
                              ? " is-active"
                              : point === "c1" || point === "c2"
                                ? " hme-handle-soft"
                                : ""
                          }`}
                          cx={p.x}
                          cy={p.y}
                          r={point === "c1" || point === "c2" ? 2.2 : 2.6}
                          onPointerDown={(e) =>
                            onPointerDown(e, {
                              kind: "river",
                              id: r.id,
                              point,
                            })
                          }
                        />
                      ))}
                    </g>
                  ))
                : null}

              {showGuides
                ? map.segments.map((s) => (
                    <g key={`sh-${s.id}`}>
                      {(
                        [
                          ["a", s.a],
                          ["b", s.b],
                        ] as const
                      ).map(([point, p]) => (
                        <circle
                          key={`${s.id}-${point}`}
                          className={`hme-handle${
                            sel?.kind === "segment" &&
                            sel.id === s.id &&
                            sel.point === point
                              ? " is-active"
                              : ""
                          }`}
                          cx={p.x}
                          cy={p.y}
                          r={2.4}
                          onPointerDown={(e) =>
                            onPointerDown(e, {
                              kind: "segment",
                              id: s.id,
                              point,
                            })
                          }
                        />
                      ))}
                    </g>
                  ))
                : null}

              {showGuides
                ? map.blocks.map((b) => (
                    <g key={`bh-${b.id}`}>
                      <rect
                        className={`hme-hit${sel?.kind === "block" && sel.id === b.id ? " is-selected" : ""}`}
                        x={b.x}
                        y={b.y}
                        width={b.w}
                        height={b.h}
                        onPointerDown={(e) =>
                          onPointerDown(e, {
                            kind: "block",
                            id: b.id,
                            mode: "move",
                          })
                        }
                      />
                      <circle
                        className="hme-handle"
                        cx={b.x + b.w}
                        cy={b.y + b.h}
                        r={2.4}
                        onPointerDown={(e) =>
                          onPointerDown(e, {
                            kind: "block",
                            id: b.id,
                            mode: "resize",
                          })
                        }
                      />
                    </g>
                  ))
                : null}

              {showGuides ? (
                <g>
                  <circle
                    className={`hme-handle${sel?.kind === "station" ? " is-active" : ""}`}
                    cx={map.station.x}
                    cy={map.station.y}
                    r={3}
                    onPointerDown={(e) =>
                      onPointerDown(e, { kind: "station", mode: "move" })
                    }
                  />
                  <circle
                    className="hme-handle-soft"
                    cx={map.station.x + map.station.size}
                    cy={map.station.y}
                    r={2.2}
                    onPointerDown={(e) =>
                      onPointerDown(e, { kind: "station", mode: "resize" })
                    }
                  />
                </g>
              ) : null}
            </svg>
          </div>
        </section>

        <aside className="hme-side">
          <div className="hme-side-section">
            <h2>選択中</h2>
            <p className="hme-note">{selectedLabel}</p>
            {sel?.kind === "station" ? (
              <div className="hme-row">
                <label>
                  x
                  <input
                    type="number"
                    step={0.1}
                    value={map.station.x}
                    onChange={(e) =>
                      updateSelectedNumber("x", Number(e.target.value))
                    }
                  />
                </label>
                <label>
                  y
                  <input
                    type="number"
                    step={0.1}
                    value={map.station.y}
                    onChange={(e) =>
                      updateSelectedNumber("y", Number(e.target.value))
                    }
                  />
                </label>
                <label>
                  大きさ
                  <input
                    type="number"
                    step={0.1}
                    value={map.station.size}
                    onChange={(e) =>
                      updateSelectedNumber("size", Number(e.target.value))
                    }
                  />
                </label>
              </div>
            ) : null}
            {sel?.kind === "block" ? (
              <div className="hme-row">
                {(["x", "y", "w", "h"] as const).map((field) => {
                  const b = map.blocks.find((x) => x.id === sel.id);
                  if (!b) return null;
                  return (
                    <label key={field}>
                      {field}
                      <input
                        type="number"
                        step={0.1}
                        value={b[field]}
                        onChange={(e) =>
                          updateSelectedNumber(field, Number(e.target.value))
                        }
                      />
                    </label>
                  );
                })}
              </div>
            ) : null}
            {sel?.kind === "segment" ? (
              <div className="hme-row">
                {(
                  [
                    ["ax", "始点x"],
                    ["ay", "始点y"],
                    ["bx", "終点x"],
                    ["by", "終点y"],
                  ] as const
                ).map(([field, label]) => {
                  const s = map.segments.find((x) => x.id === sel.id);
                  if (!s) return null;
                  const value =
                    field === "ax"
                      ? s.a.x
                      : field === "ay"
                        ? s.a.y
                        : field === "bx"
                          ? s.b.x
                          : s.b.y;
                  return (
                    <label key={field}>
                      {label}
                      <input
                        type="number"
                        step={0.1}
                        value={value}
                        onChange={(e) =>
                          updateSelectedNumber(field, Number(e.target.value))
                        }
                      />
                    </label>
                  );
                })}
              </div>
            ) : null}
            {sel?.kind === "river" ? (
              <div className="hme-row">
                {(["x", "y"] as const).map((field) => {
                  const r = map.rivers.find((x) => x.id === sel.id);
                  if (!r) return null;
                  return (
                    <label key={field}>
                      {sel.point}.{field}
                      <input
                        type="number"
                        step={0.1}
                        value={r[sel.point][field]}
                        onChange={(e) =>
                          updateSelectedNumber(field, Number(e.target.value))
                        }
                      />
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="hme-side-section">
            <h2>線の太さ</h2>
            {(
              [
                ["riverWidth", "川"],
                ["bankWidth", "岸"],
                ["streetWidth", "道"],
                ["alleyWidth", "路地"],
                ["bridgeWidth", "橋"],
                ["blockRadius", "区画の角"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  step={0.05}
                  min={0.2}
                  value={map.style[key]}
                  onChange={(e) => updateStyle(key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>

          <div className="hme-side-section">
            <h2>一覧</h2>
            <div className="hme-list">
              {map.rivers.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={sel?.kind === "river" && sel.id === r.id ? "is-on" : ""}
                  onClick={() => setSel({ kind: "river", id: r.id, point: "b" })}
                >
                  川 · {r.label}
                </button>
              ))}
              {map.segments.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={
                    sel?.kind === "segment" && sel.id === s.id ? "is-on" : ""
                  }
                  onClick={() =>
                    setSel({ kind: "segment", id: s.id, point: "b" })
                  }
                >
                  {s.kind === "bridge"
                    ? "橋"
                    : s.kind === "alley"
                      ? "路地"
                      : "道"}{" "}
                  · {s.label}
                </button>
              ))}
              {map.blocks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={sel?.kind === "block" && sel.id === b.id ? "is-on" : ""}
                  onClick={() =>
                    setSel({ kind: "block", id: b.id, mode: "move" })
                  }
                >
                  区画 · {b.label}
                </button>
              ))}
              <button
                type="button"
                className={sel?.kind === "station" ? "is-on" : ""}
                onClick={() => setSel({ kind: "station", mode: "move" })}
              >
                駅
              </button>
            </div>
          </div>

          <div className="hme-side-section">
            <h2>書き出し</h2>
            <button type="button" onClick={copyExport}>
              {copied ? "コピーした" : "いまの形をJSONでコピー"}
            </button>
            <textarea
              className="hme-export"
              readOnly
              value={exportText || exportPayload}
            />
            <p className="hme-note">
              形が決まったら「これで本番に載せて」と言ってください。JSONを正本にします。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
