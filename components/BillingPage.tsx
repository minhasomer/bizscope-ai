import React, { useState, useEffect } from 'react';
import {
  CreditCard, CheckCircle, AlertCircle, Clock, ExternalLink,
  Sparkles, ArrowRight, Receipt, RefreshCw, Shield, Zap, Building
} from 'lucide-react';
import { SubscriptionPlan } from '../src/utils/planUtils';
import { UserProfile } from '../services/authService';
import { StripeService, SubscriptionStatus } from '../services/stripeService';
import { isDemoMode, betaFullAccess } from '../src/config/appConfig';

interface BillingPageProps {
  currentPlan: SubscriptionPlan;
  user: UserProfile;
  onNavigate: (page: string) => void;
}

const PLAN_PRICES: Record<string, string> = {
  Explorer: 'Free',
  Pro: '$29 / mo',
  'Pro+': '$59 / mo',
  Enterprise: 'Custom',
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  Explorer: <Shield className="w-5 h-5 text-gray-500" />,
  Pro: <Zap className="w-5 h-5 text-blue-600" />,
  'Pro+': <Sparkles className="w-5 h-5 text-purple-600" />,
  Enterprise: <Building className="w-5 h-5 text-indigo-600" />,
};

const PLAN_COLORS: Record<string, string> = {
  Explorer: 'bg-gray-50 border-gray-200 text-gray-700',
  Pro: 'bg-blue-50 border-blue-200 text-blue-700',
  'Pro+': 'bg-purple-50 border-purple-200 text-purple-700',
  Enterprise: 'bg-indigo-50 border-indigo-200 text-indigo-700',
};

const formatPeriodEnd = (ts: number): string => {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
};

