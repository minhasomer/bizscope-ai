/**
 * billingSimState.ts
 *
 * Pure helper for computing the billing UI display state during Admin simulation.
 * Server-enforced authorization is unchanged; these values are display-only.
 * Imported by BillingPage.tsx and tested directly in tests/sim-billing-display.test.ts.
 */

export type SimSubState = 'none' | 'active' | 'trialing' | 'past_due' | 'canceled';

export interface SimBillingDisplay {
  subscriptionState: SimSubState;
  statusLabel: string;
  /** Whether the simulated state grants active paid entitlement (drives action button visibility). */
  hasPaidAccess: boolean;
  /** Optional note rendered below the plan card to explain the simulated state. */
  periodEndNote: string | null;
}

const STATUS_LABELS: Record<SimSubState, string> = {
  active:   'Active',
  trialing: 'Trial',
  past_due: 'Past Due',
  canceled: 'Cancelled',
  none:     'No Subscription',
};

const PERIOD_NOTES: Record<SimSubState, string | null> = {
  active:   null,
  trialing: 'Simulated trial — no real billing is scheduled.',
  past_due: 'Simulated past due — no real payment action is required.',
  canceled: 'Simulated canceled — paid entitlement removed.',
  none:     null,
};

const VALID_STATES = new Set<string>(['none', 'active', 'trialing', 'past_due', 'canceled']);

export function buildSimBillingDisplay(
  plan: string,
  rawState: string | null | undefined,
): SimBillingDisplay {
  const state: SimSubState =
    rawState && VALID_STATES.has(rawState) ? (rawState as SimSubState) : 'active';

  const hasPaidAccess =
    plan !== 'Explorer' &&
    state !== 'canceled' &&
    state !== 'none';

  return {
    subscriptionState: state,
    statusLabel:       STATUS_LABELS[state],
    hasPaidAccess,
    periodEndNote:     PERIOD_NOTES[state],
  };
}
