/**
 * BizScope AI — US Location Validation
 *
 * Server-side guard that rejects non-US location strings before they reach
 * Gemini. A location is accepted when it matches one of:
 *
 *   1. A 5-digit US ZIP code  (e.g. "78701", "10001-1234")
 *   2. Ends with ", XX" where XX is a recognised US state/territory abbreviation
 *      (e.g. "Austin, TX", "Travis County, TX", "Chicago, IL")
 *   3. Contains a full US state name  (e.g. "New York", "West Virginia")
 *   4. Contains an explicit US identifier  ("USA", "United States", "U.S.")
 *
 * Everything else is rejected with a clear error message.
 */

const US_STATE_ABBREVS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC','PR','GU','VI','AS','MP',
]);

const US_STATE_NAMES = new Set([
  'alabama','alaska','arizona','arkansas','california','colorado',
  'connecticut','delaware','florida','georgia','hawaii','idaho',
  'illinois','indiana','iowa','kansas','kentucky','louisiana',
  'maine','maryland','massachusetts','michigan','minnesota',
  'mississippi','missouri','montana','nebraska','nevada',
  'new hampshire','new jersey','new mexico','new york',
  'north carolina','north dakota','ohio','oklahoma','oregon',
  'pennsylvania','rhode island','south carolina','south dakota',
  'tennessee','texas','utah','vermont','virginia','washington',
  'west virginia','wisconsin','wyoming',
  'district of columbia','washington dc','washington d.c.',
  'puerto rico','guam','virgin islands','american samoa',
]);

export interface LocationValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateUSLocation(location: string): LocationValidationResult {
  const loc = location.trim();
  const locLower = loc.toLowerCase();

  // 1 — US ZIP code (5-digit, optionally with +4)
  if (/^\d{5}(-\d{4})?$/.test(loc)) return { valid: true };

  // 2 — "City, ST" / "County, ST" where ST is a 2-letter US abbreviation
  //     Optionally followed by a ZIP: "Chicago, IL 60601"
  const commaAbbrev = loc.match(/,\s*([A-Za-z]{2})\b/);
  if (commaAbbrev) {
    const abbrev = commaAbbrev[1].toUpperCase();
    if (US_STATE_ABBREVS.has(abbrev)) return { valid: true };
    // A 2-letter code that is NOT a US state strongly suggests a foreign location
    // (e.g. "ON" for Ontario, "UK", "AE" for UAE).
    return {
      valid: false,
      reason: `"${loc}" does not appear to be a US location (unrecognised state code "${abbrev}"). BizScope currently supports US locations only. Please enter a US city, county, or ZIP code — for example "Austin, TX" or "78701".`,
    };
  }

  // 3 — Full US state name anywhere in the string
  for (const stateName of US_STATE_NAMES) {
    // Word-boundary match so "Georgia" doesn't match "Georgetown"
    const escaped = stateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`).test(locLower)) return { valid: true };
  }

  // 4 — Explicit US identifier
  if (/\busa\b|\bunited states\b|\bu\.s\.a?\b/i.test(loc)) return { valid: true };

  // Nothing matched a US pattern → reject
  return {
    valid: false,
    reason: `BizScope currently supports US locations only. Please enter a US city (e.g. "Austin, TX"), ZIP code (e.g. "78701"), or county (e.g. "Travis County, TX").`,
  };
}
