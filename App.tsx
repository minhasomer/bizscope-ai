import React, { useState, useEffect, useCallback } from 'react';
import { Hero } from './components/Hero';
import { ReportDisplay } from './components/ReportDisplay';
import { Loader } from './components/Loader';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { PricingTiers } from './components/PricingTiers';
import { OpportunityExplorer } from './components/OpportunityExplorer';
import { SavedReports } from './components/SavedReports';
import { SavedReportsService } from './services/savedReportsService';
import { generateViabilityReport } from './services/geminiService';
import { isDemoMode } from './src/config/appConfig';
import type { ViabilityReport } from './types';
import { useGeolocation } from './hooks/useGeolocation';
import { mockSavedReports } from './src/data/mockSavedReports.js';
import { AlertTriangle, Sparkles, Lock } from 'lucide-react';
import { SubscriptionPlan, canSaveReports, isAdmin, previewRoleToEffectivePlan } from './src/utils/planUtils';
import { DevAdminPanel, PreviewRole } from './components/DevAdminPanel';
import { UsageTrackerService, UsageDetails } from './services/usageTrackerService';
import { ReportCacheService } from './services/reportCacheService';
import { AuthScreen } from './components/AuthScreen';
import { AccountSettings } from './components/AccountSettings';
import { BillingPage } from './components/BillingPage';
import { AuthService, UserProfile } from './services/authService';
import { StripeService } from './services/stripeService';
import { ProfileService } from './services/profileService';
import { getEffectivePlan } from './src/utils/planUtils';
import { parseSEORoute, SEORouteMatch } from './src/utils/seoUtils';
import { bootstrapGuardrails } from './src/lib/guardrails';
import { LiveModeConfirmModal } from './components/LiveModeConfirmModal';
import { BestBusinessesTemplate } from './components/seo/BestBusinessesTemplate';
import { BusinessViabilityTemplate } from './components/seo/BusinessViabilityTemplate';
import { FranchiseOpportunitiesTemplate } from './components/seo/FranchiseOpportunitiesTemplate';
import { MarketGapsTemplate } from './components/seo/MarketGapsTemplate';
import { SampleReports } from './components/SampleReports';
import { ReportSummaryCard } from './components/ReportSummaryCard';
import { ResetPasswordPage } from './components/ResetPasswordPage';

const formatResetTime = (date: Date | null): string => {
  if (!date) return 'No reset cycle required';
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return 'Resetting now...';
  
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours > 1 ? 's' : ''} left`;
  }
  const diffDays = Math.ceil(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} left`;
};

