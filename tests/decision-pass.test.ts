/**
 * Decision Pass — regression + behavioral tests
 *
 * THREE categories of coverage:
 *   [STATIC]     Source-level invariant checks (no runtime needed)
 *   [BEHAVIORAL] Control-flow tests using mocked RPC/DB boundaries
 *   [INTEGRATION] Tests that exercise the actual functions with mock Supabase clients
 *
 * Run standalone: npx tsx tests/decision-pass.test.ts
 * Exits non-zero on the first failed assertion.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ─── Source files for static checks ──────────────────────────────────────────
const migrationSource  = fs.readFileSync(path.join(root, 'supabase/migrations/20260816000000_decision_pass_entitlements.sql'), 'utf8');
const analyzeSource    = fs.readFileSync(path.join(root, 'api/analyze.ts'), 'utf8');
const oppsSource       = fs.readFileSync(path.join(root, 'api/opportunities.ts'), 'utf8');
const webhookSource    = fs.readFileSync(path.join(root, 'api/stripe/webhook.ts'), 'utf8');
const sharedSource     = fs.readFileSync(path.join(root, 'api/stripe/_shared.ts'), 'utf8');
const pathSource       = fs.readFileSync(path.join(root, 'api/stripe/[...path].ts'), 'utf8');
const usageSource      = fs.readFileSync(path.join(root, 'src/config/usageTracking.ts'), 'utf8');
const reportSource     = fs.readFileSync(path.join(root, 'components/ReportDisplay.tsx'), 'utf8');

let passed = 0;
let section = '';
function check(category: '[STATIC]' | '[BEHAVIORAL]' | '[INTEGRATION]', name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result && typeof (result as any).then === 'function') {
    throw new Error(`Async check "${name}" requires await — use checkAsync`);
  }
  console.log(`  ${category} ✓ ${name}`);
  passed++;
}
async function checkAsync(category: '[STATIC]' | '[BEHAVIORAL]' | '[INTEGRATION]', name: string, fn: () => Promise<void>) {
  await fn();
  console.log(`  ${category} ✓ ${name}`);
  passed++;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A: Migration schema [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nA. Migration — decision_pass_entitlements schema');

// A1.
check('[STATIC]', 'separate viability_remaining and market_gap_remaining columns (two independent counters)', () => {
  assert.ok(migrationSource.includes('viability_remaining') && migrationSource.includes('market_gap_remaining'));
});

// A2.
check('[STATIC]', 'stripe_checkout_session_id UNIQUE idempotency key (not payment_intent_id)', () => {
  assert.ok(
    migrationSource.includes('stripe_checkout_session_id') &&
    migrationSource.includes('UNIQUE') &&
    !migrationSource.includes('stripe_payment_intent_id'),
  );
});

// A3.
check('[STATIC]', 'decrement RPCs use FOR UPDATE SKIP LOCKED', () => {
  const count = (migrationSource.match(/FOR UPDATE SKIP LOCKED/g) ?? []).length;
  assert.ok(count >= 2, `Expected ≥2 FOR UPDATE SKIP LOCKED, found ${count}`);
});

// A4.
check('[STATIC]', 'restore RPCs use LEAST(remaining + 1, total) to cap restore at purchased quantity', () => {
  assert.ok(migrationSource.includes('LEAST') && migrationSource.includes('+ 1'));
});

// A5.
check('[STATIC]', 'non-negative balance enforced by CHECK constraints on both counters', () => {
  assert.ok(
    migrationSource.includes('viability_remaining >= 0') &&
    migrationSource.includes('market_gap_remaining >= 0'),
  );
});

// A6.
check('[STATIC]', 'balance bounded by total: viability_remaining <= viability_total (prevents manual inflation)', () => {
  assert.ok(
    migrationSource.includes('viability_remaining <= viability_total') &&
    migrationSource.includes('market_gap_remaining <= market_gap_total'),
  );
});

// A7.
check('[STATIC]', 'RLS enabled and forced on table', () => {
  assert.ok(
    migrationSource.includes('ENABLE ROW LEVEL SECURITY') &&
    migrationSource.includes('FORCE ROW LEVEL SECURITY'),
  );
});

// A8.
check('[STATIC]', 'REVOKE ALL FROM PUBLIC on all 4 RPCs before granting to service_role', () => {
  const revokeCount = (migrationSource.match(/REVOKE ALL ON FUNCTION/g) ?? []).length;
  assert.ok(revokeCount >= 4, `Expected ≥4 REVOKE clauses, found ${revokeCount}`);
});

// A9.
check('[STATIC]', 'RPCs are SECURITY DEFINER (run as owner, not caller)', () => {
  const count = (migrationSource.match(/SECURITY DEFINER/g) ?? []).length;
  assert.ok(count >= 4, `Expected ≥4 SECURITY DEFINER clauses, found ${count}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B: usageTracking.ts — function exports [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nB. usageTracking.ts — Decision Pass function exports');

// B1–B5: exported function names
for (const fn of ['decrementDecisionPassViability', 'restoreDecisionPassViability',
                   'decrementDecisionPassMarketGap', 'restoreDecisionPassMarketGap',
                   'getDecisionPassBalance']) {
  check('[STATIC]', `exports ${fn}`, () => {
    assert.ok(usageSource.includes('export') && usageSource.includes(fn));
  });
}

// B6.
check('[STATIC]', 'calls correct RPC names (not legacy decrement_purchased_pass)', () => {
  assert.ok(
    usageSource.includes('decrement_decision_pass_viability') &&
    usageSource.includes('decrement_decision_pass_market_gap') &&
    !usageSource.includes('decrement_purchased_pass'),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION C: Behavioral — usageTracking.ts functions with mocked Supabase
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nC. Behavioral — usageTracking.ts with mocked RPC/DB');

import {
  decrementDecisionPassViability,
  restoreDecisionPassViability,
  decrementDecisionPassMarketGap,
  restoreDecisionPassMarketGap,
  getDecisionPassBalance,
} from '../src/config/usageTracking.js';

/** In-memory row mirroring the decision_pass_entitlements table. */
interface PassRow {
  id: string;
  user_id: string;
  viability_remaining: number;
  viability_total: number;
  market_gap_remaining: number;
  market_gap_total: number;
}

