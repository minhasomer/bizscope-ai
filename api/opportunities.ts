import type { IncomingMessage, ServerResponse } from 'http';

// SECURITY NOTE: server.ts /api/opportunities has no authentication check.
// Before this stub is ever replaced with a real handler, auth + role gate
// must be added first — identical pattern to api/analyze.ts.

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'This endpoint is not available.', code: 'NOT_AVAILABLE' }));
}
