import React from 'react';
import { Check, X, Shield, Sparkles, Zap, Building, RefreshCw, AlertCircle } from 'lucide-react';
import { SubscriptionPlan } from '../src/utils/planUtils';
import { isDemoMode } from '../src/config/appConfig';
import {
  PRICING_CARDS,
  COMPARISON_TABLE_ROWS,
  PlanIconKey,
} from '../src/config/plans';

interface PricingTiersProps {
  currentPlan: SubscriptionPlan;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  onCheckout?: (plan: 'Pro' | 'Pro+') => void;
  /** Opens the Stripe Customer Portal for plan changes and cancellation. */
  onManageSubscription?: () => void;
  /** Navigates to the Contact page — never mutates plan state. */
  onContactSales?: () => void;
  /** True when the private-beta full-access override is active for this user. */
  isBetaActive?: boolean;
  /** True when a user is signed in. Hides account-specific UI for anonymous visitors. */
  isAuthenticated?: boolean;
  /**
   * True when the user has an actual active/trialing/past-due Stripe subscription.
   * Drives routing: paid users go to Customer Portal; unpaid users go to Checkout.
   * Must NOT be inferred from the beta-elevated effective plan.
   */
  hasPaidSubscription?: boolean;
  /** True while a checkout or portal request is in flight. Disables all action buttons. */
  pricingActionLoading?: boolean;
  /** Error message to display below the pricing cards when a checkout/portal request fails. */
  pricingActionError?: string | null;
  /**
   * True when this user qualifies for the 7-day free Pro trial.
   * Drives trial-specific CTA copy on the Pro card.
   */
  trialEligible?: boolean;
  /** Called when the user clicks "Buy Decision Pass". Not called in demo mode. */
  onDecisionPassCheckout?: () => void;
  /**
   * When false, the Decision Pass section is hidden.
   * App.tsx sets this to false for active subscribers and trialing users.
   * Defaults to true.
   */
  showDecisionPass?: boolean;
  /** Navigate to the Business Viability analysis page. */
  onNavigateToAnalyze?: () => void;
  /** Navigate to the Market Gap Discovery page. */
  onNavigateToMarketGap?: () => void;
}

const PLAN_ORDER: Record<string, number> = { Explorer: 0, Pro: 1, 'Pro+': 2, Enterprise: 3 };

function getPlanRelation(currentPlan: string, cardId: string): 'active' | 'upgrade' | 'downgrade' | 'enterprise' {
  if (currentPlan === cardId) return 'active';
  if (cardId === 'Enterprise') return 'enterprise';
  const current = PLAN_ORDER[currentPlan] ?? 0;
  const card = PLAN_ORDER[cardId] ?? 0;
  return card > current ? 'upgrade' : 'downgrade';
}

const PLAN_ICONS: Record<PlanIconKey, React.ReactNode> = {
  shield:   <Shield   className="w-5 h-5 text-gray-500"   />,
  zap:      <Zap      className="w-5 h-5 text-blue-600"   />,
  sparkles: <Sparkles className="w-5 h-5 text-purple-600" />,
  building: <Building className="w-5 h-5 text-indigo-700" />,
};

