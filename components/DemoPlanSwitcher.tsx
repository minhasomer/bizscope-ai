import React, { useState } from 'react';
import { Shield, Zap, Sparkles, Building2, Sliders, ChevronUp, ChevronDown } from 'lucide-react';
import { SubscriptionPlan } from '../src/utils/planUtils';
import { PRICING_CARDS } from '../src/config/plans';

interface DemoPlanSwitcherProps {
  currentPlan: SubscriptionPlan;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  isVisible: boolean;
}

export const DemoPlanSwitcher: React.FC<DemoPlanSwitcherProps> = ({ currentPlan, onSelectPlan, isVisible }) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  if (!isVisible) {
    return null;
  }

  // Icon map — keeps DemoPlanSwitcher free of plans.ts JSX dependency.
  const ICONS: Record<SubscriptionPlan, React.ReactNode> = {
    Explorer:   <Shield   className="w-3.5 h-3.5" />,
    Pro:        <Zap      className="w-3.5 h-3.5" />,
    'Pro+':     <Sparkles className="w-3.5 h-3.5" />,
    Enterprise: <Building2 className="w-3.5 h-3.5" />,
  };

  // Style map — visual theming per plan (accent colours, active ring).
  const STYLES: Record<SubscriptionPlan, { color: string; hover: string; activeStyle: string }> = {
    Explorer:   {
      color:       'bg-gray-100 text-gray-700',
      hover:       'hover:bg-gray-200 hover:text-gray-900',
      activeStyle: 'bg-gray-800 text-white shadow-md ring-2 ring-gray-400',
    },
    Pro:         {
      color:       'bg-blue-50 text-blue-700 border-blue-100',
      hover:       'hover:bg-blue-100 hover:text-blue-900',
      activeStyle: 'bg-blue-600 text-white shadow-md shadow-blue-100 ring-2 ring-blue-500/50 border-blue-600',
    },
    'Pro+':      {
      color:       'bg-purple-50 text-purple-700 border-purple-100',
      hover:       'hover:bg-purple-100 hover:text-purple-900',
      activeStyle: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md shadow-purple-100 ring-2 ring-purple-600',
    },
    Enterprise:  {
      color:       'bg-indigo-50 text-indigo-700 border-indigo-100',
      hover:       'hover:bg-indigo-100 hover:text-indigo-900',
      activeStyle: 'bg-indigo-900 text-white shadow-md ring-2 ring-indigo-500',
    },
  };

  // Build the plan list from PRICING_CARDS — labels and descriptions stay in sync with plans.ts.
  const plans = PRICING_CARDS.map(card => ({
    id:          card.id,
    label:       card.name,
    icon:        ICONS[card.id],
    desc:        card.shortDescription,
    ...STYLES[card.id],
  }));

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-[90vw] md:w-96 print:hidden transition-all duration-300">
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-3 bg-gray-900/95 backdrop-blur-md text-white text-xs font-bold rounded-2xl shadow-2xl border border-gray-700 hover:bg-black transition-all cursor-pointer float-right"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
          <Sliders className="w-3.5 h-3.5" />
          <span>Simulating: {currentPlan}</span>
          <ChevronUp className="w-3 h-3 opacity-60 ml-1" />
        </button>
      ) : (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 shrink-0 transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-150 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1 px-1.5 bg-indigo-50 border border-indigo-150 rounded-lg text-indigo-600 text-xs font-black uppercase flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                Sandbox
              </span>
              <p className="text-xs font-black text-gray-900 uppercase">Plan Switcher</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsMinimized(true)}
                title="Collapse Panel"
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 leading-normal mb-3">
            Switch your profile instantly to review different layouts, locked report features, and regional intelligence datasets.
          </p>

          {/* Plan Toggles Stack */}
          <div className="space-y-2">
            {plans.map((plan) => {
              const isActive = currentPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  onClick={() => onSelectPlan(plan.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                    isActive 
                      ? plan.activeStyle 
                      : `bg-white border-gray-200 text-gray-700 ${plan.hover}`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? 'bg-white/15' : 'bg-gray-50'}`}>
                      {plan.icon}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wide leading-none">{plan.label}</p>
                      <p className={`text-[10px] mt-0.5 leading-none ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                        {plan.desc}
                      </p>
                    </div>
                  </div>
                  {isActive && (
                    <span className="bg-white/20 text-[9px] font-black uppercase px-2 py-0.5 rounded-md text-white border border-white/25 shadow-xs">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Stats Helper status line */}
          <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
            <span>Mock Database Offline Active</span>
            <span className="font-semibold text-gray-500 uppercase">VITE_DEMO_MODE=true</span>
          </div>
        </div>
      )}
    </div>
  );
};
