/**
 * Normalizes currency and percentage range strings so they always render with
 * a visible "–" separator. Applied at render-time only — never mutates stored
 * data, since the AI sometimes emits ranges with no separator at all
 * (including across a literal newline), a bare hyphen, or an en/em dash with
 * inconsistent spacing.
 *
 * Handles, for both currency ($) and percentage (%) amounts:
 *   $150,000\n\n$350,000   → $150,000–$350,000   (newline-separated, no separator)
 *   $150,000 $350,000      → $150,000–$350,000   (space-separated, no separator)
 *   $150,000-$350,000      → $150,000–$350,000   (bare hyphen)
 *   $150,000–$350,000      → $150,000–$350,000   (en dash, inconsistent spacing)
 *   15% 25%                → 15%–25%
 *   2,500 5,000 sq ft      → 2,500–5,000 sq ft   (sqft plain numbers)
 *   $5,000 $10,000/month   → $5,000–$10,000/month
 */
export function normalizeRangeSeparator(s: string | undefined | null): string {
  if (!s) return s ?? '';

  // A single currency or percentage amount, e.g. "$150,000", "$5k", "15%", "15.5%".
  const amount = '(?:\\$[\\d,.]+[kKmMbB]?(?:\\/\\w+)?|[\\d,.]+\\s?%)';
  const re = (sep: string) => new RegExp(`(${amount})${sep}(${amount})`, 'g');

  return s
    // 1. en/em dash between two amounts, any surrounding whitespace
    .replace(re('\\s*[–—]\\s*'), '$1–$2')
    // 2. bare hyphen between two amounts, any surrounding whitespace
    .replace(re('\\s*-\\s*'), '$1–$2')
    // 3. whitespace only between two amounts — includes newlines (e.g. "$1\n\n$2")
    .replace(re('\\s+'), '$1–$2')
    // 4. plain-number ranges for sqft-style fields ("2,500 5,000 sq ft")
    .replace(
      /(\b[\d,]+[kKmM]?)\s+(\b[\d,]+[kKmM]?\b)(?=\s+sq\b)/g,
      '$1–$2'
    )
    // 5. X–Y% where only the trailing value carries the % sign ("8-15%", "40–55%")
    .replace(/(\b[\d,.]+)\s*[-–—]\s*([\d,.]+\s?%)/g, '$1–$2')
    // 5b. same, space-separated ("8 15%", "40 55%")
    .replace(/(\b[\d,.]+)\s+([\d,.]+\s?%)/g, '$1–$2')
    // 6. plain-number ranges before a time unit ("12-24 months", "3–5 years")
    .replace(/(\b[\d,.]+)\s*[-–—]\s*(\b[\d,.]+)(?=\s+(?:months?|years?|weeks?|days?))/g, '$1–$2')
    // 6b. same, space-separated ("12 24 months", "3 5 years")
    .replace(/(\b[\d,.]+)\s+(\b[\d,.]+)(?=\s+(?:months?|years?|weeks?|days?))/g, '$1–$2');
}
