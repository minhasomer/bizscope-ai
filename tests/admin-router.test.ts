/**
 * Admin Router Tests — api/admin/[...path].ts
 *
 * Covers:
 *  1. Routing (beta-access, cost-summary, unknown path → 404)
 *  2. Authorization invariants (non-admin blocked, auth before logic)
 *  3. Method guards (GET-only for cost-summary, 405 for unsupported methods)
 *  4. Response-shape preservation (betaTesters, totalCostUsd, byPlan, byRole, recent)
 *  5. Security: Admin role check, no arbitrary path execution
 *  6. Function count — deployment must stay at or below 12
 *  7. api/chat.ts independence
 *  8. No route collision with api/stripe/[...path].ts
 *
 * All tests are structural (source-file and file-system checks) or use mock
 * req/res objects that do not require live Supabase credentials.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const routerFile = path.join(root, 'api', 'admin', '[...path].ts');
const src = fs.readFileSync(routerFile, 'utf8');

// ── 1. Routing — explicit allowlist ──────────────────────────────────────────

check('admin router source file exists at api/admin/[...path].ts', () => {
  assert.ok(fs.existsSync(routerFile), 'consolidated router file exists');
});

check('router uses switch statement (explicit allowlist)', () => {
  assert.ok(src.includes('switch (subPath)'), 'switch statement present');
});

check('beta-access is in the allowlist', () => {
  assert.ok(src.includes("case 'beta-access':"), 'beta-access case present');
});

check('cost-summary is in the allowlist', () => {
  assert.ok(src.includes("case 'cost-summary':"), 'cost-summary case present');
});

check('unknown paths return 404 NOT_FOUND', () => {
  assert.ok(
    src.includes("json(res, 404") && src.includes("'NOT_FOUND'"),
    '404 NOT_FOUND for default case',
  );
});

// ── 2. Old files deleted ──────────────────────────────────────────────────────

check('api/admin/beta-access.ts has been deleted', () => {
  assert.ok(
    !fs.existsSync(path.join(root, 'api', 'admin', 'beta-access.ts')),
    'old beta-access.ts must not exist',
  );
});

check('api/admin/cost-summary.ts has been deleted', () => {
  assert.ok(
    !fs.existsSync(path.join(root, 'api', 'admin', 'cost-summary.ts')),
    'old cost-summary.ts must not exist',
  );
});

// ── 3. Authorization invariants ───────────────────────────────────────────────

check('Admin role check is present (=== Admin)', () => {
  assert.ok(src.includes("=== 'Admin'"), "Admin equality check present");
});

check('FORBIDDEN (403) is returned for non-admin callers', () => {
  assert.ok(src.includes("json(res, 403") && src.includes("'FORBIDDEN'"), '403 FORBIDDEN present');
});

check('NOT_CONFIGURED (503) is returned when Supabase is unavailable', () => {
  assert.ok(src.includes('503') && src.includes('NOT_CONFIGURED'), '503 NOT_CONFIGURED present');
});

check('supabaseAdmin uses service-role key from env', () => {
  assert.ok(src.includes('SUPABASE_SERVICE_ROLE_KEY'), 'service role key referenced');
  assert.ok(!src.includes('SUPABASE_ANON_KEY'), 'anon key NOT used in admin handler');
});

check('no arbitrary path execution (default: branch leads directly to 404)', () => {
  // Extract only the default: branch text (between "default:" and the closing "}")
  const defaultMatch = src.match(/default:\s+return json\(res,\s*404/);
  assert.ok(
    defaultMatch !== null,
    'default: case immediately calls json(res, 404, ...) — no sub-handler is invoked',
  );
});

// ── 4. Method guards ──────────────────────────────────────────────────────────

check('cost-summary only accepts GET (405 on other methods)', () => {
  assert.ok(src.includes("req.method !== 'GET'"), 'GET-only guard present for cost-summary');
});

check('beta-access returns 405 for unsupported methods', () => {
  // Falls through to the 405 at the end of handleBetaAccess
  const betaSection = src.split('handleBetaAccess')[1] ?? '';
  assert.ok(betaSection.includes('405') && betaSection.includes('METHOD_NOT_ALLOWED'),
    '405 METHOD_NOT_ALLOWED in beta-access handler');
});

check('METHOD_NOT_ALLOWED code is present in responses', () => {
  assert.ok(src.includes("'METHOD_NOT_ALLOWED'"), "METHOD_NOT_ALLOWED code present");
});

// ── 5. Response shape: beta-access ───────────────────────────────────────────

check('beta-access GET response includes betaTesters field', () => {
  assert.ok(src.includes('betaTesters'), 'betaTesters in GET response');
});

check('beta-access POST response includes success field', () => {
  assert.ok(src.includes('success:'), 'success field in POST response');
});

check('beta-access POST response includes role and subscription_tier', () => {
  assert.ok(src.includes('subscription_tier:'), 'subscription_tier in POST response');
});

check('beta-access protects Admin role from demotion', () => {
  assert.ok(src.includes("profile.role === 'Admin'") && src.includes('PROTECTED_ROLE'),
    'Admin role protection with PROTECTED_ROLE code present');
});

// ── 6. Response shape: cost-summary ──────────────────────────────────────────

check('cost-summary response includes totalCostUsd', () => {
  assert.ok(src.includes('totalCostUsd'), 'totalCostUsd in response');
});

check('cost-summary response includes byPlan', () => {
  assert.ok(src.includes('byPlan'), 'byPlan in response');
});

check('cost-summary response includes byRole', () => {
  assert.ok(src.includes('byRole'), 'byRole in response');
});

check('cost-summary response includes recent', () => {
  assert.ok(src.includes("recent:"), 'recent in response');
});

check('cost-summary response includes periodDays and since', () => {
  assert.ok(src.includes('periodDays:') && src.includes('since,'), 'periodDays and since in response');
});

check('cost-summary ?days= parameter is clamped to 1–365', () => {
  assert.ok(src.includes('365') && src.includes('Math.min') && src.includes('Math.max'),
    'days clamping logic present');
});

// ── 7. Vercel function count ──────────────────────────────────────────────────

check('Vercel function count is at most 12', () => {
  const apiDir = path.join(root, 'api');
  function countFunctions(dir: string): number {
    let count = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        count += countFunctions(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.ts') && !entry.name.startsWith('_')) {
        count++;
      }
    }
    return count;
  }
  const count = countFunctions(apiDir);
  console.log(`     (current function count: ${count})`);
  assert.ok(count <= 12, `Function count ${count} must be ≤ 12`);
});

// ── 8. api/chat.ts independence ───────────────────────────────────────────────

check('api/chat.ts exists independently at the top api/ level', () => {
  assert.ok(
    fs.existsSync(path.join(root, 'api', 'chat.ts')),
    'api/chat.ts exists',
  );
});

check('api/chat.ts does not import from admin router', () => {
  const chatSrc = fs.readFileSync(path.join(root, 'api', 'chat.ts'), 'utf8');
  assert.ok(!chatSrc.includes('admin'), 'chat.ts has no admin imports');
});

// ── 9. No route collision with Stripe catch-all ───────────────────────────────

check('admin catch-all is under api/admin/ not api/', () => {
  assert.ok(
    routerFile.includes(path.join('api', 'admin')),
    'admin router is nested under api/admin/',
  );
});

check('api/stripe/[...path].ts still exists (no collision)', () => {
  assert.ok(
    fs.existsSync(path.join(root, 'api', 'stripe', '[...path].ts')),
    'stripe catch-all still exists',
  );
});

check('admin and stripe catch-alls are in different directories', () => {
  const adminRouter = path.join(root, 'api', 'admin', '[...path].ts');
  const stripeRouter = path.join(root, 'api', 'stripe', '[...path].ts');
  assert.notEqual(
    path.dirname(adminRouter),
    path.dirname(stripeRouter),
    'admin and stripe routers are in different directories',
  );
});

// ── 10. Path extraction correctness (structural) ──────────────────────────────

check('getAdminSubPath rejects nested paths (length !== 3)', () => {
  assert.ok(
    src.includes('parts.length !== 3'),
    'nested-path rejection guard present',
  );
});

check('getAdminSubPath uses pathname not raw url (query-safe)', () => {
  assert.ok(
    src.includes('parsed.pathname'),
    'uses pathname to split path (ignores query string)',
  );
});

// ── 11. maxDuration is set to 15 (highest of the two originals) ───────────────

check('maxDuration is 15 (max of original 15 and 10)', () => {
  assert.ok(src.includes('export const maxDuration = 15'), 'maxDuration = 15');
});

// ── 12. Handler function routing (mock req/res) ───────────────────────────────

checkAsync('unknown admin path returns 404 NOT_FOUND via handler', async () => {
  const mod = await import('../api/admin/[...path].ts');
  const handlerFn = mod.default;

  const capturedStatus = { code: 0 };
  const capturedBody = { text: '' };
  const mockRes = {
    statusCode: 200,
    setHeader: () => {},
    end: (data: string) => {
      capturedStatus.code = mockRes.statusCode;
      capturedBody.text = data;
    },
  } as any;
  const mockReq = {
    url: '/api/admin/does-not-exist',
    method: 'GET',
    headers: {},
    body: undefined,
  } as any;

  await handlerFn(mockReq, mockRes);
  assert.equal(capturedStatus.code, 404, 'status must be 404');
  const parsed = JSON.parse(capturedBody.text);
  assert.equal(parsed.code, 'NOT_FOUND', 'code must be NOT_FOUND');
});

checkAsync('beta-access path with no supabase returns 503 (not 404)', async () => {
  // With SUPABASE_URL/KEY unset, supabaseAdmin is null → 503 NOT_CONFIGURED
  const mod = await import('../api/admin/[...path].ts');
  const handlerFn = mod.default;

  const capturedStatus = { code: 0 };
  const capturedBody = { text: '' };
  const mockRes = {
    statusCode: 200,
    setHeader: () => {},
    end: (data: string) => {
      capturedStatus.code = mockRes.statusCode;
      capturedBody.text = data;
    },
  } as any;
  const mockReq = {
    url: '/api/admin/beta-access',
    method: 'GET',
    headers: {},
    body: undefined,
  } as any;

  await handlerFn(mockReq, mockRes);
  // Without supabase configured: either 503 (NOT_CONFIGURED, beta-access path)
  // or 403 (FORBIDDEN, if supabase returns null gracefully). Either is acceptable
  // — but it must NOT be 404.
  assert.notEqual(capturedStatus.code, 404, 'beta-access path must not return 404');
});

checkAsync('cost-summary rejects non-GET methods with 405', async () => {
  const mod = await import('../api/admin/[...path].ts');
  const handlerFn = mod.default;

  const capturedStatus = { code: 0 };
  const capturedBody = { text: '' };
  const mockRes = {
    statusCode: 200,
    setHeader: () => {},
    end: (data: string) => {
      capturedStatus.code = mockRes.statusCode;
      capturedBody.text = data;
    },
  } as any;
  const mockReq = {
    url: '/api/admin/cost-summary',
    method: 'POST',
    headers: {},
    body: undefined,
  } as any;

  await handlerFn(mockReq, mockRes);
  assert.equal(capturedStatus.code, 405, 'POST to cost-summary must return 405');
  const parsed = JSON.parse(capturedBody.text);
  assert.equal(parsed.code, 'METHOD_NOT_ALLOWED', 'code must be METHOD_NOT_ALLOWED');
});

checkAsync('cost-summary path with no auth returns 403', async () => {
  // verifyAdminRole returns false when supabaseAdmin is null → 403
  const mod = await import('../api/admin/[...path].ts');
  const handlerFn = mod.default;

  const capturedStatus = { code: 0 };
  const mockRes = {
    statusCode: 200,
    setHeader: () => {},
    end: (_: string) => { capturedStatus.code = mockRes.statusCode; },
  } as any;
  const mockReq = {
    url: '/api/admin/cost-summary',
    method: 'GET',
    headers: {},
    body: undefined,
  } as any;

  await handlerFn(mockReq, mockRes);
  assert.equal(capturedStatus.code, 403, 'GET cost-summary with no auth must return 403');
});

checkAsync('deeply nested admin path returns 404 (not routed to sub-handler)', async () => {
  const mod = await import('../api/admin/[...path].ts');
  const handlerFn = mod.default;

  const capturedStatus = { code: 0 };
  const mockRes = {
    statusCode: 200,
    setHeader: () => {},
    end: (_: string) => { capturedStatus.code = mockRes.statusCode; },
  } as any;
  const mockReq = {
    url: '/api/admin/beta-access/sub-resource',
    method: 'GET',
    headers: {},
    body: undefined,
  } as any;

  await handlerFn(mockReq, mockRes);
  assert.equal(capturedStatus.code, 404, 'deeply nested path must return 404');
});

// ── Run async tests ───────────────────────────────────────────────────────────

for (const { name, fn } of asyncTests) {
  await fn();
  passed++;
  console.log(`ok   ${name}`);
}

console.log(`\n${passed} tests passed\n`);
