import type { GuideKind, TimeOptionId } from "@/data/mishiranu-stations";
import type { DayPart } from "@/lib/mishiranu-courses";

/**
 * Icons from EXPERIENCE JAPAN PICTOGRAMS
 * https://experience-japan.info/
 * Hosted locally (no hotlinking). Color/size only — shapes unchanged.
 */

type IconProps = {
  className?: string;
  title?: string;
};

const EJP = {
  map: "/ejp/B_destination.svg",
  place: "/ejp/B_history.svg",
  walk: "/ejp/A_trekking.svg",
  guide: "/ejp/B_information.svg",
  more: "/ejp/B_hamburger-menu.svg",
  locate: "/ejp/B_meeting-point.svg",
  search: "/ejp/B_search.svg",
  clock: "/ejp/B_watch-fingers.svg",
  calendar: "/ejp/B_calendar.svg",
  meal: "/ejp/F_restaurant.svg",
  souvenir: "/ejp/B_gift.svg",
  sight: "/ejp/B_photo-spot.svg",
  rest: "/ejp/B_waiting-area.svg",
  tip: "/ejp/C_ancient-road.svg",
  bike: "/ejp/T_bicycle-rental.svg",
  train: "/ejp/T_train.svg",
  arrival: "/ejp/B_arrival.svg",
  sunny: "/ejp/B_sunny.svg",
  partial: "/ejp/B_partially-sunny.svg",
  sunrise: "/ejp/N_sunrise.svg",
  sunset: "/ejp/N_sunset.svg",
  night: "/ejp/N_night-sky.svg",
  spark: "/ejp/B_approved.svg",
  relax: "/ejp/B_relaxation.svg",
  toilet: "/ejp/B_toilet.svg",
  locker: "/ejp/B_locker.svg",
  convenience: "/ejp/B_convenience-store.svg",
  atm: "/ejp/B_cash-machine.svg",
  inn: "/ejp/L_japanese-inn.svg",
} as const;

export type EjPictId = keyof typeof EJP;

function EjPict({
  id,
  className,
  title,
}: IconProps & { id: EjPictId }) {
  return (
    <span
      className={className ?? "mishiranu-icon"}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{
        WebkitMaskImage: `url(${EJP[id]})`,
        maskImage: `url(${EJP[id]})`,
      }}
    />
  );
}

export function IconLocate(props: IconProps) {
  return <EjPict id="locate" {...props} />;
}

export function IconSearch(props: IconProps) {
  return <EjPict id="search" {...props} />;
}

export function IconClock(props: IconProps) {
  return <EjPict id="clock" {...props} />;
}

export function IconSun(props: IconProps) {
  return <EjPict id="sunny" {...props} />;
}

export function IconSunrise(props: IconProps) {
  return <EjPict id="sunrise" {...props} />;
}

export function IconSunset(props: IconProps) {
  return <EjPict id="sunset" {...props} />;
}

export function IconMoon(props: IconProps) {
  return <EjPict id="night" {...props} />;
}

export function IconHourglass(props: IconProps) {
  return <EjPict id="calendar" {...props} />;
}

export function IconHalfDay(props: IconProps) {
  return <EjPict id="partial" {...props} />;
}

export function IconMeal(props: IconProps) {
  return <EjPict id="meal" {...props} />;
}

export function IconSouvenir(props: IconProps) {
  return <EjPict id="souvenir" {...props} />;
}

export function IconSight(props: IconProps) {
  return <EjPict id="sight" {...props} />;
}

export function IconRest(props: IconProps) {
  return <EjPict id="rest" {...props} />;
}

export function IconTip(props: IconProps) {
  return <EjPict id="tip" {...props} />;
}

export function IconBike(props: IconProps) {
  return <EjPict id="bike" {...props} />;
}

export function IconHistory(props: IconProps) {
  return <EjPict id="place" {...props} />;
}

export function IconTour(props: IconProps) {
  return <EjPict id="walk" {...props} />;
}

export function IconWalk(props: IconProps) {
  return <EjPict id="walk" {...props} />;
}

export function IconCompass(props: IconProps) {
  return <EjPict id="map" {...props} />;
}

export function IconMapPin(props: IconProps) {
  return <EjPict id="map" {...props} />;
}

export function IconBinoculars(props: IconProps) {
  return <EjPict id="guide" {...props} />;
}

export function IconSpark(props: IconProps) {
  return <EjPict id="spark" {...props} />;
}

export function IconMore(props: IconProps) {
  return <EjPict id="more" {...props} />;
}

export function IconTrain(props: IconProps) {
  return <EjPict id="train" {...props} />;
}

export function IconAtm(props: IconProps) {
  return <EjPict id="atm" {...props} />;
}

export function IconArrival(props: IconProps) {
  return <EjPict id="arrival" {...props} />;
}

export function GuideKindIcon({
  kind,
  className,
}: {
  kind: GuideKind;
  className?: string;
}) {
  switch (kind) {
    case "meal":
      return <IconMeal className={className} />;
    case "souvenir":
      return <IconSouvenir className={className} />;
    case "sight":
      return <IconSight className={className} />;
    case "rest":
      return <IconRest className={className} />;
    case "tip":
      return <IconTip className={className} />;
  }
}

export function DayPartIcon({
  part,
  className,
}: {
  part: DayPart;
  className?: string;
}) {
  switch (part) {
    case "morning":
      return <IconSunrise className={className} />;
    case "midday":
      return <IconSun className={className} />;
    case "afternoon":
      return <EjPict id="partial" className={className} />;
    case "evening":
      return <IconSunset className={className} />;
    case "night":
      return <IconMoon className={className} />;
  }
}

export function StayIcon({
  id,
  className,
}: {
  id: TimeOptionId;
  className?: string;
}) {
  if (id === "1h") return <IconClock className={className} />;
  if (id === "half") return <IconHalfDay className={className} />;
  return <IconHourglass className={className} />;
}

export function CourseIcon({
  courseId,
  className,
}: {
  courseId: string;
  className?: string;
}) {
  if (courseId.startsWith("taste")) return <IconMeal className={className} />;
  if (courseId.startsWith("farther"))
    return <IconCompass className={className} />;
  return <IconWalk className={className} />;
}
