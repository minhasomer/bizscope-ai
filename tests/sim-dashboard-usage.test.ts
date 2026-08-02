/**
 * sim-dashboard-usage.test.ts
 *
 * Behavioral tests for simulated usage counts returned by /api/usage-summary.
 * Verifies that the server returns simulated standardUsed / regionalUsed values
 * when a valid sim token is present, and real DB values when no token is present.
 *
 * Run standalone:
 *   npx tsx tests/sim-dashboard-usage.test.ts
 * Exits non-zero on the first failed assertion.
 *
 * Coverage (6 scenarios):
 *   D1. Pro sim, standardUsed=19 → usage-summary returns standard.used=19, limit=20
 *   D2. ProPlus sim, regionalUsed=9 → usage-summary returns regional.used=9, limit=10
 *   D3. Pro sim at-limit (standardUsed=20) → remaining=0
 *   D4. ProPlus sim at-limit (regionalUsed=10) → remaining=0
 *   D5. Enterprise sim → standard.limit=null (unlimited)
 *   D6. No sim token → usage-summary returns real DB values (plan=Enterprise, 0 counts for admin)
 *   D7. Forged sim token → no sim context → falls through to real auth → returns real DB values
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { signSimulationToken } from '../src/utils/simulationToken.js';
import type { SimPersona, SubState } from '../src/utils/simulationToken.js';

const TEST_SECRET        = 'test-sim-secret-dashboard-usage';
const FAKE_ADMIN_JWT     = 'test-admin-jwt-dashboard';
const FAKE_ADMIN_USER_ID = 'fake-admin-00000000-0000-0000-0000-0000000000bb';

function makeToken(
  persona: SimPersona,
  opts: { standardUsed?: number; regionalUsed?: number; subscriptionState?: SubState } = {},
): string {
  return signSimulationToken(
    {
      issuedForUserId: FAKE_ADMIN_USER_ID,
      persona,
      standardUsed:  opts.standardUsed  ?? 0,
      regionalUsed:  opts.regionalUsed  ?? 0,
      subscriptionState: opts.subscriptionState ?? 'active',
      betaFullAccess: false,
      anonPreviewConsumed: false,
    },
    TEST_SECRET,
  );
}

// ─── Fake Supabase server ─────────────────────────────────────────────────────

async function consumeBody(req: IncomingMessage): Promise<void> {
  await new Promise<void>(resolve => { req.on('data', () => {}); req.on('end', resolve); });
}

const fakeSupabase = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  await consumeBody(req);

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
  if (url.pathname === '/rest/v1/profiles') {
    const accept = (req.headers['accept'] as string) ?? '';
    const row = { role: 'admin', subscription_tier: 'Enterprise' };
    if (accept.includes('pgrst.object')) {
      res.writeHead(200, { 'Content-Type': 'application/vnd.pgrst.object+json' });
      res.end(JSON.stringify(row));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([row]));
    }
    return;
  }
  // usage_tracking query — always return zero rows for the admin
  if (url.pathname === '/rest/v1/usage_tracking') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
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

process.env.SUPABASE_URL             = `http://127.0.0.1:${fakeSupabasePort}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_SR_JWT;
process.env.ADMIN_SIMULATION_ENABLED  = 'true';
process.env.ADMIN_SIM_SECRET          = TEST_SECRET;
delete process.env.BETA_FULL_ACCESS;

const { default: handler } = await import('../api/usage-summary.ts');

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface MockResponse { status: number; body: any }

async function callHandler(opts: {
  authHeader?: string;
  simToken?: string;
}): Promise<MockResponse> {
  return new Promise<MockResponse>(resolve => {
    const captured: MockResponse = { status: 200, body: null };
    const headers: Record<string, string> = {};
    if (opts.authHeader) headers['authorization'] = opts.authHeader;
    if (opts.simToken)   headers['x-sim-token']   = opts.simToken;

    const req: any = { method: 'GET', headers, url: '/api/usage-summary' };
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
      captured.status = 500; captured.body = { error: err.message }; resolve(captured);
    });
  });
}

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
const tests: Array<{ name: string; fn: () => Promise<void> }> = [];
function check(name: string, fn: () => Promise<void>) { tests.push({ name, fn }); }

// ─── D1. Pro sim standardUsed=19 → standard.used=19, limit=20 ────────────────

check('D1. Pro sim (standardUsed=19) → standard.used=19, standard.limit=20', async () => {
  const token = makeToken('Pro', { standardUsed: 19 });
  const r = await callHandler({ authHeader: `Bearer ${FAKE_ADMIN_JWT}`, simToken: token });
  assert.equal(r.status, 200);
  assert.equal(r.body.standard.used,  19, `expected 19, got ${r.body.standard.used}`);
  assert.equal(r.body.standard.limit, 20, `expected 20, got ${r.body.standard.limit}`);
  assert.equal(r.body.plan, 'Pro');
});

// ─── D2. ProPlus sim regionalUsed=9 → regional.used=9, limit=10 ──────────────

check('D2. ProPlus sim (regionalUsed=9) → regional.used=9, regional.limit=10', async () => {
  const token = makeToken('ProPlus', { regionalUsed: 9 });
  const r = await callHandler({ authHeader: `Bearer ${FAKE_ADMIN_JWT}`, simToken: token });
  assert.equal(r.status, 200);
  assert.equal(r.body.regional.used,  9,  `expected 9, got ${r.body.regional.used}`);
  assert.equal(r.body.regional.limit, 10, `expected 10, got ${r.body.regional.limit}`);
  assert.equal(r.body.plan, 'Pro+');
});

// ─── D3. Pro at-limit (standardUsed=20) → remaining=0 ────────────────────────

check('D3. Pro sim (standardUsed=20, at-limit) → standard.remaining=0', async () => {
  const token = makeToken('Pro', { standardUsed: 20 });
  const r = await callHandler({ authHeader: `Bearer ${FAKE_ADMIN_JWT}`, simToken: token });
  assert.equal(r.status, 200);
  assert.equal(r.body.standard.used,      20);
  assert.equal(r.body.standard.remaining, 0);
});

// ─── D4. ProPlus at-limit (regionalUsed=10) → remaining=0 ────────────────────

check('D4. ProPlus sim (regionalUsed=10, at-limit) → regional.remaining=0', async () => {
  const token = makeToken('ProPlus', { regionalUsed: 10 });
  const r = await callHandler({ authHeader: `Bearer ${FAKE_ADMIN_JWT}`, simToken: token });
  assert.equal(r.status, 200);
  assert.equal(r.body.regional.used,      10);
  assert.equal(r.body.regional.remaining, 0);
});

// ─── D5. Enterprise sim → standard.limit=null (unlimited) ────────────────────

check('D5. Enterprise sim → standard.limit=null (unlimited), regional.limit=null', async () => {
  const token = makeToken('Enterprise', { standardUsed: 999, regionalUsed: 999 });
  const r = await callHandler({ authHeader: `Bearer ${FAKE_ADMIN_JWT}`, simToken: token });
  assert.equal(r.status, 200);
  assert.equal(r.body.standard.limit, null, 'Enterprise standard limit must be null (unlimited)');
  assert.equal(r.body.regional.limit, null, 'Enterprise regional limit must be null (unlimited)');
  assert.equal(r.body.plan, 'Enterprise');
});

// ─── D6. No sim token → real DB values (admin→Enterprise, 0 counts) ──────────

check('D6. No sim token → returns real DB plan (Enterprise) with 0 usage counts', async () => {
  const r = await callHandler({ authHeader: `Bearer ${FAKE_ADMIN_JWT}` });
  assert.equal(r.status, 200);
  assert.equal(r.body.plan, 'Enterprise', `expected Enterprise, got ${r.body.plan}`);
  assert.equal(r.body.standard.used, 0);
  assert.equal(r.body.regional.used, 0);
});

// ─── D7. Forged sim token → no sim context → real DB values ──────────────────

check('D7. Forged sim token → sim context rejected → real DB plan returned (not simulated)', async () => {
  const realToken  = makeToken('Pro', { standardUsed: 19 });
  const dot        = realToken.lastIndexOf('.');
  const forgedToken = realToken.slice(0, dot + 1) + 'INVALIDFORGERY';
  const r = await callHandler({ authHeader: `Bearer ${FAKE_ADMIN_JWT}`, simToken: forgedToken });
  assert.equal(r.status, 200);
  assert.equal(r.body.plan, 'Enterprise', 'forged token must not activate simulation');
  assert.equal(r.body.standard.used, 0, 'forged token must not return simulated counts');
});

// ─── Run ──────────────────────────────────────────────────────────────────────

for (const { name, fn } of tests) {
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
console.log(`\nPassed ${passed}/${tests.length} tests`);
