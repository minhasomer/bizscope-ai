import React from 'react';
import { Check, X, Shield, Sparkles, Zap, Building } from 'lucide-react';
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
  /** True when the private-beta full-access override is active for this user. */
  isBetaActive?: boolean;
  /** True when a user is signed in. Hides account-specific UI (billing banner, Active badge) for anonymous visitors. */
  isAuthenticated?: boolean;
}

const PLAN_ORDER: Record<string, number> = { Explorer: 0, Pro: 1, 'Pro+': 2, Enterprise: 3 };

function getPlanRelation(currentPlan: string, cardId: string): 'active' | 'upgrade' | 'downgrade' | 'enterprise' {
  if (currentPlan === cardId) return 'active';
  if (cardId === 'Enterprise') return 'enterprise';
  const current = PLAN_ORDER[currentPlan] ?? 0;
  const card = PLAN_ORDER[cardId] ?? 0;
  return card > current ? 'upgrade' : 'downgrade';
}

// Map icon keys from plans.ts to actual React icon components.
// Icon styling matches the original per-plan colour conventions.
const PLAN_ICONS: Record<PlanIconKey, React.ReactNode> = {
  shield:   <Shield   className="w-5 h-5 text-gray-500"   />,
  zap:      <Zap      className="w-5 h-5 text-blue-600"   />,
  sparkles: <Sparkles className="w-5 h-5 text-purple-600" />,
  building: <Building className="w-5 h-5 text-indigo-700" />,
};

export const PricingTiers: React.FC<PricingTiersProps> = ({ currentPlan, onSelectPlan, onCheckout, isBetaActive = false, isAuthenticated = true }) => {
  const isDemo = isDemoMode;

  const handlePlanAction = (tierId: SubscriptionPlan) => {
    if (tierId === 'Explorer' || tierId === 'Enterprise') {
      onSelectPlan(tierId);
      return;
    }
    if (isDemo) {
      onSelectPlan(tierId);
    } else {
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

      {/* Private-beta banner — shown only when beta full-access is active */}
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

      {/* Tier cards — driven by PRICING_CARDS from src/config/plans.ts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-4 items-start">
        {PRICING_CARDS.map((card) => {
          const isActive = isAuthenticated && currentPlan === card.id;
          const icon = PLAN_ICONS[card.iconKey];

          return (
            <div key={card.id} className={getCardClasses(card.accent, isActive)}>
              {/* Colored top accent bar */}
              {card.accent === 'blue' && (
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-3xl" />
              )}
              {card.accent === 'purple' && (
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-3xl" />
              )}

              {/* Active badge */}
              {isActive && (
                <div className="absolute top-5 right-4">
                  <span className="bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                    Active
                  </span>
                </div>
              )}

              <div className={`p-6 flex-1 flex flex-col ${!card.accent ? 'pt-6' : 'pt-5'}`}>
                {/* Icon + badge row — pr-16 when Active badge is present to prevent overlap */}
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

                {/* Name + description */}
                <h3 className="text-xl font-black text-gray-900 tracking-tight">{card.name}</h3>
                <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed min-h-[36px]">{card.description}</p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-gray-900 tracking-tight">{card.price}</span>
                  {card.period && (
                    <span className="text-xs text-gray-400 font-semibold">{card.period}</span>
                  )}
                </div>

                {/* Features — sourced from PRICING_CARDS[n].features */}
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
                  if (!isAuthenticated) {
                    // Anonymous visitor: no current plan to compare against — always show the card's own CTA.
                    label = card.cta;
                    btnClass = `${card.ctaClass} border border-transparent`;
                  } else {
                    const relation = getPlanRelation(currentPlan, card.id);
                    if (relation === 'active') {
                      label = 'Currently Active';
                      btnClass = 'bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100';
                    } else if (relation === 'enterprise') {
                      label = card.cta;
                      btnClass = `${card.ctaClass} border border-transparent`;
                    } else if (relation === 'upgrade') {
                      label = !isDemo ? `${card.cta} →` : card.cta;
                      btnClass = `${card.ctaClass} border border-transparent`;
                    } else {
                      // downgrade
                      label = card.id === 'Explorer' ? 'Downgrade to Free' : `Switch to ${card.name}`;
                      btnClass = 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100';
                    }
                  }
                  return (
                    <button
                      onClick={() => handlePlanAction(card.id)}
                      className={`w-full py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wide transition-all duration-150 cursor-pointer text-center ${btnClass}`}
                    >
                      {label}
                    </button>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature comparison table — driven by COMPARISON_TABLE_ROWS from src/config/plans.ts */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hidden md:block">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide">Full Capability Comparison</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-3 px-6 font-black text-gray-400 uppercase tracking-wider text-[10px] w-2/5">Feature</th>
                {PRICING_CARDS.map(card => (
                  <th key={card.id} className={`py-3 px-4 text-center font-black uppercase tracking-wider text-[10px] ${
                    card.accent === 'blue'
                      ? 'text-blue-600'
                      : card.accent === 'purple'
                        ? 'text-purple-600'
                        : card.id === 'Enterprise'
                          ? 'text-indigo-500'
                          : 'text-gray-400'
                  }`}>{card.name}</th>
                ))}
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
                            vIdx === 1 ? 'text-blue-500'
                            : vIdx === 2 ? 'text-purple-500'
                            : vIdx === 3 ? 'text-indigo-500'
                            : 'text-blue-500'
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
