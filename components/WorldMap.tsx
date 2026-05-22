"use client";

import { useEffect, useRef } from "react";
import type { Outbreak } from "@/lib/outbreaks";

interface WorldMapProps {
  outbreaks: Outbreak[];
}

const riskColors: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

export default function WorldMap({ outbreaks }: WorldMapProps) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    if (mapRef.current) return; // already initialized

    import("leaflet").then((L) => {
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
        const color = riskColors[outbreak.riskLevel] || "#6b7280";
        const radius = Math.max(8, Math.min(30, Math.log10(outbreak.cases + 1) * 6));

        const circle = L.circleMarker([outbreak.lat, outbreak.lng], {
          radius,
          fillColor: color,
          color: color,
          weight: 2,
          opacity: 0.9,
          fillOpacity: 0.5,
        }).addTo(map);

        circle.bindPopup(`
          <div style="min-width:200px;font-family:system-ui">
            <strong style="color:${color}">${outbreak.disease}</strong><br/>
            <span style="color:#9ca3af">${outbreak.country}</span><br/>
            <hr style="border-color:#374151;margin:6px 0"/>
            <span>Cas : <strong>${outbreak.cases.toLocaleString()}</strong></span><br/>
            <span>Décès : <strong>${outbreak.deaths.toLocaleString()}</strong></span><br/>
            <span style="color:#6b7280;font-size:11px">Source : ${outbreak.source} — ${outbreak.date}</span><br/>
            <p style="margin-top:6px;font-size:12px;color:#d1d5db">${outbreak.description}</p>
          </div>
        `, { className: "dark-popup" });
      });

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [outbreaks]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-800">
      <div ref={containerRef} style={{ height: "420px", width: "100%" }} />
      <div className="absolute bottom-4 left-4 flex gap-3 bg-gray-900/90 rounded-lg px-3 py-2 text-xs">
        {Object.entries(riskColors).map(([level, color]) => (
          <span key={level} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: color }}
            />
            <span className="capitalize text-gray-300">{level}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
