import React, { useState } from 'react';
import {
  Shield, Zap, Sparkles, Building2, FlaskConical, ShieldAlert,
  ChevronDown, ChevronUp, RotateCcw, Eye, Settings2,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { SubscriptionPlan, previewRoleToEffectivePlan } from '../src/utils/planUtils';
import { UserProfile } from '../services/authService';
import { AuthService } from '../services/authService';
import { appConfig, isDemoMode } from '../src/config/appConfig';
import { PRICING_CARDS } from '../src/config/plans';

/** Looks up the shortDescription for a plan-based role from the central plan config. */
const planDesc = (id: SubscriptionPlan): string =>
  PRICING_CARDS.find(c => c.id === id)?.shortDescription ?? id;

// ─── Types ─────────────────────────────────────────────────────────────────

export type PreviewRole =
  | 'Explorer'
  | 'Pro'
  | 'ProPlus'
  | 'Enterprise'
  | 'BetaTester'
  | 'Admin';

interface DevAdminPanelProps {
  /** The currently active subscription plan driving all UI gating. */
  currentPlan: SubscriptionPlan;
  /** Which role is being previewed, or null when viewing as real self. */
  previewRole: PreviewRole | null;
  /** The signed-in user (null = not logged in). */
  currentUser: UserProfile | null;
  /** Callback to activate or clear a preview role. */
  onSetPreview: (role: PreviewRole | null) => void;
  /** Whether the panel should render at all. Computed by App.tsx. */
  isVisible: boolean;
}

// ─── Role definitions ───────────────────────────────────────────────────────

interface RoleDef {
  id: PreviewRole;
  label: string;
  effectivePlan: SubscriptionPlan;
  icon: React.ReactNode;
  idle: string;
  active: string;
  desc: string;
}

// Plan-based role descs come from PRICING_CARDS.shortDescription (plans.ts).
// BetaTester and Admin are role-grant entries — their descs are not plan-driven.
const ROLES: RoleDef[] = [
  {
    id: 'Explorer',
    label: 'Explorer',
    effectivePlan: 'Explorer',
    icon: <Shield className="w-3.5 h-3.5" />,
    idle: 'bg-white border-slate-200 text-gray-700 hover:bg-gray-50',
    active: 'bg-gray-800 text-white border-gray-800 ring-2 ring-gray-400',
    desc: planDesc('Explorer'),
  },
  {
    id: 'Pro',
    label: 'Pro',
    effectivePlan: 'Pro',
    icon: <Zap className="w-3.5 h-3.5" />,
    idle: 'bg-white border-slate-200 text-indigo-700 hover:bg-indigo-50',
    active: 'bg-indigo-700 text-white border-indigo-700 ring-2 ring-indigo-300',
    desc: planDesc('Pro'),
  },
  {
    id: 'ProPlus',
    label: 'Pro+',
    effectivePlan: 'Pro+',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    idle: 'bg-white border-slate-200 text-purple-700 hover:bg-purple-50',
    active: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-purple-600 ring-2 ring-purple-300',
    desc: planDesc('Pro+'),
  },
  {
    id: 'Enterprise',
    label: 'Enterprise',
    effectivePlan: 'Enterprise',
    icon: <Building2 className="w-3.5 h-3.5" />,
    idle: 'bg-white border-slate-200 text-indigo-700 hover:bg-indigo-50',
    active: 'bg-indigo-900 text-white border-indigo-900 ring-2 ring-indigo-400',
    desc: planDesc('Enterprise'),
  },
  {
    id: 'BetaTester',
    label: 'BetaTester',
    effectivePlan: 'Pro+',
    icon: <FlaskConical className="w-3.5 h-3.5" />,
    idle: 'bg-white border-slate-200 text-emerald-700 hover:bg-emerald-50',
    active: 'bg-emerald-700 text-white border-emerald-700 ring-2 ring-emerald-400',
    desc: 'Role grant → Pro+ features',   // role-based, not a plan — hardcoded intentionally
  },
  {
    id: 'Admin',
    label: 'Admin',
    effectivePlan: 'Enterprise',
    icon: <ShieldAlert className="w-3.5 h-3.5" />,
    idle: 'bg-white border-slate-200 text-amber-700 hover:bg-amber-50',
    active: 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300',
    desc: 'Role grant → Enterprise access', // role-based, not a plan — hardcoded intentionally
  },
];

// ─── Env status row ─────────────────────────────────────────────────────────

interface StatusRowProps {
  label: string;
  live: boolean;
  liveLabel: string;
  mockLabel: string;
}

const StatusRow: React.FC<StatusRowProps> = ({ label, live, liveLabel, mockLabel }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
    {live ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wide">
        <CheckCircle2 className="w-2.5 h-2.5" />
        {liveLabel}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-wide">
        <AlertCircle className="w-2.5 h-2.5" />
        {mockLabel}
      </span>
    )}
  </div>
);

