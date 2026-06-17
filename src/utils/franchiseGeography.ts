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
export type TerritoryImpactLevel = 'none' | 'low' | 'moderate' | 'high';
export type BusinessOpportunityRating = 'Strong' | 'Moderate' | 'Weak';
export type RecommendationV2 = 'Recommended' | 'Caution Advised' | 'Not Recommended';

/**
 * Same-ZIP same-brand unit count above which even a mature/high-density
 * brand's "expected clustering" assumption no longer holds and the location
 * should be flagged as a genuine saturation/cannibalization concern instead
 * of being waved through as normal density.
 */
export const DEFAULT_SATURATION_THRESHOLD = 3;

interface TerritoryStatusInput {
  geographyType: GeographyType;
  nearestDistanceMiles: number | null;
  densityTier: FranchiseDensityTier;
  sameBrandFound: boolean;
  /** Count of same-brand locations found in the competitor search. */
  sameBrandCount?: number;
  /** Same-ZIP unit count above which mature-brand presence is treated as saturation, not expected density. */
  saturationThreshold?: number;
}

/**
 * Preview-only classification of territory status, per the geography-aware
 * model in the franchise recommendation audit. Not yet wired into the
 * recommendation/score-adjustment logic (Phase 4 scope).
 *
 * Mature/high-density brands are not blanket-exempted: at ZIP-level, a same-
 * brand count at/above the saturation threshold is still flagged as a
 * verification concern (cannibalization risk), even though a single nearby
 * unit is expected and not flagged.
 */
export function classifyTerritoryStatus(input: TerritoryStatusInput): TerritoryStatusPreview {
  const {
    geographyType, densityTier, sameBrandFound,
    sameBrandCount = 0, saturationThreshold = DEFAULT_SATURATION_THRESHOLD,
  } = input;

  if (!sameBrandFound) return '🟢 no_known_conflicts';

  if (densityTier === 'mature_national') {
    // Wider-area presence is expected for mature brands regardless of count.
    if (geographyType !== 'zip') return '🟢 no_known_conflicts';
    // ZIP-level: a single nearby unit is normal density; a cluster at/above
    // the saturation threshold is a real cannibalization/saturation signal.
    return sameBrandCount >= saturationThreshold ? '🟡 verification_required' : '🟢 no_known_conflicts';
  }

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
  const {
    geographyType, nearestDistanceMiles, densityTier, sameBrandFound,
    sameBrandCount = 0, saturationThreshold = DEFAULT_SATURATION_THRESHOLD,
  } = input;

  if (!sameBrandFound) return 'low'; // nothing detected — "no conflict" is an absence of evidence, not strong evidence

  // A same-ZIP cluster at/above the saturation threshold is hard evidence of
  // clustering regardless of brand maturity — bump confidence even for
  // mature brands, since this is no longer "expected density" territory.
  if (geographyType === 'zip' && sameBrandCount >= saturationThreshold) return 'strong';

  // Mature/high-density brands: below the saturation threshold, even a close
  // match says little about territory (units are expected to cluster), so
  // confidence in any conflict signal is low.
  if (densityTier === 'mature_national') return 'low';

  // ZIP-level match with known distance is the strongest evidence available today.
  if (geographyType === 'zip' && nearestDistanceMiles !== null) return 'strong';

  // City-level match, or a ZIP-level match with no distance data, is moderate.
  if (geographyType === 'city') return 'moderate';
  if (geographyType === 'zip') return 'moderate';

  // County/metro/region matches are the weakest evidence for a specific-location conflict.
  return 'low';
}

/**
 * Preview-only impact-level summary of territoryStatus, alongside
 * territoryConfidence — a simpler "how much should this matter" signal for
 * the shadow-mode preview, independent of the status emoji/label itself.
 */
export function classifyTerritoryImpactLevel(status: TerritoryStatusPreview): TerritoryImpactLevel {
  switch (status) {
    case '🟢 no_known_conflicts': return 'none';
    case '🟡 verification_required': return 'moderate';
    case '🔴 likely_unavailable': return 'high';
    default: return 'low';
  }
}

/**
 * Preview-only business-opportunity rating, derived solely from Gemini's raw
 * (pre-franchise-adjustment) viability score. Independent of territory.
 */
export function classifyBusinessOpportunity(rawScore: number): BusinessOpportunityRating {
  if (rawScore >= 76) return 'Strong';
  if (rawScore >= 51) return 'Moderate';
  return 'Weak';
}

/**
 * Preview-only Phase 4 recommendation matrix. Reuses the existing 3-value
 * recommendation.decision enum (Recommended / Caution Advised / Not
 * Recommended) so it is directly diffable against the live decision in
 * shadow-mode logs. Monotonic: territory status can only hold steady or
 * downgrade the outcome relative to business opportunity alone — it can
 * never upgrade it.
 */
export function deriveRecommendationV2(
  opportunity: BusinessOpportunityRating,
  territoryStatus: TerritoryStatusPreview,
): RecommendationV2 {
  if (territoryStatus === '🔴 likely_unavailable') return 'Not Recommended';

  if (opportunity === 'Strong') {
    return territoryStatus === '🟢 no_known_conflicts' ? 'Recommended' : 'Caution Advised';
  }
  if (opportunity === 'Moderate') {
    return 'Caution Advised';
  }
  return 'Not Recommended'; // Weak opportunity is never Recommended/Caution Advised, regardless of territory.
}
