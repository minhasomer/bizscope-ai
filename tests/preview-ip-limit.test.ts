/**
 * Preview per-IP limit tests — server/previewIpLimit.ts + api/preview.ts
 *
 * Covers:
 *  1. Client IP extraction from Vercel headers
 *  2. IP hashing (deterministic, keyed, raw IP not recoverable from output)
 *  3. Limit check against usage_logs (mock Supabase query builder)
 *  4. api/preview.ts wiring: guard runs before Gemini, fails open, hash is logged,
 *     global cap uses the real usage_logs timestamp column (generated_at)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage } from 'http';
import { clientIp, hashIp, previewIpLimitReached, PREVIEW_IP_DAILY_LIMIT } from '../server/previewIpLimit.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok   ${name}`);
}

const asyncTests: Array<{ name: string; fn: () => Promise<void> }> = [];
function checkAsync(name: string, fn: () => Promise<void>) {
  asyncTests.push({ name, fn });
}

const req = (headers: Record<string, string | string[]>) => ({ headers } as unknown as IncomingMessage);

/** Records filters and resolves like supabase-js: { count, error }. */
function mockSupabase(result: { count: number | null; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: any = {
    from: (t: string) => { calls.push(['from', t]); return builder; },
    select: (...a: unknown[]) => { calls.push(['select', ...a]); return builder; },
    eq: (...a: unknown[]) => { calls.push(['eq', ...a]); return builder; },
    gte: (...a: unknown[]) => { calls.push(['gte', ...a]); return Promise.resolve(result); },
  };
  return { client: builder, calls };
}

// ── 1. Client IP ──────────────────────────────────────────────────────────────

check('clientIp prefers x-real-ip', () => {
  assert.equal(clientIp(req({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' })), '203.0.113.7');
});

check('clientIp falls back to the first x-forwarded-for hop', () => {
  assert.equal(clientIp(req({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' })), '198.51.100.1');
});

check('clientIp returns null without headers', () => {
  assert.equal(clientIp(req({})), null);
});

// ── 2. Hashing ────────────────────────────────────────────────────────────────

check('hashIp is deterministic and keyed', () => {
  assert.equal(hashIp('203.0.113.7', 'k1'), hashIp('203.0.113.7', 'k1'));
  assert.notEqual(hashIp('203.0.113.7', 'k1'), hashIp('203.0.113.7', 'k2'));
  assert.notEqual(hashIp('203.0.113.7', 'k1'), hashIp('203.0.113.8', 'k1'));
});

check('hashIp output does not contain the raw IP', () => {
  const h = hashIp('203.0.113.7', 'k1');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.ok(!h.includes('203.0.113.7'));
});

// ── 3. Limit check ────────────────────────────────────────────────────────────

check('daily limit is 3', () => {
  assert.equal(PREVIEW_IP_DAILY_LIMIT, 3);
});

checkAsync('under the limit → not reached', async () => {
  const { client } = mockSupabase({ count: PREVIEW_IP_DAILY_LIMIT - 1, error: null });
  assert.equal(await previewIpLimitReached(client, 'h'), false);
});

checkAsync('at the limit → reached', async () => {
  const { client } = mockSupabase({ count: PREVIEW_IP_DAILY_LIMIT, error: null });
  assert.equal(await previewIpLimitReached(client, 'h'), true);
});

checkAsync('query filters previews for this hash in the last 24 hours on generated_at', async () => {
  const { client, calls } = mockSupabase({ count: 0, error: null });
  const before = Date.now();
  await previewIpLimitReached(client, 'abc');
  assert.deepEqual(calls[0], ['from', 'usage_logs']);
  assert.ok(calls.some((c) => c[0] === 'eq' && c[1] === 'report_type' && c[2] === 'preview'));
  assert.ok(calls.some((c) => c[0] === 'eq' && c[1] === 'ip_hash' && c[2] === 'abc'));
  const gte = calls.find((c) => c[0] === 'gte')!;
  assert.equal(gte[1], 'generated_at');
  const ageMs = before - Date.parse(gte[2] as string);
  assert.ok(Math.abs(ageMs - 24 * 60 * 60 * 1000) < 5000, '24-hour window');
});

checkAsync('query error is thrown (caller fails open)', async () => {
  const { client } = mockSupabase({ count: null, error: new Error('column missing') });
  await assert.rejects(() => previewIpLimitReached(client, 'h'), /column missing/);
});

// ── 4. api/preview.ts wiring ──────────────────────────────────────────────────

const src = fs.readFileSync(path.join(root, 'api', 'preview.ts'), 'utf8');

check('per-IP guard returns 429 PREVIEW_IP_LIMIT', () => {
  assert.ok(src.includes('previewIpLimitReached(supabaseAdmin, ipHash)'));
  assert.ok(src.includes("code: 'PREVIEW_IP_LIMIT'"));
});

check('per-IP guard runs before any Gemini call', () => {
  const guard = src.indexOf('previewIpLimitReached(supabaseAdmin, ipHash)');
  const gemini = src.indexOf('ai.models.generateContent');
  assert.ok(guard > 0 && gemini > 0 && guard < gemini);
});

check('per-IP guard fails open and skips simulations', () => {
  assert.ok(src.includes("if (!_simCtx && supabaseAdmin && ipHash)"));
  assert.ok(src.includes('per-IP limit check failed (non-fatal)'));
});

check('successful previews log the IP hash, never the raw IP', () => {
  assert.ok(src.includes('ip_hash: ipHash,'));
  assert.ok(!/ip:\s*ip\b/.test(src), 'raw IP not inserted');
});

check('global cap uses generated_at (usage_logs has no created_at)', () => {
  assert.ok(src.includes(".gte('generated_at', oneHourAgo)"));
  assert.ok(!src.includes(".gte('created_at'"));
});

check('migration adds ip_hash column', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261021000000_usage_logs_ip_hash.sql'), 'utf8');
  assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS ip_hash TEXT'));
});

// ── Run async tests ───────────────────────────────────────────────────────────

for (const { name, fn } of asyncTests) {
  await fn();
  passed++;
  console.log(`ok   ${name}`);
}

console.log(`\n${passed} tests passed\n`);
