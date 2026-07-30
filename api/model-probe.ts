// TEMPORARY — Task 2 model probe. Delete after verifying replacement model.
import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (process.env.REAL_REPORTS_ENABLED !== 'true') {
    return json(res, 503, { error: 'kill switch' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(res, 503, { error: 'no key' });

  const ai = new GoogleGenAI({ apiKey });

  // 1. List available models — names only (no keys exposed)
  let modelNames: string[] = [];
  try {
    const iter = ai.models.list();
    for await (const m of iter) {
      if (m.name) modelNames.push(m.name);
    }
  } catch (listErr: any) {
    modelNames = ['list_error: ' + (listErr.message ?? String(listErr)).slice(0, 120)];
  }

  // 2. Test candidate Pro-tier model IDs with a trivial generation (no schema, no grounding)
  const candidates = [
    'gemini-2.5-pro-preview-06-05',
    'gemini-2.5-pro-latest',
    'gemini-2.5-pro',
  ];
  const testResults: Record<string, string> = {};

  for (const model of candidates) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents: 'Reply with the single word: ok',
        config: { maxOutputTokens: 8, temperature: 0 },
      });
      testResults[model] = 'success: ' + (r.text ?? '').trim().slice(0, 30);
    } catch (e: any) {
      testResults[model] = 'error: ' + (e.message ?? String(e)).slice(0, 150);
    }
  }

  return json(res, 200, {
    proModels: modelNames.filter(n => n.toLowerCase().includes('pro')),
    testResults,
  });
}
