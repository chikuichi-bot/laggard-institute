"use client";

import { useEffect, useRef, useState } from "react";
import {
  HERO_MAP_LAYOUT,
  HERO_MAP_LAYOUT_STORAGE,
  clampLayout,
  type HeroMapLayout,
} from "../heroMapLayout";

const VIEW = { w: 160, h: 168 };
const RIVERS =
  "M52 4 C50 28, 52 48, 56 64 C60 76, 64 84, 70 90 M148 20 C128 34, 108 50, 90 68 C82 76, 76 84, 70 90 M70 90 C72 108, 74 126, 76 144 C77 154, 78 160, 80 168";
const ROADS = [
  "M2 132 H158",
  "M34 4 V164",
  "M142 4 V164",
  "M88 98 V164",
  "M6 36 H48",
  "M6 58 H50",
  "M6 82 H52",
  "M6 108 H54",
  "M100 40 H140",
  "M98 62 H144",
  "M96 88 H146",
  "M100 112 H148",
  "M18 8 V128",
  "M46 8 V128",
  "M108 8 V128",
  "M128 8 V160",
];

export default function HeroMapLayoutEditor() {
  const [layout, setLayout] = useState<HeroMapLayout>({ ...HERO_MAP_LAYOUT });
  const [msg, setMsg] = useState("");
  const slotRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    ox: number;
    oy: number;
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HERO_MAP_LAYOUT_STORAGE);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<HeroMapLayout>;
      if (typeof parsed.leftPct === "number") {
        setLayout(
          clampLayout({
            leftPct: parsed.leftPct,
            topPct: parsed.topPct ?? 0,
            widthPct: parsed.widthPct ?? 78,
          }),
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(HERO_MAP_LAYOUT_STORAGE, JSON.stringify(layout));
  }, [layout]);

  function startDrag(e: React.PointerEvent<SVGSVGElement>) {
    const slot = slotRef.current;
    if (!slot) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      ox: e.clientX,
      oy: e.clientY,
      left: layout.leftPct,
      top: layout.topPct,
    };
  }

  function moveDrag(e: React.PointerEvent<SVGSVGElement>) {
    const slot = slotRef.current;
    const d = drag.current;
    if (!slot || !d) return;
    const rect = slot.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dxPct = ((e.clientX - d.ox) / rect.width) * 100;
    const dyPct = ((e.clientY - d.oy) / rect.height) * 100;
    setLayout((prev) =>
      clampLayout({
        ...prev,
        leftPct: d.left + dxPct,
        topPct: d.top + dyPct,
      }),
    );
  }

  function endDrag(e: React.PointerEvent<SVGSVGElement>) {
    if (drag.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    drag.current = null;
  }

  function copy() {
    void navigator.clipboard.writeText(JSON.stringify(layout, null, 2)).then(() => {
      setMsg("コピーしました");
      window.setTimeout(() => setMsg(""), 1000);
    });
  }

  return (
    <div className="hml-simple">
      <header className="hml-simple-head">
        <h1>トップ地図の位置・大きさ</h1>
        <p>地図をドラッグして動かす。下のつまみで大きさを変える。</p>
      </header>

      <div className="hml-simple-phone">
        <div className="hml-simple-screen">
          <div className="hml-simple-title">見知らぬ駅</div>
          <div className="hml-simple-slot" ref={slotRef}>
            <svg
              viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
              className="hml-simple-map"
              style={{
                left: `${layout.leftPct}%`,
                top: `${layout.topPct}%`,
                width: `${layout.widthPct}%`,
              }}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <path className="bank" d={RIVERS} />
              {ROADS.map((d) => (
                <path key={d} className="road" d={d} />
              ))}
              <rect className="station" x={88.5} y={78.5} width={7} height={7} rx={1} />
            </svg>
          </div>
          <button type="button" className="hml-simple-btn">
            この場所
          </button>
        </div>
      </div>

      <div className="hml-simple-controls">
        <label>
          大きさ {layout.widthPct}%
          <input
            type="range"
            min={40}
            max={100}
            value={layout.widthPct}
            onChange={(e) =>
              setLayout(
                clampLayout({ ...layout, widthPct: Number(e.target.value) }),
              )
            }
          />
        </label>
        <label>
          左右 {layout.leftPct}
          <input
            type="range"
            min={-10}
            max={70}
            value={layout.leftPct}
            onChange={(e) =>
              setLayout(
                clampLayout({ ...layout, leftPct: Number(e.target.value) }),
              )
            }
          />
        </label>
        <label>
          上下 {layout.topPct}
          <input
            type="range"
            min={-10}
            max={70}
            value={layout.topPct}
            onChange={(e) =>
              setLayout(
                clampLayout({ ...layout, topPct: Number(e.target.value) }),
              )
            }
          />
        </label>
        <div className="hml-simple-actions">
          <button type="button" onClick={() => setLayout({ ...HERO_MAP_LAYOUT })}>
            リセット
          </button>
          <button type="button" onClick={copy}>
            JSONコピー
          </button>
        </div>
        {msg ? <p className="hml-simple-msg">{msg}</p> : null}
        <p className="hml-simple-hint">
          決まったら「この配置で本番に載せて」と言ってください。
        </p>
      </div>
    </div>
  );
}
