import type { ReactNode } from "react";
import type { GuideKind, TimeOptionId } from "@/data/mishiranu-stations";
import type { DayPart } from "@/lib/mishiranu-courses";

type IconProps = {
  className?: string;
  title?: string;
};

function Svg({
  className,
  title,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className ?? "mishiranu-icon"}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconLocate(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="8" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.5 16.5 21 21" />
    </Svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </Svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.7 5.7l1.6 1.6M16.7 16.7l1.6 1.6M18.3 5.7l-1.6 1.6M7.3 16.7l-1.6 1.6" />
    </Svg>
  );
}

export function IconSunrise(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 17h16" />
      <path d="M6.5 17a5.5 5.5 0 0 1 11 0" />
      <path d="M12 6v3M5.5 10.5l1.6 1.6M18.5 10.5l-1.6 1.6" />
    </Svg>
  );
}

export function IconSunset(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 17h16" />
      <path d="M6.5 17a5.5 5.5 0 0 1 11 0" />
      <path d="M12 13v-3M5.5 13.5l1.6-1.6M18.5 13.5l-1.6-1.6" />
    </Svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M17.5 14.2A6.8 6.8 0 0 1 9.8 6.5 7 7 0 1 0 17.5 14.2Z" />
    </Svg>
  );
}

export function IconHourglass(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4h10M7 20h10" />
      <path d="M8 4c0 4 3 5 4 8-1 3-4 4-4 8M16 4c0 4-3 5-4 8 1 3 4 4 4 8" />
    </Svg>
  );
}

export function IconHalfDay(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5V12l5.5 3.2" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" opacity="0.22" />
    </Svg>
  );
}

export function IconMeal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 4v9a3 3 0 0 0 3 3h0V4" />
      <path d="M9 4v12" />
      <path d="M15 4c2.2 0 4 1.8 4 4v4h-4V4Z" />
      <path d="M5 20h14" />
    </Svg>
  );
}

export function IconSouvenir(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 9h14v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9Z" />
      <path d="M8 9V7.5A2.5 2.5 0 0 1 12 6a2.5 2.5 0 0 1 4 1.5V9" />
      <path d="M12 12v5" />
    </Svg>
  );
}

export function IconSight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 19h16" />
      <path d="M7 19V9l5-4 5 4v10" />
      <path d="M10 19v-5h4v5" />
    </Svg>
  );
}

export function IconRest(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 14h11a3 3 0 0 0 3-3V9" />
      <path d="M5 14V8" />
      <path d="M8 8h5" />
      <path d="M5 18v-4M19 18v-4" />
    </Svg>
  );
}

export function IconTip(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 18c2-4 4-6 6-6s4 2 6 6" />
      <path d="M8 10.5a2 2 0 1 0 0.01 0" />
      <path d="M16 10.5a2 2 0 1 0 0.01 0" />
      <path d="M12 4v3" />
    </Svg>
  );
}

export function IconBike(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6.5" cy="16.5" r="3" />
      <circle cx="17.5" cy="16.5" r="3" />
      <path d="M6.5 16.5 10 9h4l3.5 7.5" />
      <path d="M10 9l2 4h4" />
      <path d="M12.5 6.5h2" />
    </Svg>
  );
}

export function IconHistory(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 4h9a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z" />
      <path d="M9 9h6M9 13h6" />
    </Svg>
  );
}

export function IconTour(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h8v4H8z" />
      <path d="M10 8v12M14 8v12" />
      <path d="M7 20h10" />
    </Svg>
  );
}

export function IconWalk(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="13" cy="5" r="2" />
      <path d="M10 21l2-6 3 2 2 4" />
      <path d="M8 12l4-1 3 3" />
      <path d="M7 21l1.5-5" />
    </Svg>
  );
}

export function IconCompass(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2.2 5.3L8 16l2.2-5.3L15.5 8.5Z" />
    </Svg>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </Svg>
  );
}

export function IconBinoculars(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10h4l1.5 9H5.5L4 10Z" />
      <path d="M16 10h4l-1.5 9h-4L16 10Z" />
      <path d="M8 10h8" />
      <path d="M9 7h2M13 7h2" />
      <circle cx="7" cy="10" r="2.2" />
      <circle cx="17" cy="10" r="2.2" />
    </Svg>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6.5 6.5 2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" />
    </Svg>
  );
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
      return <IconSun className={className} />;
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
