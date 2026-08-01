/**
 * POST /api/chat — BizScope Assistant Chat Endpoint
 *
 * Security model:
 *  - Feature flag: BIZSCOPE_CHAT_ENABLED=true required
 *  - Gemini credentials never exposed to the client
 *  - User context (plan, role, userId) resolved server-side from Supabase JWT
 *  - Browser-supplied plan/role/userId values are never trusted
 *  - Per-minute burst limit (in-memory) + per-day limit (Supabase, persistent)
 *  - Global daily request and cost ceiling (kill switch)
 *  - Conversation length limit: 12 user messages
 *  - Intent classification: business-analysis requests redirected before Gemini
 *  - System prompt scope restrictions as a second line of defence
 *  - Token and cost logged to Supabase after successful responses
 *  - Stack traces and secrets never returned to the client
 *  - Chat does not consume the report quota
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';
import { validateChatRequest }                          from '../server/chat/validation.js';
import { buildSystemPrompt }                            from '../server/chat/systemPrompt.js';
import { buildAuthenticatedContext, ANON_CONTEXT }      from '../server/chat/context.js';
import { isAnonRateLimited, isAuthRateLimited }         from '../server/chat/rateLimit.js';
import { classifyIntent, isBlockedIntent,
         getRedirectMessage, getRedirectCta }           from '../server/chat/classify.js';
import { checkAndIncrementDaily, getGlobalDailyUsage,
         logChatCost, getDailyLimit }                   from '../server/chat/dailyLimit.js';
import { estimateCost, GEMINI_MODELS }                  from '../src/config/aiBudget.js';

export const maxDuration = 30;

// ── Constants (env var overrides for operational flexibility) ─────────────────

const CHAT_MODEL        = GEMINI_MODELS.standard; // gemini-2.5-flash
const MAX_OUTPUT_TOKENS = parseInt(process.env.CHAT_MAX_OUTPUT_TOKENS          ?? '700',  10);
const TIMEOUT_MS        = 25_000;
const MAX_CONV_MSGS     = parseInt(process.env.CHAT_MAX_MESSAGES_PER_CONVERSATION ?? '12', 10);
const GLOBAL_REQ_LIMIT  = parseInt(process.env.CHAT_GLOBAL_DAILY_REQUEST_LIMIT  ?? '2000', 10);
const GLOBAL_COST_LIMIT = parseFloat(process.env.CHAT_GLOBAL_DAILY_COST_LIMIT_USD ?? '10');

// ── Feature flag ──────────────────────────────────────────────────────────────

const CHAT_ENABLED = process.env.BIZSCOPE_CHAT_ENABLED === 'true';

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function getIp(req: IncomingMessage): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    (req as any).socket?.remoteAddress ||
    'unknown'
  );
}

// ── Gemini client (lazy singleton) ────────────────────────────────────────────

let _ai: InstanceType<typeof GoogleGenAI> | null = null;

function getAiClient(): InstanceType<typeof GoogleGenAI> | null {
  if (_ai) return _ai;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  _ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
  return _ai;
}

function toGeminiContents(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: string; parts: Array<{ text: string }> }> {
  return messages.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {

  // ── Feature flag ────────────────────────────────────────────────────────────
  if (!CHAT_ENABLED) {
    return json(res, 503, {
      error: 'BizScope Assistant is not available in this environment.',
      code:  'CHAT_DISABLED',
    });
  }

  // ── Method guard ────────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  // ── Gemini config check ─────────────────────────────────────────────────────
  const ai = getAiClient();
  if (!ai) {
    console.error('[chat] GEMINI_API_KEY is not configured');
    return json(res, 503, {
      error: 'Chat service is not configured. Please try again later.',
      code:  'CONFIG_ERROR',
    });
  }

  // ── IP extraction ───────────────────────────────────────────────────────────
  const ip = getIp(req);

  // ── Auth: verify JWT server-side, build safe context ────────────────────────
  const authHeader = req.headers['authorization'] as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  let userCtx = ANON_CONTEXT;
  if (token) {
    userCtx = await buildAuthenticatedContext(token);
  }

  // userId is now provided by buildAuthenticatedContext via SafeChatUserContext.userId
  const userId = userCtx.userId ?? null;

  // ── Per-minute rate limit (burst protection) ────────────────────────────────
  const rateLimited = userId ? isAuthRateLimited(userId) : isAnonRateLimited(ip);
  if (rateLimited) {
    return json(res, 429, {
      error: 'Too many requests. Please wait a moment before asking another question.',
      code:  'RATE_LIMITED',
    });
  }

  // ── Validate request body ───────────────────────────────────────────────────
  const body = req.body ?? {};
  const validation = validateChatRequest(body);
  if (validation.ok === false) {
    return json(res, 400, { error: validation.error, code: validation.code });
  }

  const { messages, pageContext } = validation.data;

  // ── Conversation length guard ───────────────────────────────────────────────
  // Count user-role messages in the submitted history.
  // Starting a new conversation does not reset the daily allowance.
  const userMsgCount = messages.filter(m => m.role === 'user').length;
  if (userMsgCount > MAX_CONV_MSGS) {
    return json(res, 429, {
      error: 'This conversation has reached the maximum length. Please start a new chat.',
      code:  'CONVERSATION_LIMIT_REACHED',
    });
  }

  // ── Global kill switch ──────────────────────────────────────────────────────
  const global = await getGlobalDailyUsage();
  if (global.totalMessages >= GLOBAL_REQ_LIMIT || global.totalCostUsd >= GLOBAL_COST_LIMIT) {
    console.warn(
      `[chat] global kill switch: msgs=${global.totalMessages} cost=${global.totalCostUsd.toFixed(4)}`,
    );
    return json(res, 503, {
      error:
        'The BizScope Assistant has reached its current usage limit. ' +
        'Please try again later. You can continue using the rest of BizScope normally.',
      code: 'GLOBAL_LIMIT_REACHED',
    });
  }

  // ── Intent classification (before Gemini, before daily limit increment) ─────
  const latestUserMessage = messages[messages.length - 1].content;
  const intent = classifyIntent(latestUserMessage);

  if (isBlockedIntent(intent)) {
    const cta = getRedirectCta(intent);
    console.log(
      `[chat] blocked intent=${intent} user=${userId ?? 'anon'} plan=${userCtx.plan ?? 'none'}`,
    );
    return json(res, 200, {
      reply:      getRedirectMessage(intent),
      redirected: true,
      ...(cta ? { cta } : {}),
    });
  }

  // ── Daily limit check + atomic increment ────────────────────────────────────
  const dailyResult = await checkAndIncrementDaily(userCtx, ip);
  if (!dailyResult.allowed) {
    const isAnon = !userCtx.isAuthenticated;
    return json(res, 429, {
      error: isAnon
        ? "You've reached today's BizScope Assistant limit. Sign in to continue using BizScope and access your account features."
        : 'You have reached your daily BizScope Assistant limit. Your allowance resets at midnight UTC.',
      code:            'DAILY_LIMIT_REACHED',
      remainingMessages: 0,
      dailyLimit:      dailyResult.limit,
    });
  }

  // ── Build system prompt ─────────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(userCtx, pageContext.route, pageContext.reportType);

  // ── Call Gemini ─────────────────────────────────────────────────────────────
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

    const text    = response.text ?? '';
    const usage   = (response as any).usageMetadata;
    const elapsedMs = Date.now() - startMs;

    const inputTokens  = usage?.promptTokenCount     ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;

    // Estimate cost using the shared aiBudget calculator
    const costResult = estimateCost(CHAT_MODEL, inputTokens, outputTokens, 0, 0);
    const costUsd    = costResult.estimatedCostUsd;

    console.log(
      `[chat] ok user=${userId ?? 'anon'} plan=${userCtx.plan ?? 'none'} ` +
      `intent=${intent} model=${CHAT_MODEL} ` +
      `in=${inputTokens} out=${outputTokens} cost=$${costUsd.toFixed(5)} ms=${elapsedMs}`,
    );

    if (!text) {
      return json(res, 502, {
        error: 'The assistant returned an empty response. Please try again.',
        code:  'EMPTY_RESPONSE',
      });
    }

    // Log cost after success (best-effort: errors are logged, not thrown)
    await logChatCost(userCtx, ip, inputTokens, outputTokens, costUsd).catch(err =>
      console.error('[chat] cost log error:', err?.message ?? err),
    );

    return json(res, 200, {
      reply:             text,
      remainingMessages: dailyResult.remaining,
      dailyLimit:        dailyResult.limit,
    });

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
