
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, MapPin, TrendingUp, DollarSign, Users, ChevronRight, ChevronDown, Info,
  Lock, Filter, AlertTriangle, Trophy, Medal, Award, Star, Target,
  ArrowUpDown, X, Sparkles, ArrowRight, ShieldCheck, BarChart2, Briefcase, Layers
} from 'lucide-react';
import type { OpportunityReport, BusinessOpportunity } from '../types';
import { generateOpportunityReport, generateOpportunityDossier } from '../services/geminiService';
import { SavedReportsService } from '../services/savedReportsService';
import { Loader, REPORT_LOADING_MESSAGES } from './Loader';
import { SubscriptionPlan } from '../src/utils/planUtils';
import { filterLocationSuggestions, fetchLocationAutocomplete } from '../src/data/locationSuggestionsData';
import { resolveLocationDisplay } from '../src/utils/locationUtils';
import { checkBlockedCategory, blockedCategoryMessage } from '../src/utils/blockedCategories';

type FilterType = 'all' | 'low-capital' | 'low-competition' | 'low-overhead';
type SortType = 'score' | 'startup-cost' | 'competition';

// ─── Opportunity tier mapping ────────────────────────────────────────────────

interface OpportunityTier {
  label: string;
  emoji: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

// Prefer estimatedViabilityScore (formula-derived) over deprecated overallPotental
function resolveViabilityScore(scores: { estimatedViabilityScore?: number; overallPotental: number }): number {
  return scores.estimatedViabilityScore ?? scores.overallPotental;
}

function getOpportunityTier(score: number): OpportunityTier {
  if (score >= 90) return { label: 'Top Opportunity',      emoji: '🥇', badgeBg: 'bg-yellow-50',  badgeBorder: 'border-yellow-200', badgeText: 'text-yellow-800' };
  if (score >= 80) return { label: 'High Potential',       emoji: '🥈', badgeBg: 'bg-slate-50',   badgeBorder: 'border-slate-300',  badgeText: 'text-slate-700'  };
  if (score >= 70) return { label: 'Promising',            emoji: '🥉', badgeBg: 'bg-orange-50',  badgeBorder: 'border-orange-200', badgeText: 'text-orange-800' };
  if (score >= 60) return { label: 'Emerging Opportunity', emoji: '⭐', badgeBg: 'bg-blue-50',    badgeBorder: 'border-blue-200',   badgeText: 'text-blue-800'   };
  return              { label: 'Niche Opportunity',        emoji: '📍', badgeBg: 'bg-gray-50',    badgeBorder: 'border-gray-200',   badgeText: 'text-gray-700'   };
}

interface OpportunityExplorerProps {
  currentPlan: SubscriptionPlan;
  onNavigate: (page: string) => void;
  userRole?: string;
  isAuthenticated?: boolean;
  initialReport?: OpportunityReport | null;
}

const PLAN_LIMITS: Record<SubscriptionPlan, number> = {
  Explorer: 2,
  Pro: 5,
  'Pro+': 5,
  Enterprise: 5,
};

const RANK_CONFIGS = [
  { badge: 'bg-yellow-400 text-yellow-900 border-yellow-300', Icon: Trophy, label: '#1' },
  { badge: 'bg-gray-200 text-gray-700 border-gray-300', Icon: Medal, label: '#2' },
  { badge: 'bg-orange-300 text-orange-900 border-orange-200', Icon: Award, label: '#3' },
];

export const OpportunityExplorer: React.FC<OpportunityExplorerProps> = ({ currentPlan, onNavigate, userRole = '', isAuthenticated = false, initialReport = null }) => {
  const [location, setLocation] = useState(initialReport?.location ?? '');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState(-1);
  const locationRef = useRef<HTMLDivElement>(null);

  const [report, setReport] = useState<OpportunityReport | null>(initialReport ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Mobile interruption recovery — same pattern as viability reports in App.tsx.
  // showRecoveryBanner: shown when a pending record is found on mount (tab discard).
  // pendingLocation: the location to retry when the user taps Recover Analysis.
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('score');
  const [selectedDossier, setSelectedDossier] = useState<BusinessOpportunity | null>(null);
  const [selectedDossierRank, setSelectedDossierRank] = useState<number>(1);
  const [dossierLoading, setDossierLoading] = useState<string | null>(null);
  const [dossierError, setDossierError] = useState<string | null>(null);
  const dossierCacheRef = useRef<Map<string, BusinessOpportunity>>(new Map());

  // Close location dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Restore a saved Market Gap Report without calling the API.
  // Fires when App.tsx sets initialReport after the user opens a saved report
  // from the dashboard while this component is already mounted.
  useEffect(() => {
    if (initialReport) {
      setReport(initialReport);
      setLocation(initialReport.location);
    }
  }, [initialReport]);

  // On mount: check for a pending market gap analysis written before the tab
  // was discarded. sessionStorage survives Android Chrome tab discard/reload
  // (cleared only on explicit tab close). If a recent record exists, show the
  // amber recovery banner so the user can fetch the result from report_cache.
  useEffect(() => {
    const PENDING_KEY = 'bizscope_pending_market_gap';
    const MAX_AGE_MS  = 10 * 60 * 1000; // 10 minutes
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const pending = JSON.parse(raw) as {
        location: string;
        startedAt: number;
      };
      const ageMs = Date.now() - (pending.startedAt ?? 0);
      if (ageMs < MAX_AGE_MS && typeof pending.location === 'string' && pending.location.trim()) {
        setPendingLocation(pending.location);
        setShowRecoveryBanner(true);
      } else {
        sessionStorage.removeItem(PENDING_KEY);
      }
    } catch {
      sessionStorage.removeItem('bizscope_pending_market_gap');
    }
  }, []);

  // Async location autocomplete — static results appear instantly, Photon upgrades
  // them after 300 ms. Falls back to static list on any network error.
  const [locationDropdownItems, setLocationDropdownItems] = useState<string[]>(() =>
    filterLocationSuggestions(location),
  );
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    if (!location.trim()) {
      setLocationDropdownItems(filterLocationSuggestions(''));
      return;
    }
    setLocationDropdownItems(filterLocationSuggestions(location));
    locationDebounceRef.current = setTimeout(async () => {
      const results = await fetchLocationAutocomplete(location);
      setLocationDropdownItems(results);
    }, 300);
    return () => { if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current); };
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenDossier = useCallback(async (opportunity: BusinessOpportunity, rank: number) => {
    setSelectedDossierRank(rank);
    setDossierError(null);

    // Blocked category guard
    const blockedCheck = checkBlockedCategory(opportunity.businessType);
    if (blockedCheck.matched) {
      setError(blockedCategoryMessage(blockedCheck.category));
      return;
    }

    const cacheKey = `${opportunity.businessType}|${report?.location ?? ''}`;

    // Cache hit — reuse without re-generating
    const cached = dossierCacheRef.current.get(cacheKey);
    if (cached) {
      console.log(`[Dossier] Cache hit: "${opportunity.businessType}"`);
      setSelectedDossier(cached);
      return;
    }

    // Already has full dossier data from the search response (mock or pre-loaded)
    if (opportunity.executiveSummary || opportunity.marketDemand || opportunity.opportunityScorecard) {
      console.log(`[Dossier] Using pre-loaded dossier: "${opportunity.businessType}"`);
      dossierCacheRef.current.set(cacheKey, opportunity);
      setSelectedDossier(opportunity);
      return;
    }

    // Generate on demand
    setDossierLoading(opportunity.businessType);
    try {
      console.log(`[Dossier] Generating on demand: "${opportunity.businessType}" in "${report?.location ?? ''}"`);
      const dossierFields = await generateOpportunityDossier(opportunity, report?.location ?? '', userRole);
      const enriched: BusinessOpportunity = { ...opportunity, ...dossierFields };
      dossierCacheRef.current.set(cacheKey, enriched);
      setSelectedDossier(enriched);
    } catch (err: any) {
      console.error('[Dossier] Generation failed:', err);
      const message: string = typeof err?.message === 'string' ? err.message : 'Analysis generation failed. Please try again.';
      setDossierError(message);
      // Still open modal with basic card data so the user sees what we have
      setSelectedDossier(opportunity);
    } finally {
      setDossierLoading(null);
    }
  }, [report?.location, userRole]);

