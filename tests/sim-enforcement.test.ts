/**
 * sim-enforcement.test.ts
 *
 * 25 behavioral tests for server-side simulation enforcement across all
 * product endpoints (analyze, opportunities, regional-analysis, usage-summary,
 * preview) plus the centralized resolveSimulatedRequest helper.
 *
 * Run standalone:
 *   npx tsx tests/sim-enforcement.test.ts
 * Exits non-zero on the first failed assertion.
 *
 * Coverage (25 scenarios):
 *
 * Centralized helper (pure-function tests):
 *   S1.  Non-admin user with valid sim token → sim NOT activated
 *   S2.  Admin user with valid sim token → sim IS activated
 *
 * analyze.ts — standard quota:
 *   A1.  Explorer sim (standardUsed=2/3) → passes quota → 401 MISSING_API_KEY
 *   A2.  Explorer sim (standardUsed=3/3, exhausted) → 429 QUOTA_EXCEEDED
 *   A3.  Pro sim (standardUsed=20/20, exhausted) → 429 QUOTA_EXCEEDED
 *   A4.  Enterprise sim (used=9999) → unlimited → 401 MISSING_API_KEY
 *   A5.  No sim token + admin auth → admin=Enterprise, no sim → 401 MISSING_API_KEY
 *   A6.  ProPlus sim, quota OK → rpcCallCount=0 (no DB increment)
 *
 * opportunities.ts — regional quota:
 *   O1.  ProPlus sim (0/10 used) → passes → 401 MISSING_API_KEY
 *   O2.  ProPlus sim (10/10 used) → 429 QUOTA_EXCEEDED
 *   O3.  Pro sim → 403 INSUFFICIENT_PLAN (plan gate blocks Pro)
 *
 * regional-analysis.ts:
 *   R1.  ProPlus sim (0/10 used) → passes → 503 MISSING_API_KEY
 *   R2.  Explorer sim → 403 INSUFFICIENT_PLAN
 *
 * usage-summary.ts:
 *   U1.  ProPlus sim (std=7, reg=3) → 200 with simulated counts
 *   U2.  Explorer sim → 200 with Explorer plan and limits
 *   U3.  No sim → 200 with real plan (admin=Enterprise, 0 counts)
 *
 * preview.ts:
 *   P1.  Anonymous sim (anonConsumed=false) → proceeds → 401 MISSING_API_KEY
 *   P2.  Anonymous sim (anonConsumed=true) → 429 PREVIEW_CONSUMED
 *   P3.  No sim token → proceeds normally → 401 MISSING_API_KEY
 *
 * Subscription states:
 *   X1.  ProPlus + trialing → effectivePlan=Pro+ (NOT demoted) → analyze → 401 MISSING_API_KEY
 *   X2.  ProPlus + past_due → effectivePlan=Pro+ (NOT demoted) → dossier → 401 MISSING_API_KEY
 *   X3.  ProPlus + canceled → effectivePlan=Explorer → analyze → quota (0/3) → 401 MISSING_API_KEY
 *
 * betaFullAccess override:
 *   B1.  Explorer + betaFullAccess=true → effectivePlan=Pro+ → dossier passes gate
 *   B2.  Anonymous + betaFullAccess=true → effectivePlan=Explorer (NOT elevated)
 *
 * Admin identity preservation:
 *   I1.  Non-admin sends valid ProPlus sim token → sim NOT activated → Explorer plan → 403
 */

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  signSimulationToken,
  verifySimulationToken,
  resolveSimulationContext,
} from '../src/utils/simulationToken.js';
import { resolveSimulatedRequest } from '../api/_simAuth.js';
import type { SimPersona, SubState } from '../src/utils/simulationToken.js';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TEST_SECRET          = 'test-sim-secret-enforcement-suite';
const FAKE_ADMIN_JWT       = 'test-admin-enforcement-jwt';
const FAKE_ADMIN_B_JWT     = 'test-admin-b-enforcement-jwt';
const FAKE_USER_JWT        = 'test-regularuser-enforcement-jwt';
const FAKE_ADMIN_USER_ID   = 'fake-admin-ee000000-0000-0000-0000-000000000000';
const FAKE_ADMIN_B_USER_ID = 'fake-admin-b-ee000000-0000-0000-0000-000000000000';
const FAKE_USER_ID         = 'fake-user-ee000000-0000-0000-0000-000000000000';
const FAKE_SR_JWT        =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoidGVzdCIsImlhdCI6MTAwMDAwMH0' +
  '.fakesig';

