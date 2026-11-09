"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Spot, StationSeed } from "@/data/mishiranu-stations";
import { spotLatLng, stationLatLng } from "@/lib/mishiranu-geo";

const GENRE_COLOR: Record<Spot["genre"], string> = {
  history: "#9bb7c9",
  gourmet: "#d4a574",
  nature: "#7f9e86",
  odd: "#c49bb0",
};

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
      background:${color};border:2px solid #1a2430;
      box-shadow:0 0 0 ${active ? 3 : 0}px rgba(232,238,244,0.85);
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

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(map);

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
      color: "#d4a574",
      weight: 1,
      dashArray: "4 6",
      fillColor: "#d4a574",
      fillOpacity: 0.08,
    }).addTo(layer);

    L.circleMarker([center.lat, center.lng], {
      radius: 7,
      color: "#1a2430",
      weight: 2,
      fillColor: "#e8eef4",
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
        icon: pinIcon(GENRE_COLOR[spot.genre], spot.id === activeSpotId),
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