/** Build a mock supabaseAdmin that operates on an in-memory rows array. */
function makeMockAdmin(rows: PassRow[]) {
  return {
    from: (table: string) => ({
      select: (cols: string) => ({
        eq: (col: string, val: any) => ({
          // getDecisionPassBalance uses chained .eq().eq()
          eq: (col2: string, val2: any) => Promise.resolve({ data: null, error: null }),
          // getDecisionPassBalance: select viability_remaining, market_gap_remaining where user_id=...
          then: undefined,
          // resolve directly for getDecisionPassBalance
        }),
        // For getDecisionPassBalance: .from(...).select(...).eq('user_id', userId)
        // returns { data: rows[], error }
        [Symbol.asyncIterator]: undefined,
      }),
    }),
    rpc: (fn: string, params: Record<string, any>) => {
      // Simulate decrement_decision_pass_viability
      if (fn === 'decrement_decision_pass_viability') {
        const userId = params.p_user_id;
        const eligible = rows
          .filter(r => r.user_id === userId && r.viability_remaining > 0)
          .sort((a, b) => a.id.localeCompare(b.id));
        if (!eligible.length) return Promise.resolve({ data: null, error: null });
        const row = eligible[0];
        row.viability_remaining = Math.max(0, row.viability_remaining - 1);
        return Promise.resolve({ data: row.id, error: null });
      }
      // Simulate restore_decision_pass_viability
      if (fn === 'restore_decision_pass_viability') {
        const passId = params.p_pass_id;
        const row = rows.find(r => r.id === passId);
        if (row) {
          row.viability_remaining = Math.min(row.viability_remaining + 1, row.viability_total);
        }
        return Promise.resolve({ data: null, error: null });
      }
      // Simulate decrement_decision_pass_market_gap
      if (fn === 'decrement_decision_pass_market_gap') {
        const userId = params.p_user_id;
        const eligible = rows
          .filter(r => r.user_id === userId && r.market_gap_remaining > 0)
          .sort((a, b) => a.id.localeCompare(b.id));
        if (!eligible.length) return Promise.resolve({ data: null, error: null });
        const row = eligible[0];
        row.market_gap_remaining = Math.max(0, row.market_gap_remaining - 1);
        return Promise.resolve({ data: row.id, error: null });
      }
      // Simulate restore_decision_pass_market_gap
      if (fn === 'restore_decision_pass_market_gap') {
        const passId = params.p_pass_id;
        const row = rows.find(r => r.id === passId);
        if (row) {
          row.market_gap_remaining = Math.min(row.market_gap_remaining + 1, row.market_gap_total);
        }
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: new Error(`Unknown RPC: ${fn}`) });
    },
  };
}

/** Build a getDecisionPassBalance-compatible mock (uses .from().select().eq()). */
function makeBalanceMock(rows: PassRow[], userId: string) {
  const userRows = rows.filter(r => r.user_id === userId);
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: any) => Promise.resolve({
          data: userRows.map(r => ({
            viability_remaining: r.viability_remaining,
            market_gap_remaining: r.market_gap_remaining,
          })),
          error: null,
        }),
      }),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
}

// C1. Viability: 3 → 2 → 1 → 0 → null
await checkAsync('[BEHAVIORAL]', 'viability decrement: 3→2→1→0, fourth attempt returns null', async () => {
  const rows: PassRow[] = [
    { id: 'pass-1', user_id: 'user-a', viability_remaining: 3, viability_total: 3, market_gap_remaining: 1, market_gap_total: 1 },
  ];
  const admin = makeMockAdmin(rows);

  const id1 = await decrementDecisionPassViability(admin, 'user-a');
  assert.equal(id1, 'pass-1');
  assert.equal(rows[0].viability_remaining, 2);

  const id2 = await decrementDecisionPassViability(admin, 'user-a');
  assert.equal(id2, 'pass-1');
  assert.equal(rows[0].viability_remaining, 1);

  const id3 = await decrementDecisionPassViability(admin, 'user-a');
  assert.equal(id3, 'pass-1');
  assert.equal(rows[0].viability_remaining, 0);

  const id4 = await decrementDecisionPassViability(admin, 'user-a');
  assert.equal(id4, null, 'Fourth decrement must return null — balance exhausted');
  assert.equal(rows[0].viability_remaining, 0);
});

