/**
 * Handler-level tests for api/opportunity-dossier.ts
 *
 * Uses a lightweight fake Supabase HTTP server so the real handler is invoked
 * end-to-end without live credentials or module-level mocking.
 *
 * Run standalone:
 *   npx tsx tests/opportunity-dossier-handler.test.ts
 * Exits non-zero on the first failed assertion.
 *
 * Coverage (12 scenarios — matches Step 3 of the fix-verification task):
 *   H1.  Kill switch (REAL_REPORTS_ENABLED not set) → 503 NOT_AVAILABLE
 *   H2.  Non-POST method → 405 METHOD_NOT_ALLOWED
 *   H3.  No Authorization header → 401 UNAUTHENTICATED
 *   H4.  Invalid token (Supabase rejects) → 401 UNAUTHENTICATED
 *   H5.  Explorer plan → 403 INSUFFICIENT_PLAN
 *   H6.  Pro plan → 403 INSUFFICIENT_PLAN
 *   H7.  Pro+ valid auth, missing body → 400 INVALID_INPUT
 *   H8.  Pro+ valid auth, blocked category → 422 BLOCKED_CATEGORY
 *   H9.  Pro+ valid auth, quota exhausted → 429 QUOTA_EXCEEDED
 *   H10. Pro+ valid auth, quota OK, no GEMINI_API_KEY → 401 MISSING_API_KEY
 *   H11. Enterprise valid auth, unlimited quota, no GEMINI_API_KEY → 401 MISSING_API_KEY
 *   S12. Structural: BETA_FULL_ACCESS code path promotes authenticated users to Pro+
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ─── Fake Supabase HTTP server ────────────────────────────────────────────────
//
// Serves only the paths the dossier handler actually calls:
//   GET  /auth/v1/user           ← auth.getUser(token)
//   GET  /rest/v1/profiles       ← profiles.select().eq().single()
//   GET  /rest/v1/usage_tracking ← usage_tracking.select().eq().maybeSingle()
//   POST /rest/v1/rpc/*          ← rpc('increment_usage_tracking', …)
//   POST /rest/v1/usage_logs     ← usage_logs.insert(…)
//   POST /rest/v1/report_activity_log ← report_activity_log.insert(…)

interface FakeState {
  /** null = auth.getUser returns 401 */
  authUser: { id: string; email: string } | null;
  profileRole: string;
  profileTier: string;
  /** Monthly usage count returned by the usage_tracking query */
  usageCount: number;
  /** Total RPC calls received (increment_usage_tracking) */
  rpcCallCount: number;
}

const fakeState: FakeState = {
  authUser: null,
  profileRole: 'Explorer',
  profileTier: 'Explorer',
  usageCount: 0,
  rpcCallCount: 0,
};

function resetFake(overrides: Partial<FakeState> = {}): void {
  fakeState.authUser = null;
  fakeState.profileRole = 'Explorer';
  fakeState.profileTier = 'Explorer';
  fakeState.usageCount = 0;
  fakeState.rpcCallCount = 0;
  Object.assign(fakeState, overrides);
}

async function consumeBody(req: IncomingMessage): Promise<void> {
  await new Promise<void>((resolve) => {
    req.on('data', () => {});
    req.on('end', resolve);
  });
}

