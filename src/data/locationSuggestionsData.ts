
// Shared location suggestions used by Hero and OpportunityExplorer.

// ─── FULL SEARCHABLE LIST ────────────────────────────────────────────────────
export const locationSuggestions: string[] = [
  // Top US Cities
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ',
  'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA',
  'Austin, TX', 'Jacksonville, FL', 'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC',
  'San Francisco, CA', 'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Washington, DC',
  'Boston, MA', 'El Paso, TX', 'Nashville, TN', 'Detroit, MI', 'Oklahoma City, OK',
  'Portland, OR', 'Las Vegas, NV', 'Memphis, TN', 'Louisville, KY', 'Baltimore, MD',
  'Milwaukee, WI', 'Albuquerque, NM', 'Tucson, AZ', 'Fresno, CA', 'Sacramento, CA',
  'Mesa, AZ', 'Kansas City, MO', 'Atlanta, GA', 'Colorado Springs, CO',
  'Raleigh, NC', 'Miami, FL', 'Virginia Beach, VA', 'Omaha, NE', 'Oakland, CA',
  'Minneapolis, MN', 'Tulsa, OK', 'Arlington, TX', 'Tampa, FL', 'New Orleans, LA',
  'Wichita, KS', 'Cleveland, OH', 'Bakersfield, CA', 'Aurora, CO', 'Anaheim, CA',
  'Honolulu, HI', 'Corpus Christi, TX', 'Riverside, CA', 'Lexington, KY', 'Stockton, CA',
  'Pittsburgh, PA', 'Anchorage, AK', 'Greensboro, NC', 'Plano, TX', 'Lincoln, NE',
  'Orlando, FL', 'St. Louis, MO', 'Irvine, CA', 'Chandler, AZ', 'Laredo, TX',
  'Madison, WI', 'Durham, NC', 'Lubbock, TX', 'Garland, TX', 'Glendale, AZ',
  'Reno, NV', 'Baton Rouge, LA', 'Chesapeake, VA', 'Gilbert, AZ', 'Irving, TX',
  'Scottsdale, AZ', 'North Las Vegas, NV', 'Fremont, CA', 'Chula Vista, CA',
  'Fort Wayne, IN', 'St. Petersburg, FL', 'Jersey City, NJ', 'Durham, NC',

  // Major Suburbs & Regions
  'Naperville, IL', 'Schaumburg, IL', 'Evanston, IL', 'Aurora, IL', 'Joliet, IL',
  'Gurnee, IL', 'Libertyville, IL', 'Vernon Hills, IL', 'Arlington Heights, IL',
  'The Woodlands, TX', 'Sugar Land, TX', 'Katy, TX', 'Pearland, TX',
  'Frisco, TX', 'McKinney, TX', 'Allen, TX', 'Carrollton, TX',
  'Marietta, GA', 'Alpharetta, GA', 'Sandy Springs, GA', 'Roswell, GA',
  'Bellevue, WA', 'Tacoma, WA', 'Redmond, WA', 'Kirkland, WA',
  'Cambridge, MA', 'Somerville, MA', 'Quincy, MA', 'Framingham, MA',
  'Henderson, NV', 'Summerlin, NV', 'Tempe, AZ', 'Peoria, AZ', 'Surprise, AZ', 'Goodyear, AZ',
  'Clearwater, FL', 'Sarasota, FL', 'Fort Lauderdale, FL', 'Pembroke Pines, FL',
  'Boca Raton, FL', 'Coral Springs, FL', 'Pompano Beach, FL',
  'Round Rock, TX', 'Cedar Park, TX', 'Georgetown, TX', 'Kyle, TX',
  'Pasadena, CA', 'Burbank, CA', 'Torrance, CA', 'Santa Monica, CA',

  // Counties
  'Los Angeles County, CA', 'Harris County, TX', 'Maricopa County, AZ',
  'San Diego County, CA', 'Orange County, CA', 'Miami-Dade County, FL',
  'Dallas County, TX', 'King County, WA', 'Clark County, NV',
  'Tarrant County, TX', 'Bexar County, TX', 'Broward County, FL',
  'Santa Clara County, CA', 'Riverside County, CA', 'Collin County, TX',
  'Cook County, IL', 'Lake County, IL', 'DuPage County, IL',
  'Middlesex County, MA', 'Wayne County, MI',

  // ZIP Codes
  '10001', '10002', '10028', // NYC
  '90210', '90001', '90028', // LA
  '60601', '60611', '60614', // Chicago
  '77001', '77005', '77019', // Houston
  '85001', '85002', '85003', // Phoenix
  '33101', '33139', '33131', // Miami
  '94102', '94103', '94110', // SF
  '75001', '75006', '75007', // Dallas suburbs
  '30301', '30309', '30318', // Atlanta
  '98101', '98102', '98103', // Seattle
  '80201', '80202', '80203', // Denver
  '73301', '73344',          // Austin
];

// ─── NATIONAL DEFAULTS (shown when field is focused but empty) ──────────────
// Nationally representative high-growth markets — no dev-team location bias.
export const defaultLocationSuggestions: string[] = [
  'Austin, TX',
  'Dallas, TX',
  'Phoenix, AZ',
  'Charlotte, NC',
  'Denver, CO',
  'Nashville, TN',
  'Tampa, FL',
  'Raleigh, NC',
  'Atlanta, GA',
  'Houston, TX',
];

// ─── GEOLOCATION-BASED SUGGESTIONS ─────────────────────────────────────────
// Tries to reverse-geocode the user's location via Nominatim (free, no key).
// Resolves to an array of location strings or an empty array on failure.
export async function getGeolocationSuggestions(): Promise<string[]> {
  if (!('geolocation' in navigator)) return [];

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
          const res = await fetch(url, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'BizScopeAI/1.0' },
          });
          if (!res.ok) { resolve([]); return; }
          const data = await res.json();
          const a = data.address ?? {};
          const city    = a.city || a.town || a.village || a.hamlet || '';
          const county  = a.county || '';
          const state   = a.state || '';
          const zip     = a.postcode || '';

          const results: string[] = [];
          if (city && state)   results.push(`${city}, ${state}`);
          if (county && state) results.push(`${county}, ${state}`);
          if (state)           results.push(state);
          if (zip)             results.push(zip);

          resolve(results.length > 0 ? results : []);
        } catch {
          resolve([]);
        }
      },
      () => resolve([]),          // permission denied or error
      { timeout: 5000, maximumAge: 300_000 },
    );
  });
}

// ─── FILTER ─────────────────────────────────────────────────────────────────
export function filterLocationSuggestions(input: string): string[] {
  if (!input.trim()) return defaultLocationSuggestions;
  const q = input.toLowerCase();
  // Starts-with matches first, then other substring matches
  const startsWith = locationSuggestions.filter(s => s.toLowerCase().startsWith(q));
  const contains   = locationSuggestions.filter(s => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
  return [...startsWith, ...contains].slice(0, 10);
}

// ─── ASYNC AUTOCOMPLETE (Photon proxy) ───────────────────────────────────────
// Calls /api/geocode, which proxies to Photon/Komoot with countrycodes=us.
// Falls back to the static filterLocationSuggestions on any error or empty result.
export async function fetchLocationAutocomplete(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return defaultLocationSuggestions.slice(0, 8);
  if (q.length < 2) return filterLocationSuggestions(q);
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = (await res.json()) as string[];
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch { /* network error, server down, or timeout — use static fallback */ }
  return filterLocationSuggestions(q);
}