const StatusBadge: React.FC<{ status: SubscriptionStatus['status']; betaAccess?: boolean }> = ({ status, betaAccess }) => {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'bg-green-100 text-green-800 border-green-200' },
    past_due: { label: 'Past Due', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-800 border-red-200' },
    no_subscription: { label: 'Free Tier', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
    no_customer: { label: 'Free Tier', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
    not_configured: { label: 'Unverified', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
    demo: { label: 'Sandbox', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  };
  // During the private beta, paid-tier access is granted without a Stripe
  // subscription, so the raw "Unverified" status is misleading and alarming.
  const cfg = betaAccess
    ? { label: 'Beta Access', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
    : map[status] ?? map.no_subscription;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export const BillingPage: React.FC<BillingPageProps> = ({ currentPlan, user, onNavigate }) => {
  const isDemo = isDemoMode;
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setStatusLoading(true);
      try {
        const status = await StripeService.getSubscriptionStatus(user.email);
        setSubStatus(status);
      } catch {
        setSubStatus({ plan: currentPlan, status: 'not_configured', customerId: null });
      } finally {
        setStatusLoading(false);
      }
    };
    load();
  }, [user.email, currentPlan]);

  const handleManageBilling = async () => {
    setPortalError(null);
    setPortalLoading(true);
    try {
      await StripeService.openPortal(user.email);
    } catch (err: any) {
      setPortalError(err.message || 'Could not open billing portal. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  };

  const activePlan = subStatus?.plan ?? currentPlan;
  const planColor = PLAN_COLORS[activePlan] ?? PLAN_COLORS.Explorer;

  // Private-beta grant: a paid tier is unlocked without a Stripe customer/subscription.
  // This is why the status comes back "not_configured" ("Unverified") with no invoices.
  const betaGranted =
    betaFullAccess && !isDemo && activePlan !== 'Explorer' && !subStatus?.customerId;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 min-h-[70vh] animate-fade-in space-y-6">

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Billing & Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your plan and payment details.</p>
      </div>

      {/* Demo Mode Banner */}
      {isDemo && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm">
          <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <p className="font-bold text-emerald-800">Demo Mode</p>
            <p className="text-emerald-700 text-xs mt-0.5">
              No real payments are processed. Use the floating plan switcher or the{' '}
              <button onClick={() => onNavigate('pricing')} className="underline font-semibold cursor-pointer">
                Pricing page
              </button>{' '}
              to hot-swap plans instantly.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Current Plan</h2>
          {subStatus && <StatusBadge status={subStatus.status} betaAccess={betaGranted} />}
        </div>

        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl border ${planColor}`}>
            {PLAN_ICONS[activePlan] ?? PLAN_ICONS.Explorer}
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{activePlan}</p>
            <p className="text-sm text-gray-500">{PLAN_PRICES[activePlan] ?? '—'}</p>
          </div>
        </div>

        {/* Private-beta access explanation — clarifies the "Beta Access" badge and
            the absence of invoices/payment method, instead of leaving "Unverified" unexplained. */}
        {betaGranted && (
          <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-sm">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-indigo-800">Private beta — full access granted</p>
              <p className="text-indigo-700 text-xs mt-0.5 leading-relaxed">
                Your <strong>{activePlan}</strong> access is unlocked for the beta at no charge, so there's
                no payment method, invoice history, or active subscription on file yet. Nothing is wrong with
                your account. Paid billing begins only if you choose a plan once the beta ends.
              </p>
            </div>
          </div>
        )}

        {/* Billing cycle details from Stripe */}
        {subStatus?.currentPeriodEnd && (
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-3 border border-gray-100">
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            {subStatus.cancelAtPeriodEnd ? (
              <span>
                Subscription ends on{' '}
                <strong>{formatPeriodEnd(subStatus.currentPeriodEnd)}</strong>. Access continues until then.
              </span>
            ) : (
              <span>
                Next billing date:{' '}
                <strong>{formatPeriodEnd(subStatus.currentPeriodEnd)}</strong>
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          {isDemo ? (
            <button
              onClick={() => onNavigate('pricing')}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Switch Plan (Sandbox)
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              {subStatus?.customerId ? (
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {portalLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="w-3.5 h-3.5" />
                  )}
                  {portalLoading ? 'Opening Portal...' : 'Manage Billing & Invoices'}
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('pricing')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Upgrade Plan
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {activePlan !== 'Explorer' && activePlan !== 'Enterprise' && (
                <button
                  onClick={() => onNavigate('pricing')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl border border-gray-200 transition-colors cursor-pointer"
                >
                  View All Plans
                </button>
              )}
            </>
          )}
        </div>

        {portalError && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mt-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{portalError}</span>
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Account</h2>
        <div className="flex items-center gap-3">
          <img
            src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
            alt="avatar"
            className="w-10 h-10 rounded-full border border-gray-200"
            referrerPolicy="no-referrer"
          />
          <div>
            <p className="text-sm font-bold text-gray-900">{user.fullName || 'Member'}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('settings')}
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
        >
          Edit profile <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Invoice History */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Invoice History</h2>
        </div>

        {isDemo ? (
          <div className="text-center py-8 text-gray-400">
            <Receipt className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-xs font-semibold">Invoice history is not available in Sandbox mode.</p>
            <p className="text-xs mt-1 opacity-70">In live mode, invoices are accessible via the Stripe Billing Portal.</p>
          </div>
        ) : subStatus?.customerId ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              Full invoice history, receipts, and payment methods are available through the Stripe Billing Portal.
            </p>
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="inline-flex items-center gap-2 text-xs text-blue-600 hover:underline font-semibold cursor-pointer disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View invoices in Stripe Portal
            </button>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <CheckCircle className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-xs font-semibold">No billing history yet.</p>
            <p className="text-xs mt-1 opacity-70">Invoices will appear here once you start a paid subscription.</p>
          </div>
        )}
      </div>

      {/* Enterprise CTA */}
      {activePlan !== 'Enterprise' && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-gray-900">Need an Enterprise plan?</p>
            <p className="text-xs text-gray-500 mt-0.5">Custom SLAs, integrations, and dedicated support.</p>
          </div>
          <button
            onClick={() => onNavigate('pricing')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm whitespace-nowrap"
          >
            Contact Sales <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