// ─── Token helpers ─────────────────────────────────────────────────────────────

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
    issuedForUserId?: string;
  } = {},
): string {
  const {
    regionalUsed = 0, standardUsed = 0, subscriptionState = 'active',
    betaFullAccess = false, anonPreviewConsumed = false,
    issuedForUserId = FAKE_ADMIN_USER_ID,
  } = opts;
  return signSimulationToken(
    { issuedForUserId, persona, regionalUsed, standardUsed, subscriptionState, betaFullAccess, anonPreviewConsumed },
    TEST_SECRET,
  );
}

// ─── Fake Supabase server ──────────────────────────────────────────────────────

interface FakeState { rpcCallCount: number; }
const fakeState: FakeState = { rpcCallCount: 0 };
function resetFake() { fakeState.rpcCallCount = 0; }

async function consumeBody(req: IncomingMessage): Promise<void> {
  await new Promise<void>(resolve => { req.on('data', () => {}); req.on('end', resolve); });
}

const fakeSupabase = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const authHeader = req.headers['authorization'] ?? '';
  await consumeBody(req);

  // Auth endpoint: check Bearer token to decide user identity
  if (url.pathname === '/auth/v1/user') {
    if (authHeader === `Bearer ${FAKE_ADMIN_JWT}`) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: FAKE_ADMIN_USER_ID, email: 'admin@test.com', role: 'authenticated' }));
    } else if (authHeader === `Bearer ${FAKE_ADMIN_B_JWT}`) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: FAKE_ADMIN_B_USER_ID, email: 'adminb@test.com', role: 'authenticated' }));
    } else if (authHeader === `Bearer ${FAKE_USER_JWT}`) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: FAKE_USER_ID, email: 'user@test.com', role: 'authenticated' }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 401, msg: 'Invalid JWT' }));
    }
    return;
  }

  // Profiles: .single() uses Accept: application/vnd.pgrst.object+json → single object.
  if (url.pathname === '/rest/v1/profiles') {
    const accept = (req.headers['accept'] as string) ?? '';
    const isAdmin = (req.url ?? '').includes(FAKE_ADMIN_USER_ID) || (req.url ?? '').includes(FAKE_ADMIN_B_USER_ID);
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

  // RPC calls — should not fire during simulation
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    fakeState.rpcCallCount++;
    res.writeHead(204);
    res.end();
    return;
  }

  // All other REST endpoints (usage_tracking, usage_logs, report_activity_log, subscriptions, etc.)
  const method = req.method ?? 'GET';
  res.writeHead(method === 'GET' ? 200 : 201, { 'Content-Type': 'application/json' });
  res.end('[]');
});

const fakeSupabasePort = await new Promise<number>(resolve => {
  fakeSupabase.listen(0, '127.0.0.1', () => {
    resolve((fakeSupabase.address() as AddressInfo).port);
  });
});

// ─── Environment — set BEFORE importing handlers ───────────────────────────────

