"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  GUIDE_COLOR,
  spotGuide,
  type Spot,
  type StationSeed,
} from "@/data/mishiranu-stations";
import { haversineKm, spotLatLng, stationLatLng } from "@/lib/mishiranu-geo";

type Props = {
  station: StationSeed;
  spots: Spot[];
  radiusKm: number;
  activeSpotId: string | null;
  /** Ordered spot ids for the chosen walking course */
  courseStopIds?: string[] | null;
  onSelect: (spotId: string) => void;
};

function isFixedLandmarkName(name: string): boolean {
  if (/デルタ|三角州|下鴨神社|賀茂御祖/.test(name)) return true;
  // 枡形商店街は通りの正本。満寿形屋と重ねても商店街側は動かさない。
  if (/満寿/.test(name)) return false;
  return /枡形商店街|桝形商店街|出町枡形|出町桝形/.test(name);
}

function isMovableShopPin(
  point: { id: string; name?: string },
  guideById: Map<string, string>,
): boolean {
  const guide = guideById.get(point.id);
  return guide === "meal" || guide === "souvenir";
}

/** 正本（デルタ・商店街）は動かさず、ご飯／土産だけずらして両方見せる。 */
function spreadNearbyCoursePins(
  points: Array<{ id: string; lat: number; lng: number; name?: string }>,
  guideById: Map<string, string> = new Map(),
): Map<string, { lat: number; lng: number }> {
  const result = new Map<string, { lat: number; lng: number }>();
  const thresholdKm = 0.04;
  const anchored = new Set(
    points
      .filter((p) => p.name && isFixedLandmarkName(p.name))
      .map((p) => p.id),
  );
  for (const p of points) {
    if (anchored.has(p.id)) result.set(p.id, { lat: p.lat, lng: p.lng });
  }
  const clashes = (id: string, lat: number, lng: number) =>
    points.some((other) => {
      if (other.id === id) return false;
      const shown = result.get(other.id) ?? other;
      return haversineKm({ lat, lng }, shown) < thresholdKm;
    });

  points.forEach((point, index) => {
    if (anchored.has(point.id)) return;
    if (!isMovableShopPin(point, guideById)) {
      result.set(point.id, { lat: point.lat, lng: point.lng });
      return;
    }
    let { lat, lng } = point;
    // 満寿形屋は南南西へ（川・駅側へ飛ばさない）
    const baseAngleDeg = /満寿/.test(point.name ?? "") ? 200 : index * 55;
    for (let attempt = 0; attempt < 10; attempt++) {
      if (!clashes(point.id, lat, lng)) break;
      const angle = ((baseAngleDeg + attempt * 28) * Math.PI) / 180;
      const dist = 22 + attempt * 5;
      const north = dist * Math.cos(angle);
      const east = dist * Math.sin(angle);
      lat = point.lat + north / 111_320;
      lng =
        point.lng +
        east / (111_320 * Math.max(Math.cos((point.lat * Math.PI) / 180), 0.2));
    }
    result.set(point.id, { lat, lng });
  });
  for (const p of points) {
    if (!result.has(p.id)) result.set(p.id, { lat: p.lat, lng: p.lng });
  }
  return result;
}

function pinIcon(color: string, active: boolean, nudge = false) {
  const size = active ? 16 : 12;
  const shift = nudge ? 16 : 0;
  // iconSize / iconAnchor を点の中心に一致させる（余白なし）
  // nudge は座標を動かさず、重なった店アイコンだけ画面上でずらす
  return L.divIcon({
    className: "mishiranu-leaflet-pin",
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid #ffffff;box-sizing:border-box;
      box-shadow:0 0 0 ${active ? 3 : 1}px ${active ? "rgba(255,106,61,0.55)" : "rgba(36,48,56,0.18)"};
    "></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2 + shift, size / 2 + shift],
    popupAnchor: [0, -size / 2],
  });
}

