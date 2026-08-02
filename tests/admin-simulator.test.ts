/**
 * Behavioral tests for the Admin "Test as User" simulation system.
 *
 * Run standalone:
 *   npx tsx tests/admin-simulator.test.ts
 * Exits non-zero on the first failed assertion.
 *
 * Coverage (20 scenarios):
 *
 * Token utility (pure functions — no HTTP):
 *   U1.  sign + verify round-trip succeeds
 *   U2.  tampered payload → verifySimulationToken returns null
 *   U3.  tampered signature → verifySimulationToken returns null
 *   U4.  expired token → verifySimulationToken returns null
 *   U5.  personaToPlan: ProPlus + canceled → Explorer
 *   U6.  personaToPlan: BetaTester → Pro+
 *   U7.  personaToPlan: betaFullAccess + Anonymous → Explorer (not elevated)
 *   U8.  personaToPlan: betaFullAccess + Explorer → Pro+
 *
 * Handler behavioral (opportunity-dossier — no real auth header, sim token only):
 *   H9.  ProPlus sim, 0/10 regional used → reaches Gemini gate → 401 MISSING_API_KEY
 *   H10. ProPlus sim, 10/10 regional used (quota exhausted) → 429 QUOTA_EXCEEDED
 *   H11. Enterprise sim → unlimited quota → 401 MISSING_API_KEY
 *   H12. Explorer sim → 403 INSUFFICIENT_PLAN
 *   H13. Pro sim → 403 INSUFFICIENT_PLAN
 *   H14. BetaTester sim → effective Pro+ → 401 MISSING_API_KEY
 *   H15. ProPlus sim + betaFullAccess=true → unlimited → 401 MISSING_API_KEY
 *   H16. ProPlus sim + subscriptionState=canceled → effective Explorer → 403 INSUFFICIENT_PLAN
 *   H17. ProPlus sim, quota OK → rpcCallCount stays 0 (no DB mutation)
 *   H18. Expired sim token → no sim context → falls through to real auth → 401 UNAUTHENTICATED
 *   H19. Tampered sim token → no sim context → falls through to real auth → 401 UNAUTHENTICATED
 *
 * Production-guard unit test:
 *   P20. ADMIN_SIMULATION_ENABLED absent → getSimulationContext returns null (token ignored)
 */

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// ─── Token utility imports ─────────────────────────────────────────────────────
import {
  signSimulationToken,
  verifySimulationToken,
  resolveSimulationContext,
  getSimulationContext,
} from '../src/utils/simulationToken.js';
import type { SimPersona, SubState } from '../src/utils/simulationToken.js';

// ─── Test secret + fake admin identity ────────────────────────────────────────

const TEST_SECRET         = 'test-sim-secret-for-unit-tests-only';
const FAKE_ADMIN_JWT      = 'test-admin-user-jwt-for-handler-tests';
const FAKE_ADMIN_USER_ID  = 'fake-admin-00000000-0000-0000-0000-0000000000aa';

// ─── Helpers: build signed tokens ─────────────────────────────────────────────

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeToken(
  persona: SimPersona,
  opts: {
    regionalUsed?: number;
    standardUsed?: number;
    subscriptionState?: SubState;
    betaFullAccess?: boolean;
    anonPreviewConsumed?: boolean;
  } = {},
): string {
  const {
    regionalUsed = 0, standardUsed = 0, subscriptionState = 'active',
    betaFullAccess = false, anonPreviewConsumed = false,
  } = opts;
  return signSimulationToken(
    { persona, regionalUsed, standardUsed, subscriptionState, betaFullAccess, anonPreviewConsumed },
    TEST_SECRET,
  );
}

/** Builds a valid but already-expired simulation token (exp set in the past). */
function makeExpiredToken(persona: SimPersona): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    persona, regionalUsed: 0, standardUsed: 0, subscriptionState: 'active' as SubState,
    betaFullAccess: false, anonPreviewConsumed: false,
    iat: now - 7201,
    exp: now - 1,  // 1 second in the past
  };
  const encoded = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = b64url(createHmac('sha256', TEST_SECRET).update(encoded).digest());
  return `${encoded}.${sig}`;
}

