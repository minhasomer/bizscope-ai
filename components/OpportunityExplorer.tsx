
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, MapPin, TrendingUp, DollarSign, Users, ChevronRight, Info,
  ChevronDown, ChevronUp, Lock, Filter, AlertTriangle, Trophy, Medal,
  Award, Star, Target, ArrowUpDown
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

export const OpportunityExplorer: React.FC<OpportunityExplorerProps> = ({ currentPlan, onNavigate }) => {
  const [location, setLocation] = useState('');
  const [report, setReport] = useState<OpportunityReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('score');

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
      const result = await generateOpportunityReport(location, setLoadingMessage);
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
}> = ({ opportunity, rank, isLocked, currentPlan, onUpgrade }) => {
  const [expanded, setExpanded] = useState(false);
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

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer py-1 rounded-lg hover:bg-indigo-50"
        >
          {expanded ? 'Hide Details' : 'Full Analysis'}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Expandable detail panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mt-4 space-y-4"
            >
              {/* Why it works — visible on all plans */}
              <div className="bg-indigo-50/60 rounded-xl p-4 border border-indigo-100">
                <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-1.5">Why It Works</p>
                <p className="text-xs text-gray-700 leading-relaxed">{opportunity.whyItsGood}</p>
              </div>

              {/* Deep analysis sections — Pro and above only */}
              {currentPlan === 'Explorer' ? (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                  <Lock className="w-4 h-4 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-700 mb-1">Full evaluation with Pro</p>
                  <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
                    Customer segments, key risks, best launch areas, and market targeting.
                  </p>
                  <button
                    onClick={onUpgrade}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-semibold rounded-lg cursor-pointer hover:bg-indigo-700 transition-colors"
                  >
                    Upgrade to Pro →
                  </button>
                </div>
              ) : (
                <>
                  {/* Customer segment */}
                  {opportunity.customerSegment && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Users className="w-3 h-3" />Customer Segment
                      </p>
                      <p className="text-xs text-gray-700 leading-relaxed">{opportunity.customerSegment}</p>
                    </div>
                  )}

                  {/* Best nearby area */}
                  {opportunity.bestNearbyArea && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />Best Nearby Area
                      </p>
                      <p className="text-xs font-bold text-gray-800">{opportunity.bestNearbyArea}</p>
                    </div>
                  )}

                  {/* Key risks */}
                  {opportunity.risks && opportunity.risks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />Key Risks
                      </p>
                      <ul className="space-y-2">
                        {opportunity.risks.map((risk, rIdx) => (
                          <li key={rIdx} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Target market */}
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Target className="w-3 h-3" />Market Target
                    </p>
                    <p className="text-xs text-gray-700">{opportunity.financials.targetMarket}</p>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
