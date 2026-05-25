import { isDemoMode } from '../src/config/appConfig';
import { assertLiveService } from '../src/lib/guardrails';

export interface SubscriptionStatus {
  plan: string;
  status: 'active' | 'past_due' | 'cancelled' | 'no_subscription' | 'no_customer' | 'not_configured' | 'demo';
  customerId: string | null;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}

export class StripeService {
  static isDemo(): boolean {
    return isDemoMode;
  }

  /**
   * Redirect to Stripe Checkout for Pro or Pro+ subscription.
   * No-op in Demo Mode.
   */
  static async startCheckout(plan: 'Pro' | 'Pro+', userEmail: string): Promise<void> {
    if (this.isDemo()) {
      console.info('[Stripe] Demo mode active — skipping real checkout.');
      return;
    }

    // Guardrail: real Stripe sessions must never be created in Demo Mode.
    assertLiveService('Stripe /api/stripe/create-checkout-session');
    const resp = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, userEmail }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to create Stripe checkout session.');
    if (data.url) window.location.href = data.url;
  }

  /**
   * Redirect to Stripe Billing Portal so the user can manage/cancel their subscription.
   * No-op in Demo Mode.
   */
  static async openPortal(userEmail: string): Promise<void> {
    if (this.isDemo()) {
      console.info('[Stripe] Demo mode active — skipping portal redirect.');
      return;
    }

    // Guardrail: real billing portal redirects must never occur in Demo Mode.
    assertLiveService('Stripe /api/stripe/create-portal-session');
    const resp = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to open billing portal.');
    if (data.url) window.location.href = data.url;
  }

  /**
   * Fetch live subscription status from the server.
   * Returns a demo status object in Demo Mode.
   */
  static async getSubscriptionStatus(userEmail: string): Promise<SubscriptionStatus> {
    if (this.isDemo()) {
      return { plan: 'Explorer', status: 'demo', customerId: null };
    }

    const resp = await fetch(`/api/stripe/subscription-status?email=${encodeURIComponent(userEmail)}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to fetch subscription status.');
    return data as SubscriptionStatus;
  }
}