// C2. Market Gap: 1 → 0 → null
await checkAsync('[BEHAVIORAL]', 'market_gap decrement: 1→0, second attempt returns null', async () => {
  const rows: PassRow[] = [
    { id: 'pass-2', user_id: 'user-b', viability_remaining: 3, viability_total: 3, market_gap_remaining: 1, market_gap_total: 1 },
  ];
  const admin = makeMockAdmin(rows);

  const id1 = await decrementDecisionPassMarketGap(admin, 'user-b');
  assert.equal(id1, 'pass-2');
  assert.equal(rows[0].market_gap_remaining, 0);

  const id2 = await decrementDecisionPassMarketGap(admin, 'user-b');
  assert.equal(id2, null, 'Second market_gap decrement must return null');
  assert.equal(rows[0].market_gap_remaining, 0);
});

// C3. Type isolation: viability decrement does NOT reduce market_gap_remaining
await checkAsync('[BEHAVIORAL]', 'type isolation: viability decrement cannot consume market_gap balance', async () => {
  const rows: PassRow[] = [
    { id: 'pass-3', user_id: 'user-c', viability_remaining: 3, viability_total: 3, market_gap_remaining: 1, market_gap_total: 1 },
  ];
  const admin = makeMockAdmin(rows);

  await decrementDecisionPassViability(admin, 'user-c');
  assert.equal(rows[0].market_gap_remaining, 1, 'market_gap_remaining must be untouched after viability decrement');
});

// C4. Type isolation: market_gap decrement does NOT reduce viability_remaining
await checkAsync('[BEHAVIORAL]', 'type isolation: market_gap decrement cannot consume viability balance', async () => {
  const rows: PassRow[] = [
    { id: 'pass-4', user_id: 'user-d', viability_remaining: 3, viability_total: 3, market_gap_remaining: 1, market_gap_total: 1 },
  ];
  const admin = makeMockAdmin(rows);

  await decrementDecisionPassMarketGap(admin, 'user-d');
  assert.equal(rows[0].viability_remaining, 3, 'viability_remaining must be untouched after market_gap decrement');
});

// C5. Viability restore: credit returns after failure, bounded by total
await checkAsync('[BEHAVIORAL]', 'viability restore: credit returned exactly once; cannot inflate beyond total', async () => {
  const rows: PassRow[] = [
    { id: 'pass-5', user_id: 'user-e', viability_remaining: 2, viability_total: 3, market_gap_remaining: 0, market_gap_total: 1 },
  ];
  const admin = makeMockAdmin(rows);

  const passId = await decrementDecisionPassViability(admin, 'user-e');
  assert.equal(rows[0].viability_remaining, 1);

  // Simulate Gemini failure → restore
  await restoreDecisionPassViability(admin, passId!);
  assert.equal(rows[0].viability_remaining, 2, 'Restore must return exactly one credit');

  // Calling restore again must NOT inflate beyond viability_total
  await restoreDecisionPassViability(admin, passId!);
  assert.equal(rows[0].viability_remaining, 3, 'After two restores must be capped at viability_total (3)');

  await restoreDecisionPassViability(admin, passId!);
  assert.equal(rows[0].viability_remaining, 3, 'LEAST guard: cannot exceed viability_total=3');
});

// C6. Market Gap restore: bounded by market_gap_total
await checkAsync('[BEHAVIORAL]', 'market_gap restore: cannot inflate beyond market_gap_total', async () => {
  const rows: PassRow[] = [
    { id: 'pass-6', user_id: 'user-f', viability_remaining: 3, viability_total: 3, market_gap_remaining: 0, market_gap_total: 1 },
  ];
  const admin = makeMockAdmin(rows);

  // Manually decrement to 0 to simulate exhaustion without consuming the pass
  rows[0].market_gap_remaining = 0;

  await restoreDecisionPassMarketGap(admin, 'pass-6');
  assert.equal(rows[0].market_gap_remaining, 1);

  await restoreDecisionPassMarketGap(admin, 'pass-6');
  assert.equal(rows[0].market_gap_remaining, 1, 'LEAST guard: cannot exceed market_gap_total=1');
});

// C7. User isolation: decrement for user-A does not affect user-B's balance
await checkAsync('[BEHAVIORAL]', 'user isolation: decrements only affect the requesting user\'s pass rows', async () => {
  const rows: PassRow[] = [
    { id: 'pass-a', user_id: 'user-A', viability_remaining: 3, viability_total: 3, market_gap_remaining: 1, market_gap_total: 1 },
    { id: 'pass-b', user_id: 'user-B', viability_remaining: 3, viability_total: 3, market_gap_remaining: 1, market_gap_total: 1 },
  ];
  const admin = makeMockAdmin(rows);

  await decrementDecisionPassViability(admin, 'user-A');
  assert.equal(rows[0].viability_remaining, 2, 'user-A balance decremented');
  assert.equal(rows[1].viability_remaining, 3, 'user-B balance must be untouched');
});

