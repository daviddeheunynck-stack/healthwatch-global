"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Outbreak } from "@/lib/outbreaks";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";

interface Props {
  outbreaks: Outbreak[];
  locale: string;
}

const RISK_COLOR: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#22c55e",
};

export default function LandingMapLeaflet({ outbreaks, locale }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number };
      if (container._leaflet_id) container._leaflet_id = undefined;

      import("leaflet/dist/leaflet.css");

      const map = L.map(containerRef.current!, {
        center: [20, 10],
        zoom: 1.5,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        keyboard: false,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        maxZoom: 4,
      }).addTo(map);

      // Inject pulsing dot CSS once
      if (!document.getElementById("landing-map-css")) {
        const style = document.createElement("style");
        style.id = "landing-map-css";
        style.textContent = `
          .lm-dot { position:relative; width:14px; height:14px; margin:-7px; }
          .lm-dot-inner {
            position:absolute; inset:0; border-radius:50%;
            animation: lm-pulse 2.4s ease-in-out infinite;
          }
          .lm-dot-ring {
            position:absolute; inset:-5px; border-radius:50%; opacity:0;
            border: 2px solid currentColor;
            animation: lm-ring 2.4s ease-in-out infinite;
          }
          @keyframes lm-pulse {
            0%,100% { transform:scale(1); opacity:.85; }
            50%      { transform:scale(1.25); opacity:1; }
          }
          @keyframes lm-ring {
            0%   { transform:scale(.6); opacity:.7; }
            60%  { transform:scale(1.8); opacity:0; }
            100% { transform:scale(.6); opacity:0; }
          }
        `;
        document.head.appendChild(style);
      }

      outbreaks.forEach((ob) => {
        // Skip worldwide/multi-country aggregates — no meaningful geographic pin
        const cen = (ob.country_en ?? "").toLowerCase();
        if (cen === "multiple countries" || cen === "global") return;
        if (!ob.lat || !ob.lng) return;
        const color  = RISK_COLOR[ob.risk_level] || "#6b7280";
        const dName  = getLocalizedDisease(ob, locale);
        const cName  = getLocalizedCountry(ob, locale);
        const size   = Math.max(10, Math.min(22, Math.log10(ob.cases + 1) * 5));

        const icon = L.divIcon({
          html: `
            <div class="lm-dot" style="width:${size}px;height:${size}px;margin:-${size/2}px;animation-delay:${Math.random()*2}s">
              <div class="lm-dot-inner" style="background:${color};animation-delay:inherit"></div>
              <div class="lm-dot-ring"  style="color:${color};animation-delay:inherit"></div>
            </div>`,
          className: "",
          iconSize:  [size, size],
        });

        L.marker([ob.lat, ob.lng], { icon })
          .addTo(map)
          .bindTooltip(
            `<strong style="color:${color}">${dName}</strong><br/><span style="color:#9ca3af;font-size:0.75rem">${cName}</span>`,
            { className: "dark-popup", sticky: true }
          );
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [outbreaks, locale]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[300px] sm:h-[400px] rounded-xl overflow-hidden"
      aria-hidden="true"
    />
  );
}