const fakeSupabase = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const { pathname } = url;
  await consumeBody(req);

  // ── Auth: GET /auth/v1/user ───────────────────────────────────────────────
  if (pathname === '/auth/v1/user') {
    if (fakeState.authUser) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: fakeState.authUser.id,
        email: fakeState.authUser.email,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {},
      }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 401, msg: 'Invalid JWT' }));
    }
    return;
  }

  // ── Profiles: GET /rest/v1/profiles ──────────────────────────────────────
  // .single() uses Accept: application/vnd.pgrst.object+json → single object.
  if (pathname === '/rest/v1/profiles') {
    const accept = (req.headers['accept'] as string) ?? '';
    const row = { role: fakeState.profileRole, subscription_tier: fakeState.profileTier };
    if (accept.includes('pgrst.object')) {
      res.writeHead(200, { 'Content-Type': 'application/vnd.pgrst.object+json' });
      res.end(JSON.stringify(row));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([row]));
    }
    return;
  }

  // ── Usage tracking: GET /rest/v1/usage_tracking ──────────────────────────
  // .maybeSingle() → array response, client takes [0] ?? null.
  if (pathname === '/rest/v1/usage_tracking') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' });
    res.end(JSON.stringify([{ count: fakeState.usageCount }]));
    return;
  }

  // ── RPC calls (increment_usage_tracking): POST /rest/v1/rpc/* ────────────
  if (pathname.startsWith('/rest/v1/rpc/')) {
    fakeState.rpcCallCount++;
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Insert endpoints (usage_logs, report_activity_log) ───────────────────
  if (pathname.startsWith('/rest/v1/')) {
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end('[]');
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// ─── Start fake Supabase server ───────────────────────────────────────────────

const fakeSupabasePort = await new Promise<number>((resolve) => {
  fakeSupabase.listen(0, '127.0.0.1', () => {
    resolve((fakeSupabase.address() as AddressInfo).port);
  });
});

// A minimal fake JWT whose payload decodes to { "role": "service_role" }.
// The handler logs a warning when the role claim is not "service_role", so
// providing a well-formed fake suppresses that noise in test output.
const FAKE_SR_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoidGVzdCIsImlhdCI6MTAwMDAwMH0' +
  '.fakesig';

// Set env vars BEFORE importing the handler so the module-level supabaseAdmin
// IIFE picks them up and creates a real (but locally redirected) client.
process.env.SUPABASE_URL = `http://127.0.0.1:${fakeSupabasePort}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_SR_JWT;
process.env.REAL_REPORTS_ENABLED = 'true';
delete process.env.GEMINI_API_KEY;     // must be absent for MISSING_API_KEY tests
delete process.env.BETA_FULL_ACCESS;   // keep betaFullAccess=false for determinism

const { default: handler } = await import('../api/opportunity-dossier.ts');

// ─── Test helpers ─────────────────────────────────────────────────────────────

interface MockResponse {
  status: number;
  body: any;
}

async function callHandler(opts: {
  method?: string;
  authHeader?: string | null;
  body?: any;
}): Promise<MockResponse> {
  return new Promise<MockResponse>((resolve) => {
    const captured: MockResponse = { status: 200, body: null };

    const req: any = {
      method: opts.method ?? 'POST',
      headers: opts.authHeader ? { authorization: opts.authHeader } : {},
      body: opts.body ?? undefined,
      url: '/api/opportunity-dossier',
    };

    const res: any = {
      statusCode: 200,
      setHeader() {},
      end(data?: string) {
        captured.status = this.statusCode;
        if (data) {
          try { captured.body = JSON.parse(data); } catch { captured.body = data; }
        }
        resolve(captured);
      },
    };

    handler(req, res).catch((err: Error) => {
      captured.status = 500;
      captured.body = { error: err.message };
      resolve(captured);
    });
  });
}

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;

function check(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`ok   ${name}`);
}

const asyncTests: Array<{ name: string; fn: () => Promise<void> }> = [];
function checkAsync(name: string, fn: () => Promise<void>): void {
  asyncTests.push({ name, fn });
}

// ─── H1. Kill switch (REAL_REPORTS_ENABLED not set) → 503 NOT_AVAILABLE ──────

checkAsync('H1. kill switch: REAL_REPORTS_ENABLED absent → 503 NOT_AVAILABLE', async () => {
  delete process.env.REAL_REPORTS_ENABLED;
  resetFake();
  const r = await callHandler({ body: {} });
  process.env.REAL_REPORTS_ENABLED = 'true'; // restore for remaining tests
  assert.equal(r.status, 503, 'must return 503 when REAL_REPORTS_ENABLED is unset');
  assert.equal(r.body?.code, 'NOT_AVAILABLE');
});

// ─── H2. Non-POST method → 405 METHOD_NOT_ALLOWED ────────────────────────────

checkAsync('H2. method guard: GET → 405 METHOD_NOT_ALLOWED', async () => {
  resetFake();
  const r = await callHandler({ method: 'GET' });
  assert.equal(r.status, 405);
  assert.equal(r.body?.code, 'METHOD_NOT_ALLOWED');
});

// ─── H3. No Authorization header → 401 UNAUTHENTICATED ───────────────────────

checkAsync('H3. no auth header → 401 UNAUTHENTICATED, rpcCallCount stays 0', async () => {
  resetFake();
  const r = await callHandler({ authHeader: null });
  assert.equal(r.status, 401);
  assert.equal(r.body?.code, 'UNAUTHENTICATED');
  assert.equal(fakeState.rpcCallCount, 0, 'quota must not increment on auth rejection');
});

// ─── H4. Invalid token → 401 UNAUTHENTICATED ─────────────────────────────────
// fakeState.authUser=null makes the fake server return 401 for auth.getUser().

checkAsync('H4. invalid token (Supabase rejects) → 401 UNAUTHENTICATED', async () => {
  resetFake({ authUser: null });
  const r = await callHandler({ authHeader: 'Bearer totally-invalid-token' });
  assert.equal(r.status, 401);
  assert.equal(r.body?.code, 'UNAUTHENTICATED');
  assert.equal(fakeState.rpcCallCount, 0, 'quota must not increment on auth rejection');
});

// ─── H5. Explorer plan → 403 INSUFFICIENT_PLAN ───────────────────────────────
// Explorer has subscription_tier='Explorer' → normalizeTierToBudgetPlan → 'Explorer' → blocked.

checkAsync('H5. Explorer user → 403 INSUFFICIENT_PLAN, rpcCallCount stays 0', async () => {
  resetFake({
    authUser: { id: 'uid-explorer', email: 'explorer@example.com' },
    profileRole: 'Explorer',
    profileTier: 'Explorer',
  });
  const r = await callHandler({ authHeader: 'Bearer valid-token' });
  assert.equal(r.status, 403);
  assert.equal(r.body?.code, 'INSUFFICIENT_PLAN');
  assert.equal(fakeState.rpcCallCount, 0, 'quota must not increment on plan rejection');
});

// ─── H6. Pro plan → 403 INSUFFICIENT_PLAN ────────────────────────────────────
// Pro has subscription_tier='Pro' → plan='Pro' → blocked (regional is Pro+ only).

checkAsync('H6. Pro user → 403 INSUFFICIENT_PLAN, rpcCallCount stays 0', async () => {
  resetFake({
    authUser: { id: 'uid-pro', email: 'pro@example.com' },
    profileRole: 'Explorer',    // regular role
    profileTier: 'Pro',         // subscription tier = Pro → plan = 'Pro'
  });
  const r = await callHandler({ authHeader: 'Bearer valid-token' });
  assert.equal(r.status, 403);
  assert.equal(r.body?.code, 'INSUFFICIENT_PLAN');
  assert.equal(fakeState.rpcCallCount, 0, 'quota must not increment on plan rejection');
});

// ─── H7. Pro+ valid auth, missing body → 400 INVALID_INPUT ───────────────────

checkAsync('H7. Pro+ user, missing body → 400 INVALID_INPUT', async () => {
  resetFake({
    authUser: { id: 'uid-proplus', email: 'proplus@example.com' },
    profileRole: 'Explorer',
    profileTier: 'ProPlus',   // ProPlus → 'Pro+' → passes plan gate
    usageCount: 0,
  });
  // body is a plain empty object — no `opportunity` or `location` field
  const r = await callHandler({ authHeader: 'Bearer valid-token', body: {} });
  assert.equal(r.status, 400);
  assert.equal(r.body?.code, 'INVALID_INPUT');
  assert.equal(fakeState.rpcCallCount, 0, 'quota must not increment on validation rejection');
});

// ─── H8. Pro+ valid auth, blocked category → 422 BLOCKED_CATEGORY ─────────────

checkAsync('H8. Pro+ user, blocked category (firearms) → 422 BLOCKED_CATEGORY', async () => {
  resetFake({
    authUser: { id: 'uid-proplus', email: 'proplus@example.com' },
    profileRole: 'Explorer',
    profileTier: 'ProPlus',
    usageCount: 0,
  });
  const r = await callHandler({
    authHeader: 'Bearer valid-token',
    body: { opportunity: { businessType: 'gun shop' }, location: 'Austin, TX' },
  });
  assert.equal(r.status, 422);
  assert.equal(r.body?.code, 'BLOCKED_CATEGORY');
  assert.equal(fakeState.rpcCallCount, 0, 'quota must not increment on blocked category');
});

// ─── H9. Pro+ valid auth, quota exhausted → 429 QUOTA_EXCEEDED ───────────────
// Pro+ regional limit is 10/mo. usageCount=10 means at limit → blocked.

checkAsync('H9. Pro+ user, quota exhausted (used=10) → 429 QUOTA_EXCEEDED', async () => {
  resetFake({
    authUser: { id: 'uid-proplus', email: 'proplus@example.com' },
    profileRole: 'Explorer',
    profileTier: 'ProPlus',
    usageCount: 10,  // at the Pro+ regional limit of 10
  });
  const r = await callHandler({
    authHeader: 'Bearer valid-token',
    body: { opportunity: { businessType: 'Coffee Shop' }, location: 'Austin, TX' },
  });
  assert.equal(r.status, 429);
  assert.equal(r.body?.code, 'QUOTA_EXCEEDED');
  assert.equal(fakeState.rpcCallCount, 0, 'regional must not increment when quota is exceeded');
});

// ─── H10. Pro+ valid auth, quota OK, no GEMINI_API_KEY → 401 MISSING_API_KEY ─

checkAsync('H10. Pro+ user, quota OK, GEMINI_API_KEY absent → 401 MISSING_API_KEY', async () => {
  delete process.env.GEMINI_API_KEY;
  resetFake({
    authUser: { id: 'uid-proplus', email: 'proplus@example.com' },
    profileRole: 'Explorer',
    profileTier: 'ProPlus',
    usageCount: 0,
  });
  const r = await callHandler({
    authHeader: 'Bearer valid-token',
    body: { opportunity: { businessType: 'Coffee Shop' }, location: 'Austin, TX' },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body?.code, 'MISSING_API_KEY', 'must gate on missing Gemini key before any generation');
  assert.equal(fakeState.rpcCallCount, 0, 'regional must not increment when Gemini key is absent');
});

// ─── H11. Enterprise, unlimited quota, no GEMINI_API_KEY → 401 MISSING_API_KEY ─
// Enterprise users are Admin role → plan='Enterprise' → unlimited quota (no 429).
// Proves the quota gate is skipped entirely for Enterprise.

checkAsync('H11. Enterprise user (Admin role) passes quota gate → 401 MISSING_API_KEY', async () => {
  delete process.env.GEMINI_API_KEY;
  resetFake({
    authUser: { id: 'uid-admin', email: 'admin@example.com' },
    profileRole: 'Admin',      // Admin → getServerSidePlan → 'Enterprise'
    profileTier: 'Enterprise',
    usageCount: 9999,          // even a huge count must not block Enterprise
  });
  const r = await callHandler({
    authHeader: 'Bearer valid-token',
    body: { opportunity: { businessType: 'Coffee Shop' }, location: 'Austin, TX' },
  });
  // Must reach the Gemini key check (401 MISSING_API_KEY), not the quota gate (429)
  assert.equal(r.status, 401);
  assert.equal(r.body?.code, 'MISSING_API_KEY', 'Enterprise must never be stopped by quota gate');
  assert.equal(fakeState.rpcCallCount, 0);
});

// ─── S12. Structural: BETA_FULL_ACCESS promotes authenticated users to Pro+ ───
// _serverBetaFullAccess is a load-time constant, so we verify the code path
// rather than toggling the env var mid-run.

check('S12. structural: BETA_FULL_ACCESS=true promotes all authenticated users to Pro+', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'opportunity-dossier.ts'), 'utf8');
  assert.ok(
    src.includes('_serverBetaFullAccess'),
    '_serverBetaFullAccess variable must exist in opportunity-dossier.ts',
  );
  assert.ok(
    src.includes("process.env.BETA_FULL_ACCESS === 'true'"),
    'betaFullAccess must be sourced from BETA_FULL_ACCESS env var',
  );
  assert.ok(
    src.includes('if (_serverBetaFullAccess) return'),
    'betaFullAccess must short-circuit getServerSidePlan to return Pro+',
  );
});

// ─── Run async tests, then report ─────────────────────────────────────────────

for (const { name, fn } of asyncTests) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL ${name}: ${msg}`);
    fakeSupabase.close();
    process.exit(1);
  }
}

fakeSupabase.close();
console.log(`\n${passed} test(s) passed.`);