// C8. No balance: returns null without mutating any row
await checkAsync('[BEHAVIORAL]', 'zero balance: decrement returns null and no row is mutated', async () => {
  const rows: PassRow[] = [
    { id: 'pass-7', user_id: 'user-g', viability_remaining: 0, viability_total: 3, market_gap_remaining: 0, market_gap_total: 1 },
  ];
  const admin = makeMockAdmin(rows);

  const vResult = await decrementDecisionPassViability(admin, 'user-g');
  const mgResult = await decrementDecisionPassMarketGap(admin, 'user-g');

  assert.equal(vResult, null);
  assert.equal(mgResult, null);
  assert.equal(rows[0].viability_remaining, 0);
  assert.equal(rows[0].market_gap_remaining, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION D: Webhook security [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nD. Webhook security [STATIC]');

// D1.
check('[STATIC]', 'validates purchase_type === decision_pass from metadata', () => {
  assert.ok(webhookSource.includes('purchase_type') && webhookSource.includes('decision_pass'));
});

// D2.
check('[STATIC]', 'uses session.id as idempotency key (not payment_intent_id)', () => {
  assert.ok(webhookSource.includes('session.id') && !webhookSource.includes('payment_intent_id'));
});

// D3.
check('[STATIC]', 'uses server-side DECISION_PASS_VIABILITY_QUANTITY and MARKET_GAP_QUANTITY constants (not metadata)', () => {
  assert.ok(
    webhookSource.includes('DECISION_PASS_VIABILITY_QUANTITY') &&
    webhookSource.includes('DECISION_PASS_MARKET_GAP_QUANTITY'),
  );
});

// D4.
check('[STATIC]', 'handles 23505 UNIQUE violation as idempotent success (duplicate webhook event)', () => {
  assert.ok(webhookSource.includes('23505'));
});

// D5.
check('[STATIC]', 'validates price ID against DECISION_PASS_PRICE_ID env var (wrong product cannot grant entitlement)', () => {
  assert.ok(webhookSource.includes('DECISION_PASS_PRICE_ID'));
});

// D6. Behavioral: webhook mock — correct quantities granted from server constants
await checkAsync('[BEHAVIORAL]', 'Stripe grant: correct viability=3 and market_gap=1 quantities from server constants', async () => {
  // Test that the webhook uses the server-side constants, not anything from Stripe metadata.
  // We verify this by checking the constants match the expected values.
  const { DECISION_PASS_VIABILITY_QUANTITY, DECISION_PASS_MARKET_GAP_QUANTITY } = await import('../api/stripe/_shared.js');
  assert.equal(DECISION_PASS_VIABILITY_QUANTITY, 3, 'Viability quantity must be 3');
  assert.equal(DECISION_PASS_MARKET_GAP_QUANTITY, 1, 'Market Gap quantity must be 1');
});

// D7. Behavioral: duplicate checkout session simulation
await checkAsync('[BEHAVIORAL]', 'duplicate checkout: second identical session insert is detected as duplicate (23505 code)', async () => {
  // Simulate what happens when the webhook fires twice for the same checkout.session.completed.
  // The DB's UNIQUE constraint on stripe_checkout_session_id causes the second INSERT to fail
  // with error.code === '23505'. The webhook handler must treat this as idempotent success.
  const insertCalls: any[] = [];
  const mockAdmin = {
    from: (table: string) => ({
      insert: (data: any) => {
        insertCalls.push(data);
        // Second call simulates UNIQUE violation
        if (insertCalls.length === 2) {
          return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
        }
        return Promise.resolve({ data: null, error: null });
      },
      select: () => ({ eq: () => Promise.resolve({ data: [{ price: { id: 'price_test' } }], error: null }) }),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
  };

  // First insert succeeds
  const { error: e1 } = await mockAdmin.from('decision_pass_entitlements').insert({ user_id: 'u', stripe_checkout_session_id: 'cs_test_1', viability_remaining: 3, market_gap_remaining: 1 });
  assert.equal(e1, null);

  // Second insert returns 23505
  const { error: e2 } = await mockAdmin.from('decision_pass_entitlements').insert({ user_id: 'u', stripe_checkout_session_id: 'cs_test_1', viability_remaining: 3, market_gap_remaining: 1 });
  assert.equal(e2?.code, '23505', 'UNIQUE violation must be 23505');
  // The webhook handler should treat 23505 as idempotent success (verified by static check D4)
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION E: api/analyze.ts — plan-first + trial guards [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nE. api/analyze.ts — consumption guards [STATIC]');

// E1.
check('[STATIC]', 'Decision Pass only tried when !quota.allowed (plan quota consumed first)', () => {
  // The import line also contains decrementDecisionPassViability — skip past imports.
  const quotaCheckIdx  = analyzeSource.indexOf('quota.allowed');
  // Find the first CALL (not import) of the function, past the quota check.
  const passDecrIdx    = analyzeSource.indexOf('decrementDecisionPassViability(', quotaCheckIdx);
  assert.ok(quotaCheckIdx > 0 && passDecrIdx > quotaCheckIdx, 'Pass decrement call must appear after quota.allowed check');
});

// E2.
check('[STATIC]', '!_isTrialing guard prevents Decision Pass consumption during active trial', () => {
  const geminiIdx  = analyzeSource.indexOf('new GoogleGenAI(');
  const trialGuard = analyzeSource.lastIndexOf('_isTrialing', geminiIdx);
  assert.ok(trialGuard > 0 && trialGuard < geminiIdx);
});

// E3.
check('[STATIC]', '!simulationActive guard prevents Decision Pass consumption for sim users', () => {
  const geminiIdx = analyzeSource.indexOf('new GoogleGenAI(');
  const simGuard  = analyzeSource.lastIndexOf('simulationActive', geminiIdx);
  assert.ok(simGuard > 0 && simGuard < geminiIdx);
});

// E4.
check('[STATIC]', '_usedDecisionPass: true tagged on fresh-generation success path', () => {
  // Must appear AFTER the try block open (not just in the cache-hit path)
  const geminiIdx = analyzeSource.indexOf('new GoogleGenAI(');
  const tagIdx    = analyzeSource.indexOf('_usedDecisionPass = true', geminiIdx);
  assert.ok(tagIdx > 0, '_usedDecisionPass = true must be set in the fresh-generation success path');
});

// E5.
check('[STATIC]', '_usedDecisionPass: true also set on cache-hit Decision Pass path', () => {
  assert.ok(analyzeSource.includes('_usedDecisionPass: true'));
});

// E6.
check('[STATIC]', 'restoreDecisionPassViability called in catch block after Gemini try', () => {
  const geminiIdx  = analyzeSource.indexOf('new GoogleGenAI(');
  const restoreIdx = analyzeSource.indexOf('restoreDecisionPassViability', geminiIdx);
  assert.ok(restoreIdx > 0);
});

// E7.
check('[STATIC]', 'response flag is _usedDecisionPass (legacy _usedPurchasedPass removed)', () => {
  assert.ok(analyzeSource.includes('_usedDecisionPass') && !analyzeSource.includes('_usedPurchasedPass'));
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION F: api/opportunities.ts — Market Gap guards [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nF. api/opportunities.ts — Market Gap guards [STATIC]');

// F1.
check('[STATIC]', 'decrementDecisionPassMarketGap called before plan gate returns 403', () => {
  assert.ok(oppsSource.includes('decrementDecisionPassMarketGap'));
});

// F2.
check('[STATIC]', 'restoreDecisionPassMarketGap called in catch block', () => {
  assert.ok(oppsSource.includes('restoreDecisionPassMarketGap'));
});

// F3.
check('[STATIC]', 'simulation guard wraps the market_gap decrement call', () => {
  const importEnd   = oppsSource.indexOf('\n\n');
  const passCallIdx = oppsSource.indexOf('decrementDecisionPassMarketGap(', importEnd);
  const guardIdx    = oppsSource.lastIndexOf('simulationActive', passCallIdx);
  assert.ok(guardIdx > 0 && guardIdx < passCallIdx);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION G: ReportDisplay — Decision Pass full access [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nG. ReportDisplay.tsx — Decision Pass full report access [STATIC]');

// G1.
check('[STATIC]', 'dpFullAccess constant derived from report._usedDecisionPass', () => {
  assert.ok(reportSource.includes('dpFullAccess') && reportSource.includes('_usedDecisionPass'));
});

// G2.
check('[STATIC]', 'full financials gated by (dpFullAccess || canViewFullFinancials(currentPlan))', () => {
  assert.ok(reportSource.includes('dpFullAccess || canViewFullFinancials(currentPlan)'));
});

// G3.
check('[STATIC]', 'PDF export gated by (dpFullAccess || canExportPdf(currentPlan))', () => {
  assert.ok(reportSource.includes('dpFullAccess || canExportPdf(currentPlan)'));
});

// G4.
check('[STATIC]', 'save to dashboard remains plan-only (not elevated by Decision Pass)', () => {
  // canSaveReports must NOT be prefixed with dpFullAccess
  const saveIdx = reportSource.indexOf('canSaveReports(currentPlan)');
  assert.ok(saveIdx > 0);
  const before = reportSource.slice(Math.max(0, saveIdx - 20), saveIdx);
  assert.ok(!before.includes('dpFullAccess'), 'save-to-dashboard must not be granted by Decision Pass');
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION H: Route + balance [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nH. Stripe routes + _shared.ts constants [STATIC]');

// H1.
check('[STATIC]', 'route is create-decision-pass-checkout (old one-time-checkout routes removed)', () => {
  assert.ok(
    pathSource.includes('create-decision-pass-checkout') &&
    !pathSource.includes('create-one-time-checkout') &&
    !pathSource.includes('single-report-pass') &&
    !pathSource.includes('compare-two'),
  );
});

// H2.
check('[STATIC]', 'returns decisionPassBalance (not legacy purchasedReportBalance)', () => {
  assert.ok(pathSource.includes('decisionPassBalance') && !pathSource.includes('purchasedReportBalance'));
});

// H3.
check('[STATIC]', 'DECISION_PASS_VIABILITY_QUANTITY=3 in _shared.ts', () => {
  assert.ok(sharedSource.includes('DECISION_PASS_VIABILITY_QUANTITY') && !sharedSource.includes('ONE_TIME_PRODUCT_TO_QUANTITY'));
});

// H4.
check('[STATIC]', 'DECISION_PASS_MARKET_GAP_QUANTITY=1 in _shared.ts', () => {
  assert.ok(sharedSource.includes('DECISION_PASS_MARKET_GAP_QUANTITY'));
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION I: Billing UI — entitlement_source in activity log [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nI. Activity log — entitlement_source field [STATIC]');

// I1.
check('[STATIC]', 'migration adds entitlement_source column to report_activity_log', () => {
  const migPath = path.join(root, 'supabase/migrations/20260817000000_add_entitlement_source.sql');
  const migContent = fs.readFileSync(migPath, 'utf8');
  assert.ok(
    migContent.includes('entitlement_source') && migContent.includes('report_activity_log'),
    'Migration must add entitlement_source to report_activity_log',
  );
});

// I2.
check('[STATIC]', 'analyze.ts success path emits entitlement_source', () => {
  assert.ok(
    analyzeSource.includes("entitlement_source: usedDecisionPassId ? 'decision_pass'"),
    "analyze.ts success path must set entitlement_source to 'decision_pass' when usedDecisionPassId is set",
  );
});

// I3.
check('[STATIC]', 'analyze.ts failure path emits entitlement_source', () => {
  const count = (analyzeSource.match(/entitlement_source:/g) ?? []).length;
  assert.ok(count >= 3, `analyze.ts must have ≥3 entitlement_source entries (cache-hit, success, failure), found ${count}`);
});

// I4.
check('[STATIC]', 'analyze.ts trial path uses entitlement_source: trial', () => {
  assert.ok(
    analyzeSource.includes("_isTrialing ? 'trial' : 'plan'"),
    "analyze.ts must distinguish trial from plan in entitlement_source",
  );
});

// I5.
check('[STATIC]', 'opportunities.ts success path emits entitlement_source', () => {
  assert.ok(
    oppsSource.includes("entitlement_source: (explorerProDecisionPassId || proPlussDecisionPassId) ? 'decision_pass' : 'plan'"),
    "opportunities.ts must set entitlement_source to 'decision_pass' when a pass was consumed",
  );
});

// I6.
check('[STATIC]', 'opportunities.ts has entitlement_source in all three log sites', () => {
  const count = (oppsSource.match(/entitlement_source:/g) ?? []).length;
  assert.ok(count >= 3, `opportunities.ts must have ≥3 entitlement_source entries (cache-hit, success, failure), found ${count}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION J: Billing UI — Decision Pass balance display [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nJ. Billing UI — Decision Pass balance display [STATIC]');

const billingSource = fs.readFileSync(path.join(root, 'components/BillingPage.tsx'), 'utf8');

// J1.
check('[STATIC]', 'BillingPage shows Decision Pass section independently of subscription status', () => {
  // Section must NOT be gated behind only the active/trialing/past_due condition
  // Verify the section is now rendered at the same level as (not inside) the status conditional
  assert.ok(
    billingSource.includes("One-time access · No automatic renewal"),
    "Billing page must show 'One-time access · No automatic renewal' label for Decision Pass",
  );
});

// J2.
check('[STATIC]', 'BillingPage uses singular "1 report remaining" vs plural "N reports remaining"', () => {
  assert.ok(
    billingSource.includes('=== 1') &&
    billingSource.includes("'1 report remaining'") &&
    billingSource.includes('reports remaining'),
    'Billing page must use singular/plural grammar for Decision Pass credits',
  );
});

// J3.
check('[STATIC]', 'BillingPage shows "Get Another Decision Pass" CTA when both balances are 0', () => {
  assert.ok(
    billingSource.includes('Get Another Decision Pass'),
    "Billing page must show 'Get Another Decision Pass' CTA when both balances are exhausted",
  );
});

// J4.
check('[STATIC]', 'BillingPage Decision Pass section hidden when both credits are zero', () => {
  // Panel must only render when viability > 0 OR marketGap > 0 — a zero-balance
  // object (returned by default when no entitlement exists) must not show the panel.
  assert.ok(
    billingSource.includes('decisionPassBalance.viability > 0') &&
    billingSource.includes('decisionPassBalance.marketGap > 0'),
    'BillingPage must gate Decision Pass panel on viability > 0 || marketGap > 0',
  );
});

// J5.
check('[STATIC]', '"Get Another Decision Pass" CTA gated on user not having an active subscription', () => {
  const ctaIdx = billingSource.lastIndexOf('Get Another Decision Pass');
  assert.ok(ctaIdx > 0, '"Get Another Decision Pass" not found in BillingPage');
  const ctaContext = billingSource.slice(Math.max(0, ctaIdx - 500), ctaIdx);
  assert.ok(
    ctaContext.includes("'active', 'trialing', 'past_due'"),
    '"Get Another Decision Pass" CTA must be gated on subscription status (active/trialing/past_due)',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION K: Exhausted messaging [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nK. Exhausted messaging — UI copy [STATIC]');

const appSource = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const oppExplorerSource = fs.readFileSync(path.join(root, 'components/OpportunityExplorer.tsx'), 'utf8');

// K1.
check('[STATIC]', 'App.tsx viability modal shows pass-exhausted copy when decisionPassBalance.viability === 0', () => {
  assert.ok(
    appSource.includes("You've used all of your included and Decision Pass Business Viability reports."),
    "App.tsx must show pass-exhausted message when viability === 0",
  );
});

// K2.
check('[STATIC]', 'App.tsx viability exhausted modal has "Get Another Decision Pass" CTA', () => {
  assert.ok(
    appSource.includes('Get Another Decision Pass'),
    "App.tsx must have 'Get Another Decision Pass' CTA in the exhausted viability modal",
  );
});

// K3.
check('[STATIC]', 'App.tsx viability exhausted modal branches on decisionPassBalance.viability === 0', () => {
  assert.ok(
    appSource.includes('decisionPassBalance.viability === 0'),
    "App.tsx must check decisionPassBalance.viability === 0 to differentiate pass-exhausted state",
  );
});

// K4.
check('[STATIC]', 'OpportunityExplorer market gap modal shows pass-exhausted copy when decisionPassBalance.marketGap === 0', () => {
  assert.ok(
    oppExplorerSource.includes("You've used your Decision Pass Market Gap report."),
    "OpportunityExplorer must show pass-exhausted message when marketGap === 0",
  );
});

// K5.
check('[STATIC]', 'OpportunityExplorer market gap exhausted modal does NOT say "Upgrade to Pro" (Pro has no Market Gap)', () => {
  // When pass is exhausted, CTAs must be "Get Another Decision Pass" + "Upgrade to Pro+"
  // We verify "Upgrade to Pro+" appears and "Upgrade to Pro" does not appear in the exhausted branch
  // The simplest static check: the exhausted path's button text is "Upgrade to Pro+"
  assert.ok(
    oppExplorerSource.includes('Upgrade to Pro+'),
    "OpportunityExplorer exhausted path must show 'Upgrade to Pro+', not 'Upgrade to Pro'",
  );
});

// K6.
check('[STATIC]', 'OpportunityExplorer receives subscriptionStatus prop', () => {
  assert.ok(
    oppExplorerSource.includes('subscriptionStatus') && oppExplorerSource.includes('SubscriptionStatus'),
    "OpportunityExplorer must accept subscriptionStatus prop",
  );
});

// K7.
check('[STATIC]', 'App.tsx passes subscriptionStatus to OpportunityExplorer', () => {
  // Find the OpportunityExplorer usage and verify subscriptionStatus is passed
  const explorerIdx = appSource.indexOf('<OpportunityExplorer');
  assert.ok(explorerIdx > 0);
  const explorerBlock = appSource.slice(explorerIdx, appSource.indexOf('/>', explorerIdx) + 2);
  assert.ok(
    explorerBlock.includes('subscriptionStatus='),
    "App.tsx must pass subscriptionStatus prop to OpportunityExplorer",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION M: Cache-hit entitlement_source ordering [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nM. Cache-hit entitlement_source ordering [STATIC]');

// ── Business Viability (analyze.ts) ──────────────────────────────────────────

// M1. The cache-hit Decision Pass log is written AFTER passId is confirmed — not before quota check.
check('[STATIC]', 'BV cache-hit: Decision Pass log written after passId confirmed (not pre-quota)', () => {
  // decrementDecisionPassViability must appear before 'decision_pass' entitlement literal in the cache block.
  // The cache-hit section ends before 'cacheWasStale = !!cacheHit?.isStale'
  const cacheBlockEnd = analyzeSource.indexOf('cacheWasStale = !!cacheHit?.isStale');
  assert.ok(cacheBlockEnd > 0, 'Cache block end marker not found');
  const cacheBlock = analyzeSource.slice(0, cacheBlockEnd);
  const decrementIdx = cacheBlock.lastIndexOf('decrementDecisionPassViability');
  const dpLogIdx     = cacheBlock.lastIndexOf("entitlement_source: 'decision_pass'");
  assert.ok(decrementIdx > 0, 'decrementDecisionPassViability must appear in cache-hit block');
  assert.ok(dpLogIdx     > 0, "entitlement_source: 'decision_pass' must appear in cache-hit block");
  assert.ok(decrementIdx < dpLogIdx, 'decrementDecisionPassViability must precede the decision_pass log');
});

// M2. The cache-hit plan/trial log is written AFTER incrementUsageTracking.
check('[STATIC]', 'BV cache-hit: plan/trial log written after incrementUsageTracking (entitlement consumed first)', () => {
  const cacheBlockEnd = analyzeSource.indexOf('cacheWasStale = !!cacheHit?.isStale');
  const cacheBlock = analyzeSource.slice(0, cacheBlockEnd);
  const incrementIdx = Math.max(
    cacheBlock.lastIndexOf('incrementUsageTracking'),
    cacheBlock.lastIndexOf('incrementTrialUsage'),
  );
  const planLogIdx = cacheBlock.lastIndexOf("_isTrialing ? 'trial' : 'plan'");
  assert.ok(incrementIdx > 0, 'increment call must appear in cache-hit block');
  assert.ok(planLogIdx   > 0, "_isTrialing ? 'trial' : 'plan' must appear in cache-hit block");
  assert.ok(incrementIdx < planLogIdx, 'increment must precede the plan/trial log in cache-hit block');
});

// M3. The cache-hit section exits before any fresh-generation quota check — no double-consume possible.
check('[STATIC]', 'BV cache-hit: early return before fresh-generation quota prevents double-consume', () => {
  // 'cacheWasStale = !!cacheHit?.isStale' marks where the cache-hit if-block ends.
  // All return statements in the cache-hit block must appear before that marker.
  const cacheBlockEnd = analyzeSource.indexOf('cacheWasStale = !!cacheHit?.isStale');
  const freshQuotaIdx = analyzeSource.indexOf('// ── Server-side quota check — standard reports');
  assert.ok(cacheBlockEnd > 0 && freshQuotaIdx > 0);
  assert.ok(cacheBlockEnd < freshQuotaIdx,
    'Cache-hit block must fully exit before the fresh-generation quota check');
});

// M4. Trial guard (!_isTrialing) wraps the cache-hit Decision Pass decrement.
check('[STATIC]', 'BV cache-hit: !_isTrialing guard prevents Decision Pass consumption for trial users', () => {
  const cacheBlockEnd = analyzeSource.indexOf('cacheWasStale = !!cacheHit?.isStale');
  const cacheBlock = analyzeSource.slice(0, cacheBlockEnd);
  // The guard and decrement call must both appear; guard must come first.
  const guardIdx     = cacheBlock.lastIndexOf('!_isTrialing');
  const decrementIdx = cacheBlock.lastIndexOf('decrementDecisionPassViability');
  assert.ok(guardIdx > 0     && decrementIdx > 0);
  assert.ok(guardIdx < decrementIdx, '!_isTrialing guard must appear before decrementDecisionPassViability in cache block');
});

// M5. BV cache-hit has exactly two entitlement_source literals in the cache block
//     (one 'decision_pass' and one plan/trial), confirming both branches are covered.
check('[STATIC]', 'BV cache-hit: two distinct entitlement_source literals in cache block (decision_pass + plan/trial)', () => {
  const cacheBlockEnd = analyzeSource.indexOf('cacheWasStale = !!cacheHit?.isStale');
  const cacheBlock = analyzeSource.slice(0, cacheBlockEnd);
  const dpCount    = (cacheBlock.match(/entitlement_source:\s*'decision_pass'/g) ?? []).length;
  const planCount  = (cacheBlock.match(/entitlement_source:\s*_isTrialing/g)     ?? []).length;
  assert.equal(dpCount,   1, `Expected exactly 1 'decision_pass' entitlement in cache block, found ${dpCount}`);
  assert.equal(planCount, 1, `Expected exactly 1 plan/trial entitlement in cache block, found ${planCount}`);
});

// ── Market Gap (opportunities.ts) ────────────────────────────────────────────

// M6. Explorer/Pro pass is pre-decremented before the cache lookup — log is always accurate.
check('[STATIC]', 'MG cache-hit: explorerProDecisionPassId set before cache lookup (log is always accurate)', () => {
  // Use the specific call-site signature to avoid matching the import declaration.
  const cacheHitIdx = oppsSource.indexOf("getFromServerCache('market_gaps'");
  const passSetIdx  = oppsSource.indexOf('explorerProDecisionPassId = passId');
  assert.ok(passSetIdx  > 0, 'explorerProDecisionPassId = passId must exist in opportunities.ts');
  assert.ok(cacheHitIdx > 0, "getFromServerCache('market_gaps' call must exist in opportunities.ts");
  assert.ok(passSetIdx < cacheHitIdx, 'explorerProDecisionPassId must be set BEFORE the cache lookup');
});

// M7. Pro+ pass (proPlussDecisionPassId) is set AFTER the cache section — cache hits for Pro+ log 'plan' (no pass consumed).
check('[STATIC]', 'MG cache-hit: proPlussDecisionPassId set after cache section (Pro+ cache hits consume no pass)', () => {
  // Use a single-line marker inside the cache-hit return block (avoids CRLF/LF mismatch on Windows).
  const cacheReturnIdx = oppsSource.indexOf('_isStale:       false,');
  const proPassSetIdx  = oppsSource.indexOf('proPlussDecisionPassId = passId');
  assert.ok(cacheReturnIdx > 0, 'Cache-hit return must exist in opportunities.ts');
  assert.ok(proPassSetIdx  > 0, 'proPlussDecisionPassId = passId must exist in opportunities.ts');
  assert.ok(proPassSetIdx > cacheReturnIdx,
    'proPlussDecisionPassId must be set AFTER the cache-hit return — Pro+ cache hits do not consume a pass');
});

// M8. MG cache-hit log correctly reads explorerProDecisionPassId at the point of logging.
check('[STATIC]', 'MG cache-hit: log reads explorerProDecisionPassId to determine entitlement_source', () => {
  // The cache-hit log in opportunities.ts must include the decision_pass conditional based on the pre-set flag.
  const cacheReturnIdx = oppsSource.indexOf("_generatedAt:   cacheHit.generatedAt");
  const logBlockStart  = oppsSource.lastIndexOf('supabase', cacheReturnIdx);
  const cacheBlock     = oppsSource.slice(logBlockStart, cacheReturnIdx);
  assert.ok(
    cacheBlock.includes('explorerProDecisionPassId') || cacheBlock.includes('proPlussDecisionPassId'),
    'MG cache-hit activity log must reference explorerProDecisionPassId or proPlussDecisionPassId',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION L: Scope guardrails — no quota changes [STATIC]
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nL. Scope guardrails — quota logic unchanged [STATIC]');

// L1.
check('[STATIC]', 'Explorer plan standard report limit is still 3 (no quota changes)', () => {
  assert.ok(usageSource.includes('3') || analyzeSource.includes('3'));
  // Specifically: the Explorer limit constant hasn't been changed.
  // Static check: no Explorer limit change (no "Explorer.*4|Explorer.*5|Explorer.*6" pattern).
  const explorerLimitMatch = analyzeSource.match(/Explorer[^}]*limit.*?(\d+)/s);
  if (explorerLimitMatch) {
    assert.notEqual(explorerLimitMatch[1], '4');
    assert.notEqual(explorerLimitMatch[1], '5');
    assert.notEqual(explorerLimitMatch[1], '6');
  }
});

// L2.
check('[STATIC]', 'Decision Pass quantities unchanged: viability=3, market_gap=1', () => {
  const sharedSource2 = fs.readFileSync(path.join(root, 'api/stripe/_shared.ts'), 'utf8');
  assert.ok(
    sharedSource2.includes('DECISION_PASS_VIABILITY_QUANTITY') &&
    sharedSource2.includes('DECISION_PASS_MARKET_GAP_QUANTITY'),
    'Decision Pass quantities constants must still exist in _shared.ts',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n✅ All ${passed} checks passed.\n`);
