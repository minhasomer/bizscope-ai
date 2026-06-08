import type { IncomingMessage, ServerResponse } from 'http';

// SECURITY NOTE: when this stub is replaced, add auth + plan gate before any
// Gemini call — use the plan-based pattern from api/opportunities.ts, NOT the
// legacy BETA_ROLES role check. Gate: !verifiedUserId → 401, verifiedPlan ===
// 'Explorer' → 403. Also: regional analysis uses gemini-1.5-pro which can
// take 30-50s; set maxDuration = 60.

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'This endpoint is not available.', code: 'NOT_AVAILABLE' }));
}
