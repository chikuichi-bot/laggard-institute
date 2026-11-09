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
import { spotLatLng, stationLatLng } from "@/lib/mishiranu-geo";

type Props = {
  station: StationSeed;
  spots: Spot[];
  radiusKm: number;
  activeSpotId: string | null;
  onSelect: (spotId: string) => void;
};

function pinIcon(color: string, active: boolean) {
  const size = active ? 16 : 12;
  return L.divIcon({
    className: "mishiranu-leaflet-pin",
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid #ffffff;
      box-shadow:0 0 0 ${active ? 3 : 1}px ${active ? "rgba(255,106,61,0.55)" : "rgba(36,48,56,0.18)"};
    "></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function StationMap({
  station,
  spots,
  radiusKm,
  activeSpotId,
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
    }).setView([center.lat, center.lng], 15);

    L.control.zoom({ position: "topright" }).addTo(map);

    // OSM is key-free; dusk look comes from CSS filter on .leaflet-tile-pane
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(containerRef.current);

    return () => {
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
    map.setView([center.lat, center.lng], radiusKm >= 2.5 ? 14 : 15, {
      animate: false,
    });

    L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000,
      color: "#ff6a3d",
      weight: 1.5,
      dashArray: "4 6",
      fillColor: "#ff6a3d",
      fillOpacity: 0.06,
    }).addTo(layer);

    L.circleMarker([center.lat, center.lng], {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#ff6a3d",
      fillOpacity: 1,
    })
      .bindTooltip(station.name, {
        permanent: true,
        direction: "bottom",
        offset: [0, 8],
        className: "mishiranu-leaflet-tooltip",
      })
      .addTo(layer);

    for (const spot of spots) {
      const { lat, lng } = spotLatLng(station, spot);
      const marker = L.marker([lat, lng], {
        icon: pinIcon(GUIDE_COLOR[spotGuide(spot)], spot.id === activeSpotId),
        title: spot.name,
      });
      marker.on("click", () => onSelectRef.current(spot.id));
      marker.addTo(layer);
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [station, spots, radiusKm, activeSpotId]);

  return (
    <div className="mishiranu-map mishiranu-map--live" aria-label={`${station.name}駅周辺の地図`}>
      <div ref={containerRef} className="mishiranu-leaflet" />
    </div>
  );
}
