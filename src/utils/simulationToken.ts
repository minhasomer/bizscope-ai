/**
 * simulationToken.ts
 *
 * Server-side only — uses node:crypto.
 * Do NOT import this from any client (browser) component.
 *
 * Signs and verifies short-lived Admin simulation tokens for the
 * Preview-only "Test as User" feature.
 *
 * Token format: base64url(JSON payload) + "." + base64url(HMAC-SHA256)
 * Secret:       ADMIN_SIM_SECRET env var (Preview only — never Production)
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

// ─── Allowlists ────────────────────────────────────────────────────────────────

export const SIMULATION_PERSONAS = [
  'Admin', 'Anonymous', 'Explorer', 'Pro', 'ProPlus', 'Enterprise', 'BetaTester',
] as const;
export type SimPersona = typeof SIMULATION_PERSONAS[number];

export const SUBSCRIPTION_STATES = [
  'none', 'active', 'trialing', 'past_due', 'canceled',
] as const;
export type SubState = typeof SUBSCRIPTION_STATES[number];

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SimulationPayload {
  persona: SimPersona;
  standardUsed: number;
  regionalUsed: number;
  anonPreviewConsumed: boolean;
  subscriptionState: SubState;
  betaFullAccess: boolean;
  exp: number;  // Unix timestamp (seconds)
  iat: number;  // Issued-at (seconds)
}

export interface SimulationContext extends SimulationPayload {
  /** Resolved effective plan (e.g. 'Pro+') — derived from persona + state. */
  effectivePlan: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 hours
export const SIM_TOKEN_HEADER  = 'x-sim-token';

// ─── Base64url helpers ─────────────────────────────────────────────────────────

function b64url(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4);
  const base64 = (s + (pad < 4 ? '='.repeat(pad) : ''))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

function hmacSha256(secret: string, data: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

// ─── Sign ──────────────────────────────────────────────────────────────────────

export function signSimulationToken(
  payload: Omit<SimulationPayload, 'exp' | 'iat'>,
  secret: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const full: SimulationPayload = { ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS };
  const encoded = b64url(Buffer.from(JSON.stringify(full), 'utf8'));
  const sig     = b64url(hmacSha256(secret, encoded));
  return `${encoded}.${sig}`;
}

// ─── Verify ────────────────────────────────────────────────────────────────────

export function verifySimulationToken(
  token: string,
  secret: string,
): SimulationPayload | null {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const encoded = token.slice(0, dot);
    const sig     = token.slice(dot + 1);

    // Constant-time signature check
    const expectedSig = b64url(hmacSha256(secret, encoded));
    const sigBuf      = b64urlDecode(sig);
    const expectedBuf = b64urlDecode(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = JSON.parse(b64urlDecode(encoded).toString('utf8')) as SimulationPayload;

    // Expiry
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;

    // Allowlist validation
    if (!(SIMULATION_PERSONAS as readonly string[]).includes(payload.persona)) return null;
    if (!(SUBSCRIPTION_STATES as readonly string[]).includes(payload.subscriptionState)) return null;

    // Type guards on numeric fields
    if (typeof payload.standardUsed !== 'number' || payload.standardUsed < 0) return null;
    if (typeof payload.regionalUsed !== 'number' || payload.regionalUsed < 0) return null;
    if (typeof payload.betaFullAccess !== 'boolean') return null;
    if (typeof payload.anonPreviewConsumed !== 'boolean') return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Plan resolution ───────────────────────────────────────────────────────────

function personaToPlan(
  persona: SimPersona,
  subscriptionState: SubState,
  betaFullAccess: boolean,
): string {
  // Canceled subscription demotes to Explorer unless Admin or Enterprise persona.
  // A canceled Pro or ProPlus user loses paid features.
  if (
    subscriptionState === 'canceled' &&
    persona !== 'Admin' &&
    persona !== 'Enterprise'
  ) {
    return 'Explorer';
  }

  // Beta full-access flag elevates any non-Anonymous authenticated user to Pro+.
  if (betaFullAccess && persona !== 'Anonymous') return 'Pro+';

  switch (persona) {
    case 'Admin':      return 'Enterprise';  // Admin bypass is suspended server-side
    case 'Explorer':   return 'Explorer';
    case 'Pro':        return 'Pro';
    case 'ProPlus':    return 'Pro+';
    case 'Enterprise': return 'Enterprise';
    case 'BetaTester': return 'Pro+';
    case 'Anonymous':  return 'Explorer';    // Treated as unauthenticated by product endpoints
    default:           return 'Explorer';
  }
}

export function resolveSimulationContext(payload: SimulationPayload): SimulationContext {
  return {
    ...payload,
    effectivePlan: personaToPlan(payload.persona, payload.subscriptionState, payload.betaFullAccess),
  };
}

// ─── Request helper ────────────────────────────────────────────────────────────

/**
 * Reads and validates the X-Sim-Token header from an incoming request.
 *
 * Returns null if:
 *  - ADMIN_SIMULATION_ENABLED is not 'true' (production guard)
 *  - ADMIN_SIM_SECRET is not set
 *  - No token header present
 *  - Token is invalid, tampered, or expired
 */
export function getSimulationContext(
  headers: Record<string, string | string[] | undefined>,
): SimulationContext | null {
  // Production guard — must be explicitly enabled in Preview
  if (process.env.ADMIN_SIMULATION_ENABLED !== 'true') return null;

  const secret = process.env.ADMIN_SIM_SECRET;
  if (!secret) return null;

  const raw = headers[SIM_TOKEN_HEADER];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token) return null;

  const payload = verifySimulationToken(token, secret);
  if (!payload) return null;

  return resolveSimulationContext(payload);
}
