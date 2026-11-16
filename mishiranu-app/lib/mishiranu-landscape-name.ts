/**
 * 川・山の総称だけだと「駅から見渡せる」ように読めるので、立ち寄り先の名前に直す。
 */

const VIEWPOINT_HINTS = [
  "堤防",
  "合流",
  "公園",
  "橋",
  "岸",
  "河原",
  "緑地",
  "広場",
  "展望",
  "デッキ",
  "遊歩道",
  "デルタ",
  "三角州",
] as const;

function hasViewpointHint(name: string): boolean {
  return VIEWPOINT_HINTS.some((k) => name.includes(k));
}

function isBareRiver(name: string): boolean {
  const t = name.trim();
  if (!(t.endsWith("川") || t.endsWith("河"))) return false;
  if (hasViewpointHint(t)) return false;
  return t.length <= 5;
}

function isBareMountain(name: string): boolean {
  const t = name.trim();
  if (!(t.endsWith("山") || t.endsWith("岳"))) return false;
  if (hasViewpointHint(t)) return false;
  return t.length <= 5;
}

export function clarifyLandscapeName(raw: string): string {
  const name = raw.trim();
  if (!name) return name;
  // 藤森の物語仮称「疏水の橋」→ 実際の橋名（水路ロックと揃える）
  if (name === "疏水の橋" || name === "疎水の橋") return "堀田橋";
  if (hasViewpointHint(name)) return name;
  if (isBareRiver(name)) return `${name}の堤防`;
  if (isBareMountain(name)) return `${name}の眺望`;
  return name;
}

export function landscapeWalkBlurb(
  rawName: string,
  walkMinutes?: number,
): string {
  const name = clarifyLandscapeName(rawName);
  const walk =
    typeof walkMinutes === "number" && walkMinutes > 0
      ? `徒歩約${walkMinutes}分で寄れる。`
      : "駅から歩いて寄れる。";
  if (name.includes("堤防") || isBareRiver(rawName)) {
    return `${walk}堤防へ出ると川面が開ける。駅のホームから見渡す景色ではない。`;
  }
  if (name.includes("眺望") || isBareMountain(rawName)) {
    return `${walk}展望の場所へ向かう寄り道。駅から常に見える、という意味ではない。`;
  }
  return `${walk}${name}へ立ち寄る。`;
}

export function shouldRewriteLandscapeBlurb(
  blurb: string,
  name: string,
): boolean {
  const t = blurb.trim();
  if (!t) return true;
  if (t.includes("見渡") || t.includes("一望") || t.includes("眼下")) return true;
  if (t.includes("駅前の顔") && (isBareRiver(name) || name.includes("堤防"))) {
    return true;
  }
  if (isBareRiver(name) || name.endsWith("の堤防")) return true;
  return false;
}
