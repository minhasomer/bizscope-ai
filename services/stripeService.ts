import { isDemoMode } from '../src/config/appConfig';
import { assertLiveService } from '../src/lib/guardrails';
import { supabase } from './supabaseClient';

export interface SubscriptionStatus {
  plan: string;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'inactive' | 'no_subscription' | 'no_customer' | 'not_configured' | 'demo';
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  /** Stripe customer ID. Null when the user has never started a paid subscription. */
  customerId: string | null;
  /** Stripe subscription ID. Null when no active subscription exists. */
  subscriptionId: string | null;
  /** True when this user has previously used their one free trial. */
  hasUsedTrial?: boolean;
  /**
   * Server-computed trial eligibility: PRO_TRIAL_ENABLED=true, no prior trial,
   * no active subscription. Use this field instead of re-deriving client-side.
   */
  trialEligible?: boolean;
  /** True when PRO_TRIAL_ENABLED=true on the server (mirrors the server flag). */
  proTrialEnabled?: boolean;
  /** True when status === 'trialing'. Shorthand for status check. */
  trialing?: boolean;
  /** ISO timestamp when this trial started. Only present when trialing. */
  trialStartedAt?: string | null;
  /** ISO timestamp when this trial ends. Only present when trialing. */
  trialEndsAt?: string | null;
  /** Number of trial reports used (only present when status === 'trialing'). */
  trialReportCount?: number;
  /** Remaining Decision Pass credits (separate viability and market_gap counters). */
  decisionPassBalance?: { viability: number; marketGap: number };
}

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export class StripeService {
  static isDemo(): boolean {
    return isDemoMode;
  }

  /**
   * Create a Stripe Checkout Session and return the redirect URL.
   * The caller is responsible for firing analytics events BEFORE navigating
   * so that begin_checkout fires only after a confirmed URL is received.
   * Returns null in demo mode (caller should skip redirect and analytics).
   */
  static async startCheckout(
    plan: 'Pro' | 'Pro+',
  ): Promise<{ url: string; trialEligible: boolean } | null> {
    if (this.isDemo()) {
      console.info('[Stripe] Demo mode active — skipping real checkout.');
      return null;
    }
    assertLiveService('Stripe /api/stripe/create-checkout-session');

    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated.');

    const resp = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ plan }),
    });

    const data = await resp.json();
    if (resp.status === 409 && data.code === 'ACTIVE_SUBSCRIPTION_EXISTS') {
      throw Object.assign(new Error(data.error), { code: 'ACTIVE_SUBSCRIPTION_EXISTS' });
    }
    if (!resp.ok) throw new Error(data.error || 'Failed to create Stripe checkout session.');
    if (!data.url) throw new Error('No checkout URL returned from server.');
    return { url: data.url as string, trialEligible: !!(data.trialEligible) };
  }

  /**
   * Create a Stripe Checkout Session for a Decision Pass purchase ($19 one-time).
   * Returns null in demo mode (caller should skip redirect).
   */
  static async startDecisionPassCheckout(): Promise<{ url: string } | null> {
    if (this.isDemo()) {
      console.info('[Stripe] Demo mode active — skipping Decision Pass checkout.');
      return null;
    }
    assertLiveService('Stripe /api/stripe/create-decision-pass-checkout');

    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated.');

    const resp = await fetch('/api/stripe/create-decision-pass-checkout', {
      method: 'POST',
      headers: authHeaders(token),
    });

    const contentType = resp.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('Server error. Please try again.');
    }
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to create checkout session.');
    if (!data.url) throw new Error('No checkout URL returned from server.');
    return { url: data.url as string };
  }

  static async openPortal(): Promise<void> {
    if (this.isDemo()) {
      console.info('[Stripe] Demo mode active — skipping portal redirect.');
      return;
    }
    assertLiveService('Stripe /api/stripe/create-portal-session');

    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated.');

    const resp = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: authHeaders(token),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to open billing portal.');
    if (data.url) window.location.href = data.url;
  }

  static async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    if (this.isDemo()) {
      return { plan: 'Explorer', status: 'demo', cancelAtPeriodEnd: false, currentPeriodEnd: null, customerId: null, subscriptionId: null };
    }

    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated.');

    const resp = await fetch('/api/stripe/subscription-status', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to fetch subscription status.');
    return data as SubscriptionStatus;
  }
}
