export interface RefinementOption {
  label: string;
  value: string;
}

export interface RefinementResult {
  needsRefinement: boolean;
  question?: string;
  options?: RefinementOption[];
}

/**
 * Converts a snake_case or slug string to a human-readable Title Case name.
 * Used as a safety net for refinement option values that the AI returned in
 * the wrong format (e.g. "coffee_beverage_food_truck" → "Coffee Beverage Food Truck").
 * Leaves already-readable values unchanged.
 */
function normalizeOptionValue(v: string): string {
  // If the value contains underscores or hyphens but no spaces, it's likely a slug.
  if (/[_-]/.test(v) && !/\s/.test(v)) {
    return v
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  return v;
}

/**
 * Parses and validates the JSON response from /api/refine.
 * Returns the fail-safe passthrough on any structural problem.
 */
export function parseRefinementResponse(raw: unknown): RefinementResult {
  if (!raw || typeof raw !== 'object') return { needsRefinement: false };

  const r = raw as Record<string, unknown>;
  if (typeof r.needsRefinement !== 'boolean') return { needsRefinement: false };
  if (!r.needsRefinement) return { needsRefinement: false };

  const options = Array.isArray(r.options) ? r.options : [];
  const validOptions: RefinementOption[] = options
    .filter((o: any) => typeof o?.label === 'string' && typeof o?.value === 'string')
    .map((o: any) => ({
      label: o.label.trim(),
      value: normalizeOptionValue(o.value.trim()),
    }))
    .filter((o: any) => o.label.length > 0 && o.value.length > 0)
    .slice(0, 6);

  if (validOptions.length < 2) return { needsRefinement: false };

  return {
    needsRefinement: true,
    question: typeof r.question === 'string' && r.question.trim()
      ? r.question.trim()
      : undefined,
    options: validOptions,
  };
}

/**
 * Calls /api/refine and returns a RefinementResult.
 * NEVER throws — returns { needsRefinement: false } on any failure.
 */
export async function fetchRefinement(
  businessType: string,
  location: string,
  timeoutMs = 15_000,
): Promise<RefinementResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'refine', businessType, location }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) return { needsRefinement: false };

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return { needsRefinement: false };
    }

    return parseRefinementResponse(data);
  } catch {
    // Network error, timeout, or any other failure — always fail safe.
    return { needsRefinement: false };
  }
}