process.env.SUPABASE_URL              = `http://127.0.0.1:${fakeSupabasePort}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_SR_JWT;
process.env.REAL_REPORTS_ENABLED      = 'true';
process.env.ADMIN_SIMULATION_ENABLED  = 'true';
process.env.ADMIN_SIM_SECRET          = TEST_SECRET;
delete process.env.GEMINI_API_KEY;
delete process.env.BETA_FULL_ACCESS;

// Import all handlers after env vars are set (ESM module cache frozen at import time)
const { default: analyzeHandler }     = await import('../api/analyze.ts');
const { default: oppsHandler }        = await import('../api/opportunities.ts');
const { default: regionalHandler }    = await import('../api/regional-analysis.ts');
const { default: summaryHandler }     = await import('../api/usage-summary.ts');
const { default: previewHandler }     = await import('../api/preview.ts');
const { default: dossierHandler }     = await import('../api/opportunity-dossier.ts');

// ─── Call helpers ──────────────────────────────────────────────────────────────

interface MockResponse { status: number; body: any; }

type HandlerFn = (req: any, res: any) => Promise<void>;

async function call(
  handler: HandlerFn,
  opts: {
    method?: string;
    adminAuth?: boolean;
    adminBAuth?: boolean;
    userAuth?: boolean;
    simToken?: string;
    body?: any;
  },
): Promise<MockResponse> {
  return new Promise<MockResponse>(resolve => {
    const captured: MockResponse = { status: 200, body: null };
    const headers: Record<string, string> = {};
    if (opts.adminAuth)  headers['authorization'] = `Bearer ${FAKE_ADMIN_JWT}`;
    if (opts.adminBAuth) headers['authorization'] = `Bearer ${FAKE_ADMIN_B_JWT}`;
    if (opts.userAuth)   headers['authorization'] = `Bearer ${FAKE_USER_JWT}`;
    if (opts.simToken)   headers['x-sim-token']   = opts.simToken;

    const req: any = {
      method: opts.method ?? 'POST',
      headers,
      body: opts.body ?? undefined,
      url: '/test',
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

// Default body shapes for each endpoint
const dossierBody = { opportunity: { businessType: 'coffee shop' }, location: 'Austin, TX' };
const analyzeBody = { businessType: 'coffee shop', location: 'Austin, TX' };
const oppsBody    = { location: 'Austin, TX' };
const regionalBody = { businessType: 'coffee shop', location: 'Austin, TX' };
const previewBody = { businessType: 'coffee shop', location: 'Austin, TX' };

// ─── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
const asyncTests: Array<{ name: string; fn: () => Promise<void> }> = [];

function checkAsync(name: string, fn: () => Promise<void>): void {
  asyncTests.push({ name, fn });
}

// ─── S1. Non-admin → sim NOT activated ────────────────────────────────────────

checkAsync('S1. resolveSimulatedRequest: non-admin + valid token → simulationActive=false', async () => {
  const token = makeToken('ProPlus');
  const result = resolveSimulatedRequest(
    { 'x-sim-token': token },
    FAKE_USER_ID,
    'Explorer',          // non-admin role
    'Explorer',
    false,
  );
  assert.equal(result.simulationActive, false, 'non-admin must not activate simulation');
  assert.equal(result.effectivePlan, 'Explorer', 'must use real plan when sim not active');
});

// ─── S2. Admin → sim IS activated ─────────────────────────────────────────────

checkAsync('S2. resolveSimulatedRequest: admin + valid token → simulationActive=true', async () => {
  const token = makeToken('ProPlus', { regionalUsed: 5 });
  const result = resolveSimulatedRequest(
    { 'x-sim-token': token },
    FAKE_ADMIN_USER_ID,
    'admin',
    'Enterprise',
    false,
  );
  assert.equal(result.simulationActive, true, 'admin must activate simulation');
  assert.equal(result.effectivePlan, 'Pro+');
  assert.equal(result.regionalUsed, 5);
});

// ─── A1. Explorer sim (2/3 used) → 401 MISSING_API_KEY ───────────────────────

checkAsync('A1. analyze: Explorer sim (standardUsed=2/3) → passes quota → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('Explorer', { standardUsed: 2 });
  const r = await call(analyzeHandler, { adminAuth: true, simToken: token, body: analyzeBody });
  assert.equal(r.status, 401, `expected 401, got ${r.status}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── A2. Explorer sim (3/3 exhausted) → 429 QUOTA_EXCEEDED ───────────────────