  const visibleLimit = PLAN_LIMITS[currentPlan];
  const showRegionalContext = currentPlan === 'Pro+' || currentPlan === 'Enterprise';

  // For Explorer: lock by SET MEMBERSHIP against the canonical top-N (raw score order),
  // not by position in the sorted result. This prevents sort/filter from rotating
  // different items into the visible slots.
  const canonicalVisibleTypes = useMemo(() => {
    if (!report || currentPlan !== 'Explorer') return null;
    return new Set(
      [...report.topOpportunities]
        .sort((a, b) => resolveViabilityScore(b.scores) - resolveViabilityScore(a.scores))
        .slice(0, visibleLimit)
        .map(o => o.businessType),
    );
  }, [report, currentPlan, visibleLimit]);

  // runSearchForLocation: shared core used by both the normal search form and the
  // recovery banner. Accepts an explicit locationOverride so recovery can pass the
  // saved location without waiting for setLocation() state to settle.
  const runSearchForLocation = async (locationStr: string, forceRegenerate: boolean) => {
    setLocation(locationStr);
    setShowLocationSuggestions(false);
    setShowRecoveryBanner(false);
    setIsLoading(true);
    setError(null);
    if (!forceRegenerate) setReport(null);

    sessionStorage.setItem('bizscope_pending_market_gap', JSON.stringify({
      location: locationStr,
      startedAt: Date.now(),
    }));

    try {
      const displayLocation = await resolveLocationDisplay(locationStr);
      if (displayLocation !== locationStr) setLocation(displayLocation);
      const result = await generateOpportunityReport(displayLocation, setLoadingMessage, userRole, forceRegenerate);
      setReport(result);
      sessionStorage.removeItem('bizscope_pending_market_gap');

      if (isAuthenticated && result) {
        SavedReportsService.saveMarketGapReport(result).catch((err) =>
          console.warn('[OpportunityExplorer] Auto-save market gap report failed:', err),
        );
      }
    } catch (err) {
      sessionStorage.removeItem('bizscope_pending_market_gap');
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to analyze opportunities');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const runSearch = async (forceRegenerate = false) => {
    if (!location.trim()) return;

    setShowLocationSuggestions(false);
    setShowRecoveryBanner(false);
    setIsLoading(true);
    setError(null);
    if (!forceRegenerate) setReport(null);

    // Persist params so they survive a tab discard / page reload on Android Chrome.
    // Cleared on successful report display below. The mount effect reads this on
    // reload and shows the recovery banner if the record is < 10 minutes old.
    sessionStorage.setItem('bizscope_pending_market_gap', JSON.stringify({
      location: location.trim(),
      startedAt: Date.now(),
    }));

    try {
      const displayLocation = await resolveLocationDisplay(location.trim());
      if (displayLocation !== location.trim()) setLocation(displayLocation);
      const result = await generateOpportunityReport(displayLocation, setLoadingMessage, userRole, forceRegenerate);
      setReport(result);
      sessionStorage.removeItem('bizscope_pending_market_gap');

      // Auto-save for authenticated users — deduplicates by location, no quota consumed.
      if (isAuthenticated && result) {
        SavedReportsService.saveMarketGapReport(result).catch((err) =>
          console.warn('[OpportunityExplorer] Auto-save market gap report failed:', err),
        );
      }
    } catch (err) {
      sessionStorage.removeItem('bizscope_pending_market_gap');
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to analyze opportunities');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); runSearch(false); };

  const processedOpportunities = useMemo(() => {
    if (!report) return [];

    let opps = [...report.topOpportunities];

    if (filter === 'low-capital') opps = opps.filter(o => o.scores.capEx <= 4);
    else if (filter === 'low-competition') opps = opps.filter(o => o.scores.competitionLevel <= 4);
    else if (filter === 'low-overhead') opps = opps.filter(o => o.scores.overhead <= 4);

    if (sort === 'score') opps.sort((a, b) => resolveViabilityScore(b.scores) - resolveViabilityScore(a.scores));
    else if (sort === 'startup-cost') opps.sort((a, b) => a.scores.capEx - b.scores.capEx);
    else if (sort === 'competition') opps.sort((a, b) => a.scores.competitionLevel - b.scores.competitionLevel);

    return opps;
  }, [report, filter, sort]);

  const visibleCount = canonicalVisibleTypes
    ? processedOpportunities.filter(o => canonicalVisibleTypes.has(o.businessType)).length
    : Math.min(processedOpportunities.length, visibleLimit);
  const lockedCount = processedOpportunities.length - visibleCount;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
          Find High-Potential Markets Before They're Crowded
        </h2>
        <p className="text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
          Enter any US city, ZIP code, or county to surface underserved business niches ranked by potential, competition, and capital requirements.
        </p>

        {/* Plan access indicator */}
        <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-600">
          {currentPlan === 'Explorer' ? (
            <>
              <Lock className="w-3 h-3 text-amber-500" />
              <span>Explorer plan — top 2 visible</span>
              <span className="text-slate-300">·</span>
              <button
                onClick={() => onNavigate('pricing')}
                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                Upgrade for full access →
              </button>
            </>
          ) : currentPlan === 'Pro' ? (
            <>
              <Trophy className="w-3 h-3 text-indigo-500" />
              <span>Pro — top 5 opportunities unlocked</span>
            </>
          ) : (
            <>
              <Star className="w-3 h-3 text-violet-500" />
              <span>{currentPlan} — full access + regional context</span>
            </>
          )}
        </div>
      </div>

      {/* Search form */}
      <div className="max-w-2xl mx-auto mb-8">
        <form onSubmit={handleSearch}>
          <div className="relative group" ref={locationRef}>
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors z-10">
              <MapPin className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={location}
              onChange={(e) => { setLocation(e.target.value); setActiveLocationIndex(-1); setShowLocationSuggestions(true); }}
              onFocus={() => setShowLocationSuggestions(true)}
              onKeyDown={(e) => {
                if (!showLocationSuggestions) return;
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveLocationIndex(p => (p + 1) % Math.max(locationDropdownItems.length, 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveLocationIndex(p => (p - 1 + Math.max(locationDropdownItems.length, 1)) % Math.max(locationDropdownItems.length, 1)); }
                else if (e.key === 'Enter' && activeLocationIndex >= 0 && activeLocationIndex < locationDropdownItems.length) {
                  e.preventDefault(); setLocation(locationDropdownItems[activeLocationIndex]); setShowLocationSuggestions(false);
                } else if (e.key === 'Escape') setShowLocationSuggestions(false);
              }}
              placeholder="e.g., Austin, TX · Charlotte, NC · 80202"
              className="block w-full pl-12 pr-32 py-4 bg-white border-2 border-slate-100 rounded-2xl shadow-lg focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all text-base placeholder:text-slate-400"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="absolute right-3 top-3 bottom-3 px-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-md hover:shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
            >
              {isLoading ? 'Scanning...' : (
                <>
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Explore</span>
                </>
              )}
            </button>

            {/* Location autocomplete dropdown */}
            {showLocationSuggestions && (locationDropdownItems.length > 0 || location.trim().length > 0) && (
              <div className="absolute z-50 w-full bg-white rounded-xl shadow-xl mt-1 max-h-72 overflow-y-auto text-left border border-gray-100">
                {locationDropdownItems.length > 0 ? (
                  locationDropdownItems.map((s, i) => (
                    <div
                      key={i}
                      className={`px-4 py-3 cursor-pointer text-gray-800 border-b border-gray-50 last:border-0 transition-colors text-sm ${
                        i === activeLocationIndex ? 'bg-indigo-50 font-semibold text-indigo-900' : 'hover:bg-indigo-50'
                      }`}
                      onMouseDown={(e) => { e.preventDefault(); setLocation(s); setShowLocationSuggestions(false); }}
                      onMouseEnter={() => setActiveLocationIndex(i)}
                    >
                      {s}
                    </div>
                  ))
                ) : (
                  <div
                    className="px-4 py-3.5 cursor-pointer flex items-center gap-3 hover:bg-indigo-50 transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); setShowLocationSuggestions(false); }}
                  >
                    <MapPin className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700">Use <span className="text-indigo-600 font-semibold">"{location}"</span> as location</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Example location chips — shown in initial state only */}
        {!report && !isLoading && !error && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="text-xs text-slate-400 self-center mr-1">Try:</span>
            {['Austin, TX', 'Charlotte, NC', 'Denver, CO', 'Nashville, TN', 'Tampa, FL'].map(loc => (
              <button
                key={loc}
                onClick={() => setLocation(loc)}
                className="px-3 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-full transition-colors cursor-pointer"
              >
                {loc}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-12"
          >
            <Loader messages={REPORT_LOADING_MESSAGES} durationCopy="Market Gap reports may take up to 2 minutes." />
          </motion.div>
        )}

        {showRecoveryBanner && pendingLocation && (
          <motion.div
            key="recovery"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-50 border border-amber-200 text-amber-900 p-8 rounded-2xl shadow-sm max-w-2xl mx-auto"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1">Analysis Interrupted</h3>
                <p className="text-sm text-amber-800/90 mb-4">Your market gap analysis may have completed in the background.</p>
                <button
                  onClick={() => runSearchForLocation(pendingLocation, false)}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  Recover Analysis
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 border border-red-200 text-red-700 p-8 rounded-2xl shadow-sm max-w-2xl mx-auto text-center"
          >
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">Analysis Interrupted</h3>
            <p className="text-red-600/80">{error}</p>
          </motion.div>
        )}

        {report && !isLoading && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Market overview banner */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.04]">
                <MapPin className="w-32 h-32 text-indigo-600" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3 flex-wrap">
                    Market Overview: <span className="text-indigo-600">{report.location}</span>
                  </h3>
                  {report.groundingSources.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                      <ShieldCheck className="w-3 h-3" />
                      Live Web-Grounded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                      <AlertTriangle className="w-3 h-3" />
                      AI Model Only
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-base leading-relaxed max-w-4xl">{report.summary}</p>
                {/* Freshness banner */}
                {(() => {
                  const FRESHNESS_DAYS = report._freshnessDays ?? 45;
                  const rawDate = report._generatedAt ?? report.generationMeta?.generatedAt;
                  if (!rawDate) return null;
                  const genDate = new Date(rawDate);
                  const ageDays = Math.floor((Date.now() - genDate.getTime()) / 86_400_000);
                  const isOld   = ageDays > FRESHNESS_DAYS;
                  return (
                    <div className={`mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl px-4 py-3 border text-xs ${
                      isOld
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : report._refreshedFromStale
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : report._cached
                        ? 'bg-sky-50 border-sky-200 text-sky-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                      <span className="shrink-0">
                        {isOld
                          ? `⏳ This report was generated ${ageDays} day${ageDays !== 1 ? 's' : ''} ago. Local conditions may have changed.`
                          : report._refreshedFromStale
                          ? '✅ Fresh analysis generated today — previous data was outdated.'
                          : report._cached
                          ? `✅ Generated on ${genDate.toLocaleDateString()}. Using a recently generated analysis to keep results consistent across users.`
                          : `✅ Fresh analysis generated on ${genDate.toLocaleDateString()}.`
                        }
                      </span>
                      {isOld && (
                        <button
                          onClick={() => runSearch(true)}
                          disabled={isLoading}
                          className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Run Fresh Analysis
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* How rankings work */}
            <HowRankingsWork />

            {/* Filter & sort controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-gray-400 shrink-0" />
                {(['all', 'low-capital', 'low-competition', 'low-overhead'] as FilterType[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                      filter === f
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'low-capital' ? 'Low Capital' : f === 'low-competition' ? 'Low Competition' : 'Low Overhead'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <ArrowUpDown className="w-4 h-4 text-gray-400" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortType)}
                  className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                >
                  <option value="score">Highest Potential</option>
                  <option value="startup-cost">Lowest Capital</option>
                  <option value="competition">Least Competition</option>
                </select>
              </div>
            </div>
            {filter !== 'all' && (
              <p className="text-[11px] text-slate-500 px-1 -mt-2">
                {filter === 'low-capital'    && 'Showing opportunities with relatively low startup investment requirements.'}
                {filter === 'low-competition' && 'Showing opportunities with few existing competitors in this market.'}
                {filter === 'low-overhead'   && 'Showing opportunities with low ongoing monthly operating costs.'}
              </p>
            )}

            {/* Count summary */}
            {processedOpportunities.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No opportunities match the selected filter. Try a different filter.
              </div>
            ) : (
              <p className="text-xs text-gray-400 font-medium px-1">
                Showing {visibleCount} of {processedOpportunities.length} opportunities
                {lockedCount > 0 && ` · ${lockedCount} locked`}
              </p>
            )}

            {/* Opportunity cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {processedOpportunities.map((opportunity, idx) => (
                <OpportunityCard
                  key={`${opportunity.businessType}-${idx}`}
                  opportunity={opportunity}
                  rank={idx + 1}
                  isLocked={
                    canonicalVisibleTypes
                      ? !canonicalVisibleTypes.has(opportunity.businessType)
                      : idx >= visibleLimit
                  }
                  currentPlan={currentPlan}
                  onUpgrade={() => onNavigate('pricing')}
                  location={report.location}
                  onOpenDossier={(opp) => handleOpenDossier(opp, idx + 1)}
                  isDossierLoading={dossierLoading === opportunity.businessType}
                />
              ))}
            </div>

            {/* Explorer upgrade nudge */}
            {currentPlan === 'Explorer' && lockedCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl p-8 text-center"
              >
                <Lock className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                <h4 className="text-lg font-black text-gray-900 mb-2">
                  {lockedCount} More {lockedCount === 1 ? 'Opportunity' : 'Opportunities'} Available
                </h4>
                <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                  Upgrade to <strong>Pro</strong> to unlock all 5 opportunities including full risk analysis, customer segments, and best launch areas.
                </p>
                <button
                  onClick={() => onNavigate('pricing')}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Upgrade to Pro →
                </button>
              </motion.div>
            )}

            {/* Regional Context (Pro+ / Enterprise) */}
            {showRegionalContext && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-purple-900 to-indigo-900 text-white p-8 rounded-3xl"
              >
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-purple-300" />
                  <h4 className="text-lg font-black text-purple-100 uppercase tracking-tight">Regional Market Context</h4>
                  <span className="bg-purple-700/60 text-purple-200 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {currentPlan} Feature
                  </span>
                </div>
                <p className="text-purple-200 text-sm leading-relaxed mb-6">
                  The opportunities above are based on localized market analysis of <strong className="text-white">{report.location}</strong>.
                  Regional context indicates surrounding districts share similar demographic profiles — adjacent ZIP codes may offer lower competition with comparable demand signals, ideal for phased expansion.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                    <p className="text-[10px] font-black text-purple-300 uppercase tracking-widest mb-1">Demand Signal</p>
                    <p className="text-sm font-bold text-white">Strong regional match</p>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                    <p className="text-[10px] font-black text-purple-300 uppercase tracking-widest mb-1">Adjacent ZIPs</p>
                    <p className="text-sm font-bold text-white">High opportunity density</p>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                    <p className="text-[10px] font-black text-purple-300 uppercase tracking-widest mb-1">Expansion Viability</p>
                    <p className="text-sm font-bold text-white">Multi-district ready</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Methodology */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl">
              <h4 className="flex items-center gap-2 text-sm font-semibold mb-3 text-indigo-400">
                <Info className="w-5 h-5" />
                Methodology & Data Sources
              </h4>
              {report.groundingSources.length === 0 && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-300 leading-relaxed">
                    <strong className="text-amber-200">Limited grounding:</strong> Live web search data was unavailable for this analysis. All ratings and recommendations are based on Gemini's training knowledge only, not verified live market data. Treat results as directional only.
                  </p>
                </div>
              )}
              <p className="text-gray-400 mb-6 leading-relaxed text-sm">{report.methodology}</p>
              <div className="flex flex-wrap gap-3">
                {report.groundingSources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-700"
                  >
                    <ChevronRight className="w-3 h-3 text-blue-400" />
                    {source.title}
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Opportunity Dossier Modal */}
      <AnimatePresence>
        {selectedDossier && (
          <OpportunityDossierModal
            opportunity={selectedDossier}
            location={report?.location ?? ''}
            currentPlan={currentPlan}
            rank={selectedDossierRank}
            isGrounded={(report?.groundingSources.length ?? 0) > 0}
            generationError={dossierError}
            onClose={() => setSelectedDossier(null)}
            onUpgrade={() => { setSelectedDossier(null); onNavigate('pricing'); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── How Rankings Work explainer ─────────────────────────────────────────────

const HowRankingsWork: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden text-left">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          What is Market Gaps &amp; how are opportunities ranked?
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">What is a Market Gap?</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              A market gap exists when consumer demand in an area exceeds current supply — an underserved niche a new business can enter with less competition. BizScope identifies these by comparing demand signals against business density across 50+ categories.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">How the Assessment is Calculated</p>
            <ul className="text-xs text-slate-600 space-y-1 leading-relaxed">
              <li><span className="font-semibold text-slate-700">Market Demand</span> — local consumer need &amp; spending signals</li>
              <li><span className="font-semibold text-slate-700">Competition</span> — how crowded the category already is</li>
              <li><span className="font-semibold text-slate-700">Financial Feasibility</span> — realistic startup cost vs. revenue</li>
              <li><span className="font-semibold text-slate-700">Risk Level</span> — execution, market, and regulatory risk factors</li>
            </ul>
            <p className="text-[10px] text-slate-400 mt-2">Higher rating = stronger opportunity. #1 ranked = best balance of all four factors.</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Confidence Level</p>
            <p className="text-xs text-slate-600 leading-relaxed mb-2">
              Ratings are AI-estimated from live web search signals and training data. They are <span className="font-semibold text-slate-700">directional, not definitive</span> — treat them as a starting point for research, not a guarantee of success.
            </p>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="text-[10px] text-amber-700 font-medium">Verify before committing capital.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Opportunity Card ────────────────────────────────────────────────────────

const OpportunityCard: React.FC<{
  opportunity: BusinessOpportunity;
  rank: number;
  isLocked: boolean;
  currentPlan: SubscriptionPlan;
  onUpgrade: () => void;
  location: string;
  onOpenDossier: (opp: BusinessOpportunity) => void;
  isDossierLoading?: boolean;
}> = ({ opportunity, rank, isLocked, currentPlan, onUpgrade, onOpenDossier, isDossierLoading = false }) => {
  const rankConfig = RANK_CONFIGS[rank - 1];
  const tier = getOpportunityTier(resolveViabilityScore(opportunity.scores));

  if (isLocked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: rank * 0.08 }}
        className="relative bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[320px]"
      >
        {/* Blurred preview background */}
        <div className="p-6 blur-sm select-none pointer-events-none" aria-hidden>
          <div className="flex justify-between items-center mb-5">
            <div className="px-3 py-1 rounded-full bg-gray-200 w-12 h-6" />
            <div className="w-14 h-14 rounded-full bg-gray-100" />
          </div>
          <div className="h-5 bg-gray-200 rounded-lg w-3/4 mb-3" />
          <div className="h-3 bg-gray-100 rounded w-full mb-2" />
          <div className="h-3 bg-gray-100 rounded w-5/6 mb-6" />
          <div className="space-y-3">
            <div className="h-2 bg-gray-100 rounded-full" />
            <div className="h-2 bg-gray-100 rounded-full" />
            <div className="h-2 bg-gray-100 rounded-full" />
          </div>
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] rounded-3xl p-6 text-center">
          <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mb-3">
            <Lock className="w-6 h-6 text-blue-400" />
          </div>
          <p className="text-sm font-black text-gray-900 mb-1">Opportunity #{rank} Locked</p>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Upgrade to <strong>Pro</strong> to unlock all 5 opportunities with full analysis.
          </p>
          <button
            onClick={onUpgrade}
            className="px-5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-indigo-700 transition-all shadow-sm"
          >
            Upgrade Plan →
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08 }}
      className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col"
    >
      <div className="p-6 flex-grow flex flex-col">
        {/* Rank badge + tier badge */}
        <div className="flex items-center justify-between mb-5 gap-2">
          {rankConfig ? (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${rankConfig.badge}`}>
              <rankConfig.Icon className="w-3.5 h-3.5" />
              {rankConfig.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-gray-100 text-gray-600 border border-gray-200">
              #{rank}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${tier.badgeBg} ${tier.badgeBorder} ${tier.badgeText}`}>
            <span>{tier.emoji}</span>
            <span>{tier.label}</span>
          </span>
        </div>

        <h3 className="text-base font-black text-gray-900 mb-2 leading-tight">
          {opportunity.businessType}
        </h3>
        <p className="text-gray-500 text-xs leading-relaxed mb-4 line-clamp-2">
          {opportunity.description}
        </p>

        {/* Why #1 banner */}
        {rank === 1 && opportunity.whyItsGood && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3 h-3 text-yellow-600 shrink-0" />
              <span className="text-[10px] font-black text-yellow-700 uppercase tracking-wider">Why it ranks #1</span>
            </div>
            <p className="text-xs text-yellow-900 leading-relaxed">{opportunity.whyItsGood}</p>
          </div>
        )}

        {/* Score bars */}
        <div className="space-y-2.5 mb-5">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg mb-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="text-[10px] text-amber-700 font-medium leading-snug">AI-estimated — lower competition, startup capital & overhead are better</span>
          </div>
          <ScoreBar label="Competition" score={opportunity.scores.competitionLevel} />
          <ScoreBar label="Startup Capital" score={opportunity.scores.capEx} dollarValue={opportunity.financials.estimatedStartupCost} />
          <ScoreBar label="Monthly Overhead" score={opportunity.scores.overhead} />
        </div>

        {/* Financial quick-stats */}
        <div className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-100 mb-4">
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-500 font-medium">
              <DollarSign className="w-3.5 h-3.5 text-green-500" />Startup
            </span>
            <span className="font-black text-gray-900">{opportunity.financials.estimatedStartupCost}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-500 font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-purple-500" />Revenue
            </span>
            <span className="font-black text-gray-900">{opportunity.financials.potentialRevenue}</span>
          </div>
          <p className="text-[9px] text-gray-400 pt-1 border-t border-gray-100 leading-snug">
            Estimates based on available market signals. Verify before committing capital.
          </p>
        </div>

        {/* Full Analysis button */}
        <button
          onClick={() => { if (!isDossierLoading) onOpenDossier(opportunity); }}
          disabled={isDossierLoading}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-600 transition-all py-2.5 rounded-xl bg-indigo-50 disabled:opacity-70 disabled:cursor-wait"
        >
          {isDossierLoading ? (
            <>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generating Analysis...
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3" />
              View Full Analysis
              <ArrowRight className="w-3 h-3" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

// ─── Score Bar ───────────────────────────────────────────────────────────────

/** Maps a 1–10 score to a Low/Moderate/High label with colours. */
function scoreToLabel(score: number): { label: string; chip: string; bar: string } {
  if (score <= 3) return { label: 'Low',      chip: 'bg-green-100 text-green-700',  bar: 'bg-green-500'  };
  if (score <= 6) return { label: 'Moderate', chip: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-500' };
  return              { label: 'High',     chip: 'bg-red-100 text-red-700',      bar: 'bg-red-500'    };
}

/**
 * dollarValue — shown beside the label when a concrete dollar figure is available
 *               (used for Startup Capital where financials.estimatedStartupCost exists).
 */
const ScoreBar: React.FC<{ label: string; score: number; dollarValue?: string }> = ({
  label,
  score,
  dollarValue,
}) => {
  const percentage = (score / 10) * 100;
  const { label: levelLabel, chip, bar } = scoreToLabel(score);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${chip}`}>
          {levelLabel}
          {dollarValue && <span className="opacity-70">· {dollarValue}</span>}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full ${bar} rounded-full`}
        />
      </div>
    </div>
  );
};

// ─── Opportunity Dossier Modal ───────────────────────────────────────────────

const RISK_CATEGORY_COLORS: Record<string, string> = {
  Market: 'bg-blue-100 text-blue-800',
  Regulatory: 'bg-purple-100 text-purple-800',
  Competitive: 'bg-orange-100 text-orange-800',
  Execution: 'bg-red-100 text-red-800',
};

const DECISION_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Proceed': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  'High Potential': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  'Proceed with Caution': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  'Limited Opportunity': { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
};

const SATURATION_STYLES: Record<string, string> = {
  Low: 'bg-emerald-100 text-emerald-800',
  Moderate: 'bg-amber-100 text-amber-800',
  High: 'bg-red-100 text-red-800',
};

const COMPLEXITY_STYLES: Record<string, string> = {
  Low: 'bg-emerald-100 text-emerald-800',
  Moderate: 'bg-amber-100 text-amber-800',
  High: 'bg-red-100 text-red-800',
};

const DossierSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-5">
    <h4 className="flex items-center gap-2.5 text-sm font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">
      <span className="text-indigo-500">{icon}</span>
      {title}
    </h4>
    {children}
  </div>
);

const getDossierScoreLevel = (value: number): { label: string; color: string } => {
  if (value >= 76) return { label: 'High', color: 'text-emerald-600' };
  if (value >= 51) return { label: 'Moderate', color: 'text-blue-600' };
  if (value >= 26) return { label: 'Low', color: 'text-amber-600' };
  return { label: 'Very Low', color: 'text-rose-600' };
};

const MetricBar: React.FC<{ label: string; value: number; description?: string }> = ({ label, value, description }) => {
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-blue-500' : 'bg-amber-500';
  const level = getDossierScoreLevel(value);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold ${level.color}`}>{level.label}</span>
        </div>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
      {description && <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>}
    </div>
  );
};

const OpportunityDossierModal: React.FC<{
  opportunity: BusinessOpportunity;
  location: string;
  currentPlan: SubscriptionPlan;
  rank: number;
  isGrounded: boolean;
  generationError?: string | null;
  onClose: () => void;
  onUpgrade: () => void;
}> = ({ opportunity, location, currentPlan, rank, isGrounded, generationError, onClose, onUpgrade }) => {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const tier = getOpportunityTier(resolveViabilityScore(opportunity.scores));

  // Derive "why it surfaced" bullets from scores + whyItsGood
  const whySurfaced: string[] = [];
  if (opportunity.scores.competitionLevel <= 4) whySurfaced.push('Limited direct competition');
  if (opportunity.scores.capEx <= 4) whySurfaced.push('Low startup capital requirements');
  if (opportunity.scores.overhead <= 4) whySurfaced.push('Low operating overhead');
  if (resolveViabilityScore(opportunity.scores) >= 80) whySurfaced.push('Strong unmet demand signal');
  if (whySurfaced.length === 0 && opportunity.whyItsGood) whySurfaced.push(opportunity.whyItsGood.split('.')[0]);

  const hasDossier = !!(
    opportunity.executiveSummary ||
    opportunity.marketDemand ||
    opportunity.opportunityScorecard
  );
  const canViewDossier = currentPlan !== 'Explorer';

  const decisionKey = opportunity.strategicRecommendation?.decision ?? '';
  const decisionStyle = DECISION_STYLES[decisionKey] ?? DECISION_STYLES['Proceed with Caution'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-8 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-4xl bg-slate-50 rounded-3xl shadow-2xl overflow-hidden mb-8"
      >
        {/* Modal header */}
        <div className="bg-white border-b border-slate-100 px-6 py-5 flex items-center gap-4 sticky top-0 z-10">
          {/* Tier badge block */}
          <div className={`flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center border ${tier.badgeBg} ${tier.badgeBorder}`}>
            <span className="text-2xl leading-none">{tier.emoji}</span>
            <span className={`text-[8px] font-black uppercase tracking-wide mt-0.5 ${tier.badgeText} text-center leading-tight px-1`}>
              {tier.label.split(' ')[0]}
            </span>
          </div>

          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${tier.badgeBg} ${tier.badgeBorder} ${tier.badgeText}`}>
                {tier.emoji} {tier.label}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Rank #{rank}</span>
            </div>
            <h2 className="text-base font-black text-slate-900 leading-tight">{opportunity.businessType}</h2>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" />{location}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal body */}
        <div className="p-5 space-y-5">

          {/* Opportunity Discovery Summary */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Opportunity Discovery Summary</span>
            </div>
            <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-2">Discovered via Market Gaps</p>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className="text-xs text-indigo-700 font-semibold">Rank <strong>#{rank}</strong></span>
              <span className="text-indigo-200">·</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${tier.badgeBg} ${tier.badgeBorder} ${tier.badgeText}`}>
                {tier.emoji} {tier.label}
              </span>
            </div>
            {whySurfaced.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider mb-1.5">Why it surfaced</p>
                <ul className="space-y-1">
                  {whySurfaced.map((reason, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-indigo-800">
                      <span className="text-emerald-500 font-black">✓</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* What Happens Next */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">What Happens Next</span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed mb-3">
              Market Gaps identifies attractive market opportunities based on gap size, competition level, and demand signals.
            </p>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-2">The full analysis below additionally considers:</p>
            <ul className="space-y-1 mb-3">
              {['Startup investment requirements', 'Operating complexity', 'Competitive intensity', 'Financial feasibility', 'Business execution risk'].map((factor) => (
                <li key={factor} className="flex items-center gap-2 text-xs text-amber-800">
                  <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                  {factor}
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-700 leading-relaxed">
              This determines whether the opportunity is likely to succeed in practice — not just whether a market gap exists. The Opportunity Scorecard below reflects all these factors.
            </p>
          </div>

          {/* Executive Summary */}
          {opportunity.executiveSummary && (
            <div className="bg-indigo-600 text-white rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Opportunity Overview</span>
              </div>
              <p className="text-sm leading-relaxed text-indigo-50">{opportunity.executiveSummary}</p>
            </div>
          )}

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-slate-100 rounded-2xl p-3 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Startup Cost</p>
              <p className="text-sm font-black text-slate-900 leading-tight">{opportunity.financials.estimatedStartupCost}</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-3 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Revenue Potential</p>
              <p className="text-xs font-black text-slate-900 leading-tight">{opportunity.financials.potentialRevenue}</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-3 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Target Market</p>
              <p className="text-xs font-semibold text-slate-700 leading-snug">{opportunity.financials.targetMarket}</p>
            </div>
          </div>

          {/* Plan gate for Explorer */}
          {!canViewDossier ? (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-8 text-center">
              <Lock className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
              <h4 className="text-base font-black text-slate-800 mb-2">Full Analysis — Pro Required</h4>
              <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto leading-relaxed">
                Upgrade to <strong>Pro</strong> to unlock the complete business analysis — market breakdown, competitive landscape, financial projections, risk assessment, and scorecard.
              </p>
              <button
                onClick={onUpgrade}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl cursor-pointer transition-all shadow-md"
              >
                Upgrade to Pro →
              </button>
            </div>
          ) : !hasDossier ? (
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-8 text-center">
              <Info className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-600 mb-1">Full Analysis Not Available</h4>
              {generationError ? (
                <p className="text-xs text-red-500 max-w-sm mx-auto leading-relaxed">
                  {generationError}
                </p>
              ) : (
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Detailed analysis wasn't included. Run a new search to get the full breakdown.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* 1. Market Demand Analysis */}
              {opportunity.marketDemand && (
                <DossierSection title="Market Demand Analysis" icon={<TrendingUp className="w-4 h-4" />}>
                  <p className="text-sm text-slate-700 leading-relaxed mb-4">{opportunity.marketDemand.summary}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {opportunity.marketDemand.drivers && opportunity.marketDemand.drivers.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Demand Drivers</p>
                        <ul className="space-y-2">
                          {opportunity.marketDemand.drivers.map((d, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />{d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {opportunity.marketDemand.consumerTrends && opportunity.marketDemand.consumerTrends.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Consumer Trends</p>
                        <ul className="space-y-2">
                          {opportunity.marketDemand.consumerTrends.map((t, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />{t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {opportunity.marketDemand.targetAudience && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Target Audience</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{opportunity.marketDemand.targetAudience}</p>
                      </div>
                    )}
                    {opportunity.marketDemand.localMarketConditions && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Local Market Conditions</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{opportunity.marketDemand.localMarketConditions}</p>
                      </div>
                    )}
                  </div>
                </DossierSection>
              )}

              {/* 2. Demographic & Customer Fit */}
              {opportunity.demographicFit && (
                <DossierSection title="Demographic & Customer Fit" icon={<Users className="w-4 h-4" />}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: 'Ideal Customer', value: opportunity.demographicFit.idealCustomer },
                      { label: 'Income Considerations', value: opportunity.demographicFit.incomeConsiderations },
                      { label: 'Primary Age Groups', value: opportunity.demographicFit.ageGroups },
                      { label: 'Population Relevance', value: opportunity.demographicFit.populationRelevance },
                    ].filter(({ value }) => !!value).map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{value}</p>
                      </div>
                    ))}
                  </div>
                </DossierSection>
              )}

              {/* 3. Competitive Landscape */}
              {opportunity.competitiveLandscape && (
                <DossierSection title="Competitive Landscape" icon={<ShieldCheck className="w-4 h-4" />}>
                  <div className="flex items-start gap-3 mb-3 flex-wrap">
                    <p className="text-sm text-slate-700 leading-relaxed flex-grow">{opportunity.competitiveLandscape.summary}</p>
                    {opportunity.competitiveLandscape.marketSaturation && (
                      <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${SATURATION_STYLES[opportunity.competitiveLandscape.marketSaturation] ?? 'bg-slate-100 text-slate-700'}`}>
                        {opportunity.competitiveLandscape.marketSaturation} Competition
                      </span>
                    )}
                  </div>
                  {opportunity.competitiveLandscape.existingCompetitors && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Existing Competitors</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{opportunity.competitiveLandscape.existingCompetitors}</p>
                    </div>
                  )}
                  {opportunity.competitiveLandscape.competitiveAdvantages && opportunity.competitiveLandscape.competitiveAdvantages.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Your Competitive Advantages</p>
                      <ul className="space-y-2">
                        {opportunity.competitiveLandscape.competitiveAdvantages.map((adv, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed bg-emerald-50 rounded-lg p-2.5 border border-emerald-100">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />{adv}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </DossierSection>
              )}

              {/* 4 & 5. Startup Requirements + Cost Range (side by side) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {opportunity.startupRequirements && (
                  <DossierSection title="Startup & Operational Requirements" icon={<Briefcase className="w-4 h-4" />}>
                    <div className="space-y-3">
                      {[
                        { label: 'Licensing', value: opportunity.startupRequirements.licensing },
                        { label: 'Staffing', value: opportunity.startupRequirements.staffing },
                        { label: 'Equipment', value: opportunity.startupRequirements.equipment },
                      ].filter(({ value }) => !!value).map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                          <p className="text-xs text-slate-700 leading-relaxed">{value}</p>
                        </div>
                      ))}
                      {opportunity.startupRequirements.operationalComplexity && (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Complexity</p>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${COMPLEXITY_STYLES[opportunity.startupRequirements.operationalComplexity] ?? 'bg-slate-100 text-slate-700'}`}>
                            {opportunity.startupRequirements.operationalComplexity}
                          </span>
                        </div>
                      )}
                    </div>
                  </DossierSection>
                )}

                {opportunity.startupCostRange && (
                  <DossierSection title="Estimated Startup Cost Range" icon={<DollarSign className="w-4 h-4" />}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-xl px-4 py-3 border bg-emerald-50 border-emerald-100">
                        <p className="text-xs font-semibold text-emerald-800">Lean Launch</p>
                        <p className="text-sm font-black text-emerald-900">{opportunity.startupCostRange.low}</p>
                      </div>
                      <div className="flex items-center justify-between rounded-xl px-4 py-3 border bg-blue-50 border-blue-100">
                        <p className="text-xs font-semibold text-blue-800">Typical Launch</p>
                        <p className="text-sm font-black text-blue-900">{opportunity.startupCostRange.expected}</p>
                      </div>
                      <div className="flex items-center justify-between rounded-xl px-4 py-3 border bg-amber-50 border-amber-100">
                        <p className="text-xs font-semibold text-amber-800">Full Buildout</p>
                        <p className="text-sm font-black text-amber-900">{opportunity.startupCostRange.high}</p>
                      </div>
                    </div>
                  </DossierSection>
                )}
              </div>

              {/* 6. Revenue Model */}
              {opportunity.revenueModel && (
                <DossierSection title="Revenue Potential & Business Model" icon={<BarChart2 className="w-4 h-4" />}>
                  <p className="text-sm text-slate-700 leading-relaxed mb-4">{opportunity.revenueModel.summary}</p>
                  {opportunity.revenueModel.monetizationMethods && opportunity.revenueModel.monetizationMethods.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Revenue Streams</p>
                      <ul className="space-y-2">
                        {opportunity.revenueModel.monetizationMethods.map((m, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                            <DollarSign className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />{m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {opportunity.revenueModel.scalabilityPotential && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Scalability Potential</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{opportunity.revenueModel.scalabilityPotential}</p>
                    </div>
                  )}
                </DossierSection>
              )}

              {/* 7. Strategic Risks */}
              {opportunity.strategicRisks && opportunity.strategicRisks.length > 0 && (
                <DossierSection title="Strategic Risks & Mitigations" icon={<AlertTriangle className="w-4 h-4" />}>
                  <div className="space-y-3">
                    {opportunity.strategicRisks.map((r, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex items-start gap-2 mb-2 flex-wrap">
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${RISK_CATEGORY_COLORS[r.category] ?? 'bg-slate-100 text-slate-700'}`}>
                            {r.category}
                          </span>
                          <p className="text-xs font-semibold text-slate-800 leading-relaxed">{r.risk}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-slate-600 leading-relaxed">
                            <strong className="text-slate-700">Mitigation: </strong>{r.mitigation}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </DossierSection>
              )}

              {/* 8. Opportunity Scorecard */}
              {opportunity.opportunityScorecard && (
                <DossierSection title="Opportunity Scorecard" icon={<Layers className="w-4 h-4" />}>
                  <div className="space-y-4">
                    <MetricBar
                      label="Market Demand"
                      value={opportunity.opportunityScorecard.marketDemand}
                      description="Consumer need and spending potential for this business category in this location."
                    />
                    <MetricBar
                      label="Competition Advantage"
                      value={opportunity.opportunityScorecard.competition}
                      description="How open the market is to a new entrant. Higher score = less competition = better for you."
                    />
                    <MetricBar
                      label="Startup Simplicity"
                      value={opportunity.opportunityScorecard.startupComplexity}
                      description="How straightforward this business is to launch. Higher = lower complexity, faster time to first revenue."
                    />
                    <MetricBar
                      label="Revenue Potential"
                      value={opportunity.opportunityScorecard.revenuePotential}
                      description="Expected earning capacity based on market size, pricing power, and customer volume."
                    />
                    <MetricBar
                      label="Scalability"
                      value={opportunity.opportunityScorecard.scalability}
                      description="Ability to grow revenue without proportional increases in cost or operational complexity."
                    />
                    <div className="pt-3 border-t border-slate-100">
                      <MetricBar
                        label="Overall Rating"
                        value={opportunity.opportunityScorecard.overallScore}
                        description="Weighted composite of all five dimensions above. 76–100: Strong opportunity. 51–75: Moderate. Below 50: Proceed with caution."
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
                    Rating ranges: 0–25 Very Low · 26–50 Low · 51–75 Moderate · 76–100 High.
                    Competition Advantage ratings are directional — a rating of 80 means the market is 80% open, not 80% saturated.
                  </p>
                </DossierSection>
              )}

              {/* 9. Strategic Recommendation */}
              {opportunity.strategicRecommendation && (
                <div className={`rounded-2xl p-5 border ${decisionStyle.bg} ${decisionStyle.border}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className={`w-4 h-4 ${decisionStyle.text}`} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Strategic Recommendation</p>
                  </div>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm mb-3 border ${decisionStyle.bg} ${decisionStyle.text} ${decisionStyle.border}`}>
                    <ArrowRight className="w-4 h-4" />
                    {opportunity.strategicRecommendation.decision}
                  </div>
                  <p className={`text-sm leading-relaxed ${decisionStyle.text}`}>
                    {opportunity.strategicRecommendation.rationale}
                  </p>
                </div>
              )}
            </>
          )}

          {/* 90-Day Launch Roadmap — derived from startup requirements + strategic recommendation */}
          {hasDossier && opportunity.startupRequirements && opportunity.strategicRecommendation && (
            <DossierSection title="90-Day Launch Roadmap" icon={<Target className="w-4 h-4" />}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-[10px] mb-2">1</div>
                  <p className="text-xs font-black text-indigo-900 mb-1.5">Days 1–30: Foundation</p>
                  <ul className="space-y-1.5 text-[10px] text-indigo-800 leading-relaxed">
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Secure business licenses and permits</li>
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Finalize location selection and lease terms</li>
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Source equipment and initial supplies</li>
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Begin hiring process ({opportunity.startupRequirements.staffing})</li>
                  </ul>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-[10px] mb-2">2</div>
                  <p className="text-xs font-black text-blue-900 mb-1.5">Days 31–60: Build</p>
                  <ul className="space-y-1.5 text-[10px] text-blue-800 leading-relaxed">
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Complete fit-out and operational setup</li>
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Train team on service delivery standards</li>
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Launch local digital presence and Google listing</li>
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Run soft-open with early customer feedback</li>
                  </ul>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-black flex items-center justify-center text-[10px] mb-2">3</div>
                  <p className="text-xs font-black text-emerald-900 mb-1.5">Days 61–90: Launch</p>
                  <ul className="space-y-1.5 text-[10px] text-emerald-800 leading-relaxed">
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Official grand opening with promotional push</li>
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Activate referral and loyalty programs</li>
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Track key metrics: revenue, customer acquisition cost, and retention rate</li>
                    <li className="flex gap-1.5"><span className="flex-shrink-0 font-bold">·</span> Review and adjust based on early performance</li>
                  </ul>
                </div>
              </div>
            </DossierSection>
          )}

          {/* Data Sources & Confidence */}
          {hasDossier && (
            <DossierSection title="Data Sources & Confidence" icon={<Info className="w-4 h-4" />}>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className={`rounded-xl p-3 border ${isGrounded ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Analysis Source</p>
                    {isGrounded ? (
                      <p className="text-xs text-slate-700">AI market intelligence synthesized from live web search data and economic modeling.</p>
                    ) : (
                      <p className="text-xs text-amber-800">AI market intelligence based on model training knowledge. Live web search was unavailable for this analysis — treat as directional.</p>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Confidence Level</p>
                    <p className="text-xs text-slate-700">{isGrounded ? 'Moderate-High' : 'Moderate'} — directional estimates based on {isGrounded ? 'live market signals' : 'model knowledge'}. Not a substitute for primary market research.</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Recommended Next Step</p>
                    <p className="text-xs text-slate-700">Validate assumptions with local market visits, competitor interviews, and a financial advisor before committing capital.</p>
                  </div>
                </div>
              </div>
            </DossierSection>
          )}

          {/* Disclaimer */}
          <div className="bg-slate-100 rounded-xl px-4 py-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              AI-generated business intelligence estimates. All financial projections and market assessments are indicative only. Verify critical decisions with independent market research and financial advisors.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
