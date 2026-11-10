/** 駅名のひらがな読み（土地ページ「○○駅のこと」用）。 */
export const STATION_NAME_READINGS: Record<string, string> = {
  demachiyanagi: "でまちやなぎ",
  chushojima: "ちゅうしょじま",
  "iwashimizu-hachimangu": "いわしみずはちまんぐう",
  oyamazaki: "おおやまざき",
  biei: "びえい",
  kanita: "かにた",
  ashio: "つうどう",
  sawara: "さわら",
  manazuru: "まなづる",
  hamakanaya: "はまかなや",
  nagatoro: "ながとろ",
  katsunuma: "かつぬまぶどうきょう",
  kobuchizawa: "こぶちざわ",
  obasute: "おばすて",
  shimosuwa: "しもすわ",
  yui: "ゆい",
  nebukawa: "ねぶかわ",
  amarube: "あまるべ",
  onomichi: "おのみち",
  misumi: "みすみ",
  usuki: "うすき",
  hitoyoshi: "ひとよし",
  tsukazaki: "つきざき",
  tamatsukuri: "たまつくりおんせん",
};

export function stationBaseName(name: string): string {
  return name.replace(/駅$/u, "").trim();
}

export function stationAboutTitle(name: string): string {
  return `${stationBaseName(name)}駅のこと`;
}

export function stationNameReading(station: {
  id: string;
  nameReading?: string | null;
}): string | undefined {
  const fromField = station.nameReading?.trim();
  if (fromField) return fromField;
  return STATION_NAME_READINGS[station.id];
}
