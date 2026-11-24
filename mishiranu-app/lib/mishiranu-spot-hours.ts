import type { Spot } from "@/data/mishiranu-stations";
import { hoursFor } from "@/data/mishiranu-stations";

/** 営業時間は分かっているときだけ。無いときは書かない。 */

export function hoursDisplay(spot: Spot): string | undefined {
  return hoursFor(spot);
}
