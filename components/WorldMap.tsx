"use client";

import { useEffect, useRef, useState } from "react";
// Type-only — Leaflet itself is dynamically imported below (it touches `window`
// and can't survive SSR), but its types are pure compile-time and erase cleanly.
import type { Map as LeafletMap } from "leaflet";
import type { Outbreak } from "@/lib/outbreaks";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import OutbreakDetailModal from "@/components/OutbreakDetailModal";
import { getCountryCoords } from "@/lib/country-coords";

interface WorldMapProps {
  outbreaks: Outbreak[];
  locale: string;
  isPaid: boolean;
  popupLabels: {
    cases: string;
    deaths: string;
    source: string;
    date: string;
  };
  riskLabels: {
    high: string;
    medium: string;
    low: string;
  };
}

const riskColors: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

export default function WorldMap({ outbreaks, locale, isPaid, popupLabels: _popupLabels, riskLabels }: WorldMapProps) {
  const mapRef      = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected,  setSelected] = useState<Outbreak | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    // Synchronous flag — set before the async import so the cleanup
    // can cancel a pending (not-yet-resolved) initialisation.
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      // Guard against double-init (e.g. HMR keeping the container alive).
      // `_leaflet_id` is Leaflet's own internal marker for "already a map
      // container" — real at runtime, just absent from the DOM lib types.
      const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number };
      if (container._leaflet_id) {
        container._leaflet_id = undefined;
      }

      import("leaflet/dist/leaflet.css");

      const map = L.map(containerRef.current!, {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "© OpenStreetMap © CARTO",
          maxZoom: 19,
        }
      ).addTo(map);


      outbreaks.forEach((outbreak) => {
        // Skip worldwide/multi-country aggregates — no meaningful geographic pin
        const cen = (outbreak.country_en ?? "").toLowerCase();
        if (cen === "multiple countries" || cen === "global" || cen === "eu/eea") return;

        const color = riskColors[outbreak.risk_level] || "#6b7280";
        const radius = Math.max(8, Math.min(30, Math.log10(outbreak.cases + 1) * 6));
        const diseaseName = getLocalizedDisease(outbreak, locale);
        const countryName = getLocalizedCountry(outbreak, locale);

        // Use admin1 coords when available; fall back to country centroid if lat/lng is null
        const hasAdmin1 = typeof outbreak.admin1_lat === "number" && typeof outbreak.admin1_lng === "number";
        const countryFallback = !hasAdmin1 ? getCountryCoords(outbreak.country_en) : null;
        const pinLat = hasAdmin1 ? outbreak.admin1_lat! : ((outbreak.lat as number | null | undefined) ?? countryFallback?.[0]);
        const pinLng = hasAdmin1 ? outbreak.admin1_lng! : ((outbreak.lng as number | null | undefined) ?? countryFallback?.[1]);
        if (pinLat == null || pinLng == null) return;

        const circle = L.circleMarker([pinLat, pinLng], {
          radius,
          fillColor: color,
          color: color,
          weight: hasAdmin1 ? 2.5 : 1.5,
          opacity: 0.9,
          fillOpacity: 0.5,
          // Solid border on admin1-precise pins, dashed on country-centroid fallbacks
          dashArray: hasAdmin1 ? undefined : "4 3",
        }).addTo(map);

        // Tooltip: show province when available
        const locationLine = hasAdmin1 && outbreak.admin1
          ? `<span style="color:#9ca3af">${outbreak.admin1}, ${countryName}</span>`
          : `<span style="color:#9ca3af">${countryName}</span>`;
        const precisionTag = hasAdmin1
          ? `<span style="color:#6b7280;font-size:10px"> · ${locale === "fr" ? "niveau province" : locale === "es" ? "nivel provincia" : locale === "ar" ? "المستوى الإقليمي" : locale === "id" ? "tingkat provinsi" : "province-level"}</span>`
          : "";
        circle.bindTooltip(
          `<strong style="color:${color}">${diseaseName}</strong>${precisionTag}<br/>${locationLine}`,
          { className: "dark-popup", sticky: true }
        );

        // Full modal on click
        circle.on("click", () => setSelected(outbreak));
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outbreaks]);

  return (
    <>
      <div className="relative isolate rounded-xl overflow-hidden border border-gray-800">
        <div ref={containerRef} className="h-[260px] sm:h-[340px] md:h-[420px] w-full" />

        {/* Click hint */}
        <div className="absolute top-3 right-3 bg-gray-900/80 rounded-lg px-2 py-1 text-xs text-gray-500 pointer-events-none hidden sm:block">
          {locale === "fr" ? "Cliquez sur un foyer" :
           locale === "es" ? "Haga clic en un foco" :
           locale === "ar" ? "انقر على بؤرة" :
           locale === "id" ? "Klik pada wabah" :
           "Click an outbreak"}
        </div>

        <div className="absolute bottom-4 left-4 flex gap-3 bg-gray-900/90 rounded-lg px-3 py-2 text-xs">
          {(["high", "medium", "low"] as const).map((level) => (
            <span key={level} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: riskColors[level] }}
              />
              <span className="text-gray-300">{riskLabels[level]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Detail modal — same as table row click */}
      <OutbreakDetailModal
        outbreak={selected}
        locale={locale}
        isPaid={isPaid}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
