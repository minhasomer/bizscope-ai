/**
 * Campaign attribution — UTM parameter preservation across SPA navigation,
 * Google OAuth redirects, and Stripe Checkout redirects.
 *
 * Mechanism: On initial page load, UTM params are read from the URL and stored
 * in sessionStorage. sessionStorage persists for the browser tab session and is
 * automatically cleared when the tab is closed — no indefinite storage.
 *
 * GA4 reads UTM params from the page URL on the initial page_view. After a
 * redirect (OAuth, Stripe), the UTMs are no longer in the URL but remain in
 * sessionStorage for debugging / custom attribution if needed. GA4's _ga cookie
 * maintains session continuity across same-origin redirects.
 *
 * Privacy:
 * - Only the standard UTM params are stored (no user identity attached).
 * - Parameter values are sanitized to printable ASCII, max 256 chars each.
 * - No indefinite storage — sessionStorage lifetime = browser tab.
 * - No sensitive params (no tokens, no emails, no Stripe IDs).
 * - referrer is stored only as the origin, not the full path, to avoid capturing
 *   query strings that might contain sensitive data.
 */

const ALLOWED_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

type UtmParam = (typeof ALLOWED_PARAMS)[number];

export interface Attribution {
  params: Partial<Record<UtmParam, string>>;
  capturedAt: number;
  referrer?: string;
}

const STORAGE_KEY = 'bizscope_attr';
const MAX_VALUE_LENGTH = 256;

/** Strip non-printable characters and truncate. */
function sanitize(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, MAX_VALUE_LENGTH);
}

/**
 * Capture UTM params from the current URL and store in sessionStorage.
 * Called once on app init. No-op if no UTM params are present or if called
 * in a non-browser environment.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    const search = new URLSearchParams(window.location.search);
    const params: Partial<Record<UtmParam, string>> = {};
    let hasUtm = false;

    for (const key of ALLOWED_PARAMS) {
      const raw = search.get(key);
      if (raw) {
        const clean = sanitize(raw);
        if (clean) {
          params[key] = clean;
          hasUtm = true;
        }
      }
    }

    if (!hasUtm) return;

    // Store only the referrer origin, not the full URL, to avoid capturing
    // any query strings that might contain sensitive data.
    let referrer: string | undefined;
    try {
      const ref = document.referrer;
      if (ref) referrer = new URL(ref).origin.slice(0, MAX_VALUE_LENGTH);
    } catch {
      // Malformed referrer — omit.
    }

    const data: Attribution = {
      params,
      capturedAt: Date.now(),
      ...(referrer && { referrer }),
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Non-fatal.
  }
}

/**
 * Retrieve stored attribution data. Returns null if none captured or if
 * sessionStorage is unavailable.
 */
export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Attribution;
    if (!data?.params || typeof data.capturedAt !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Clear stored attribution data.
 * Call after a confirmed conversion if you want single-session attribution.
 */
export function clearAttribution(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}
