import type { IncomingMessage, ServerResponse } from 'http';

// SECURITY NOTE: when this stub is replaced, add auth + role gate before any
// Gemini call — identical pattern to api/analyze.ts. Also: regional analysis
// uses gemini-1.5-pro which can take 30-50s; set maxDuration = 60.

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'This endpoint is not available.', code: 'NOT_AVAILABLE' }));
}