// ─── Fake Supabase HTTP server ─────────────────────────────────────────────────
// The handler always tries to call Supabase even when a sim token is present
// (verifyAndGetPlan runs first). We serve a no-auth-user response so the
// handler falls through to the sim context override for all sim-token tests.

interface FakeState {
  rpcCallCount: number;
}
const fakeState: FakeState = { rpcCallCount: 0 };
function resetFake() { fakeState.rpcCallCount = 0; }

async function consumeBody(req: IncomingMessage): Promise<void> {
  await new Promise<void>(resolve => { req.on('data', () => {}); req.on('end', resolve); });
}

const fakeSupabase = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  await consumeBody(req);

  // Auth: admin JWT → admin user; anything else → 401.
  if (url.pathname === '/auth/v1/user') {
    if (req.headers['authorization'] === `Bearer ${FAKE_ADMIN_JWT}`) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: FAKE_ADMIN_USER_ID, email: 'admin@test.com', role: 'authenticated' }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 401, msg: 'Invalid JWT' }));
    }
    return;
  }
  // Profiles: .single() uses Accept: application/vnd.pgrst.object+json → single object.
  if (url.pathname === '/rest/v1/profiles') {
    const accept = (req.headers['accept'] as string) ?? '';
    const isAdmin = (req.url ?? '').includes(FAKE_ADMIN_USER_ID);
    const row = isAdmin
      ? { role: 'admin', subscription_tier: 'Enterprise' }
      : { role: 'Explorer', subscription_tier: 'Explorer' };
    if (accept.includes('pgrst.object')) {
      res.writeHead(200, { 'Content-Type': 'application/vnd.pgrst.object+json' });
      res.end(JSON.stringify(row));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([row]));
    }
    return;
  }
  // RPC increment calls should never fire during simulation.
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    fakeState.rpcCallCount++;
    res.writeHead(204);
    res.end();
    return;
  }
  // Insert endpoints — should not be reached during simulation for quota increments.
  if (url.pathname.startsWith('/rest/v1/')) {
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end('[]');
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});

const fakeSupabasePort = await new Promise<number>(resolve => {
  fakeSupabase.listen(0, '127.0.0.1', () => {
    resolve((fakeSupabase.address() as AddressInfo).port);
  });
});

const FAKE_SR_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoidGVzdCIsImlhdCI6MTAwMDAwMH0' +
  '.fakesig';

// Set env vars BEFORE importing the handler.
process.env.SUPABASE_URL                = `http://127.0.0.1:${fakeSupabasePort}`;
process.env.SUPABASE_SERVICE_ROLE_KEY   = FAKE_SR_JWT;
process.env.REAL_REPORTS_ENABLED        = 'true';
process.env.ADMIN_SIMULATION_ENABLED    = 'true';
process.env.ADMIN_SIM_SECRET            = TEST_SECRET;
delete process.env.GEMINI_API_KEY;
delete process.env.BETA_FULL_ACCESS;

const { default: handler } = await import('../api/opportunity-dossier.ts');

// ─── Test helpers ──────────────────────────────────────────────────────────────

interface MockResponse { status: number; body: any; }

