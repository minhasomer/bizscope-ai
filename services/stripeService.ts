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

  static async startCheckout(plan: 'Pro' | 'Pro+'): Promise<void> {
    if (this.isDemo()) {
      console.info('[Stripe] Demo mode active — skipping real checkout.');
      return;
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
      // Caller should redirect to portal instead.
      throw Object.assign(new Error(data.error), { code: 'ACTIVE_SUBSCRIPTION_EXISTS' });
    }
    if (!resp.ok) throw new Error(data.error || 'Failed to create Stripe checkout session.');
    if (data.url) window.location.href = data.url;
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
