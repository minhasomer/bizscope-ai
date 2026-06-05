
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, MapPin, TrendingUp, DollarSign, Users, ChevronRight, Info,
  Lock, Filter, AlertTriangle, Trophy, Medal, Award, Star, Target,
  ArrowUpDown, X, Sparkles, ArrowRight, ShieldCheck, BarChart2, Briefcase, Layers
} from 'lucide-react';
import type { OpportunityReport, BusinessOpportunity } from '../types';
import { generateOpportunityReport } from '../services/geminiService';
import { Loader } from './Loader';
import { SubscriptionPlan } from '../src/utils/planUtils';

type FilterType = 'all' | 'low-capital' | 'low-competition' | 'low-overhead';
type SortType = 'score' | 'startup-cost' | 'competition';

interface OpportunityExplorerProps {
  currentPlan: SubscriptionPlan;
  onNavigate: (page: string) => void;
  userRole?: string;
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

export const OpportunityExplorer: React.FC<OpportunityExplorerProps> = ({ currentPlan, onNavigate, userRole = '' }) => {
  const [location, setLocation] = useState('');
  const [report, setReport] = useState<OpportunityReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('score');
  const [selectedDossier, setSelectedDossier] = useState<BusinessOpportunity | null>(null);

  const visibleLimit = PLAN_LIMITS[currentPlan];
  const showRegionalContext = currentPlan === 'Pro+' || currentPlan === 'Enterprise';

  // For Explorer: lock by SET MEMBERSHIP against the canonical top-N (raw score order),
  // not by position in the sorted result. This prevents sort/filter from rotating
  // different items into the visible slots.
  const canonicalVisibleTypes = useMemo(() => {
    if (!report || currentPlan !== 'Explorer') return null;
    return new Set(
      [...report.topOpportunities]
        .sort((a, b) => b.scores.overallPotental - a.scores.overallPotental)
        .slice(0, visibleLimit)
        .map(o => o.businessType),
    );
  }, [report, currentPlan, visibleLimit]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return;

    setIsLoading(true);
    setError(null);
    setReport(null);

    try {
      const result = await generateOpportunityReport(location, setLoadingMessage, userRole);
      setReport(result);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to analyze opportunities');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const processedOpportunities = useMemo(() => {
    if (!report) return [];

    let opps = [...report.topOpportunities];

    if (filter === 'low-capital') opps = opps.filter(o => o.scores.capEx <= 3);
    else if (filter === 'low-competition') opps = opps.filter(o => o.scores.competitionLevel <= 3);
    else if (filter === 'low-overhead') opps = opps.filter(o => o.scores.overhead <= 3);

    if (sort === 'score') opps.sort((a, b) => b.scores.overallPotental - a.scores.overallPotental);
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
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-4 border border-indigo-100"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Market Intelligence · Opportunity Discovery
        </motion.div>

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
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
            <MapPin className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., Gurnee, IL · Austin, TX · Denver, CO"
            className="block w-full pl-12 pr-32 py-4 bg-white border-2 border-slate-100 rounded-2xl shadow-lg focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all text-base placeholder:text-slate-400"
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
        </form>

        {/* Example location chips — shown in initial state only */}
        {!report && !isLoading && !error && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="text-xs text-slate-400 self-center mr-1">Try:</span>
            {['Gurnee, IL', 'Austin, TX', 'Charlotte, NC', 'Denver, CO', 'Phoenix, AZ'].map(loc => (
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
            <Loader message={loadingMessage || 'Scanning market opportunities...'} />
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
                <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-3 flex-wrap">
                  Market Overview: <span className="text-indigo-600">{report.location}</span>
                </h3>
                <p className="text-gray-600 text-base leading-relaxed max-w-4xl">{report.summary}</p>
              </div>
            </div>

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
                  <option value="score">Highest Score</option>
                  <option value="startup-cost">Lowest Capital</option>
                  <option value="competition">Least Competition</option>
                </select>
              </div>
            </div>

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
                  onOpenDossier={setSelectedDossier}
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
            onClose={() => setSelectedDossier(null)}
            onUpgrade={() => { setSelectedDossier(null); onNavigate('pricing'); }}
          />
        )}
      </AnimatePresence>
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
}> = ({ opportunity, rank, isLocked, currentPlan, onUpgrade, onOpenDossier }) => {
  const rankConfig = RANK_CONFIGS[rank - 1];

  const scoreColor =
    opportunity.scores.overallPotental >= 85
      ? '#22c55e'
      : opportunity.scores.overallPotental >= 70
        ? '#3b82f6'
        : '#f59e0b';

  const circumference = 2 * Math.PI * 15; // r=15

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
        {/* Rank badge + score ring */}
        <div className="flex justify-between items-center mb-5">
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

          {/* SVG score circle */}
          <div className="relative flex items-center justify-center w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15"
                fill="none"
                stroke={scoreColor}
                strokeWidth="3"
                strokeDasharray={`${(opportunity.scores.overallPotental / 100) * circumference} ${circumference}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-[13px] font-black text-gray-900 leading-none">
                {opportunity.scores.overallPotental}
              </span>
            </div>
          </div>
        </div>

        <h3 className="text-base font-black text-gray-900 mb-2 leading-tight">
          {opportunity.businessType}
        </h3>
        <p className="text-gray-500 text-xs leading-relaxed mb-5 line-clamp-2">
          {opportunity.description}
        </p>

        {/* Score bars */}
        <div className="space-y-2.5 mb-5">
          <ScoreBar label="Competition" score={opportunity.scores.competitionLevel} inverse />
          <ScoreBar label="Startup Capital" score={opportunity.scores.capEx} />
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
        </div>

        {/* Full Analysis button */}
        <button
          onClick={() => onOpenDossier(opportunity)}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-600 transition-all cursor-pointer py-2.5 rounded-xl bg-indigo-50"
        >
          <Sparkles className="w-3 h-3" />
          View Full Analysis
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
};

// ─── Score Bar ───────────────────────────────────────────────────────────────

const ScoreBar: React.FC<{ label: string; score: number; inverse?: boolean }> = ({
  label,
  score,
  inverse = false,
}) => {
  const percentage = (score / 10) * 100;

  let color = 'bg-blue-500';
  if (inverse) {
    if (score <= 3) color = 'bg-green-500';
    else if (score <= 7) color = 'bg-yellow-500';
    else color = 'bg-red-500';
  } else {
    if (score <= 3) color = 'bg-green-500';
    else if (score <= 7) color = 'bg-blue-500';
    else color = 'bg-orange-500';
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider">
        <span>{label}</span>
        <span className="text-gray-800">{score}/10</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full ${color} rounded-full`}
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

const MetricBar: React.FC<{ label: string; value: number; description?: string }> = ({ label, value, description }) => {
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className="text-xs font-black text-slate-900">{value}/100</span>
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
  onClose: () => void;
  onUpgrade: () => void;
}> = ({ opportunity, location, currentPlan, onClose, onUpgrade }) => {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const scoreColor =
    opportunity.scores.overallPotental >= 85 ? '#22c55e'
    : opportunity.scores.overallPotental >= 70 ? '#3b82f6'
    : '#f59e0b';
  const circumference = 2 * Math.PI * 18;

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
          {/* Score circle */}
          <div className="relative flex-shrink-0 w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
              <circle
                cx="22" cy="22" r="18"
                fill="none"
                stroke={scoreColor}
                strokeWidth="3.5"
                strokeDasharray={`${(opportunity.scores.overallPotental / 100) * circumference} ${circumference}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[15px] font-black text-slate-900">{opportunity.scores.overallPotental}</span>
            </div>
          </div>

          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Full Business Intelligence Dossier</span>
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

          {/* Executive Summary */}
          {opportunity.executiveSummary && (
            <div className="bg-indigo-600 text-white rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Executive Opportunity Summary</span>
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
              <h4 className="text-base font-black text-slate-800 mb-2">Full Dossier Available on Pro</h4>
              <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto leading-relaxed">
                Upgrade to <strong>Pro</strong> to unlock the complete business intelligence dossier — market analysis, competitive landscape, financial projections, risk assessment, and scorecard.
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
              <h4 className="text-sm font-bold text-slate-600 mb-1">Full Dossier Not Available</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Extended analysis data was not included in this report. Generate a fresh analysis to access the full dossier.
              </p>
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
                        {opportunity.competitiveLandscape.marketSaturation} Saturation
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
                    <MetricBar label="Market Demand" value={opportunity.opportunityScorecard.marketDemand} />
                    <MetricBar
                      label="Competition Advantage"
                      value={opportunity.opportunityScorecard.competition}
                      description="Higher = less competition = better positioning"
                    />
                    <MetricBar
                      label="Startup Simplicity"
                      value={opportunity.opportunityScorecard.startupComplexity}
                      description="Higher = simpler to launch and operate"
                    />
                    <MetricBar label="Revenue Potential" value={opportunity.opportunityScorecard.revenuePotential} />
                    <MetricBar label="Scalability" value={opportunity.opportunityScorecard.scalability} />
                    <div className="pt-3 border-t border-slate-100">
                      <MetricBar label="Overall Score" value={opportunity.opportunityScorecard.overallScore} />
                    </div>
                  </div>
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
