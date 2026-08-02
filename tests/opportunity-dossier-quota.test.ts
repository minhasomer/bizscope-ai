/**
 * Behavioral tests for the opportunity-dossier regional quota enforcement.
 *
 * Run standalone (no test runner required):
 *   npx tsx tests/opportunity-dossier-quota.test.ts
 * Exits non-zero on the first failed assertion.
 *
 * Coverage:
 *   1-4.  checkRegionalQuota blocks/allows at plan-specific limits
 *   5-6.  betaFullAccess bypasses quota for Pro and Pro+
 *   7-8.  Quota fails open on DB errors (never blocks on infra failure)
 *   9-12. Structural source guards on opportunity-dossier.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRegionalQuota } from '../src/config/usageTracking';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot  = path.resolve(__dirname, '..');

// Fluent Supabase mock: .from().select().eq().eq().eq().maybeSingle()
function mockDb(count: number | null, error: unknown = null) {
  const leaf = { maybeSingle: async () => ({ data: count !== null ? { count } : null, error }) };
  const eqable: any = { eq: () => eqable, maybeSingle: leaf.maybeSingle };
  return { from: () => ({ select: () => eqable }) };
}

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

// ── 1. Pro plan: regional quota always blocked (limit=0) ─────────────────────

checkAsync('1. Pro: regional quota always blocked (limit=0, used=0)', async () => {
  const r = await checkRegionalQuota(mockDb(0), 'uid', 'Pro', false);
  assert.equal(r.allowed, false, 'Pro must be blocked by regional quota');
  assert.equal(r.limit,   0,    'Pro regional limit must be 0');
  assert.equal(r.used,    0);
});

// ── 2. Pro+ plan: allowed below limit ─────────────────────────────────────────

checkAsync('2. Pro+: allowed at used=9 (under 10-report limit)', async () => {
  const r = await checkRegionalQuota(mockDb(9), 'uid', 'Pro+', false);
  assert.equal(r.allowed, true, 'Pro+ must be allowed at used=9');
  assert.equal(r.limit,   10);
  assert.equal(r.used,    9);
});

// ── 3. Pro+ plan: blocked at limit ────────────────────────────────────────────

checkAsync('3. Pro+: blocked at used=10 (at limit)', async () => {
  const r = await checkRegionalQuota(mockDb(10), 'uid', 'Pro+', false);
  assert.equal(r.allowed, false, 'Pro+ must be blocked when used=limit=10');
  assert.equal(r.limit,   10);
  assert.equal(r.used,    10);
});

// ── 4. Enterprise plan: always allowed ────────────────────────────────────────

checkAsync('4. Enterprise: always allowed regardless of usage (limit=null)', async () => {
  const r = await checkRegionalQuota(mockDb(9999), 'uid', 'Enterprise', false);
  assert.equal(r.allowed, true,  'Enterprise must never be blocked by regional quota');
  assert.equal(r.limit,   null,  'Enterprise regional limit must be null (unlimited)');
});

// ── 5. betaFullAccess bypasses quota for Pro+ at limit ────────────────────────

checkAsync('5. betaFullAccess=true: Pro+ at used=10 still allowed', async () => {
  const r = await checkRegionalQuota(mockDb(10), 'uid', 'Pro+', true);
  assert.equal(r.allowed, true, 'betaFullAccess must bypass Pro+ quota even when used=limit');
  assert.equal(r.used,    10);
});

// ── 6. betaFullAccess bypasses quota for Pro (normally limit=0) ───────────────

checkAsync('6. betaFullAccess=true: Pro at used=0 allowed despite limit=0', async () => {
  const r = await checkRegionalQuota(mockDb(0), 'uid', 'Pro', true);
  assert.equal(r.allowed, true, 'betaFullAccess must bypass Pro regional quota (limit=0 normally blocks)');
});

// ── 7. Quota fails open when supabaseAdmin is null ────────────────────────────

checkAsync('7. Quota fails open when supabaseAdmin is null (infra not configured)', async () => {
  const r = await checkRegionalQuota(null, 'uid', 'Pro+', false);
  assert.equal(r.allowed, true, 'regional quota must fail open when supabaseAdmin is null');
});

// ── 8. Quota fails open on Supabase DB error ──────────────────────────────────

checkAsync('8. Quota fails open on Supabase error (never blocks on infra failure)', async () => {
  const r = await checkRegionalQuota(mockDb(null, new Error('connection timeout')), 'uid', 'Pro+', false);
  assert.equal(r.allowed, true, 'regional quota must fail open on DB error');
});

// ── 9. Structural: checkRegionalQuota imported in opportunity-dossier.ts ──────

check('9. opportunity-dossier.ts: checkRegionalQuota is imported from usageTracking', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'opportunity-dossier.ts'), 'utf8');
  assert.ok(
    src.includes('checkRegionalQuota'),
    'opportunity-dossier.ts must import checkRegionalQuota',
  );
  assert.ok(
    /import\s*\{[^}]*checkRegionalQuota[^}]*\}\s*from\s*['"][^'"]*usageTracking/.test(src),
    'checkRegionalQuota must be imported from usageTracking',
  );
});

// ── 10. Structural: quota check precedes Gemini generateContent ───────────────

check('10. opportunity-dossier.ts: quota check precedes generateContent call', () => {
  const src      = fs.readFileSync(path.join(repoRoot, 'api', 'opportunity-dossier.ts'), 'utf8');
  const quotaIdx = src.indexOf('checkRegionalQuota(');
  const genIdx   = src.indexOf('ai.models.generateContent(');
  assert.ok(quotaIdx !== -1, 'checkRegionalQuota call not found in opportunity-dossier.ts');
  assert.ok(genIdx   !== -1, 'generateContent call not found in opportunity-dossier.ts');
  assert.ok(quotaIdx < genIdx, 'quota check must precede generateContent (no Gemini call before quota is verified)');
});

// ── 11. Structural: QUOTA_EXCEEDED gate precedes usage increment ──────────────

check("11. opportunity-dossier.ts: QUOTA_EXCEEDED gate precedes incrementUsageTracking", () => {
  const src          = fs.readFileSync(path.join(repoRoot, 'api', 'opportunity-dossier.ts'), 'utf8');
  const quotaGateIdx = src.indexOf("code: 'QUOTA_EXCEEDED'");
  const incrementIdx = src.indexOf("incrementUsageTracking(");
  assert.ok(quotaGateIdx !== -1, "QUOTA_EXCEEDED code not found in opportunity-dossier.ts");
  assert.ok(incrementIdx !== -1, "incrementUsageTracking not found in opportunity-dossier.ts");
  assert.ok(
    quotaGateIdx < incrementIdx,
    'QUOTA_EXCEEDED gate must appear before incrementUsageTracking (increment must never execute on quota refusal)',
  );
});

// ── 12. Structural: regional increment in success path, not after success return ─
//
// The success path ends with `return json(res, 200, normalized)`.
// The regional increment must appear before that return, proving it is inside
// the generation try-block and not in the error-path catch block.

check("12. opportunity-dossier.ts: 'regional' increment precedes the success return (not in error path)", () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'opportunity-dossier.ts'), 'utf8');

  const regionalIdx  = src.indexOf("incrementUsageTracking(supabaseAdmin, verifiedUserId, 'regional')");
  const successReturnIdx = src.indexOf('return json(res, 200, normalized)');
  assert.ok(regionalIdx     !== -1, "incrementUsageTracking with 'regional' not found in opportunity-dossier.ts");
  assert.ok(successReturnIdx !== -1, "'return json(res, 200, normalized)' not found — success return missing");
  assert.ok(
    regionalIdx < successReturnIdx,
    "regional increment must appear before 'return json(res, 200, normalized)' (must be in success path)",
  );

  // The error-path catch block starts after the success return.
  // Verify 'regional' does not appear anywhere after the success return.
  const afterSuccess = src.slice(successReturnIdx + 'return json(res, 200, normalized)'.length);
  assert.ok(
    !afterSuccess.includes("'regional'"),
    "error-path catch block must not contain 'regional' — failed generations must not consume quota",
  );
});

// ── Run async tests, then report ──────────────────────────────────────────────

for (const { name, fn } of asyncTests) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL ${name}: ${msg}`);
    process.exit(1);
  }
}

console.log(`\n${passed} test(s) passed.`);
