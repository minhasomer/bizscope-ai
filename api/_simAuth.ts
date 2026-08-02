/**
 * _simAuth.ts — Server-only simulation auth helper.
 *
 * Centralizes simulation context resolution for all product endpoints.
 * Must be called AFTER verifyAndGetPlan() so the real user identity is established.
 *
 * The centralized Admin identity check enforces that only a real Admin's request
 * can activate simulation, preventing token replay by non-Admin users.
 */

import { getSimulationContext } from '../src/utils/simulationToken.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SimAuthResult {
  realUserId: string | null;
  realRole: string;
  isRealAdmin: boolean;
  simulationActive: boolean;
  effectivePlan: string;
  effectivePersona: string | null;
  effectiveSubscriptionState: string | null;
  standardUsed: number;
  regionalUsed: number;
  anonymousPreviewConsumed: boolean;
  betaFullAccess: boolean;
}

export interface SimQuota {
  allowed: boolean;
  used: number;
  limit: number | null;
}

// ─── Quota limit tables ────────────────────────────────────────────────────────

const SIM_STANDARD_LIMITS: Record<string, number | null> = {
  'Explorer': 3, 'Pro': 20, 'Pro+': 50, 'Enterprise': null,
};

const SIM_REGIONAL_LIMITS: Record<string, number | null> = {
  'Explorer': 0, 'Pro': 0, 'Pro+': 10, 'Enterprise': null,
};

// ─── Core resolver ─────────────────────────────────────────────────────────────

/**
 * Resolves the effective identity for a simulated request.
 * Only activates simulation if the real user is Admin.
 */
export function resolveSimulatedRequest(
  headers: Record<string, string | string[] | undefined>,
  realUserId: string | null,
  realRole: string,
  realPlan: string,
  serverBetaFullAccess: boolean,
): SimAuthResult {
  const isRealAdmin = (realRole ?? '').trim().toLowerCase() === 'admin';

  const simCtx = isRealAdmin ? getSimulationContext(headers) : null;

  // Binding check: token must have been issued for this exact Admin's user ID
  if (simCtx && simCtx.issuedForUserId !== realUserId) {
    return {
      realUserId,
      realRole,
      isRealAdmin,
      simulationActive: false,
      effectivePlan: realPlan,
      effectivePersona: null,
      effectiveSubscriptionState: null,
      standardUsed: 0,
      regionalUsed: 0,
      anonymousPreviewConsumed: false,
      betaFullAccess: serverBetaFullAccess,
    };
  }

  if (!simCtx) {
    return {
      realUserId,
      realRole,
      isRealAdmin,
      simulationActive: false,
      effectivePlan: realPlan,
      effectivePersona: null,
      effectiveSubscriptionState: null,
      standardUsed: 0,
      regionalUsed: 0,
      anonymousPreviewConsumed: false,
      betaFullAccess: serverBetaFullAccess,
    };
  }

  return {
    realUserId,
    realRole,
    isRealAdmin,
    simulationActive: true,
    effectivePlan: simCtx.effectivePlan,
    effectivePersona: simCtx.persona,
    effectiveSubscriptionState: simCtx.subscriptionState,
    standardUsed: simCtx.standardUsed,
    regionalUsed: simCtx.regionalUsed,
    anonymousPreviewConsumed: simCtx.anonPreviewConsumed,
    betaFullAccess: simCtx.betaFullAccess,
  };
}

// ─── Simulated quota helpers ───────────────────────────────────────────────────

/** Simulated standard (analyze) quota — no DB call, uses token counts. */
export function getSimStandardQuota(sim: SimAuthResult): SimQuota {
  const rawLimit = SIM_STANDARD_LIMITS[sim.effectivePlan];
  const limit: number | null = rawLimit !== undefined ? rawLimit : 3;
  const used = sim.standardUsed;
  return { allowed: limit === null || used < limit, used, limit };
}

/** Simulated regional (opportunities / regional-analysis / dossier) quota. */
export function getSimRegionalQuota(sim: SimAuthResult): SimQuota {
  const rawLimit = SIM_REGIONAL_LIMITS[sim.effectivePlan];
  const limit: number | null = rawLimit !== undefined ? rawLimit : 0;
  const used = sim.regionalUsed;
  return { allowed: limit === null || sim.betaFullAccess || (limit > 0 && used < limit), used, limit };
}