checkAsync('A2. analyze: Explorer sim (standardUsed=3/3 exhausted) → 429 QUOTA_EXCEEDED', async () => {
  resetFake();
  const token = makeToken('Explorer', { standardUsed: 3 });
  const r = await call(analyzeHandler, { adminAuth: true, simToken: token, body: analyzeBody });
  assert.equal(r.status, 429);
  assert.equal(r.body?.code, 'QUOTA_EXCEEDED');
});

// ─── A3. Pro sim (20/20 exhausted) → 429 QUOTA_EXCEEDED ──────────────────────

checkAsync('A3. analyze: Pro sim (standardUsed=20/20 exhausted) → 429 QUOTA_EXCEEDED', async () => {
  resetFake();
  const token = makeToken('Pro', { standardUsed: 20 });
  const r = await call(analyzeHandler, { adminAuth: true, simToken: token, body: analyzeBody });
  assert.equal(r.status, 429);
  assert.equal(r.body?.code, 'QUOTA_EXCEEDED');
});

// ─── A4. Enterprise sim (unlimited) → 401 MISSING_API_KEY ────────────────────

checkAsync('A4. analyze: Enterprise sim (used=9999) → unlimited → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('Enterprise', { standardUsed: 9999 });
  const r = await call(analyzeHandler, { adminAuth: true, simToken: token, body: analyzeBody });
  assert.equal(r.status, 401);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── A5. No sim token + admin auth → admin=Enterprise → 401 MISSING_API_KEY ──

checkAsync('A5. analyze: no sim token + admin auth → real Enterprise plan → 401 MISSING_API_KEY', async () => {
  resetFake();
  const r = await call(analyzeHandler, { adminAuth: true, body: analyzeBody });
  assert.equal(r.status, 401, `expected 401, got ${r.status}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── A6. ProPlus sim, quota OK → rpcCallCount=0 (no DB increment) ─────────────

checkAsync('A6. analyze: ProPlus sim (quota OK) → rpcCallCount=0 (no incrementUsageTracking)', async () => {
  resetFake();
  const token = makeToken('ProPlus', { standardUsed: 5 });
  await call(analyzeHandler, { adminAuth: true, simToken: token, body: analyzeBody });
  assert.equal(
    fakeState.rpcCallCount, 0,
    `increment_usage_tracking must not be called during simulation, got rpcCallCount=${fakeState.rpcCallCount}`,
  );
});

// ─── O1. ProPlus sim (0/10) → 401 MISSING_API_KEY ────────────────────────────

checkAsync('O1. opportunities: ProPlus sim (0/10 regional) → passes → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('ProPlus', { regionalUsed: 0 });
  const r = await call(oppsHandler, { adminAuth: true, simToken: token, body: oppsBody });
  assert.equal(r.status, 401, `expected 401, got ${r.status}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── O2. ProPlus sim (10/10) → 429 QUOTA_EXCEEDED ────────────────────────────

checkAsync('O2. opportunities: ProPlus sim (10/10 exhausted) → 429 QUOTA_EXCEEDED', async () => {
  resetFake();
  const token = makeToken('ProPlus', { regionalUsed: 10 });
  const r = await call(oppsHandler, { adminAuth: true, simToken: token, body: oppsBody });
  assert.equal(r.status, 429);
  assert.equal(r.body?.code, 'QUOTA_EXCEEDED');
});

// ─── O3. Pro sim → 403 INSUFFICIENT_PLAN ─────────────────────────────────────

checkAsync('O3. opportunities: Pro sim → 403 INSUFFICIENT_PLAN (plan gate)', async () => {
  resetFake();
  const token = makeToken('Pro');
  const r = await call(oppsHandler, { adminAuth: true, simToken: token, body: oppsBody });
  assert.equal(r.status, 403);
  assert.equal(r.body?.code, 'INSUFFICIENT_PLAN');
});

// ─── R1. ProPlus sim (0/10) → 401 MISSING_API_KEY ────────────────────────────

checkAsync('R1. regional-analysis: ProPlus sim (0/10) → passes → 503 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('ProPlus', { regionalUsed: 0 });
  const r = await call(regionalHandler, { adminAuth: true, simToken: token, body: regionalBody });
  assert.equal(r.status, 503, `expected 503, got ${r.status}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── R2. Explorer sim → 403 INSUFFICIENT_PLAN ────────────────────────────────

checkAsync('R2. regional-analysis: Explorer sim → 403 INSUFFICIENT_PLAN', async () => {
  resetFake();
  const token = makeToken('Explorer');
  const r = await call(regionalHandler, { adminAuth: true, simToken: token, body: regionalBody });
  assert.equal(r.status, 403);
  assert.equal(r.body?.code, 'INSUFFICIENT_PLAN');
});

// ─── U1. ProPlus sim (std=7, reg=3) → 200 with simulated counts ──────────────

checkAsync('U1. usage-summary: ProPlus sim (std=7, reg=3) → 200 with simulated counts + Pro+ plan', async () => {
  const token = makeToken('ProPlus', { standardUsed: 7, regionalUsed: 3 });
  const r = await call(summaryHandler, { method: 'GET', adminAuth: true, simToken: token });
  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  assert.equal(r.body?.plan, 'Pro+', 'plan must reflect sim persona Pro+');
  assert.equal(r.body?.standard?.used, 7, 'standardUsed must come from sim token');
  assert.equal(r.body?.regional?.used, 3, 'regionalUsed must come from sim token');
});

// ─── U2. Explorer sim → 200 with Explorer plan ───────────────────────────────

checkAsync('U2. usage-summary: Explorer sim → 200 with Explorer plan and limits', async () => {
  const token = makeToken('Explorer', { standardUsed: 1, regionalUsed: 0 });
  const r = await call(summaryHandler, { method: 'GET', adminAuth: true, simToken: token });
  assert.equal(r.status, 200, `expected 200, got ${r.status}`);
  assert.equal(r.body?.plan, 'Explorer');
  assert.equal(r.body?.standard?.used, 1);
  assert.equal(r.body?.standard?.limit, 3, 'Explorer standard limit must be 3');
});

// ─── U3. No sim → 200 with real plan (admin=Enterprise) ──────────────────────

checkAsync('U3. usage-summary: no sim token + admin auth → 200 with real Enterprise plan', async () => {
  const r = await call(summaryHandler, { method: 'GET', adminAuth: true });
  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  assert.equal(r.body?.plan, 'Enterprise', 'admin must resolve to Enterprise plan without sim');
});

// ─── P1. Anonymous sim (anonConsumed=false) → 401 MISSING_API_KEY ────────────

checkAsync('P1. preview: Anonymous sim (anonConsumed=false) → proceeds → 401 MISSING_API_KEY', async () => {
  const token = makeToken('Anonymous', { anonPreviewConsumed: false });
  const r = await call(previewHandler, { simToken: token, body: previewBody });
  assert.equal(r.status, 401, `expected 401 MISSING_API_KEY, got ${r.status}: ${JSON.stringify(r.body)}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── P2. Anonymous sim (anonConsumed=true) → 429 PREVIEW_CONSUMED ────────────

checkAsync('P2. preview: Anonymous sim (anonConsumed=true) → 429 PREVIEW_CONSUMED', async () => {
  const token = makeToken('Anonymous', { anonPreviewConsumed: true });
  const r = await call(previewHandler, { simToken: token, body: previewBody });
  assert.equal(r.status, 429, `expected 429, got ${r.status}`);
  assert.equal(r.body?.code, 'PREVIEW_CONSUMED');
});

// ─── P3. No sim token → 401 MISSING_API_KEY (real anonymous path) ────────────

checkAsync('P3. preview: no sim token → proceeds normally → 401 MISSING_API_KEY', async () => {
  const r = await call(previewHandler, { body: previewBody });
  assert.equal(r.status, 401, `expected 401, got ${r.status}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── X1. ProPlus + trialing → effectivePlan=Pro+ (NOT demoted) ───────────────

checkAsync('X1. subscriptionState=trialing + ProPlus → effectivePlan=Pro+ (analyze) → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('ProPlus', { subscriptionState: 'trialing', standardUsed: 0 });
  const r = await call(analyzeHandler, { adminAuth: true, simToken: token, body: analyzeBody });
  assert.equal(r.status, 401, `trialing ProPlus must resolve to Pro+ (not demoted), got ${r.status}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── X2. ProPlus + past_due → effectivePlan=Pro+ (NOT demoted) ───────────────

checkAsync('X2. subscriptionState=past_due + ProPlus → effectivePlan=Pro+ (dossier) → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('ProPlus', { subscriptionState: 'past_due', regionalUsed: 0 });
  const r = await call(dossierHandler, { adminAuth: true, simToken: token, body: dossierBody });
  assert.equal(r.status, 401, `past_due ProPlus must resolve to Pro+ (not demoted), got ${r.status}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── X3. ProPlus + canceled → effectivePlan=Explorer → quota (0/3) → 401 ─────

checkAsync('X3. subscriptionState=canceled + ProPlus → effectivePlan=Explorer → analyze quota (0/3) → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('ProPlus', { subscriptionState: 'canceled', standardUsed: 0 });
  const r = await call(analyzeHandler, { adminAuth: true, simToken: token, body: analyzeBody });
  // Canceled ProPlus → Explorer plan → 3/mo limit → used=0 → allowed → reaches Gemini gate → MISSING_API_KEY
  assert.equal(r.status, 401, `canceled ProPlus must demote to Explorer (passes quota with 0 used), got ${r.status}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── B1. betaFullAccess=true + Explorer → effectivePlan=Pro+ ─────────────────

checkAsync('B1. betaFullAccess=true + Explorer persona → effectivePlan=Pro+ → dossier passes gate → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('Explorer', { betaFullAccess: true, regionalUsed: 0 });
  const r = await call(dossierHandler, { adminAuth: true, simToken: token, body: dossierBody });
  assert.equal(r.status, 401, `betaFullAccess must elevate Explorer to Pro+, got ${r.status}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
});

// ─── B2. betaFullAccess=true + Anonymous → effectivePlan=Explorer (NOT elevated)

checkAsync('B2. betaFullAccess=true + Anonymous persona → effectivePlan stays Explorer (not elevated)', async () => {
  const payload = {
    issuedForUserId: FAKE_ADMIN_USER_ID,
    persona: 'Anonymous' as SimPersona,
    subscriptionState: 'none' as SubState,
    betaFullAccess: true,
    standardUsed: 0, regionalUsed: 0, anonPreviewConsumed: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7200,
  };
  const ctx = resolveSimulationContext(payload);
  assert.equal(ctx.effectivePlan, 'Explorer', 'Anonymous must not be elevated by betaFullAccess');
});

// ─── I1. Non-admin user sends valid sim token → sim NOT activated → 403 ───────

checkAsync('I1. non-admin user sends valid ProPlus sim token → sim NOT activated → 403 INSUFFICIENT_PLAN (dossier)', async () => {
  resetFake();
  const token = makeToken('ProPlus', { regionalUsed: 0 });
  // Regular Explorer user with a valid ProPlus sim token
  const r = await call(dossierHandler, { userAuth: true, simToken: token, body: dossierBody });
  // Sim not activated (non-admin) → real plan = Explorer → 403 INSUFFICIENT_PLAN
  assert.equal(r.status, 403, `non-admin sim token replay must be rejected with 403, got ${r.status}`);
  assert.equal(r.body?.code, 'INSUFFICIENT_PLAN');
});

// ─── J1. Admin A uses own token → sim activated ───────────────────────────────

checkAsync('J1. resolveSimulatedRequest: Admin A token + Admin A as realUser → simulationActive=true', async () => {
  const token = makeToken('ProPlus'); // issuedForUserId defaults to FAKE_ADMIN_USER_ID
  const result = resolveSimulatedRequest(
    { 'x-sim-token': token },
    FAKE_ADMIN_USER_ID,
    'admin',
    'Enterprise',
    false,
  );
  assert.equal(result.simulationActive, true, 'token issued for Admin A must activate when Admin A uses it');
  assert.equal(result.effectivePlan, 'Pro+');
});

// ─── J2. Admin B uses Admin A's token → binding mismatch → sim NOT activated ──

checkAsync('J2. resolveSimulatedRequest: Admin A token + Admin B as realUser → simulationActive=false (binding mismatch)', async () => {
  const token = makeToken('ProPlus'); // issuedForUserId = FAKE_ADMIN_USER_ID (Admin A)
  const result = resolveSimulatedRequest(
    { 'x-sim-token': token },
    FAKE_ADMIN_B_USER_ID,
    'admin',
    'Enterprise',
    false,
  );
  assert.equal(result.simulationActive, false, 'token issued for Admin A must not activate for Admin B');
  assert.equal(result.isRealAdmin, true, 'Admin B is still a real admin');
  assert.equal(result.effectivePlan, 'Enterprise', 'Admin B falls back to their own real plan');
});

// ─── J3. Old-format token (no issuedForUserId) → verifySimulationToken → null ─

checkAsync('J3. verifySimulationToken: old-format token without issuedForUserId → null', async () => {
  const now = Math.floor(Date.now() / 1000);
  const oldPayload = {
    persona: 'ProPlus' as SimPersona,
    standardUsed: 0, regionalUsed: 0,
    anonPreviewConsumed: false, subscriptionState: 'active' as SubState,
    betaFullAccess: false, iat: now, exp: now + 7200,
    // issuedForUserId intentionally absent — simulates a pre-binding-feature token
  };
  const encoded = b64url(Buffer.from(JSON.stringify(oldPayload), 'utf8'));
  const sig = b64url(createHmac('sha256', TEST_SECRET).update(encoded).digest());
  const result = verifySimulationToken(`${encoded}.${sig}`, TEST_SECRET);
  assert.equal(result, null, 'old-format token without issuedForUserId must be rejected');
});

// ─── J4. Tampered issuedForUserId → HMAC mismatch → null ─────────────────────

checkAsync('J4. verifySimulationToken: tampered issuedForUserId → HMAC invalid → null', async () => {
  const validToken = makeToken('ProPlus'); // issuedForUserId = FAKE_ADMIN_USER_ID
  const dot = validToken.lastIndexOf('.');
  const encoded = validToken.slice(0, dot);
  const sig = validToken.slice(dot + 1);

  // Decode payload, swap issuedForUserId to Admin B, re-encode → original sig now mismatches
  const decoded = JSON.parse(Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  decoded.issuedForUserId = FAKE_ADMIN_B_USER_ID;
  const tamperedEncoded = b64url(Buffer.from(JSON.stringify(decoded), 'utf8'));
  const result = verifySimulationToken(`${tamperedEncoded}.${sig}`, TEST_SECRET);
  assert.equal(result, null, 'tampered issuedForUserId must invalidate the HMAC signature');
});

// ─── J5. Admin B replays Admin A's exhausted Explorer token → binding rejected ─
//
// If binding check works: Admin B's real Enterprise plan is used → analyze passes quota
//   → reaches Gemini gate → 401 MISSING_API_KEY.
// If binding check were absent: sim activates with Explorer/3-used → 429 QUOTA_EXCEEDED.

checkAsync('J5. analyze: Admin B sends Admin A exhausted-Explorer token → binding rejected → Admin B Enterprise plan → 401 MISSING_API_KEY', async () => {
  resetFake();
  const token = makeToken('Explorer', { standardUsed: 3, issuedForUserId: FAKE_ADMIN_USER_ID });
  const r = await call(analyzeHandler, { adminBAuth: true, simToken: token, body: analyzeBody });
  assert.equal(r.status, 401, `binding mismatch must fall back to Admin B's Enterprise plan (passes quota), got ${r.status}: ${JSON.stringify(r.body)}`);
  assert.equal(r.body?.code, 'MISSING_API_KEY');
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
