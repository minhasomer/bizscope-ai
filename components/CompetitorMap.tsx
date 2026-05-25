
import React from 'react';
import { Competition } from '../types';

interface CompetitorMapProps {
  competitors: Competition[];
  targetCoordinates?: { latitude: number; longitude: number };
}

export const CompetitorMap: React.FC<CompetitorMapProps> = ({ competitors, targetCoordinates }) => {
  // If we don't have coordinates, we can't render the map effectively.
  // We'll show a fallback message or just the list.
  const hasCoords = competitors.some(c => c.latitude && c.longitude) && targetCoordinates;

  if (!hasCoords) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 flex-col p-4 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9.553 4.553A1 1 0 009 7" />
        </svg>
        <p>Exact map coordinates unavailable for this location.</p>
        <p className="text-sm mt-1">Check the competitor list for addresses.</p>
      </div>
    );
  }

  // Basic normalization for plotting
  // 1. Find min/max lat/long to set bounds
  const points = [
    { lat: targetCoordinates!.latitude, lng: targetCoordinates!.longitude, type: 'target', name: 'Your Location' },
    ...competitors.filter(c => c.latitude && c.longitude).map(c => ({ lat: c.latitude!, lng: c.longitude!, type: 'competitor', name: c.name }))
  ];

  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Add padding
  const paddingLat = (maxLat - minLat) * 0.2 || 0.01;
  const paddingLng = (maxLng - minLng) * 0.2 || 0.01;

  const boundMinLat = minLat - paddingLat;
  const boundMaxLat = maxLat + paddingLat;
  const boundMinLng = minLng - paddingLng;
  const boundMaxLng = maxLng + paddingLng;

  const latRange = boundMaxLat - boundMinLat;
  const lngRange = boundMaxLng - boundMinLng;

  const getX = (lng: number) => ((lng - boundMinLng) / lngRange) * 100;
  const getY = (lat: number) => 100 - ((lat - boundMinLat) / latRange) * 100; // Invert Y for SVG

  return (
    <div className="relative w-full h-80 bg-slate-50 rounded-lg overflow-hidden border border-gray-200">
      {/* Grid background */}
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
        {[...Array(16)].map((_, i) => (
          <div key={i} className="border-gray-100 border-[0.5px]"></div>
        ))}
      </div>
      
      <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
        {points.map((p, i) => (
          <g key={i}>
            {p.type === 'target' ? (
              // Target marker (You are here)
              <circle cx={getX(p.lng)} cy={getY(p.lat)} r="3" fill="#3B82F6" stroke="white" strokeWidth="0.5">
                <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
              </circle>
            ) : (
              // Competitor marker
              <circle cx={getX(p.lng)} cy={getY(p.lat)} r="2" fill="#EF4444" stroke="white" strokeWidth="0.5" />
            )}
          </g>
        ))}
      </svg>
      
      {/* Tooltips/Labels overlaid */}
      {points.map((p, i) => (
        <div
          key={i}
          className="absolute transform -translate-x-1/2 -translate-y-full pb-2 pointer-events-none"
          style={{ left: `${getX(p.lng)}%`, top: `${getY(p.lat)}%` }}
        >
          {p.type === 'target' ? (
             <div className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap z-10">Your Location</div>
          ) : (
             <div className="bg-white text-gray-800 text-[10px] px-1.5 py-0.5 rounded shadow border border-gray-200 whitespace-nowrap opacity-90 max-w-[100px] truncate">
               {p.name}
             </div>
          )}
        </div>
      ))}

      <div className="absolute bottom-2 right-2 bg-white/80 p-2 rounded text-xs text-gray-500 backdrop-blur-sm">
        <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 block"></span> You
            <span className="w-2 h-2 rounded-full bg-red-500 block ml-2"></span> Competitor
        </div>
      </div>
    </div>
  );
};