async function callHandler(opts: {
  method?: string;
  authHeader?: string | null;
  adminAuth?: boolean;
  simToken?: string;
  body?: any;
}): Promise<MockResponse> {
  return new Promise<MockResponse>(resolve => {
    const captured: MockResponse = { status: 200, body: null };
    const headers: Record<string, string> = {};
    if (opts.adminAuth) {
      headers['authorization'] = `Bearer ${FAKE_ADMIN_JWT}`;
    } else if (opts.authHeader) {
      headers['authorization'] = opts.authHeader;
    }
    if (opts.simToken) headers['x-sim-token'] = opts.simToken;

    const req: any = {
      method: opts.method ?? 'POST',
      headers,
      body: opts.body ?? undefined,
      url: '/api/opportunity-dossier',
    };
    const res: any = {
      statusCode: 200,
      setHeader() {},
      end(data?: string) {
        captured.status = this.statusCode;
        if (data) { try { captured.body = JSON.parse(data); } catch { captured.body = data; } }
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

// ─── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
const asyncTests: Array<{ name: string; fn: () => Promise<void> }> = [];

function checkAsync(name: string, fn: () => Promise<void>): void {
  asyncTests.push({ name, fn });
}

// ─── U1. Sign + verify round-trip succeeds ─────────────────────────────────────

checkAsync('U1. sign+verify round-trip: valid payload → non-null result', async () => {
  const token = makeToken('ProPlus', { regionalUsed: 3, subscriptionState: 'active' });
  const result = verifySimulationToken(token, TEST_SECRET);
  assert.ok(result !== null, 'verifySimulationToken should return payload for a valid token');
  assert.equal(result!.persona, 'ProPlus');
  assert.equal(result!.regionalUsed, 3);
});

// ─── U2. Tampered payload → null ───────────────────────────────────────────────

checkAsync('U2. tampered payload → verifySimulationToken returns null', async () => {
  const token = makeToken('ProPlus');
  const [encoded, sig] = [token.slice(0, token.lastIndexOf('.')), token.slice(token.lastIndexOf('.') + 1)];
  // Flip one byte in the base64url-encoded payload
  const mutated = encoded.slice(0, -3) + (encoded.slice(-3) === 'AAA' ? 'ZZZ' : 'AAA');
  const tampered = `${mutated}.${sig}`;
  const result = verifySimulationToken(tampered, TEST_SECRET);
  assert.equal(result, null, 'tampered payload must not verify');
});

// ─── U3. Tampered signature → null ─────────────────────────────────────────────

checkAsync('U3. tampered signature → verifySimulationToken returns null', async () => {
  const token = makeToken('ProPlus');
  const dot = token.lastIndexOf('.');
  const tampered = token.slice(0, dot + 1) + 'AAABBBCCC';
  const result = verifySimulationToken(tampered, TEST_SECRET);
  assert.equal(result, null, 'tampered signature must not verify');
});

// ─── U4. Expired token → null ──────────────────────────────────────────────────

checkAsync('U4. expired token → verifySimulationToken returns null', async () => {
  const expiredToken = makeExpiredToken('ProPlus');
  const result = verifySimulationToken(expiredToken, TEST_SECRET);
  assert.equal(result, null, 'expired token must not verify');
});

// ─── U5. personaToPlan: ProPlus + canceled → Explorer ─────────────────────────

checkAsync('U5. personaToPlan: ProPlus + canceled subscription → Explorer plan', async () => {
  const payload = {
    persona: 'ProPlus' as SimPersona,
    subscriptionState: 'canceled' as SubState,
    betaFullAccess: false,
    standardUsed: 0,
    regionalUsed: 0,
    anonPreviewConsumed: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7200,
  };
  const ctx = resolveSimulationContext(payload);
  assert.equal(ctx.effectivePlan, 'Explorer', 'canceled ProPlus must resolve to Explorer');
});

// ─── U6. personaToPlan: BetaTester → Pro+ ─────────────────────────────────────

checkAsync('U6. personaToPlan: BetaTester → Pro+ effective plan', async () => {
  const payload = {
    persona: 'BetaTester' as SimPersona,
    subscriptionState: 'active' as SubState,
    betaFullAccess: false,
    standardUsed: 0, regionalUsed: 0, anonPreviewConsumed: false,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7200,
  };
  const ctx = resolveSimulationContext(payload);
  assert.equal(ctx.effectivePlan, 'Pro+');
});

// ─── U7. betaFullAccess + Anonymous → Explorer (not elevated) ─────────────────

checkAsync('U7. betaFullAccess=true + Anonymous persona → effectivePlan stays Explorer', async () => {
  const payload = {
    persona: 'Anonymous' as SimPersona,
    subscriptionState: 'none' as SubState,
    betaFullAccess: true,
    standardUsed: 0, regionalUsed: 0, anonPreviewConsumed: false,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7200,
  };
  const ctx = resolveSimulationContext(payload);
  assert.equal(ctx.effectivePlan, 'Explorer', 'betaFullAccess must not elevate Anonymous persona');
});

// ─── U8. betaFullAccess + Explorer → Pro+ ─────────────────────────────────────

checkAsync('U8. betaFullAccess=true + Explorer persona → effectivePlan is Pro+', async () => {
  const payload = {
    persona: 'Explorer' as SimPersona,
    subscriptionState: 'active' as SubState,
    betaFullAccess: true,
    standardUsed: 0, regionalUsed: 0, anonPreviewConsumed: false,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7200,
  };
  const ctx = resolveSimulationContext(payload);
  assert.equal(ctx.effectivePlan, 'Pro+', 'betaFullAccess must elevate Explorer to Pro+');
});

// ─── H9. ProPlus sim, 0/10 used → 401 MISSING_API_KEY ────────────────────────

checkAsync('H9. ProPlus sim (0/10 used) → passes plan+quota gates → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('ProPlus', { regionalUsed: 0 });
  const r = await callHandler({
    adminAuth: true,
    simToken: token,
    body: { opportunity: { businessType: 'coffee shop' }, location: 'Austin, TX' },
  });
  assert.equal(r.status, 401, `expected 401 MISSING_API_KEY, got ${r.status}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── H10. ProPlus sim, 10/10 used → 429 QUOTA_EXCEEDED ───────────────────────

checkAsync('H10. ProPlus sim (10/10 used, quota exhausted) → 429 QUOTA_EXCEEDED', async () => {
  resetFake();
  const token = makeToken('ProPlus', { regionalUsed: 10 });
  const r = await callHandler({
    adminAuth: true,
    simToken: token,
    body: { opportunity: { businessType: 'coffee shop' }, location: 'Austin, TX' },
  });
  assert.equal(r.status, 429);
  assert.equal(r.body?.code, 'QUOTA_EXCEEDED');
});

// ─── H11. Enterprise sim → unlimited → 401 MISSING_API_KEY ───────────────────

checkAsync('H11. Enterprise sim → unlimited quota → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('Enterprise', { regionalUsed: 999 });
  const r = await callHandler({
    adminAuth: true,
    simToken: token,
    body: { opportunity: { businessType: 'franchise' }, location: 'Chicago, IL' },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── H12. Explorer sim → 403 INSUFFICIENT_PLAN ───────────────────────────────

checkAsync('H12. Explorer sim → 403 INSUFFICIENT_PLAN', async () => {
  resetFake();
  const token = makeToken('Explorer');
  const r = await callHandler({
    adminAuth: true,
    simToken: token,
    body: { opportunity: { businessType: 'bakery' }, location: 'Denver, CO' },
  });
  assert.equal(r.status, 403);
  assert.equal(r.body?.code, 'INSUFFICIENT_PLAN');
});

// ─── H13. Pro sim → 403 INSUFFICIENT_PLAN ────────────────────────────────────

checkAsync('H13. Pro sim → 403 INSUFFICIENT_PLAN', async () => {
  resetFake();
  const token = makeToken('Pro');
  const r = await callHandler({
    adminAuth: true,
    simToken: token,
    body: { opportunity: { businessType: 'gym' }, location: 'Seattle, WA' },
  });
  assert.equal(r.status, 403);
  assert.equal(r.body?.code, 'INSUFFICIENT_PLAN');
});

// ─── H14. BetaTester sim → Pro+ effective → 401 MISSING_API_KEY ───────────────

checkAsync('H14. BetaTester sim → effective Pro+ → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('BetaTester', { regionalUsed: 0 });
  const r = await callHandler({
    adminAuth: true,
    simToken: token,
    body: { opportunity: { businessType: 'yoga studio' }, location: 'Portland, OR' },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── H15. ProPlus + betaFullAccess=true → unlimited → 401 MISSING_API_KEY ─────

checkAsync('H15. ProPlus sim + betaFullAccess=true → unlimited quota → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('ProPlus', { regionalUsed: 10, betaFullAccess: true });
  const r = await callHandler({
    adminAuth: true,
    simToken: token,
    body: { opportunity: { businessType: 'spa' }, location: 'Miami, FL' },
  });
  // betaFullAccess=true bypasses quota (allowed=true even at 10/10)
  assert.equal(r.status, 401);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── H16. ProPlus + canceled → Explorer effective → 403 INSUFFICIENT_PLAN ─────

checkAsync('H16. ProPlus sim + subscriptionState=canceled → effective Explorer → 403 INSUFFICIENT_PLAN', async () => {
  resetFake();
  const token = makeToken('ProPlus', { subscriptionState: 'canceled' });
  const r = await callHandler({
    adminAuth: true,
    simToken: token,
    body: { opportunity: { businessType: 'restaurant' }, location: 'Nashville, TN' },
  });
  assert.equal(r.status, 403);
  assert.equal(r.body?.code, 'INSUFFICIENT_PLAN');
});

// ─── H17. ProPlus sim, quota OK → rpcCallCount stays 0 (no DB write) ──────────

checkAsync('H17. ProPlus sim (0/10 used) → rpcCallCount=0 (increment_usage_tracking not called)', async () => {
  resetFake();
  const token = makeToken('ProPlus', { regionalUsed: 0 });
  await callHandler({
    adminAuth: true,
    simToken: token,
    body: { opportunity: { businessType: 'ice cream shop' }, location: 'Phoenix, AZ' },
  });
  assert.equal(
    fakeState.rpcCallCount, 0,
    `DB increment_usage_tracking must not be called during simulation, got rpcCallCount=${fakeState.rpcCallCount}`,
  );
});

// ─── H18. Expired token → falls through to real auth → 401 UNAUTHENTICATED ────

checkAsync('H18. expired sim token → getSimulationContext returns null → 401 UNAUTHENTICATED', async () => {
  resetFake();
  const expiredToken = makeExpiredToken('ProPlus');
  // No real auth header → verifyAndGetPlan returns FALLBACK → verifiedUserId=null
  const r = await callHandler({
    simToken: expiredToken,
    body: { opportunity: { businessType: 'diner' }, location: 'Houston, TX' },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body?.code, 'UNAUTHENTICATED');
});

// ─── H19. Tampered token → falls through to real auth → 401 UNAUTHENTICATED ───

checkAsync('H19. tampered sim token → getSimulationContext returns null → 401 UNAUTHENTICATED', async () => {
  resetFake();
  const token = makeToken('ProPlus');
  const dot = token.lastIndexOf('.');
  const tampered = token.slice(0, dot + 1) + 'INVALIDXXX';
  const r = await callHandler({
    simToken: tampered,
    body: { opportunity: { businessType: 'bakery' }, location: 'Dallas, TX' },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body?.code, 'UNAUTHENTICATED');
});

// ─── P20. ADMIN_SIMULATION_ENABLED absent → getSimulationContext returns null ──

checkAsync('P20. ADMIN_SIMULATION_ENABLED absent → getSimulationContext returns null (production guard)', async () => {
  const prev = process.env.ADMIN_SIMULATION_ENABLED;
  delete process.env.ADMIN_SIMULATION_ENABLED;
  try {
    const token = makeToken('ProPlus');
    const result = getSimulationContext({ 'x-sim-token': token });
    assert.equal(result, null, 'getSimulationContext must return null when ADMIN_SIMULATION_ENABLED is absent');
  } finally {
    if (prev !== undefined) process.env.ADMIN_SIMULATION_ENABLED = prev;
  }
});

// ─── Run all tests ─────────────────────────────────────────────────────────────

for (const { name, fn } of asyncTests) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err: any) {
    console.error(`FAIL ${name}`);
    console.error(`     ${err.message ?? err}`);
    fakeSupabase.close();
    process.exit(1);
  }
}

fakeSupabase.close();
console.log(`\nPassed ${passed}/${asyncTests.length} tests`);