// ─── Component ──────────────────────────────────────────────────────────────

export const DevAdminPanel: React.FC<DevAdminPanelProps> = ({
  currentPlan,
  previewRole,
  currentUser,
  onSetPreview,
  isVisible,
}) => {
  const [minimized, setMinimized] = useState(true);
  const [envExpanded, setEnvExpanded] = useState(false);

  if (!isVisible) return null;

  const inDemoMode = isDemoMode;
  // True when visible purely because the signed-in user is Admin (not demo mode).
  const isAdminSession = !inDemoMode && currentUser?.role === 'Admin';
  const supabaseActive = AuthService.isSupabaseActive();

  const previewActive = previewRole !== null;
  const activeRoleDef = ROLES.find(r => r.id === previewRole);

  // ── Minimized pill ─────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 print:hidden">
        <button
          onClick={() => setMinimized(false)}
          className={`flex items-center gap-2 px-4 py-2.5 backdrop-blur-md text-white text-xs font-bold rounded-2xl shadow-2xl border transition-all cursor-pointer ${
            previewActive
              ? 'bg-amber-600/95 border-amber-500 hover:bg-amber-700'
              : inDemoMode
              ? 'bg-gray-900/95 border-gray-700 hover:bg-black'
              : 'bg-amber-700/95 border-amber-600 hover:bg-amber-800'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5 shrink-0" />
          {previewActive ? (
            <span>Viewing as <strong>{activeRoleDef?.label ?? previewRole}</strong></span>
          ) : (
            <span>{isAdminSession ? 'Admin Panel' : 'Preview Mode'}: {currentPlan}</span>
          )}
          <ChevronUp className="w-3 h-3 opacity-60 ml-0.5" />
        </button>
      </div>
    );
  }

  // ── Expanded panel ─────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[90vw] max-w-[268px] print:hidden">
      <div className="bg-white/97 rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden backdrop-blur-sm">

        {/* Header */}
        <div className={`flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 ${
          isAdminSession ? 'bg-amber-50/60' : 'bg-slate-50/80'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-widest border ${
              isAdminSession
                ? 'bg-amber-100/80 text-amber-700 border-amber-200/80'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isAdminSession ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isAdminSession ? 'Admin' : 'Dev'}
            </span>
            <span className="text-xs font-semibold text-slate-700">
              Admin Panel
            </span>
          </div>
          <button
            onClick={() => setMinimized(true)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Minimise"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* "Viewing as" badge — shown when a preview is active */}
        {previewActive && (
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-amber-50/70 border-b border-amber-100/80">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-xs font-black text-amber-800">
                Viewing as <span className="uppercase tracking-wide">{activeRoleDef?.label ?? previewRole}</span>
                <span className="font-normal text-amber-600 ml-1">→ {activeRoleDef?.effectivePlan ?? currentPlan} access</span>
              </span>
            </div>
            <button
              onClick={() => onSetPreview(null)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-amber-200 rounded-lg text-[10px] font-black text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
              title="Return to your real plan"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Reset
            </button>
          </div>
        )}

        {/* Environment Status */}
        <div className="border-b border-gray-100">
          <button
            onClick={() => setEnvExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                System Status
              </span>
            </div>
            <div className="flex items-center gap-2">
              {inDemoMode ? (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-700">Demo</span>
              ) : (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-700">Live</span>
              )}
              {envExpanded
                ? <ChevronUp className="w-3 h-3 text-gray-400" />
                : <ChevronDown className="w-3 h-3 text-gray-400" />
              }
            </div>
          </button>

          {envExpanded && (
            <div className="px-4 pb-3">
              <StatusRow
                label="Mode"
                live={!inDemoMode}
                liveLabel="Live"
                mockLabel="Demo"
              />
              <StatusRow
                label="Auth"
                live={supabaseActive}
                liveLabel="Supabase"
                mockLabel="Demo session"
              />
              <StatusRow
                label="AI / Reports"
                live={!appConfig.useMockGemini}
                liveLabel="Live Gemini"
                mockLabel="Mock data"
              />
              <StatusRow
                label="Stripe"
                live={!appConfig.useMockStripe}
                liveLabel="Live"
                mockLabel="Mock"
              />
              <StatusRow
                label="Usage limits"
                live={!appConfig.useMockUsageLimits}
                liveLabel="Real"
                mockLabel="Mock"
              />
              <StatusRow
                label="Saved reports"
                live={!appConfig.useMockSavedReports}
                liveLabel="Supabase"
                mockLabel="Mock seed"
              />
              {/* Active plan row */}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-dashed border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active plan</span>
                <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                  previewActive
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-gray-100 border-gray-200 text-gray-700'
                }`}>
                  {currentPlan}{previewActive ? ' (preview)' : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Preview role selector */}
        <div className="p-3 space-y-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              Preview as Role
            </p>
            {previewActive && (
              <button
                onClick={() => onSetPreview(null)}
                className="text-[9px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-wide cursor-pointer transition-colors"
              >
                Reset →real self
              </button>
            )}
          </div>

          {!previewActive && (
            <p className="text-[11px] text-gray-400 leading-normal mb-2.5">
              {isAdminSession
                ? 'UI-only preview — no DB writes, real session unchanged.'
                : 'Preview plan-gated features. UI only — no subscription changes.'}
            </p>
          )}

          {ROLES.map(role => {
            const isActive = previewRole === role.id;
            return (
              <button
                key={role.id}
                onClick={() => onSetPreview(isActive ? null : role.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                  isActive ? role.active : role.idle
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? 'bg-white/15' : 'bg-gray-50'}`}>
                    {role.icon}
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide leading-none">
                      {role.label}
                    </p>
                    <p className={`text-[10px] mt-0.5 leading-none ${isActive ? 'text-white/75' : 'text-gray-400'}`}>
                      {role.desc}
                    </p>
                  </div>
                </div>
                {isActive ? (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/20 border border-white/25 text-white ml-2 shrink-0">
                    Active
                  </span>
                ) : (
                  <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0 ml-2 ${
                    role.effectivePlan === 'Enterprise' ? 'bg-indigo-50 text-indigo-400' :
                    role.effectivePlan === 'Pro+' ? 'bg-purple-50 text-purple-400' :
                    role.effectivePlan === 'Pro' ? 'bg-blue-50 text-blue-400' :
                    'bg-gray-50 text-gray-400'
                  }`}>
                    {role.effectivePlan}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer — real session info */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
          {currentUser ? (
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span className="truncate max-w-[60%]" title={currentUser.email}>
                {currentUser.email}
              </span>
              <span className="font-bold text-gray-500 uppercase tracking-wide shrink-0 ml-2">
                {currentUser.role} · {currentUser.subscription_tier}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span>Not signed in</span>
              <span className="font-semibold uppercase tracking-wide">
                {inDemoMode ? 'Demo Mode' : 'Admin Panel'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
