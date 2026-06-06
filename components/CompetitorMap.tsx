
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Competition } from '../types';

interface CompetitorMapProps {
  competitors: Competition[];
  targetCoordinates?: { latitude: number; longitude: number };
  coordinatesAreReal?: boolean;
}

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
            <div className="font-semibold text-sm text-gray-900">{comp.name}</div>
            {comp.address && <div className="text-xs text-gray-500 mt-0.5">{comp.address}</div>}
            {comp.details && <div className="text-xs text-gray-600 mt-1.5 leading-relaxed">{comp.details}</div>}
          </li>
        ))}
      </ul>
    )}
  </div>
);

const LeafletMap: React.FC<CompetitorMapProps> = ({ competitors, targetCoordinates, coordinatesAreReal }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

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

    if (coordinatesAreReal && targetCoordinates) {
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([targetCoordinates.latitude, targetCoordinates.longitude], { icon })
        .addTo(map)
        .bindPopup('<strong style="font-size:12px">📍 Your Location</strong>');
    }

    competitorsWithCoords.forEach(comp => {
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#EF4444;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const popupHtml = [
        `<strong style="font-size:12px;display:block;margin-bottom:3px">${comp.name}</strong>`,
        comp.address ? `<span style="font-size:11px;color:#6B7280;display:block">${comp.address}</span>` : '',
        comp.details ? `<span style="font-size:11px;color:#374151;display:block;margin-top:4px;max-width:200px">${comp.details}</span>` : '',
      ].filter(Boolean).join('');
      L.marker([comp.latitude!, comp.longitude!], { icon })
        .addTo(map)
        .bindPopup(popupHtml);
    });

    if (points.length > 1) {
      map.fitBounds(points, { padding: [30, 30] });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
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
            Competitor
          </span>
        )}
      </div>
    </div>
  );
};

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
