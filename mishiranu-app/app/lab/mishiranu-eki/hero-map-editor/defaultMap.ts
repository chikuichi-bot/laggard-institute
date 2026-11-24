export type Point = { x: number; y: number };

export type Cubic = {
  id: string;
  label: string;
  a: Point;
  c1: Point;
  c2: Point;
  b: Point;
};

export type Segment = {
  id: string;
  label: string;
  kind: "street" | "alley" | "bridge";
  a: Point;
  b: Point;
};

export type Block = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type StationMark = {
  x: number;
  y: number;
  size: number;
};

export type MapStyle = {
  riverWidth: number;
  bankWidth: number;
  streetWidth: number;
  alleyWidth: number;
  bridgeWidth: number;
  blockRadius: number;
};

export type AbstractMap = {
  rivers: Cubic[];
  segments: Segment[];
  blocks: Block[];
  station: StationMark;
  style: MapStyle;
};

export const VIEW = { w: 160, h: 168 };

/** サンプル「1 · 街区」の初期値。 */
export const DEFAULT_MAP: AbstractMap = {
  rivers: [
    {
      id: "river-west",
      label: "賀茂川（北西）",
      a: { x: 36, y: 10 },
      c1: { x: 50, y: 40 },
      c2: { x: 66, y: 68 },
      b: { x: 78, y: 94 },
    },
    {
      id: "river-east",
      label: "高野川（北東）",
      a: { x: 124, y: 8 },
      c1: { x: 110, y: 40 },
      c2: { x: 94, y: 68 },
      b: { x: 82, y: 94 },
    },
    {
      id: "river-south",
      label: "鴨川（南）",
      a: { x: 80, y: 96 },
      c1: { x: 84, y: 118 },
      c2: { x: 90, y: 138 },
      b: { x: 98, y: 158 },
    },
  ],
  segments: [
    { id: "st-1", label: "道 西1", kind: "street", a: { x: 4, y: 38 }, b: { x: 48, y: 38 } },
    { id: "st-2", label: "道 東1", kind: "street", a: { x: 112, y: 36 }, b: { x: 156, y: 36 } },
    { id: "st-3", label: "道 西2", kind: "street", a: { x: 6, y: 68 }, b: { x: 42, y: 68 } },
    { id: "st-4", label: "道 東2", kind: "street", a: { x: 112, y: 70 }, b: { x: 156, y: 70 } },
    { id: "st-5", label: "道 縦西", kind: "street", a: { x: 24, y: 6 }, b: { x: 24, y: 34 } },
    { id: "st-6", label: "道 縦東", kind: "street", a: { x: 140, y: 6 }, b: { x: 140, y: 32 } },
    { id: "st-7", label: "道 南西", kind: "street", a: { x: 8, y: 108 }, b: { x: 62, y: 108 } },
    { id: "st-8", label: "道 南東", kind: "street", a: { x: 102, y: 110 }, b: { x: 154, y: 110 } },
    { id: "al-1", label: "路地 西", kind: "alley", a: { x: 8, y: 54 }, b: { x: 36, y: 54 } },
    { id: "al-2", label: "路地 東", kind: "alley", a: { x: 120, y: 54 }, b: { x: 154, y: 54 } },
    { id: "al-3", label: "路地 南西", kind: "alley", a: { x: 18, y: 128 }, b: { x: 46, y: 128 } },
    { id: "al-4", label: "路地 南東", kind: "alley", a: { x: 112, y: 132 }, b: { x: 148, y: 132 } },
    { id: "br-1", label: "橋", kind: "bridge", a: { x: 64, y: 104 }, b: { x: 98, y: 112 } },
  ],
  blocks: [
    { id: "b1", label: "区画 NW1", x: 8, y: 20, w: 26, h: 14 },
    { id: "b2", label: "区画 NW2", x: 10, y: 42, w: 30, h: 16 },
    { id: "b3", label: "区画 NW3", x: 14, y: 66, w: 22, h: 14 },
    { id: "b4", label: "区画 NE1", x: 116, y: 16, w: 30, h: 14 },
    { id: "b5", label: "区画 NE2", x: 110, y: 40, w: 34, h: 16 },
    { id: "b6", label: "区画 NE3", x: 106, y: 64, w: 28, h: 14 },
    { id: "b7", label: "区画 SW1", x: 16, y: 112, w: 32, h: 14 },
    { id: "b8", label: "区画 SW2", x: 52, y: 120, w: 14, h: 18 },
    { id: "b9", label: "区画 SE1", x: 108, y: 114, w: 30, h: 16 },
    { id: "b10", label: "区画 SE2", x: 120, y: 138, w: 20, h: 12 },
  ],
  station: { x: 70, y: 96, size: 7 },
  style: {
    riverWidth: 11,
    bankWidth: 1.05,
    streetWidth: 0.85,
    alleyWidth: 0.7,
    bridgeWidth: 1.6,
    blockRadius: 1.2,
  },
};

export function cubicPath(c: Cubic): string {
  return `M${round(c.a.x)} ${round(c.a.y)} C${round(c.c1.x)} ${round(c.c1.y)}, ${round(c.c2.x)} ${round(c.c2.y)}, ${round(c.b.x)} ${round(c.b.y)}`;
}

export function riversPath(rivers: Cubic[]): string {
  return rivers.map(cubicPath).join(" ");
}

export function segmentPath(s: Segment): string {
  return `M${round(s.a.x)} ${round(s.a.y)} L${round(s.b.x)} ${round(s.b.y)}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function cloneMap(map: AbstractMap): AbstractMap {
  return structuredClone(map);
}
