import type { StationSeed } from "@/data/mishiranu-stations";
import { isEditorialPlaceName } from "@/lib/mishiranu-map-trust";
import {
  clarifyLandscapeName,
  landscapeWalkBlurb,
  shouldRewriteLandscapeBlurb,
} from "@/lib/mishiranu-landscape-name";
import { isNonWalkInMeal } from "@/lib/mishiranu-walk-in-meal";

/**
 * キャッシュ・生成のどちらから出しても、実地で壊れた案内を残さない。
 * 配食をご飯にしない／生成メモの店名／川の総称／閉業レンタ。
 */
export function sealGuideIntegrity(station: StationSeed): StationSeed {
  const spots = (station.spots ?? [])
    .filter((s) => {
      if (s.guide === "meal" || s.guide === "souvenir") {
        if (isEditorialPlaceName(s.name)) return false;
      }
      if (
        s.guide === "meal" &&
        isNonWalkInMeal({ name: s.name, blurb: s.blurb, detail: s.detail })
      ) {
        return false;
      }
      return true;
    })
    .map((s) => {
      const name = clarifyLandscapeName(s.name);
      const blurb = shouldRewriteLandscapeBlurb(s.blurb, s.name)
        ? landscapeWalkBlurb(s.name, s.walkMinutes)
        : s.blurb;
      if (name === s.name && blurb === s.blurb) return s;
      return { ...s, name, blurb };
    });

  const places = (station.bikeRental?.places ?? []).filter(
    (p) => !p.name.includes("えむじか"),
  );
  const bike = station.bikeRental
    ? {
        ...station.bikeRental,
        places,
        available: places.length > 0,
        summary: station.bikeRental.summary.includes("えむじか")
          ? places.length
            ? `この駅で確認できた貸出は次のとおりです（${places.map((p) => p.name).join("、")}）。`
            : "この駅で確認できたレンタサイクルは、いまのところありません。"
          : station.bikeRental.summary,
      }
    : station.bikeRental;

  return { ...station, spots, bikeRental: bike };
}