export const PricingTiers: React.FC<PricingTiersProps> = ({
  currentPlan,
  onSelectPlan,
  onCheckout,
  onManageSubscription,
  onContactSales,
  isBetaActive = false,
  isAuthenticated = true,
  hasPaidSubscription = false,
  pricingActionLoading = false,
  pricingActionError = null,
  trialEligible = false,
  onDecisionPassCheckout,
  showDecisionPass = true,
  onNavigateToAnalyze,
  onNavigateToMarketGap,
}) => {
  const isDemo = isDemoMode;

  const handlePlanAction = (tierId: SubscriptionPlan) => {
    if (pricingActionLoading) return;

    // Enterprise: always navigate to Contact — never activates as a plan.
    if (tierId === 'Enterprise') {
      onContactSales?.();
      return;
    }

    // Demo mode: local plan switching only (no real Stripe calls).
    if (isDemo) {
      onSelectPlan(tierId);
      return;
    }

    // Explorer card in live mode.
    if (tierId === 'Explorer') {
      if (hasPaidSubscription) {
        // Paid subscriber: open portal to cancel at period end.
        onManageSubscription?.();
      }
      // No paid subscription (free or beta): nothing to cancel.
      return;
    }

    // Pro / Pro+ in live mode.
    if (hasPaidSubscription) {
      // Existing subscriber: change plan or cancel via portal.
      onManageSubscription?.();
    } else {
      // No subscription: start a new one via Checkout.
      onCheckout?.(tierId as 'Pro' | 'Pro+');
    }
  };

  const getCardClasses = (accent: 'blue' | 'purple' | null, isActive: boolean) => {
    const base = 'bg-white rounded-3xl border flex flex-col justify-between transition-all duration-200 relative overflow-hidden';
    if (accent === 'blue') {
      return `${base} border-blue-200 shadow-2xl shadow-blue-100/50 ring-1 ring-blue-100 ${isActive ? 'ring-2 ring-blue-500' : ''}`;
    }
    if (accent === 'purple') {
      return `${base} border-purple-200 shadow-lg shadow-purple-50/40 ring-1 ring-purple-100 ${isActive ? 'ring-2 ring-purple-500' : ''}`;
    }
    return `${base} border-gray-150 shadow-sm hover:shadow-md hover:border-gray-200 ${isActive ? 'ring-2 ring-blue-500 border-blue-200' : ''}`;
  };

  return (
    <div className="space-y-10">
      {/* Mode / account banner — only shown to authenticated users or in demo mode */}
      {(isAuthenticated || isDemo) && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm ${
          isDemo
            ? 'bg-blue-50 border-blue-100'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            {isDemo ? (
              <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shrink-0">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
            ) : (
              <div className="p-2 bg-gray-200 text-gray-700 rounded-xl shrink-0">
                <Zap className="w-4 h-4" />
              </div>
            )}
            <div>
              <p className="text-xs font-black text-gray-900 uppercase tracking-wide">
                {isDemo ? 'Demo Mode' : 'Billing Active'}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {isDemo
                  ? 'Click any plan to hot-swap instantly — no payment required.'
                  : 'Upgrade instantly via Stripe. Cancel anytime. No hidden fees.'}
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border shrink-0 ${
            isDemo ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-gray-700 border-gray-200'
          }`}>
            Current: {currentPlan}
          </span>
        </div>
      )}

      {/* Private-beta banner */}
      {isBetaActive && (
        <div className="flex items-start gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-800">
          <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-black uppercase tracking-wide text-[10px] text-purple-700 mb-0.5">Private Beta — Complimentary Pro+ Access</p>
            <p className="leading-relaxed text-purple-700">
              Every new account receives complimentary access to all Pro+ features throughout the beta at no cost. The pricing below is provided for reference and will apply after beta. You will not be charged for participating.
            </p>
          </div>
        </div>
      )}

      {/* Ongoing Plans section header */}
      <div className="flex items-center gap-3">
        <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider shrink-0">Ongoing Plans</h4>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-4 items-start">
        {PRICING_CARDS.map((card) => {
          const isActive = isAuthenticated && currentPlan === card.id;
          const icon = PLAN_ICONS[card.iconKey];

          return (
            <div key={card.id} className={getCardClasses(card.accent, isActive)}>
              {card.accent === 'blue' && (
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-3xl" />
              )}
              {card.accent === 'purple' && (
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-3xl" />
              )}

              {/* Active / Beta badge */}
              {isActive && (
                <div className="absolute top-5 right-4">
                  <span className="bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                    {isBetaActive && !hasPaidSubscription ? 'Beta' : 'Active'}
                  </span>
                </div>
              )}

              <div className={`p-6 flex-1 flex flex-col ${!card.accent ? 'pt-6' : 'pt-5'}`}>
                <div className={`flex items-start justify-between gap-2 mb-4${isActive ? ' pr-16' : ''}`}>
                  <div className={`p-2.5 rounded-xl border ${
                    card.accent === 'blue'
                      ? 'bg-blue-50 border-blue-100'
                      : card.accent === 'purple'
                        ? 'bg-purple-50 border-purple-100'
                        : 'bg-gray-50 border-gray-100'
                  }`}>
                    {icon}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                    card.accent === 'blue'
                      ? 'bg-blue-50 text-blue-700 border-blue-100'
                      : card.accent === 'purple'
                        ? 'bg-purple-50 text-purple-700 border-purple-100'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    {card.badge}
                  </span>
                </div>

                <h3 className="text-xl font-black text-gray-900 tracking-tight">{card.name}</h3>
                <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed min-h-[36px]">{card.description}</p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-gray-900 tracking-tight">{card.price}</span>
                  {card.period && (
                    <span className="text-xs text-gray-400 font-semibold">{card.period}</span>
                  )}
                </div>

                <ul className="space-y-2.5 border-t border-gray-100 pt-5 flex-1">
                  {card.features.map((feature, idx) => (
                    <li key={idx} className={`flex items-start gap-2.5 text-xs ${
                      feature.included ? 'text-gray-700' : 'text-gray-350'
                    }`}>
                      {feature.included ? (
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${
                          card.accent === 'purple' ? 'text-purple-500' : 'text-blue-500'
                        }`} />
                      ) : (
                        <X className="w-4 h-4 shrink-0 mt-0.5 text-gray-250" strokeWidth={2.5} />
                      )}
                      <span className={feature.included ? '' : 'text-gray-300'}>{feature.name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div className="px-6 pb-6 pt-4 border-t border-gray-50">
                {(() => {
                  let label: string;
                  let btnClass: string;
                  let disabled = false;

                  if (!isAuthenticated) {
                    // Anonymous visitor: show the card's default CTA.
                    label = card.cta;
                    btnClass = `${card.ctaClass} border border-transparent`;
                  } else if (card.id === 'Enterprise') {
                    // Enterprise never self-activates — always Contact Sales.
                    label = 'Contact Sales';
                    btnClass = `${card.ctaClass} border border-transparent`;
                  } else {
                    const relation = getPlanRelation(currentPlan, card.id);

                    if (relation === 'active') {
                      // Beta-elevated plan vs. real paid subscription.
                      label = (isBetaActive && !hasPaidSubscription)
                        ? 'Beta Access Active'
                        : 'Currently Active';
                      btnClass = 'bg-blue-50 text-blue-700 border border-blue-100';
                      disabled = true;
                    } else if (isDemo) {
                      // Demo mode: local switching labels.
                      label = relation === 'upgrade' ? card.cta :
                              card.id === 'Explorer' ? 'Downgrade to Free' : `Switch to ${card.name}`;
                      btnClass = relation === 'upgrade'
                        ? `${card.ctaClass} border border-transparent`
                        : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100';
                    } else if (hasPaidSubscription) {
                      // Real subscriber: all changes go through Stripe Customer Portal.
                      if (card.id === 'Explorer') {
                        label = 'Cancel to Free';
                      } else if (relation === 'upgrade') {
                        label = pricingActionLoading ? 'Opening Portal…' : 'Upgrade in Billing Portal →';
                      } else {
                        label = pricingActionLoading ? 'Opening Portal…' : 'Downgrade in Billing Portal';
                      }
                      btnClass = 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 disabled:opacity-50';
                      disabled = pricingActionLoading;
                    } else {
                      // No paid subscription.
                      if (card.id === 'Explorer') {
                        // No subscription to cancel: disable this button.
                        label = 'No Subscription to Cancel';
                        btnClass = 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed';
                        disabled = true;
                      } else {
                        // Pro / Pro+: start a new subscription via Checkout.
                        // Show trial-specific copy for eligible users on the Pro card.
                        const isProTrial = card.id === 'Pro' && trialEligible;
                        label = pricingActionLoading ? 'Loading…'
                          : isProTrial ? 'Start Free 7-Day Trial →'
                          : `${card.cta} →`;
                        btnClass = `${card.ctaClass} border border-transparent disabled:opacity-60`;
                        disabled = pricingActionLoading;
                      }
                    }
                  }

                  const isProTrialNote = card.id === 'Pro' && trialEligible && !hasPaidSubscription && !isDemo && isAuthenticated;

                  return (
                    <div>
                      <button
                        onClick={() => handlePlanAction(card.id)}
                        disabled={disabled}
                        className={`w-full py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wide transition-all duration-150 text-center ${btnClass} ${disabled ? '' : 'cursor-pointer'}`}
                      >
                        {pricingActionLoading && !disabled && (
                          <RefreshCw className="inline w-3 h-3 mr-1.5 animate-spin" />
                        )}
                        {label}
                      </button>
                      {isProTrialNote && (
                        <p className="text-center text-[10px] text-gray-400 mt-2">
                          No charge today — includes 5 Business Viability reports. Payment method required. Renews at $29/month after 7 days unless canceled.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Checkout / portal error — shown below the grid */}
      {pricingActionError && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <span>{pricingActionError}</span>
        </div>
      )}

      {/* Decision Pass — one-time purchase, hidden in demo mode and for active subscribers */}
      {!isDemo && showDecisionPass && onDecisionPassCheckout && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider shrink-0">One-Time Access</h4>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-gray-900 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
            {/* Subtle background accent */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.12)_0%,_transparent_65%)] pointer-events-none" />

            {/* Section header */}
            <div className="mb-6 relative">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-1.5">
                Not ready for a subscription?
              </p>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
                You don't need a monthly plan to use BizScope.
              </h3>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 relative">
              {/* Left: price, badges, CTA */}
              <div className="lg:w-60 shrink-0 flex flex-col gap-5">
                <div>
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-4xl font-black text-white tracking-tight">$19</span>
                    <span className="text-sm text-gray-400 font-semibold">one time</span>
                  </div>
                  <p className="text-base font-black text-white tracking-tight">Decision Pass</p>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                    Explore multiple opportunities without an ongoing commitment.
                  </p>
                </div>

                {/* Trust badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/10 text-gray-300 px-2.5 py-1 rounded-full border border-white/10">
                    No subscription
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/10 text-gray-300 px-2.5 py-1 rounded-full border border-white/10">
                    No recurring charge
                  </span>
                </div>

                <button
                  onClick={() => !pricingActionLoading && onDecisionPassCheckout?.()}
                  disabled={pricingActionLoading}
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wide bg-white text-gray-900 hover:bg-gray-100 transition-all duration-150 disabled:opacity-50 cursor-pointer"
                >
                  {pricingActionLoading ? 'Loading…' : 'Get Decision Pass — $19'}
                </button>
              </div>

              {/* Divider */}
              <div className="h-px lg:h-auto lg:w-px bg-white/10 shrink-0" />

              {/* Right: feature list + pitch */}
              <div className="flex-1 flex flex-col gap-5">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2.5 text-xs text-gray-300">
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                    <span><strong className="text-white">3 Business Viability Reports</strong> — demand, competition, demographics, and risks</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-gray-300">
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                    <span><strong className="text-white">1 Market Gap Discovery Report</strong> — find underserved niches in your target market</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-gray-300">
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                    <span>Full financial projections and analysis</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-gray-300">
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                    <span>Competitor location mapping</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-gray-300">
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                    <span>PDF export</span>
                  </li>
                </ul>

                <p className="text-xs text-gray-400 leading-relaxed border-t border-white/10 pt-4">
                  <strong className="text-gray-200">One payment. No subscription. No recurring charge.</strong>{' '}
                  Perfect for evaluating a few business ideas, comparing franchise opportunities, or researching a market before deciding what to pursue.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report type education */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500 shrink-0" />
            <p className="text-sm font-black text-gray-900">Business Viability</p>
          </div>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Already have an idea?</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Evaluate a specific business and market across demand, competition, demographics, risks, and recommended next steps.
          </p>
          {onNavigateToAnalyze && (
            <button
              onClick={onNavigateToAnalyze}
              className="text-xs text-blue-600 font-semibold hover:text-blue-700 transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              Explore Business Viability →
            </button>
          )}
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
            <p className="text-sm font-black text-gray-900">Market Gap Discovery</p>
          </div>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Still looking for the right opportunity?</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Discover underserved business niches in a selected U.S. market.
          </p>
          {onNavigateToMarketGap && (
            <button
              onClick={onNavigateToMarketGap}
              className="text-xs text-purple-600 font-semibold hover:text-purple-700 transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              Explore Market Gap Discovery →
            </button>
          )}
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hidden md:block">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide">Full Capability Comparison</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-3 px-6 font-black text-gray-400 uppercase tracking-wider text-[10px] w-2/5">Feature</th>
                <th className="py-3 px-4 text-center font-black uppercase tracking-wider text-[10px] text-gray-400">Explorer</th>
                <th className="py-3 px-4 text-center font-black uppercase tracking-wider text-[10px] text-gray-600">Decision Pass</th>
                <th className="py-3 px-4 text-center font-black uppercase tracking-wider text-[10px] text-blue-600">Pro</th>
                <th className="py-3 px-4 text-center font-black uppercase tracking-wider text-[10px] text-purple-600">Pro+</th>
                <th className="py-3 px-4 text-center font-black uppercase tracking-wider text-[10px] text-indigo-500">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {COMPARISON_TABLE_ROWS.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-6 text-gray-700 font-medium">{row.label}</td>
                  {row.values.map((val, vIdx) => (
                    <td key={vIdx} className="py-3 px-4 text-center">
                      {typeof val === 'boolean' ? (
                        val ? (
                          <Check className={`w-4 h-4 mx-auto ${
                            vIdx === 2 ? 'text-blue-500'
                            : vIdx === 3 ? 'text-purple-500'
                            : vIdx === 4 ? 'text-indigo-500'
                            : 'text-gray-500'
                          }`} />
                        ) : (
                          <X className="w-4 h-4 mx-auto text-gray-200" strokeWidth={2.5} />
                        )
                      ) : (
                        <span className={`font-bold ${vIdx === 0 ? 'text-gray-400' : 'text-gray-900'}`}>{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
