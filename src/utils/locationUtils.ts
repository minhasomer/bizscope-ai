
// ─── Internal helpers ─────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str.replace(/\b\w+/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

// ─── Public sync formatter ────────────────────────────────────────────────────

/**
 * Normalizes a freeform location string to a clean presentation format.
 *
 * Rules:
 *   - Bare 5-digit ZIP codes are returned unchanged (handled by resolveLocationDisplay).
 *   - "city, ST"  → title-cased city + uppercased 2-letter state abbreviation.
 *   - "city, State" → title-cased city + title-cased state name.
 *   - "city name"  → title-cased words (no comma).
 *
 * Examples:
 *   "gary, IN"          → "Gary, IN"
 *   "vernon hills, il"  → "Vernon Hills, IL"
 *   "wisconsin dells"   → "Wisconsin Dells"
 *   "lake county, il"   → "Lake County, IL"
 *
 * Safe to call at render time — pure, no side-effects.
 */
export function formatLocationDisplay(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  // ZIP codes: leave for resolveLocationDisplay to handle via API lookup.
  if (/^\d{5}$/.test(trimmed)) return trimmed;

  const commaIdx = trimmed.indexOf(',');
  if (commaIdx !== -1) {
    const city  = trimmed.slice(0, commaIdx).trim();
    const state = trimmed.slice(commaIdx + 1).trim();
    // 2-letter abbreviations → uppercase; full state names → title-case.
    const formattedState = /^[a-zA-Z]{2}$/.test(state)
      ? state.toUpperCase()
      : toTitleCase(state);
    return `${toTitleCase(city)}, ${formattedState}`;
  }
  return toTitleCase(trimmed);
}

// ─── Async ZIP resolver ───────────────────────────────────────────────────────

/**
 * Resolves a bare US ZIP code to "City, ST" using the free zippopotam.us API,
 * then applies formatLocationDisplay to any non-ZIP input.
 *
 * Returns the original input unchanged if:
 *   - the API call fails or returns no results (ZIP case)
 *
 * The caller should preserve the original ZIP for any geocoding/radius logic
 * and use the returned display name only for UI headings and AI prompts.
 */
export async function resolveLocationDisplay(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!/^\d{5}$/.test(trimmed)) return formatLocationDisplay(trimmed);
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${trimmed}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return trimmed;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return trimmed;
    return `${place['place name']}, ${place['state abbreviation']}`;
  } catch {
    return trimmed;
  }
}
