
/**
 * Resolves a bare US ZIP code to "City, ST" using the free zippopotam.us API.
 * Returns the original input unchanged if:
 *   - input is not a bare 5-digit ZIP
 *   - the API call fails or returns no results
 *
 * The caller should preserve the original ZIP for any geocoding/radius logic
 * and use the returned display name only for UI headings and AI prompts.
 */
export async function resolveLocationDisplay(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!/^\d{5}$/.test(trimmed)) return trimmed;
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
