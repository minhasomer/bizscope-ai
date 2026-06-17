/**
 * Geography-aware franchise territory signals (Phase 3).
 * Zero dependencies — safe to import in both browser (Vite) and Node (API).
 *
 * These functions compute and store observability signals only.
 * They do NOT feed into score adjustment, recommendation capping, or any
 * other existing franchise-penalty logic — that remains untouched pending
 * a separate redesign pass.
 */

import { FranchiseDensityTier } from './franchiseDetection';

export type GeographyType = 'zip' | 'city' | 'county' | 'metro' | 'region';

/**
 * Classifies the user-entered search location string into a geography type.
 * Pattern-based heuristic over the raw input — no geocoding call involved.
 * Falls back to 'city', matching today's de facto flat treatment of all
 * non-zip, non-county inputs.
 */
export function classifySearchGeography(locationInput: string): GeographyType {
  const input = (locationInput || '').trim();
  if (!input) return 'city';

  if (/^\d{5}(-\d{4})?$/.test(input)) return 'zip';
  if (/\bcounty\b/i.test(input)) return 'county';
  if (/\b(metro|metropolitan area|metro area)\b/i.test(input)) return 'metro';
  if (/\b(region|area|tri-state|state of)\b/i.test(input)) return 'region';

  return 'city';
}

/**
 * Great-circle distance between two lat/lng points, in miles.
 */
export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
}

export type TerritoryStatusPreview = '🟢 no_known_conflicts' | '🟡 verification_required' | '🔴 likely_unavailable';
export type TerritoryConfidence = 'strong' | 'moderate' | 'low';

interface TerritoryStatusInput {
  geographyType: GeographyType;
  nearestDistanceMiles: number | null;
  densityTier: FranchiseDensityTier;
  sameBrandFound: boolean;
}

/**
 * Preview-only classification of territory status, per the geography-aware
 * model in the franchise recommendation audit. Not yet wired into the
 * recommendation/score-adjustment logic (Phase 4 scope).
 */
export function classifyTerritoryStatus(input: TerritoryStatusInput): TerritoryStatusPreview {
  const { geographyType, densityTier, sameBrandFound } = input;

  if (!sameBrandFound) return '🟢 no_known_conflicts';

  // Mature/high-density brands: a nearby unit is expected, weak signal on its own.
  if (densityTier === 'mature_national') return '🟢 no_known_conflicts';

  // County/metro/region-level matches are verification signals, not automatic conflicts.
  if (geographyType === 'county' || geographyType === 'metro' || geographyType === 'region') {
    return '🟡 verification_required';
  }

  // ZIP/city-level match on an established/emerging brand: stronger conflict signal.
  if (geographyType === 'zip') return '🔴 likely_unavailable';
  return '🟡 verification_required'; // city-level: moderate signal, not yet a hard conflict
}

/**
 * Preview-only confidence rating for the territory status above — reflects
 * how much the underlying geography/density evidence actually supports the
 * status, independent of the status itself.
 */
export function classifyTerritoryConfidence(input: TerritoryStatusInput): TerritoryConfidence {
  const { geographyType, nearestDistanceMiles, densityTier, sameBrandFound } = input;

  if (!sameBrandFound) return 'low'; // nothing detected — "no conflict" is an absence of evidence, not strong evidence

  // Mature/high-density brands: even a close match says little about territory
  // (units are expected to cluster), so confidence in any conflict signal is low.
  if (densityTier === 'mature_national') return 'low';

  // ZIP-level match with known distance is the strongest evidence available today.
  if (geographyType === 'zip' && nearestDistanceMiles !== null) return 'strong';

  // City-level match, or a ZIP-level match with no distance data, is moderate.
  if (geographyType === 'city') return 'moderate';
  if (geographyType === 'zip') return 'moderate';

  // County/metro/region matches are the weakest evidence for a specific-location conflict.
  return 'low';
}
