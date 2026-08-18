import type { IncomingMessage } from 'http';

export interface ClientGeo {
  visitor_city:    string | null;
  visitor_country: string | null;
  visitor_region:  string | null;  // ISO 3166-2 subdivision code, e.g. "TX"
  visitor_lat:     number | null;
  visitor_lon:     number | null;
}

function hdr(req: IncomingMessage, name: string): string | null {
  const v = req.headers[name];
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return null;
  // Vercel percent-encodes city names (e.g. "New%20York") — decode them.
  try { return decodeURIComponent(s.trim()) || null; } catch { return s.trim() || null; }
}

/**
 * Extracts Vercel's per-request geo headers and returns them as columns
 * ready to spread into a report_activity_log insert.
 * All fields are null when running locally or if Vercel omits a header.
 */
export function extractClientGeo(req: IncomingMessage): ClientGeo {
  const lat = parseFloat(hdr(req, 'x-vercel-ip-latitude')  ?? '');
  const lon = parseFloat(hdr(req, 'x-vercel-ip-longitude') ?? '');
  return {
    visitor_city:    hdr(req, 'x-vercel-ip-city'),
    visitor_country: hdr(req, 'x-vercel-ip-country'),
    visitor_region:  hdr(req, 'x-vercel-ip-country-region'),
    visitor_lat:     Number.isFinite(lat) ? lat : null,
    visitor_lon:     Number.isFinite(lon) ? lon : null,
  };
}
