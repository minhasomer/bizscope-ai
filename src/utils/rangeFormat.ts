/**
 * Normalizes financial range strings so they always render with a visible
 * " – " separator. Applied at render-time only — never mutates stored data.
 *
 * Handles:
 *   $200,000 $500,000       → $200,000 – $500,000   (missing separator)
 *   $200,000-$500,000       → $200,000 – $500,000   (bare hyphen)
 *   $200,000–$500,000       → $200,000 – $500,000   (en dash, no spaces)
 *   $200,000 - $500,000     → $200,000 – $500,000   (hyphen with spaces)
 *   2,500 5,000 sq ft       → 2,500 – 5,000 sq ft   (sqft plain numbers)
 *   $5,000 $10,000/month    → $5,000 – $10,000/month
 */
export function normalizeRangeSeparator(s: string | undefined | null): string {
  if (!s) return s ?? '';

  return s
    // 1. Normalize en/em dash (with optional surrounding spaces) between dollar amounts
    .replace(
      /(\$[\d,.]+[kKmMbB%]?(?:\/\w+)?)\s*[–—]\s*(\$[\d,.]+[kKmMbB%]?(?:\/\w+)?)/g,
      '$1 – $2'
    )
    // 2. Normalize bare hyphen (with optional spaces) between dollar amounts
    .replace(
      /(\$[\d,.]+[kKmMbB%]?(?:\/\w+)?)\s*-\s*(\$[\d,.]+[kKmMbB%]?(?:\/\w+)?)/g,
      '$1 – $2'
    )
    // 3. Insert separator between two adjacent dollar amounts separated only by whitespace
    .replace(
      /(\$[\d,.]+[kKmMbB%]?(?:\/\w+)?) +(\$[\d,.]+[kKmMbB%]?(?:\/\w+)?)/g,
      '$1 – $2'
    )
    // 4. Plain-number ranges for sqft-style fields ("2,500 5,000 sq ft")
    .replace(
      /(\b[\d,]+[kKmM]?) +(\b[\d,]+[kKmM]?\b)(?=\s+sq\b)/g,
      '$1 – $2'
    );
}
