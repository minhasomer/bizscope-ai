
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Competition } from '../types';

interface CompetitorMapProps {
  competitors: Competition[];
  targetCoordinates?: { latitude: number; longitude: number };
  coordinatesAreReal?: boolean;
}

// ─── Fallback table (no coordinates at all) ────────────────────────────────────

const CompetitorTable: React.FC<{ competitors: Competition[] }> = ({ competitors }) => (
  <div className="space-y-3">
    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
      Geographic coordinates were not available for this report. Competitor locations are listed below.
    </p>
    {competitors.length === 0 ? (
      <p className="text-sm text-gray-500 text-center py-8">No competitor data found for this location.</p>
    ) : (
      <ul className="space-y-3">
        {competitors.map((comp, i) => (
          <li key={i} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <span className="font-semibold text-sm text-gray-900">{comp.name}</span>
            </div>
            {comp.address && <div className="text-xs text-gray-500 ml-7">{comp.address}</div>}
            {comp.details
              ? <div className="text-xs text-gray-600 mt-1.5 ml-7 leading-relaxed">{comp.details}</div>
              : <div className="text-xs text-gray-400 mt-1 ml-7 italic">Competitor location identified; details unavailable.</div>
            }
          </li>
        ))}
      </ul>
    )}
  </div>
);

// ─── Leaflet map + side list ───────────────────────────────────────────────────

const LeafletMap: React.FC<CompetitorMapProps> = ({ competitors, targetCoordinates, coordinatesAreReal }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<L.Marker[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const competitorsWithCoords = competitors.filter(c => c.latitude != null && c.longitude != null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const points: [number, number][] = [];
    if (coordinatesAreReal && targetCoordinates) {
      points.push([targetCoordinates.latitude, targetCoordinates.longitude]);
    }
    competitorsWithCoords.forEach(c => points.push([c.latitude!, c.longitude!]));

    let center: [number, number] = [39.5, -98.35];
    let zoom = 4;
    if (points.length > 0) {
      center = [
        points.reduce((s, p) => s + p[0], 0) / points.length,
        points.reduce((s, p) => s + p[1], 0) / points.length,
      ];
      zoom = 12;
    } else if (targetCoordinates) {
      center = [targetCoordinates.latitude, targetCoordinates.longitude];
      zoom = 13;
    }

    const map = L.map(containerRef.current, {
      center,
      zoom,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    // Target location marker (blue pin, no number)
    if (coordinatesAreReal && targetCoordinates) {
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([targetCoordinates.latitude, targetCoordinates.longitude], { icon })
        .addTo(map)
        .bindTooltip('📍 Your Location', { direction: 'top', offset: [0, -10] })
        .bindPopup('<strong style="font-size:12px">📍 Your Location</strong>');
    }

    // Competitor markers — numbered red circles
    markerRefs.current = competitorsWithCoords.map((comp, idx) => {
      const num = idx + 1;
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:24px;height:24px;border-radius:50%;background:#EF4444;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;line-height:1;">${num}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const detailsHtml = comp.details
        ? `<span style="font-size:11px;color:#374151;display:block;margin-top:4px;max-width:220px;line-height:1.4">${comp.details}</span>`
        : `<span style="font-size:11px;color:#9CA3AF;display:block;margin-top:4px;font-style:italic">Competitor location identified; details unavailable.</span>`;

      const popupHtml = [
        `<div style="min-width:160px">`,
        `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">`,
        `<span style="width:18px;height:18px;border-radius:50%;background:#EF4444;color:white;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${num}</span>`,
        `<strong style="font-size:12px">${comp.name}</strong>`,
        `</div>`,
        comp.address ? `<span style="font-size:11px;color:#6B7280;display:block;margin-bottom:2px">📍 ${comp.address}</span>` : '',
        detailsHtml,
        `</div>`,
      ].filter(Boolean).join('');

      const marker = L.marker([comp.latitude!, comp.longitude!], { icon })
        .addTo(map)
        .bindTooltip(comp.name, { direction: 'top', offset: [0, -14], className: 'competitor-tooltip' })
        .bindPopup(popupHtml, { maxWidth: 260 });

      marker.on('popupopen', () => setActiveIndex(idx));
      marker.on('popupclose', () => setActiveIndex(null));

      return marker;
    });

    if (points.length > 1) {
      map.fitBounds(points, { padding: [30, 30] });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRefs.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleListItemClick = (idx: number) => {
    const marker = markerRefs.current[idx];
    const map = mapRef.current;
    if (!marker || !map) return;
    const latlng = marker.getLatLng();
    map.setView(latlng, Math.max(map.getZoom(), 14), { animate: true });
    marker.openPopup();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Map panel */}
      <div className="relative" style={{ flex: '1 1 60%', minHeight: 0 }}>
        <div ref={containerRef} className="w-full h-full" />
        {/* Legend */}
        <div className="absolute bottom-8 left-2 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[10px] text-gray-500 flex items-center gap-3 shadow-sm pointer-events-none">
          {coordinatesAreReal && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              Your Location
            </span>
          )}
          {competitorsWithCoords.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              Competitor (click for details)
            </span>
          )}
        </div>
      </div>

      {/* Competitor list panel */}
      {competitorsWithCoords.length > 0 && (
        <div className="border-t border-gray-100 bg-white overflow-y-auto" style={{ flex: '0 0 40%' }}>
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Competitors · click to focus
          </div>
          <ul>
            {competitorsWithCoords.map((comp, idx) => (
              <li
                key={idx}
                onClick={() => handleListItemClick(idx)}
                className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${activeIndex === idx ? 'bg-red-50' : 'hover:bg-gray-50'}`}
              >
                <span className="mt-0.5 w-5 h-5 flex-shrink-0 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900 truncate">{comp.name}</div>
                  {comp.address
                    ? <div className="text-[11px] text-gray-400 truncate">{comp.address}</div>
                    : comp.details
                      ? <div className="text-[11px] text-gray-500 truncate">{comp.details}</div>
                      : <div className="text-[11px] text-gray-400 italic">Details unavailable</div>
                  }
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ─── Public export ─────────────────────────────────────────────────────────────

export const CompetitorMap: React.FC<CompetitorMapProps> = ({ competitors, targetCoordinates, coordinatesAreReal }) => {
  const hasMapData = competitors.some(c => c.latitude != null && c.longitude != null);

  if (!hasMapData && !targetCoordinates) {
    return <CompetitorTable competitors={competitors} />;
  }

  return (
    <LeafletMap
      competitors={competitors}
      targetCoordinates={targetCoordinates}
      coordinatesAreReal={coordinatesAreReal}
    />
  );
};