const App: React.FC = () => {
  const [seoRoute] = useState<SEORouteMatch | null>(() => parseSEORoute(window.location.pathname));
  const [report, setReport] = useState<ViabilityReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<string>('home');
  const { location: userLocation } = useGeolocation();

  // User Authentication States
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Real plan from Supabase/Stripe. Never overwritten by the preview panel.
  const [baseUserPlan, setBaseUserPlan] = useState<SubscriptionPlan>(() => {
    const stored = localStorage.getItem('bizscope_user_plan');
    return (stored as SubscriptionPlan) || 'Explorer';
  });

  // Role being previewed in DevAdminPanel (null = viewing as real self).
  const [previewRole, setPreviewRole] = useState<PreviewRole | null>(null);

  // Pending live-mode report request waiting for admin confirmation.
  const [pendingLiveRequest, setPendingLiveRequest] = useState<{
    businessType: string;
    location: string;
    forceRegenerate: boolean;
  } | null>(null);

  // Effective plan driving all feature gating — preview wins when active.
  const userPlan: SubscriptionPlan = previewRole !== null
    ? previewRoleToEffectivePlan(previewRole) as SubscriptionPlan
    : baseUserPlan;

  // Log active service configuration once on mount (collapsed console group).
  useEffect(() => { bootstrapGuardrails(); }, []);

  // Load session on mount + subscribe to real-time auth state changes
  useEffect(() => {
    // 1. Subscribe first so OAuth redirects & token refreshes are never missed
    const unsubscribe = AuthService.subscribeToAuthChanges(
      (user) => {
        setCurrentUser(user);
        if (user) {
          setBaseUserPlan(user.plan as SubscriptionPlan);
          localStorage.setItem('bizscope_user_email', user.email);
        } else {
          setBaseUserPlan('Explorer');
          setPreviewRole(null);
          setCurrentView('home');
        }
        setAuthLoading(false);
      },
      () => setCurrentView('reset-password'),
    );

    // 2. Load the existing session (page refresh / direct visit).
    //
    // getInitialSession() is now a fast JWT-only check (~50 ms) — it no longer
    // blocks on a DB profile fetch. The INITIAL_SESSION handler registered above
    // in subscribeToAuthChanges runs concurrently and updates plan/role from the
    // DB in the background without holding authLoading.
    const initAuth = async () => {
      setAuthLoading(true);
      // Safety net: covers only getSession() hangs (e.g. Supabase navigator.locks
      // Web Lock contention). 5 s is enough since we no longer wait for a DB call.
      const loadingTimeout = setTimeout(() => {
        console.error('[Auth] initAuth safety timeout fired after 5s — forcing authLoading=false');
        setAuthLoading(false);
      }, 5000);
      try {
        const { user } = await AuthService.getInitialSession();
        if (user) {
          // Use functional update: if the INITIAL_SESSION subscription handler
          // already resolved and set a full profile, don't overwrite it with the
          // lighter JWT-only snapshot returned by getInitialSession().
          setCurrentUser(prev => prev ?? user);
          setBaseUserPlan(prev => prev !== 'Explorer' ? prev : user.plan as SubscriptionPlan);
          localStorage.setItem('bizscope_user_email', user.email);
        }
      } catch (err) {
        console.error('[Auth] Session loading failed:', err);
      } finally {
        clearTimeout(loadingTimeout);
        setAuthLoading(false);
      }
    };
    initAuth();

    return unsubscribe;
  }, []);

  // Keep track of reports run count for the daily limits rule
  const [reportsRunCount, setReportsRunCount] = useState<number>(() => {
    const stored = localStorage.getItem('bizscope_reports_run_count');
    return stored ? parseInt(stored) : 0;
  });

  const [usage, setUsage] = useState<UsageDetails>(() => UsageTrackerService.getDetails(baseUserPlan));

  useEffect(() => {
    const handleUsageUpdate = () => {
      const u = UsageTrackerService.getDetails(userPlan);
      setUsage(u);
      setReportsRunCount(u.standardUsed);
    };
    window.addEventListener('bizscope_usage_update', handleUsageUpdate);
    // Initialize standard count
    setReportsRunCount(usage.standardUsed);
    return () => {
      window.removeEventListener('bizscope_usage_update', handleUsageUpdate);
    };
  }, [userPlan, usage.standardUsed]);

  const [showLimitModal, setShowLimitModal] = useState<boolean>(false);
  const [savedReports, setSavedReports] = useState<ViabilityReport[]>([]);

  // Contact form state
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [contactErrors, setContactErrors] = useState<{ email?: string; message?: string }>({});

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { email?: string; message?: string } = {};
    if (!contactEmail.trim()) errs.email = 'Email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errs.email = 'Enter a valid email address.';
    if (!contactMessage.trim()) errs.message = 'Message is required.';
    if (Object.keys(errs).length > 0) { setContactErrors(errs); return; }
    setContactErrors({});
    setContactStatus('sending');
    // Simulated submission — replace with real API call when backend endpoint exists.
    await new Promise(r => setTimeout(r, 1500));
    setContactStatus('sent');
    setContactEmail('');
    setContactMessage('');
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setBaseUserPlan(plan);
    setPreviewRole(null);
    const u = UsageTrackerService.getDetails(plan);
    setUsage(u);
    setReportsRunCount(u.standardUsed);

    // In demo mode: persist the switcher choice to localStorage and update the cached user object.
    // In live mode: plan is DB-authoritative — saveUserPlan is a no-op, and currentUser.plan
    // is not mutated here (it reflects the real subscription_tier from Supabase).
    if (isDemoMode) {
      localStorage.setItem('bizscope_user_plan', plan);
      if (currentUser) {
        AuthService.saveUserPlan(currentUser.email, plan);
        setCurrentUser(prev => prev ? { ...prev, plan } : null);
      }
    }
  };

  /**
   * Re-fetch the Supabase profile and sync the effective plan into state.
   * Call this after a Stripe checkout success redirect to pick up the new tier
   * without requiring the user to sign out and back in.
   */
  const handleRefreshProfile = async () => {
    if (!currentUser || !AuthService.isSupabaseActive() || isDemoMode) return;
    const profile = await ProfileService.refreshUserProfile(currentUser.id);
    if (!profile) return;
    const effectivePlan = getEffectivePlan(
      { role: profile.role, subscription_tier: profile.subscription_tier },
      null,
    ) as SubscriptionPlan;
    setBaseUserPlan(effectivePlan);
    setPreviewRole(null);
    setCurrentUser(prev =>
      prev
        ? { ...prev, plan: effectivePlan, role: profile.role, subscription_tier: profile.subscription_tier }
        : null,
    );
  };

  const handleUpdateProfile = async (newName: string) => {
    if (!currentUser) return;
    const updated = await AuthService.updateProfile(currentUser.email, newName);
    setCurrentUser(updated);
  };

  const handleSignOut = async () => {
    await AuthService.signOut();
    setCurrentUser(null);
    setCurrentView('home');
    setBaseUserPlan('Explorer');
    setPreviewRole(null);
  };

  const handleSetPreview = (role: PreviewRole | null) => {
    setPreviewRole(role);
    const plan = role !== null ? previewRoleToEffectivePlan(role) as SubscriptionPlan : baseUserPlan;
    const u = UsageTrackerService.getDetails(plan);
    setUsage(u);
    setReportsRunCount(u.standardUsed);
  };

  const syncSavedReports = async () => {
    try {
      const reports = await SavedReportsService.getReports();
      setSavedReports(reports);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    syncSavedReports();
    window.addEventListener('bizscope_reports_changed', syncSavedReports);
    return () => {
      window.removeEventListener('bizscope_reports_changed', syncSavedReports);
    };
  }, []);

  const handleDeleteReport = async (indexOrId: number | string) => {
    try {
      if (typeof indexOrId === 'string') {
        await SavedReportsService.deleteReport(indexOrId);
      } else {
        const reports = await SavedReportsService.getReports();
        if (indexOrId >= 0 && indexOrId < reports.length) {
          await SavedReportsService.deleteReport(reports[indexOrId].id);
        }
      }
      syncSavedReports();
    } catch(e) {
      console.error(e);
    }
  };

  /**
   * Core generation logic — handles the actual Gemini call (or mock in Demo Mode).
   * Extracted so both handleAnalysisRequest and the live-mode confirm modal can call it.
   */
  const runAnalysis = useCallback(async (
    businessType: string,
    location: string,
    forceRegenerate: boolean,
  ) => {
    setIsLoading(true);
    setError(null);
    setReport(null);
    setCurrentView('home');

    setTimeout(() => {
      const resultsElement = document.getElementById('results-section');
      if (resultsElement) resultsElement.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      if (forceRegenerate) {
        await ReportCacheService.invalidate(businessType, location, 'standard', userPlan);
      }

      const fullReport = await generateViabilityReport(
        businessType,
        location,
        userLocation,
        setLoadingMessage,
        userPlan,
        forceRegenerate,
      );
      setReport(fullReport);

      if (fullReport && !fullReport.loadedFromCache) {
        await UsageTrackerService.incrementStandardUsage(userPlan);
        const u = UsageTrackerService.getDetails(userPlan);
        setUsage(u);
        setReportsRunCount(u.standardUsed);
      }
    } catch (err) {
      console.error(err);
      const rawMessage = err instanceof Error ? err.message : 'An unknown error occurred. Please try again.';
      // Surface a targeted hint when the server reports a missing Gemini API key.
      const isMissingKey =
        rawMessage.includes('GEMINI_API_KEY') ||
        rawMessage.includes('MISSING_API_KEY') ||
        rawMessage.toLowerCase().includes('missing gemini api key');
      setError(
        isMissingKey
          ? `${rawMessage} — Ensure GEMINI_API_KEY is set in your server-side .env.local and restart the dev server.`
          : rawMessage,
      );
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [userLocation, userPlan]);

  /**
   * Entry point for all standard report requests.
   * Handles quota checks, cache lookup, and live-mode cost protection for Admin users.
   * Regen requests (forceRegenerate=true) are NOT intercepted here — ReportDisplay
   * already shows its own confirmation modal before calling onRegenerate().
   */
  const handleAnalysisRequest = useCallback(async (
    businessType: string,
    location: string,
    forceRegenerate: boolean = false,
  ) => {
    const currentUsage = UsageTrackerService.getDetails(userPlan);
    let willCallApi = forceRegenerate;

    if (forceRegenerate) {
      if (!currentUsage.canRunStandard) { setShowLimitModal(true); return; }
    } else {
      const cachedReport = await ReportCacheService.get(businessType, location, 'standard', userPlan);
      if (!cachedReport) {
        willCallApi = true;
        if (!currentUsage.canRunStandard) { setShowLimitModal(true); return; }
      }
      // Cache hit → fall through; runAnalysis will serve it from cache immediately.
    }

    // Live-mode cost protection: show confirmation to Admin users on first generation.
    // Regen is already guarded by showRegenConfirm inside ReportDisplay — skip it here.
    if (!isDemoMode && willCallApi && !forceRegenerate && isAdmin(currentUser?.role ?? '')) {
      setPendingLiveRequest({ businessType, location, forceRegenerate });
      return;
    }

    await runAnalysis(businessType, location, forceRegenerate);
  }, [userPlan, currentUser, runAnalysis]);

  /** Admin confirms the live-mode cost prompt → proceed with generation. */
  const handleLiveConfirm = useCallback(async () => {
    if (!pendingLiveRequest) return;
    const { businessType, location, forceRegenerate } = pendingLiveRequest;
    setPendingLiveRequest(null);
    await runAnalysis(businessType, location, forceRegenerate);
  }, [pendingLiveRequest, runAnalysis]);

  /** Admin cancels the live-mode cost prompt → discard the pending request. */
  const handleLiveCancel = useCallback(() => {
    setPendingLiveRequest(null);
  }, []);

  const handleCheckout = async (plan: 'Pro' | 'Pro+') => {
    if (!currentUser) {
      setCurrentView('settings'); // redirect to auth if not signed in
      return;
    }
    try {
      await StripeService.startCheckout(plan, currentUser.email);
    } catch (err) {
      console.error('Stripe checkout failed:', err);
    }
  };

  const renderSEOTemplate = () => {
    if (!seoRoute) return null;
    const navigate = (page: string) => setCurrentView(page);
    switch (seoRoute.type) {
      case 'best-businesses':
        return <BestBusinessesTemplate citySlug={seoRoute.citySlug} onNavigate={navigate} />;
      case 'viability':
        return <BusinessViabilityTemplate businessSlug={seoRoute.businessSlug!} citySlug={seoRoute.citySlug} onNavigate={navigate} />;
      case 'franchise-opportunities':
        return <FranchiseOpportunitiesTemplate citySlug={seoRoute.citySlug} onNavigate={navigate} />;
      case 'market-gaps':
        return <MarketGapsTemplate citySlug={seoRoute.citySlug} onNavigate={navigate} />;
    }
  };

  const renderContent = () => {
    // SEO landing page routes take priority over the main SPA
    if (seoRoute) return renderSEOTemplate();

    // Normalizing view aliases
    let activeView = currentView;
    if (activeView === 'saved-reports') activeView = 'dashboard';

    // Only block non-home views during auth resolution — home renders immediately.
    if (authLoading && activeView !== 'home') {
      return (
        <div className="min-h-[60vh] flex items-center justify-center py-20 px-4">
          <svg className="animate-spin h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      );
    }

    // Intercept protected paths
    const isProtected = ['dashboard', 'settings', 'billing'].includes(activeView);
    if (isProtected && !currentUser) {
      return (
        <div className="max-w-7xl mx-auto py-16 px-4 flex justify-center items-center min-h-[60vh] animate-fade-in">
          <AuthScreen 
            onAuthSuccess={(user) => {
              setCurrentUser(user);
              setBaseUserPlan(user.plan as SubscriptionPlan);
              localStorage.setItem('bizscope_user_email', user.email);
            }} 
          />
        </div>
      );
    }

    switch (activeView) {
      case 'pricing':
        return (
          <div className="max-w-7xl mx-auto py-14 px-4 sm:px-6 lg:px-8 min-h-[60vh] print:hidden">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight sm:text-4xl">
                Simple, Transparent Pricing
              </h2>
              <p className="mt-2 text-base text-gray-550">
                Unlock deep structural data patterns and specialized local opportunities in seconds.
              </p>
            </div>
            <PricingTiers currentPlan={userPlan} onSelectPlan={handleSelectPlan} onCheckout={handleCheckout} />
          </div>
        );
      case 'opportunities':
        return (
          <div className="print:hidden">
            <OpportunityExplorer currentPlan={userPlan} onNavigate={setCurrentView} />
          </div>
        );
      case 'dashboard':
        if (!canSaveReports(userPlan)) {
          return (
            <div className="max-w-4xl mx-auto py-16 px-4 text-center min-h-[70vh] flex flex-col justify-center items-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 border border-blue-150 shadow-xs">
                <Lock className="h-8 w-8 animate-pulse" />
              </div>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider mb-3">
                Pro Feature Gated
              </span>
              <h3 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                Venture Ledger Locked
              </h3>
              <p className="text-gray-500 max-w-lg mb-6 text-sm leading-relaxed">
                Cataloging and tracking your custom generated viability studies inside your persistent workspace dashboard requires a <strong>Pro</strong> subscription tier.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setCurrentView('pricing')}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  View Upgrades / Hot-Swap Plan
                </button>
                <button 
                  onClick={() => setCurrentView('home')}
                  className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-250 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Return Home
                </button>
              </div>
              {isDemoMode && (
                <div className="mt-8 text-xs text-blue-700 bg-blue-50 border border-blue-150 p-3.5 rounded-xl max-w-md shadow-xs">
                  🧪 <strong>Demo Mode:</strong> Switch to <strong>Pro</strong>, <strong>Pro+</strong>, or <strong>Enterprise</strong> using the plan switcher to preview report history.
                </div>
              )}
            </div>
          );
        }
        return (
          <div className="max-w-5xl mx-auto py-8 px-4 min-h-[70vh] print:hidden animate-fade-in">
            <div className="mb-5 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Venture Dashboard</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Manage and compare your saved business viability reports.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentView('home')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  🚀 New Analysis Request
                </button>
                <button
                   onClick={() => setCurrentView('opportunities')}
                  className="px-5 py-2.5 bg-gray-150 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl cursor-pointer border border-gray-200 transition-colors"
                >
                  🔍 Explore Market Gaps
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Reports Ledger */}
              <div className="bg-gradient-to-br from-white to-indigo-50/40 border border-indigo-100/80 p-5 rounded-2xl flex flex-col gap-2.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest">Reports Saved</p>
                <p className="text-3xl font-bold text-slate-900">{savedReports.length}</p>
                <p className="text-[11px] text-slate-400">Saved on this device</p>
              </div>

              {/* Standard Quota */}
              <div className="bg-gradient-to-br from-white to-violet-50/40 border border-violet-100/80 p-5 rounded-2xl flex flex-col gap-2.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-widest">Standard Quota</p>
                <p className="text-3xl font-bold text-slate-900">
                  {usage.standardLimit === null ? '∞' : `${usage.standardUsed}/${usage.standardLimit}`}
                </p>
                <p className="text-[11px] text-slate-400">
                  {usage.standardLimit === null ? 'Unlimited' : `${Math.max(0, usage.standardLimit - usage.standardUsed)} remaining`}
                </p>
              </div>

              {/* Regional Quota */}
              <div className="bg-gradient-to-br from-white to-slate-50/60 border border-slate-100/80 p-5 rounded-2xl flex flex-col gap-2.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Regional Quota</p>
                <p className="text-3xl font-bold text-slate-900">
                  {usage.regionalLimit === 0 ? '—' : usage.regionalLimit === null ? '∞' : `${usage.regionalUsed}/${usage.regionalLimit}`}
                </p>
                <p className="text-[11px] text-slate-400">
                  {usage.regionalLimit === 0 ? 'Pro+ required' : usage.regionalLimit === null ? 'Unlimited' : `${Math.max(0, usage.regionalLimit - usage.regionalUsed)} remaining`}
                </p>
              </div>

              {/* Active Plan */}
              <div className="bg-gradient-to-br from-white to-emerald-50/40 border border-emerald-100/80 p-5 rounded-2xl flex flex-col gap-2.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest">Active Plan</p>
                <p className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{userPlan}</p>
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] text-gray-400">{usage.resetCycleDescription} · {formatResetTime(usage.standardResetDate)}</p>
                  {isDemoMode && (
                    <button
                      onClick={async () => {
                        await UsageTrackerService.resetUsage();
                        const u = UsageTrackerService.getDetails(userPlan);
                        setUsage(u);
                        setReportsRunCount(u.standardUsed);
                        window.dispatchEvent(new Event('bizscope_usage_update'));
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[10px] rounded-lg transition-colors cursor-pointer uppercase tracking-wide self-start"
                    >
                      Reset Quota
                    </button>
                  )}
                </div>
              </div>
            </div>

            <SavedReports 
              reports={savedReports} 
              currentPlan={userPlan}
              onViewReport={(rep) => {
                setReport(rep);
                setCurrentView('report');
              }}
              onDeleteReport={handleDeleteReport}
            />
          </div>
        );
      case 'reset-password':
        return (
          <ResetPasswordPage onSuccess={() => setCurrentView('dashboard')} />
        );
      case 'billing':
        return (
          <BillingPage
            currentPlan={userPlan}
            user={currentUser!}
            onNavigate={setCurrentView}
          />
        );
      case 'settings':
        return (
          <AccountSettings
            user={currentUser!}
            onUpdateProfile={handleUpdateProfile}
            onSignOut={handleSignOut}
            onNavigate={setCurrentView}
          />
        );
      case 'about':
        return (
          <div className="min-h-[60vh] print:hidden">
            {/* Hero — compact */}
            <div className="bg-gradient-to-br from-[#0a0f1e] via-[#1e1b4b] to-[#0f172a] py-10 px-4">
              <div className="max-w-3xl mx-auto text-center">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-4">
                  About BizScope
                </span>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3 leading-tight">
                  Market intelligence built for the real world
                </h1>
                <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                  AI-powered analysis for founders, franchise buyers, and local market researchers — so you know before you invest.
                </p>
              </div>
            </div>

            <div className="max-w-4xl mx-auto py-8 px-4 space-y-10">

              {/* What it does + Who it's for — merged 2-col */}
              <section>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2">What it does</p>
                <h2 className="text-xl font-bold text-slate-900 mb-5">AI-powered viability analysis, in seconds</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  <div>
                    <p className="text-sm text-slate-500 leading-relaxed mb-3">
                      BizScope analyzes the viability of any business idea or franchise concept in any US market. Enter a business type and city — and in seconds you get a structured report covering competitor density, demographic fit, startup cost estimates, market opportunity scoring, risk factors, and AI-driven go/no-go guidance.
                    </p>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Reports combine US Census demographics, economic indicators, and large-language-model analysis — surfacing real signal, not generic advice.
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      {
                        iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600',
                        iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
                        title: 'First-time entrepreneurs',
                        desc: 'Validate your idea and check market fit before investing time or capital.',
                      },
                      {
                        iconBg: 'bg-violet-100', iconColor: 'text-violet-600',
                        iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
                        title: 'Franchise buyers',
                        desc: 'Evaluate franchise opportunities by local demand, competition density, and demographic fit.',
                      },
                      {
                        iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
                        iconPath: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
                        title: 'Expansion planners',
                        desc: 'Identify adjacent markets and underserved ZIP codes before opening a second location.',
                      },
                    ].map(({ iconBg, iconColor, iconPath, title, desc }) => (
                      <div key={title} className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/40 hover:-translate-y-0.5 transition-all duration-200">
                        <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center shrink-0 mt-0.5`}>
                          <svg className={`w-4 h-4 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={iconPath} />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{title}</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* What's inside a report */}
              <section>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2">What you get</p>
                <h2 className="text-xl font-bold text-slate-900 mb-4">What's inside a viability report</h2>
                <div className="bg-gradient-to-br from-slate-900 to-[#0a0f1e] rounded-2xl p-5 border border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {[
                      'Viability Score & Executive Summary',
                      'Competitor Landscape Analysis',
                      'Demographic & Consumer Fit',
                      'Startup Cost Range Estimates',
                      'Risk Factor Assessment',
                      'Market Opportunity Indicators',
                      'Nearby ZIP & Regional Intelligence',
                      'PDF Export & Saved Report History',
                      'AI-Driven Go / No-Go Guidance',
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-xs text-slate-300 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Disclaimer — integrated, no standalone heading */}
              <div className="border-t border-slate-100 pt-5 flex gap-3">
                <svg className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                  <strong className="text-slate-500 font-semibold">Analytical estimates, not guarantees.</strong>{' '}
                  BizScope reports support research and planning — not investment decisions. Market conditions vary and AI models can make assumptions. Validate key findings with local advisors and primary research before committing capital.
                </p>
              </div>

            </div>
          </div>
        );
      case 'contact':
        return (
          <div className="max-w-xl mx-auto py-16 px-4 min-h-[60vh] print:hidden">
            <div className="mb-8">
              <h2 className="text-3xl font-black tracking-tight text-gray-900">Contact Us</h2>
              <p className="text-gray-500 mt-2 text-sm">Have questions about our data or methodology? Reach out to our team.</p>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-gray-150 shadow-sm">
              {contactStatus === 'sent' ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                    <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-1">Message received</h3>
                  <p className="text-sm text-gray-500 mb-6">We'll follow up at the email address you provided within 1–2 business days.</p>
                  <button
                    onClick={() => setContactStatus('idle')}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleContactSubmit} noValidate>
                  <div>
                    <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={e => { setContactEmail(e.target.value); setContactErrors(prev => ({ ...prev, email: undefined })); }}
                      className={`block w-full rounded-xl border focus:ring-2 outline-none px-4 py-3 text-sm text-gray-900 bg-white transition-all ${contactErrors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'}`}
                      placeholder={currentUser?.email || 'you@example.com'}
                      disabled={contactStatus === 'sending'}
                    />
                    {contactErrors.email && <p className="text-xs text-red-600 mt-1">{contactErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider mb-1.5">Message</label>
                    <textarea
                      value={contactMessage}
                      onChange={e => { setContactMessage(e.target.value); setContactErrors(prev => ({ ...prev, message: undefined })); }}
                      className={`block w-full rounded-xl border focus:ring-2 outline-none px-4 py-3 text-sm text-gray-900 bg-white transition-all resize-none ${contactErrors.message ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'}`}
                      rows={4}
                      placeholder="How can we help?"
                      disabled={contactStatus === 'sending'}
                    />
                    {contactErrors.message && <p className="text-xs text-red-600 mt-1">{contactErrors.message}</p>}
                  </div>
                  <button
                    type="submit"
                    disabled={contactStatus === 'sending'}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait text-white px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    {contactStatus === 'sending' ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending…
                      </>
                    ) : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="max-w-3xl mx-auto py-14 px-4 min-h-[60vh] print:hidden">
            <div className="mb-8">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Legal</span>
              <h1 className="text-3xl font-black tracking-tight text-gray-900 mt-1">Privacy Policy</h1>
              <p className="text-gray-400 text-sm mt-1">Last updated: May 2026</p>
            </div>
            <div className="prose prose-sm max-w-none space-y-6 text-gray-600 leading-relaxed">
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">1. Overview</h2>
                <p>BizScope AI ("BizScope", "we", "us") operates an AI-powered business viability analysis platform at this domain. This policy explains what information we collect, how we use it, and your choices. By using BizScope you agree to the practices described here.</p>
                <p className="mt-2 text-xs bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 text-amber-800"><strong>Sandbox notice:</strong> This deployment may be running in sandbox/demo mode. In demo mode, AI outputs are simulated and no real financial transactions are processed.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">2. Information We Collect</h2>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Account data:</strong> Email address, display name, and OAuth profile photo when you sign in via Google or email/password.</li>
                  <li><strong>Usage data:</strong> Business queries you run (business type and location strings), report counts, and feature usage to enforce plan quotas.</li>
                  <li><strong>Technical data:</strong> Browser type, rough IP-derived region, and session tokens managed by Supabase Auth.</li>
                  <li><strong>Saved reports:</strong> Reports you explicitly save to your Dashboard are stored associated with your account.</li>
                </ul>
                <p className="mt-2 text-sm">We do <strong>not</strong> collect payment card numbers directly — Stripe handles all billing data under their own privacy policy.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">3. How We Use Your Information</h2>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Provide and improve the BizScope analysis service.</li>
                  <li>Enforce plan usage limits and subscription features.</li>
                  <li>Send transactional emails (password reset, billing receipts).</li>
                  <li>Debug errors and monitor service reliability.</li>
                </ul>
                <p className="mt-2 text-sm">We do <strong>not</strong> sell your personal data to third parties or use it for advertising.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">4. Data Storage & Security</h2>
                <p className="text-sm">Account and report data is stored in Supabase (hosted on AWS). Data is encrypted in transit (TLS) and at rest. Row-level security policies restrict database access so users can only read and modify their own records.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">5. Third-Party Services</h2>
                <p className="text-sm">BizScope uses: <strong>Supabase</strong> (authentication and database), <strong>Google Gemini API</strong> (AI analysis — your query text is sent to Google's servers), <strong>Stripe</strong> (billing), and <strong>Google OAuth</strong> (sign-in). Each service operates under its own privacy policy.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">6. Your Rights</h2>
                <p className="text-sm">You may request deletion of your account and associated data at any time by contacting us via the Contact page. We will process deletion requests within 30 days.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">7. Contact</h2>
                <p className="text-sm">Questions about this policy? Use the <button onClick={() => setCurrentView('contact')} className="text-indigo-600 hover:underline cursor-pointer">Contact page</button> to reach our team.</p>
              </section>
            </div>
          </div>
        );

      case 'terms':
        return (
          <div className="max-w-3xl mx-auto py-14 px-4 min-h-[60vh] print:hidden">
            <div className="mb-8">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Legal</span>
              <h1 className="text-3xl font-black tracking-tight text-gray-900 mt-1">Terms of Service</h1>
              <p className="text-gray-400 text-sm mt-1">Last updated: May 2026</p>
            </div>
            <div className="prose prose-sm max-w-none space-y-6 text-gray-600 leading-relaxed">
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">1. Acceptance</h2>
                <p>By accessing or using BizScope AI ("Service") you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>
                <p className="mt-2 text-xs bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 text-amber-800"><strong>Sandbox notice:</strong> This deployment may be running in sandbox/demo mode with simulated AI outputs and no real billing.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">2. Description of Service</h2>
                <p className="text-sm">BizScope provides AI-assisted market research and business viability analysis. Reports combine US Census data, economic indicators, and large-language-model synthesis. Outputs are <strong>estimates for research and planning purposes only</strong> — not professional financial, legal, or investment advice.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">3. No Investment Advice</h2>
                <p className="text-sm">BizScope reports do not constitute investment, financial, or legal advice. Market conditions change rapidly. You are solely responsible for any business decisions made in reliance on BizScope output. Always verify key findings with qualified local advisors before committing capital.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">4. Account Responsibilities</h2>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>You must be at least 18 years old to create an account.</li>
                  <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                  <li>You may not share, resell, or redistribute reports generated by BizScope without written permission.</li>
                  <li>You may not use the Service to generate reports for unlawful purposes.</li>
                </ul>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">5. Subscriptions & Billing</h2>
                <p className="text-sm">Paid plans are billed monthly through Stripe. You may cancel at any time; cancellation takes effect at the end of the current billing period. No refunds are issued for partial months. Plan features and pricing may change with 30 days notice.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">6. Intellectual Property</h2>
                <p className="text-sm">The BizScope platform, brand, and underlying software are owned by BizScope and protected by copyright. Reports generated for you are licensed for your personal or business use. You retain no rights to the underlying AI models or data sources.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">7. Limitation of Liability</h2>
                <p className="text-sm">To the maximum extent permitted by law, BizScope is not liable for any indirect, incidental, or consequential damages arising from your use of the Service or reliance on its outputs. Our total liability for any claim is limited to the fees you paid in the 3 months preceding the claim.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">8. Governing Law</h2>
                <p className="text-sm">These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict of law provisions.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">9. Changes to Terms</h2>
                <p className="text-sm">We may update these Terms at any time. Continued use of the Service after changes are posted constitutes acceptance of the updated Terms.</p>
              </section>
              <section>
                <h2 className="text-base font-black text-gray-900 mb-2">10. Contact</h2>
                <p className="text-sm">Questions? Use the <button onClick={() => setCurrentView('contact')} className="text-indigo-600 hover:underline cursor-pointer">Contact page</button>.</p>
              </section>
            </div>
          </div>
        );

      case 'samples':
        return (
          <div className="print:hidden">
            <SampleReports
              onNavigate={setCurrentView}
              onRunSample={(bt, loc) => { handleAnalysisRequest(bt, loc); setCurrentView('home'); }}
            />
          </div>
        );

      case 'report':
        if (!report) {
          return (
            <div className="max-w-xl mx-auto py-16 px-4 text-center min-h-[50vh] flex flex-col items-center justify-center gap-4">
              <p className="text-gray-500 text-sm">No report loaded. Run a viability analysis first.</p>
              <button onClick={() => setCurrentView('home')} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors">
                Go to Home
              </button>
            </div>
          );
        }
        return (
          <div className="bg-gradient-to-b from-gray-50/50 to-white py-8 print:py-0">
            <div className="px-4">
              <ReportDisplay
                report={report}
                currentPlan={userPlan}
                onNavigate={setCurrentView}
                onRegenerate={() => { setCurrentView('home'); handleAnalysisRequest(report.businessType, report.location, true); }}
                isAdminOrDev={!isDemoMode && isAdmin(currentUser?.role ?? '')}
              />
            </div>
          </div>
        );

      default: // Home
        return (
          <>
            <Hero onSubmit={handleAnalysisRequest} onNavigate={setCurrentView} isLoading={isLoading} hasResults={!!report || isLoading} currentPlan={userPlan} />
            
            {/* Results output block — compact preview; full report lives at 'report' view */}
            {(isLoading || error || report) && (
                <div id="results-section" className="bg-gradient-to-b from-gray-50/50 to-white py-8">
                    {isLoading && (
                        <div className="max-w-3xl mx-auto px-4">
                            <Loader message={loadingMessage} />
                        </div>
                    )}

                    {error && (
                         <div className="max-w-3xl mx-auto px-4">
                            <div className="bg-red-50 text-red-800 p-6 rounded-2xl border border-red-100 flex items-start gap-4">
                                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                                  <AlertTriangle className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                  <h3 className="font-black text-sm uppercase tracking-wide mb-1">Analysis Failed</h3>
                                  <p className="text-sm text-red-700/90">{error}</p>
                                </div>
                            </div>
                         </div>
                    )}

                    {report && !isLoading && (
                        <div className="px-4">
                            <ReportSummaryCard
                              report={report}
                              onViewFull={() => setCurrentView('report')}
                              onRegenerate={() => handleAnalysisRequest(report.businessType, report.location, true)}
                            />
                        </div>
                    )}
                </div>
            )}
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 font-sans print:bg-white print:text-black">
      <div className="print:hidden">
        <Navbar onNavigate={setCurrentView} currentPage={currentView} currentPlan={userPlan} user={currentUser} onSignOut={handleSignOut} authLoading={authLoading} />
      </div>
      
      {isDemoMode && (
        <div className="print:hidden bg-slate-900 border-b border-slate-700/60 px-4 py-1.5 flex items-center justify-center gap-3 text-[11px] text-slate-400 font-medium">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>Sandbox Mode — AI calls disabled · Mock data in use</span>
          {AuthService.isSupabaseActive() && (
            <span className="ml-2 text-emerald-400 bg-emerald-900/50 border border-emerald-700/50 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide">
              Live Auth
            </span>
          )}
        </div>
      )}

      <main className="flex-grow">
        {renderContent()}
      </main>

      <div className="print:hidden">
        <Footer onNavigate={setCurrentView} />
      </div>

      <DevAdminPanel
        currentPlan={userPlan}
        previewRole={previewRole}
        currentUser={currentUser}
        onSetPreview={handleSetPreview}
        isVisible={(isDemoMode && currentUser !== null) || (!isDemoMode && isAdmin(currentUser?.role ?? ''))}
      />

      {/* Live-mode cost protection — only shown to Admin users, never in Demo Mode */}
      <LiveModeConfirmModal
        isOpen={pendingLiveRequest !== null}
        reportType="standard"
        businessType={pendingLiveRequest?.businessType ?? ''}
        location={pendingLiveRequest?.location ?? ''}
        onConfirm={handleLiveConfirm}
        onCancel={handleLiveCancel}
      />

      {/* Explorer / Free plan warning modal box */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity cursor-pointer" onClick={() => setShowLimitModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-gray-150">
              <div className="bg-white px-5 pt-6 pb-5 sm:p-6 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-50 text-amber-600 border border-amber-100 mb-4 animate-bounce">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-gray-900" id="modal-title">
                   Explorer Tier Limit Hit
                </h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                   Explorer accounts are limited to <strong>3 standard reports/month</strong>.
                </p>
                {isDemoMode && (
                  <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-150 text-xs text-blue-800 mt-4 text-left leading-normal">
                    ⚡ <strong>Demo Mode:</strong> Switch plans instantly below to try Pro or Pro+ features.
                  </div>
                )}
              </div>
              <div className="bg-gray-50 px-4 py-3.5 sm:px-6 flex flex-col sm:flex-row-reverse gap-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    handleSelectPlan('Pro');
                    setShowLimitModal(false);
                  }}
                  className="w-full inline-flex justify-center rounded-xl shadow-xs px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                   ⚡ Upgrade to Pro
                </button>
                <button
                  onClick={() => {
                    setShowLimitModal(false);
                    setCurrentView('pricing');
                  }}
                  className="w-full inline-flex justify-center rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                   Configure Plans
                </button>
                <button
                  onClick={() => {
                    setReportsRunCount(0);
                    localStorage.setItem('bizscope_reports_run_count', '0');
                    setShowLimitModal(false);
                  }}
                  className="w-full inline-flex justify-center rounded-xl border border-transparent text-[10px] font-black text-gray-400 hover:text-gray-600 cursor-pointer text-center"
                >
                   (Bypass Limit for testing)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
