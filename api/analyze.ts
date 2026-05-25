import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    error: 'Live AI analysis is not available on this deployment. Enable demo mode via VITE_DEMO_MODE=true.',
  }));
}