function stepIcon(step: number, color: string, active: boolean, nudge = false) {
  const size = active ? 26 : 22;
  const shift = nudge ? 18 : 0;
  return L.divIcon({
    className: "mishiranu-leaflet-pin",
    html: `<span class="mishiranu-leaflet-step${active ? " mishiranu-leaflet-step--active" : ""}" style="
      --step-color:${color};width:${size}px;height:${size}px;font-size:${active ? 12 : 11}px;
      box-sizing:border-box;
    ">${step}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2 + shift, size / 2 + shift],
    popupAnchor: [0, -size / 2],
  });
}

/** 徒歩の道なり（OSRM foot）。直線だと川の上を横切るので使わない。 */
async function footRoutePath(
  points: Array<{ lat: number; lng: number }>,
): Promise<L.LatLngExpression[] | null> {
  if (points.length < 2) return null;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: number[][] } }>;
    };
    const line = data.routes?.[0]?.geometry?.coordinates;
    if (!line?.length) return null;
    return line.map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
  } catch {
    return null;
  }
}

export default function StationMap({
  station,
  spots,
  radiusKm,
  activeSpotId,
  courseStopIds = null,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = stationLatLng(station);
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      tapTolerance: 28,
    }).setView([center.lat, center.lng], 15);

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const invalidate = () => map.invalidateSize({ pan: false });
    const ro = new ResizeObserver(invalidate);
    ro.observe(containerRef.current);
    // iOS Safari often lays out after first paint; refresh map size twice.
    requestAnimationFrame(invalidate);
    const late = window.setTimeout(invalidate, 350);

    return () => {
      window.clearTimeout(late);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // station identity only for initial mount; updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const center = stationLatLng(station);
    const spotById = new Map<string, Spot>();
    for (const spot of station.spots) spotById.set(spot.id, spot);
    for (const spot of spots) spotById.set(spot.id, spot);

    const courseIds = (courseStopIds ?? []).filter((id) => spotById.has(id));
    const courseSet = new Set(courseIds);
    // 駅出発 → 立ち寄り → 駅帰還
    const waypoints: Array<{ lat: number; lng: number }> = [
      { lat: center.lat, lng: center.lng },
    ];
    for (const id of courseIds) {
      const spot = spotById.get(id);
      if (!spot) continue;
      const ll = spotLatLng(station, spot);
      waypoints.push({ lat: ll.lat, lng: ll.lng });
    }
    if (courseIds.length > 0) {
      waypoints.push({ lat: center.lat, lng: center.lng });
    }

    let cancelled = false;
    const focusActive = (): boolean => {
      if (!activeSpotId) return false;
      const spot = spotById.get(activeSpotId);
      if (!spot) return false;
      const ll = spotLatLng(station, spot);
      map.setView([ll.lat, ll.lng], 16, { animate: true });
      return true;
    };

    const drawCourseLine = (path: L.LatLngExpression[]) => {
      if (cancelled || !layerRef.current) return;
      L.polyline(path, {
        color: "#9a3d31",
        weight: 4,
        opacity: 0.88,
        lineJoin: "round",
        lineCap: "round",
        className: "mishiranu-leaflet-course",
      }).addTo(layer);
      L.polyline(path, {
        color: "#f9f4e6",
        weight: 1.5,
        opacity: 0.95,
        lineJoin: "round",
        lineCap: "round",
        dashArray: "1 10",
      }).addTo(layer);
      if (!focusActive()) {
        map.fitBounds(L.latLngBounds(path), {
          padding: [36, 36],
          maxZoom: 16,
          animate: false,
        });
      }
    };

    if (waypoints.length >= 2) {
      void footRoutePath(waypoints).then((routed) => {
        const path =
          routed ??
          waypoints.map((p) => [p.lat, p.lng] as L.LatLngExpression);
        drawCourseLine(path);
      });
    } else {
      L.circle([center.lat, center.lng], {
        radius: radiusKm * 1000,
        color: "#b5493a",
        weight: 1.5,
        dashArray: "4 6",
        fillColor: "#b5493a",
        fillOpacity: 0.06,
      }).addTo(layer);
      if (!focusActive()) {
        map.setView([center.lat, center.lng], radiusKm >= 2.5 ? 14 : 15, {
          animate: false,
        });
      }
    }

    const stationLabel = document.createElement("span");
    stationLabel.textContent = station.name;
    L.circleMarker([center.lat, center.lng], {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#b5493a",
      fillOpacity: 1,
    })
      .bindTooltip(stationLabel, {
        permanent: true,
        direction: "bottom",
        offset: [0, 8],
        className: "mishiranu-leaflet-tooltip",
      })
      .addTo(layer);

    // コース＋ご飯屋など、近いピンをまとめて広げて両方見せる（満寿形屋×枡形商店街など）
    const orderedForSpread: Array<{
      id: string;
      lat: number;
      lng: number;
      name: string;
    }> = [];
    for (const id of courseIds) {
      const spot = spotById.get(id);
      if (!spot) continue;
      const ll = spotLatLng(station, spot);
      orderedForSpread.push({
        id,
        lat: ll.lat,
        lng: ll.lng,
        name: spot.name,
      });
    }
    for (const spot of spots) {
      if (courseSet.has(spot.id)) continue;
      const ll = spotLatLng(station, spot);
      orderedForSpread.push({
        id: spot.id,
        lat: ll.lat,
        lng: ll.lng,
        name: spot.name,
      });
    }
    const guideById = new Map(
      orderedForSpread.map((p) => {
        const spot = spotById.get(p.id);
        return [p.id, spot ? spotGuide(spot) : "tip"] as const;
      }),
    );
    // 座標は正本のまま。近いご飯ピンだけアイコンを画面上でずらす。
    const displayCoords = new Map(
      orderedForSpread.map((p) => [p.id, { lat: p.lat, lng: p.lng }]),
    );
    const nudged = new Set(
      orderedForSpread
        .filter((p) => {
          const guide = guideById.get(p.id);
          if (guide !== "meal" && guide !== "souvenir") return false;
          return orderedForSpread.some((other) => {
            if (other.id === p.id) return false;
            return haversineKm(p, other) < 0.028;
          });
        })
        .map((p) => p.id),
    );

    for (const spot of spots) {
      if (courseSet.has(spot.id)) continue;
      const shown = displayCoords.get(spot.id) ?? spotLatLng(station, spot);
      const marker = L.marker([shown.lat, shown.lng], {
        icon: pinIcon(
          GUIDE_COLOR[spotGuide(spot)],
          spot.id === activeSpotId,
          nudged.has(spot.id),
        ),
        title: spot.name,
        opacity: courseIds.length > 0 ? 0.45 : 1,
        zIndexOffset: spotGuide(spot) === "meal" ? 160 : 100,
      });
      marker.on("click", () => onSelectRef.current(spot.id));
      marker.addTo(layer);
    }

    courseIds.forEach((id, index) => {
      const spot = spotById.get(id);
      if (!spot) return;
      const shown = displayCoords.get(id) ?? spotLatLng(station, spot);
      const marker = L.marker([shown.lat, shown.lng], {
        icon: stepIcon(
          index + 1,
          GUIDE_COLOR[spotGuide(spot)],
          spot.id === activeSpotId,
          nudged.has(id),
        ),
        title: `${index + 1}. ${spot.name}`,
        zIndexOffset: 200 + index,
      });
      marker.on("click", () => onSelectRef.current(spot.id));
      marker.addTo(layer);
    });

    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      cancelled = true;
    };
  }, [station, spots, radiusKm, activeSpotId, courseStopIds]);

  return (
    <div className="mishiranu-map mishiranu-map--live" aria-label={`${station.name}駅周辺の地図`}>
      <div ref={containerRef} className="mishiranu-leaflet" />
    </div>
  );
}
