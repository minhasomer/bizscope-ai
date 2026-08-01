/**
 * POST /api/chat — BizScope Assistant Chat Endpoint
 *
 * Secure server-side Gemini integration for the BizScope chatbot.
 * Gemini credentials are never exposed to the client.
 *
 * Security model:
 *  - Rate limited per IP (anonymous) and per user-ID (authenticated)
 *  - Request body validated and sanitized
 *  - User context resolved server-side from Supabase JWT
 *  - Browser-supplied role/plan/usage values are never trusted
 *  - System prompt instructs Gemini to refuse injection attempts
 *  - Stack traces and secrets never returned to the client
 *  - Chat does not consume the report quota
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';
import { validateChatRequest } from '../server/chat/validation.js';
import { buildSystemPrompt }   from '../server/chat/systemPrompt.js';
import { buildAuthenticatedContext, ANON_CONTEXT } from '../server/chat/context.js';
import { isAnonRateLimited, isAuthRateLimited }    from '../server/chat/rateLimit.js';

// Vercel function timeout — shorter than analyze.ts (90s) since chat needs
// no grounding tools or structured JSON schema.
export const maxDuration = 30;

const CHAT_MODEL       = 'gemini-2.5-flash';
const MAX_OUTPUT_TOKENS = 1024;
const TIMEOUT_MS        = 25_000;

// ─── Feature flag ─────────────────────────────────────────────────────────────
// Set BIZSCOPE_CHAT_ENABLED=true in Vercel environment variables to enable.
// Defaults to disabled so the flag must be explicitly set on staging.
const CHAT_ENABLED = process.env.BIZSCOPE_CHAT_ENABLED === 'true';

// ─── Response helper ──────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// ─── Timeout helper ───────────────────────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// ─── IP extraction ────────────────────────────────────────────────────────────

function getIp(req: IncomingMessage): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    (req as any).socket?.remoteAddress ||
    'unknown'
  );
}

// ─── Gemini client (lazy singleton) ──────────────────────────────────────────

let _ai: InstanceType<typeof GoogleGenAI> | null = null;

function getAiClient(): InstanceType<typeof GoogleGenAI> | null {
  if (_ai) return _ai;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  _ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
  return _ai;
}

// ─── Map chat history to Gemini contents format ───────────────────────────────

function toGeminiContents(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: string; parts: Array<{ text: string }> }> {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {

  // ── Feature flag ──────────────────────────────────────────────────────────
  if (!CHAT_ENABLED) {
    return json(res, 503, {
      error: 'BizScope Assistant is not available in this environment.',
      code:  'CHAT_DISABLED',
    });
  }

  // ── Method guard ──────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  // ── Gemini config check ───────────────────────────────────────────────────
  const ai = getAiClient();
  if (!ai) {
    console.error('[chat] GEMINI_API_KEY is not configured');
    return json(res, 503, {
      error: 'Chat service is not configured. Please try again later.',
      code:  'CONFIG_ERROR',
    });
  }

  // ── IP extraction ─────────────────────────────────────────────────────────
  const ip = getIp(req);

  // ── Auth (optional) — verify JWT server-side ──────────────────────────────
  const authHeader = req.headers['authorization'] as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  let userCtx = ANON_CONTEXT;
  let userId: string | null = null;

  if (token) {
    userCtx = await buildAuthenticatedContext(token);
    if (userCtx.isAuthenticated) {
      // Extract userId from token for rate-limit keying (not used for trust)
      try {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
        ) as Record<string, unknown>;
        userId = typeof payload.sub === 'string' ? payload.sub : null;
      } catch {
        // Fail safe — treat as anonymous
      }
    }
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  if (userId) {
    if (isAuthRateLimited(userId)) {
      return json(res, 429, {
        error: 'Too many requests. Please wait a moment before asking another question.',
        code:  'RATE_LIMITED',
      });
    }
  } else {
    if (isAnonRateLimited(ip)) {
      return json(res, 429, {
        error: 'Too many requests from this address. Please sign in or try again later.',
        code:  'RATE_LIMITED',
      });
    }
  }

  // ── Validate request body ─────────────────────────────────────────────────
  const body = req.body ?? {};
  const validation = validateChatRequest(body);
  if (!validation.ok) {
    return json(res, 400, { error: validation.error, code: validation.code });
  }

  const { messages, pageContext } = validation.data;

  // ── Build system prompt ───────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(userCtx, pageContext.route, pageContext.reportType);

  // ── Call Gemini ───────────────────────────────────────────────────────────
  const startMs = Date.now();
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model:    CHAT_MODEL,
        contents: toGeminiContents(messages),
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens:   MAX_OUTPUT_TOKENS,
          temperature:       0.5,
          thinkingConfig:    { thinkingBudget: 0 },
        },
      }),
      TIMEOUT_MS,
      'chat',
    );

    const text = response.text ?? '';
    const usage = (response as any).usageMetadata;
    const elapsedMs = Date.now() - startMs;

    // Log metadata only — never log message content
    console.log(
      `[chat] ok user=${userId ?? 'anon'} plan=${userCtx.plan ?? 'none'} ` +
      `model=${CHAT_MODEL} in=${usage?.promptTokenCount ?? '?'} ` +
      `out=${usage?.candidatesTokenCount ?? '?'} ms=${elapsedMs}`,
    );

    if (!text) {
      return json(res, 502, {
        error: 'The assistant returned an empty response. Please try again.',
        code:  'EMPTY_RESPONSE',
      });
    }

    return json(res, 200, { reply: text });

  } catch (err: unknown) {
    const elapsedMs = Date.now() - startMs;
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('timed out')) {
      console.warn(`[chat] timeout user=${userId ?? 'anon'} ms=${elapsedMs}`);
      return json(res, 504, {
        error: 'The assistant took too long to respond. Please try again.',
        code:  'TIMEOUT',
      });
    }

    console.error(`[chat] error user=${userId ?? 'anon'} ms=${elapsedMs}:`, msg);
    return json(res, 500, {
      error: 'An unexpected error occurred. Please try again.',
      code:  'INTERNAL_ERROR',
    });
  }
}
