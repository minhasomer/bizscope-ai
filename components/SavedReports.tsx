import React, { useState, useEffect, useMemo } from 'react';
import { SavedReport } from '../types';
import { SavedReportsService } from '../services/savedReportsService';
import { isDemoMode } from '../src/config/appConfig';
import { 
  Briefcase, 
  MapPin, 
  Eye, 
  Trash2, 
  Calendar, 
  Heart, 
  Search, 
  Globe, 
  Award, 
  Trash, 
  Sparkles,
  SlidersHorizontal,
  X,
  Layers,
  ArrowUpDown,
  Scale,
  Trophy,
  TrendingUp,
  AlertCircle,
  Zap
} from 'lucide-react';

interface SavedReportsProps {
  reports: any[];
  currentPlan: string;
  onViewReport: (report: any) => void;
  onDeleteReport?: (indexOrId: number | string) => void; // Optional fallback
}

export const SavedReports: React.FC<SavedReportsProps> = ({ reports, currentPlan, onViewReport }) => {
  const [localReports, setLocalReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'standard' | 'regional'>('all');
  const [favoriteFilter, setFavoriteFilter] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'score-desc' | 'score-asc'>('date-desc');
  
  // Custom states for Delete Confirmation flow
  const [reportToDelete, setReportToDelete] = useState<SavedReport | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  
  // Custom state for UI feedback toast after favorite toggle or deletion
  const [toastMessage, setToastMessage] = useState<string>('');

  // Custom states for Side-by-Side Comparison
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [showComparisonMatrix, setShowComparisonMatrix] = useState<boolean>(false);
  const [showCompareUpgradeModal, setShowCompareUpgradeModal] = useState<boolean>(false);

  // Helper toggle selection handler
  const handleToggleSelectForComparison = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    // Check if plan is Explorer (Gated/Locked)
    if (currentPlan === 'Explorer') {
      setShowCompareUpgradeModal(true);
      return;
    }

    setSelectedCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 2) {
        triggerToast("⚖️ Compare limit: Deselect one choice to add another saved report.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const getRiskLabel = (rep: SavedReport) => {
    if (rep.riskAssessment && rep.riskAssessment.summary) {
      return rep.riskAssessment.summary;
    }
    const score = rep.scoreBreakdown?.riskLevel ?? 50;
    if (score < 35) return "Low Risk Level";
    if (score <= 70) return "Medium Risk Level";
    return "High Risk Level";
  };

  const getCompetitionLabel = (rep: SavedReport) => {
    if (rep.competitionAnalysis && rep.competitionAnalysis.summary) {
      return rep.competitionAnalysis.summary.slice(0, 120) + (rep.competitionAnalysis.summary.length > 120 ? '...' : '');
    }
    const intensity = rep.scoreBreakdown?.competitionIntensity ?? 50;
    if (intensity < 40) return "Low Local Competition Flow";
    if (intensity <= 75) return "Moderate Neighborhood Competition";
    return "High Competitor Footprint Density";
  };

  // Fetch / Sync reports from service
  const fetchReportsList = async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const data = await SavedReportsService.getReports();
      setLocalReports(data);
    } catch (err) {
      console.error('Error fetching saved reports list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsList(true);

    const handleSync = () => {
      fetchReportsList(false);
    };

    window.addEventListener('bizscope_reports_changed', handleSync);
    return () => {
      window.removeEventListener('bizscope_reports_changed', handleSync);
    };
  }, []);

  // Show a temporary visual status toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // Toggle favorite trigger
  const handleToggleFavorite = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    try {
      const updated = await SavedReportsService.toggleFavorite(id);
      if (updated) {
        triggerToast(updated.isFavorite ? `"${name}" added to favorites! ❤️` : `"${name}" removed from favorites.`);
      }
    } catch (_) {}
  };

  // Delete trigger
  const confirmDeleteReport = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);
    try {
      await SavedReportsService.deleteReport(reportToDelete.id);
      triggerToast(`Report for "${reportToDelete.businessType}" deleted.`);
      setReportToDelete(null);
    } catch (_) {
    } finally {
      setIsDeleting(false);
    }
  };

  // Color helper for viability score
  const getScoreColor = (score: number) => {
    if (score >= 75) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (score >= 50) return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-rose-50 text-rose-705 border-rose-100';
  };

  // Filtered and sorted reports memory cache
  const processedReports = useMemo(() => {
    let list = [...localReports];

    // 1. Search Query matcher
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => 
        (r.businessType || '').toLowerCase().includes(q) || 
        (r.location || '').toLowerCase().includes(q)
      );
    }

    // 2. Report Type category matcher
    if (typeFilter !== 'all') {
      list = list.filter(r => r.reportType === typeFilter);
    }

    // 3. Favorites matcher
    if (favoriteFilter) {
      list = list.filter(r => r.isFavorite);
    }

    // 4. Sort selection controller
    list.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.dateSaved).getTime() - new Date(a.dateSaved).getTime();
      }
      if (sortBy === 'date-asc') {
        return new Date(a.dateSaved).getTime() - new Date(b.dateSaved).getTime();
      }
      if (sortBy === 'score-desc') {
        return b.viabilityScore - a.viabilityScore;
      }
      if (sortBy === 'score-asc') {
        return a.viabilityScore - b.viabilityScore;
      }
      return 0;
    });

    return list;
  }, [localReports, searchQuery, typeFilter, favoriteFilter, sortBy]);

  // Derive the two reports being compared from the selection tray.
  // These were the missing variables that caused the modal guard
  // `showComparisonMatrix && reportA && reportB` to always be falsy —
  // the button set showComparisonMatrix=true but the modal never rendered.
  // Lookup uses localReports (not processedReports) so filters can't hide
  // a report that was selected before a filter was applied.
  const reportA = localReports.find(r => r.id === selectedCompareIds[0]) ?? null;
  const reportB = localReports.find(r => r.id === selectedCompareIds[1]) ?? null;
  const scoreDiff = reportA && reportB ? Math.abs(reportA.viabilityScore - reportB.viabilityScore) : 0;
  const isAWinner = reportA && reportB ? reportA.viabilityScore > reportB.viabilityScore : false;
  const isBWinner = reportA && reportB ? reportB.viabilityScore > reportA.viabilityScore : false;
  const isTie     = reportA && reportB ? reportA.viabilityScore === reportB.viabilityScore : false;

  // Render a clean modern loading state
  if (isLoading) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
          <div className="h-6 w-48 bg-gray-100 animate-pulse rounded-md" />
          <div className="h-8 w-24 bg-gray-100 animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-10 w-10 bg-gray-200/60 animate-pulse rounded-xl" />
                <div className="h-6 w-16 bg-gray-200/60 animate-pulse rounded-md" />
              </div>
              <div className="h-6 w-3/4 bg-gray-200/60 animate-pulse rounded-md" />
              <div className="h-4 w-1/2 bg-gray-200/60 animate-pulse rounded-md" />
              <div className="pt-4 border-t border-gray-100 flex gap-3">
                <div className="h-9 flex-1 bg-gray-200/60 animate-pulse rounded-xl" />
                <div className="h-9 w-10 bg-gray-200/60 animate-pulse rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden max-w-5xl mx-auto text-left relative">
      {/* Toast notification message banner */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white font-medium text-xs px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          {toastMessage}
        </div>
      )}

      {/* Header controls box */}
      <div className="p-6 md:p-8 bg-gradient-to-r from-gray-50/50 to-white border-b border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm">📁</span>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Saved Reports
              </h3>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Browse and compare your saved business reports ({localReports.length} total)
            </p>
            <p className="text-[10px] text-gray-400/70 mt-0.5">
              Synced across devices when signed in
            </p>
          </div>

          {/* Quick Stats badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Types:</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50/70 py-1 px-2.5 rounded-lg border border-purple-100">
              <Sparkles className="w-3 h-3" /> Regional {localReports.filter(r => r.reportType === 'regional').length}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50/70 py-1 px-2.5 rounded-lg border border-indigo-100">
              <Briefcase className="w-3 h-3" /> Standard {localReports.filter(r => r.reportType === 'standard').length}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50/70 py-1 px-2.5 rounded-lg border border-rose-100">
              <Heart className="w-3 h-3 fill-rose-600 text-rose-600" /> Favs {localReports.filter(r => r.isFavorite).length}
            </span>
          </div>
        </div>

        {/* Filters and search action rail */}
        <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search column */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by business name or zip..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 hover:bg-gray-100/50 focus:bg-white text-xs text-gray-950 placeholder-gray-450 border border-transparent focus:border-blue-150 rounded-xl focus:outline-none transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtering row options */}
          <div className="md:col-span-8 flex flex-wrap items-center gap-3 md:justify-end text-xs">
            {/* Standard vs Regional Filter */}
            <div className="flex bg-gray-50 p-0.5 rounded-lg border border-gray-100">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                  typeFilter === 'all' ? 'bg-white shadow-sm text-gray-950' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setTypeFilter('standard')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                  typeFilter === 'standard' ? 'bg-white shadow-sm text-gray-950' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setTypeFilter('regional')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                  typeFilter === 'regional' ? 'bg-white shadow-sm text-gray-950' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Pro+ Regional
              </button>
            </div>

            {/* Favorite status button toggler */}
            <button
              onClick={() => setFavoriteFilter(!favoriteFilter)}
              className={`p-1 px-3 rounded-lg border flex items-center gap-1.5 font-semibold text-[11px] transition-all cursor-pointer ${
                favoriteFilter 
                  ? 'bg-rose-50 border-rose-200 text-rose-700' 
                  : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${favoriteFilter ? 'fill-rose-600 text-rose-600' : ''}`} />
              Favorites Only
            </button>

            {/* Sorting helper dropdown */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
              <ArrowUpDown className="w-3 h-3 text-gray-400 ml-1.5" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent border-0 pr-6 text-[11px] text-gray-700 font-semibold focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option value="date-desc">Newest Saved</option>
                <option value="date-asc">Oldest Saved</option>
                <option value="score-desc">Score: High to Low</option>
                <option value="score-asc">Score: Low to High</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main ledger grid section */}
      <div className="p-6 md:p-8">
        {processedReports.length === 0 ? (
          <div className="text-center py-16 px-4 bg-gray-50/30 rounded-2xl border-2 border-dashed border-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h4M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-6 4h4m-6 4h4m2 4H6a2 2 0 01-2-2V7a2 2 0 012-2h2.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H18a2 2 0 012 2v2M16 12h-3m-3 0h-3m3-3h3" />
            </svg>
            
            {localReports.length === 0 ? (
              // Empty State - No items at all
              <>
                <h4 className="text-sm font-bold text-gray-800">Your Private Ledger is Empty</h4>
                <p className="mt-1 text-xs text-gray-550 max-w-sm mx-auto">
                  Run a business viability analysis for any spot, and click "Save to Dashboard" within the report to add it here.
                </p>
                <button
                  onClick={() => {
                    const el = document.getElementById('businessType');
                    if (el) el.focus();
                  }}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 py-1.5 px-3.5 rounded-xl transition-all"
                >
                  Analyze First Idea
                </button>
              </>
            ) : (
              // Search mismatch empty state
              <>
                <h4 className="text-sm font-bold text-gray-800">No Matching Dossiers Found</h4>
                <p className="mt-1 text-xs text-gray-450 max-w-sm mx-auto">
                  Try adjusting your search keywords, disabling the "Favorites Only" switch, or resetting categories.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('all');
                    setFavoriteFilter(false);
                  }}
                  className="mt-4 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Reset active search filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {processedReports.map((report) => {
              const isSelectedForComparison = selectedCompareIds.includes(report.id);
              return (
                <div 
                  key={report.id} 
                  className={`group relative bg-white rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between ${
                    isSelectedForComparison 
                      ? 'border-blue-600 shadow-xl ring-2 ring-blue-500/20 bg-blue-50/5' 
                      : 'border-gray-100 shadow-sm hover:shadow-md hover:border-blue-250'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-4">
                      <div className="flex gap-2">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-105 transition-transform flex items-center justify-center">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        
                        {/* Report type labels & badges */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-extrabold uppercase tracking-wide text-gray-400">Dossier Grade</span>
                          {report.reportType === 'regional' ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
                              <Globe className="w-2.5 h-2.5" /> Regional Intel (Pro+)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                              Standard Report
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {/* Compare Selection Action */}
                        <button
                          onClick={(e) => handleToggleSelectForComparison(e, report.id)}
                          className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                            isSelectedForComparison
                              ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                              : 'bg-slate-50 border-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200'
                          }`}
                          title={isSelectedForComparison ? "Remove from comparison matrix" : "Add to comparison matrix"}
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span className="text-[9px] uppercase tracking-wider font-extrabold px-0.5 hidden sm:inline">
                            {isSelectedForComparison ? 'Added' : 'Compare'}
                          </span>
                        </button>

                        {/* Favorite Button Action */}
                        <button
                          onClick={(e) => handleToggleFavorite(e, report.id, report.businessType)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            report.isFavorite 
                              ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                              : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title={report.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <Heart className={`w-3.5 h-3.5 transition-all duration-300 ${report.isFavorite ? 'fill-rose-500 scale-110 text-rose-500' : ''}`} />
                        </button>

                        {/* Score display tag */}
                        <div className={`px-2 py-1 text-xs font-black rounded-lg border tracking-tight ${getScoreColor(report.viabilityScore)}`}>
                          VIABILITY: {report.viabilityScore}%
                        </div>
                      </div>
                    </div>

                  {/* Info details */}
                  <h4 className="text-base font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    {report.businessType}
                  </h4>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    {report.location}
                  </p>
                  
                  {/* Generated Date label */}
                  <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
                    <Calendar className="w-3 h-3" />
                    Generated {report.dateSaved ? new Date(report.dateSaved).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recently'}
                  </p>
                </div>

                {/* Card Button triggers */}
                <div className="mt-5 flex gap-2.5">
                  <button
                    onClick={() => onViewReport(report)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all text-xs font-medium rounded-xl"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Open Report
                  </button>
                  <button
                    onClick={() => setReportToDelete(report)}
                    className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors rounded-xl"
                    title="Delete Report"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Modern Dialog Modal to trigger Custom Delete Confirmation - avoids ugly default alerts */}
      {reportToDelete && (
        <div className="fixed inset-0 bg-gray-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-gray-100 shadow-2xl relative animate-scale-up text-center">
            
            {/* Visual warning icon */}
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 mb-4">
              <Trash className="w-6 h-6 animate-bounce" />
            </div>

            <h3 className="text-lg font-black text-gray-900 leading-snug">
              Delete This Report?
            </h3>
            <p className="text-xs text-gray-500 mt-2">
              Are you sure you want to permanently delete the saved report for{' '}
              <strong className="text-gray-900 font-bold">"{reportToDelete.businessType}"</strong> in{' '}
              <strong className="text-gray-900 font-bold">"{reportToDelete.location}"</strong>? This action cannot be undone.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setReportToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 md:text-xs font-bold rounded-xl focus:outline-none transition-colors border border-gray-100 cursor-pointer disabled:opacity-50"
              >
                No, Keep Report
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteReport}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white md:text-xs font-bold rounded-xl focus:outline-none transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Yes, Delete Permanent
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating comparison selector panel bar */}
      {selectedCompareIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[45] bg-gray-900 border border-gray-800 text-white rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 animate-scale-up max-w-[90vw] w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Scale className="w-5 h-5 animate-pulse" />
            </div>
            <div className="text-left font-sans">
              <p className="text-xs font-black text-gray-200">Compare Reports</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {selectedCompareIds.length === 1 
                  ? "Select another saved report card..." 
                  : "2 study files staged of 2 max allowed"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button 
              onClick={() => setSelectedCompareIds([])}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 transition-colors cursor-pointer"
            >
              Clear
            </button>
            <button
              disabled={selectedCompareIds.length < 2}
              onClick={() => setShowComparisonMatrix(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-md cursor-pointer disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
            >
              ⚖️ Compare Side-by-Side
            </button>
          </div>
        </div>
      )}

      {/* Modern Dialog Modal for Comparative Matrix Analysis */}
      {showComparisonMatrix && reportA && reportB && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-gray-150 shadow-2xl relative overflow-hidden animate-scale-up my-8 text-left">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/55">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚖️</span>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">Comparative Venture Matrix</h3>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Comparing viability, financials, and risks of two saved prospects side-by-side.
                </p>
              </div>
              <button 
                onClick={() => setShowComparisonMatrix(false)}
                className="p-1 px-2.5 bg-gray-150 hover:bg-gray-200 text-gray-600 font-bold rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto space-y-6">
              
              {/* Header Cards (Side-by-Side) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Report A Header Column Card */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between relative ${isAWinner ? 'border-amber-400 bg-amber-50/5 ring-1 ring-amber-300' : 'border-gray-100 bg-gray-50/20'}`}>
                  {isAWinner && (
                    <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                      <Trophy className="w-3 h-3 fill-white" /> Winner
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wide">Option alpha</span>
                    <h4 className="text-base font-black text-gray-900 mt-0.5">{reportA.businessType}</h4>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-gray-450" /> {reportA.location}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-3xl font-black text-blue-900">{reportA.viabilityScore}%</span>
                    <span className="text-xs text-gray-400">Overall Viability Score</span>
                  </div>
                </div>

                {/* Report B Header Column Card */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between relative ${isBWinner ? 'border-amber-400 bg-amber-50/5 ring-1 ring-amber-300' : 'border-gray-100 bg-gray-50/20'}`}>
                  {isBWinner && (
                    <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                      <Trophy className="w-3 h-3 fill-white" /> Winner
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wide">Option beta</span>
                    <h4 className="text-base font-black text-gray-900 mt-0.5">{reportB.businessType}</h4>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-gray-450" /> {reportB.location}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-3xl font-black text-blue-900">{reportB.viabilityScore}%</span>
                    <span className="text-xs text-gray-400">Overall Viability Score</span>
                  </div>
                </div>

              </div>

              {/* Tie / Score Differential status overlay indicator */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center text-xs text-gray-650 flex items-center justify-center gap-1.5 font-semibold">
                {isTie ? (
                  <span>⚖️ Both dossiers share identical viability ratings ({reportA.viabilityScore}%).</span>
                ) : (
                  <span>
                    🏆 <strong className="text-gray-900">"{isAWinner ? reportA.businessType : reportB.businessType}"</strong> has a <strong className="text-blue-700">+{scoreDiff} point</strong> feasibility advantage over the other option.
                  </span>
                )}
              </div>

              {/* Attribute Comparisons */}
              <div className="space-y-4 pt-2">
                
                {/* Business Type Row */}
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-gray-50/70 p-2.5 px-4 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    💼 Business Model
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div className="p-4">
                      <p className="text-xs font-semibold text-gray-900">{reportA.businessType}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Alpha Model Formulation</p>
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-semibold text-gray-900">{reportB.businessType}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Beta Model Formulation</p>
                    </div>
                  </div>
                </div>

                {/* Location Row */}
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-gray-50/70 p-2.5 px-4 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    📍 Target Location
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div className="p-4 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span>{reportA.location}</span>
                    </div>
                    <div className="p-4 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span>{reportB.location}</span>
                    </div>
                  </div>
                </div>

                {/* Startup Capital Row */}
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-gray-50/70 p-2.5 px-4 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    💵 Startup Cost Range
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div className="p-4">
                      <p className="text-base font-black text-gray-900">{reportA.financialProjections?.startupCostRange || 'Not Defined'}</p>
                      <p className="text-[10px] text-gray-400 mt-1 truncate" title={reportA.financialProjections?.startupCostBreakdown}>{reportA.financialProjections?.startupCostBreakdown || 'Cost breakdown unavailable'}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-base font-black text-gray-900">{reportB.financialProjections?.startupCostRange || 'Not Defined'}</p>
                      <p className="text-[10px] text-gray-400 mt-1 truncate" title={reportB.financialProjections?.startupCostBreakdown}>{reportB.financialProjections?.startupCostBreakdown || 'Cost breakdown unavailable'}</p>
                    </div>
                  </div>
                </div>

                {/* Revenue Potential Row */}
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-gray-50/70 p-2.5 px-4 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    📈 Projected Revenue Potential & Profit Margin
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div className="p-4 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 font-medium">Year 1 Gross:</span>
                        <strong className="text-gray-800 font-bold">{reportA.financialProjections?.revenueYear1 || 'N/A'}</strong>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-450 font-medium">Year 3 Gross:</span>
                        <strong className="text-indigo-700 font-bold">{reportA.financialProjections?.revenueYear3 || 'N/A'}</strong>
                      </div>
                      <span className="inline-flex pt-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-md px-1.5 py-0.5 mt-1 border border-emerald-100">
                        Margin: {reportA.financialProjections?.profitMargin || 'N/A'}
                      </span>
                    </div>
                    <div className="p-4 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 font-medium">Year 1 Gross:</span>
                        <strong className="text-gray-800 font-bold">{reportB.financialProjections?.revenueYear1 || 'N/A'}</strong>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-450 font-medium">Year 3 Gross:</span>
                        <strong className="text-indigo-700 font-bold">{reportB.financialProjections?.revenueYear3 || 'N/A'}</strong>
                      </div>
                      <span className="inline-flex pt-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-md px-1.5 py-0.5 mt-1 border border-emerald-100">
                        Margin: {reportB.financialProjections?.profitMargin || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Risk Profiles Row */}
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-gray-50/70 p-2.5 px-4 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    ⚠️ Risk Assessment Overview
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div className="p-4">
                      {reportA.scoreBreakdown?.riskLevel !== undefined && (
                        <span className="text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded-md uppercase">
                          Risk Level: {reportA.scoreBreakdown.riskLevel}/100
                        </span>
                      )}
                      <p className="text-xs text-gray-650 mt-2 font-medium leading-relaxed">
                        {getRiskLabel(reportA)}
                      </p>
                    </div>
                    <div className="p-4">
                      {reportB.scoreBreakdown?.riskLevel !== undefined && (
                        <span className="text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded-md uppercase">
                          Risk Level: {reportB.scoreBreakdown.riskLevel}/100
                        </span>
                      )}
                      <p className="text-xs text-gray-650 mt-2 font-medium leading-relaxed">
                        {getRiskLabel(reportB)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Local Competition Row */}
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-gray-50/70 p-2.5 px-4 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    ⚔️ Local Competitor Intensity
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div className="p-4">
                      {reportA.scoreBreakdown?.competitionIntensity !== undefined && (
                        <span className="text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-100 px-2 py-0.5 rounded-md uppercase">
                          Intensity Score: {reportA.scoreBreakdown.competitionIntensity}/100
                        </span>
                      )}
                      <p className="text-xs text-gray-650 mt-2 font-medium leading-relaxed">
                        {getCompetitionLabel(reportA)}
                      </p>
                    </div>
                    <div className="p-4">
                      {reportB.scoreBreakdown?.competitionIntensity !== undefined && (
                        <span className="text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-100 px-2 py-0.5 rounded-md uppercase">
                          Intensity Score: {reportB.scoreBreakdown.competitionIntensity}/100
                        </span>
                      )}
                      <p className="text-xs text-gray-650 mt-2 font-medium leading-relaxed">
                        {getCompetitionLabel(reportB)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recommendation Row */}
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-gray-50/70 p-2.5 px-4 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    🎖️ AI Venture Directive Summary
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div className="p-4 space-y-2">
                      <span className={`inline-flex text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${
                        reportA.recommendation?.decision === 'Recommended' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                        reportA.recommendation?.decision === 'Caution Advised' ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-rose-50 text-rose-800 border-rose-100'
                      }`}>
                        {reportA.recommendation?.decision || 'No Decision'}
                      </span>
                      <p className="text-xs text-gray-500 leading-relaxed italic">
                        "{reportA.recommendation?.reasoning || 'Reasoning text omitted'}"
                      </p>
                    </div>
                    <div className="p-4 space-y-2">
                      <span className={`inline-flex text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${
                        reportB.recommendation?.decision === 'Recommended' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                        reportB.recommendation?.decision === 'Caution Advised' ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-rose-50 text-rose-800 border-rose-100'
                      }`}>
                        {reportB.recommendation?.decision || 'No Decision'}
                      </span>
                      <p className="text-xs text-gray-500 leading-relaxed italic">
                        "{reportB.recommendation?.reasoning || 'Reasoning text omitted'}"
                      </p>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Footer actions */}
            <div className="p-5 bg-gray-50 border-t border-gray-100 text-right flex flex-col sm:flex-row justify-between items-center gap-3">
              <button 
                onClick={() => setSelectedCompareIds([])}
                className="text-xs text-red-650 hover:text-red-700 font-extrabold hover:underline cursor-pointer"
              >
                Clear comparison list
              </button>
              <div className="flex flex-wrap gap-2 justify-end w-full sm:w-auto">
                <button
                  onClick={() => {
                    setShowComparisonMatrix(false);
                    onViewReport(reportA);
                  }}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Inspect Option Alpha
                </button>
                <button
                  onClick={() => {
                    setShowComparisonMatrix(false);
                    onViewReport(reportB);
                  }}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Inspect Option Beta
                </button>
                <button
                  onClick={() => setShowComparisonMatrix(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Acknowledged
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modern Dialog Modal to trigger Premium Upgrade on Compare trigger */}
      {showCompareUpgradeModal && (
        <div className="fixed inset-0 bg-gray-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-gray-150 shadow-2xl relative animate-scale-up text-center">
            
            {/* Visual lock icon */}
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 border border-blue-100 text-blue-600 mb-4">
              <Zap className="w-6 h-6 fill-blue-500 text-blue-500 animate-bounce" />
            </div>

            <h3 className="text-lg font-black text-gray-900 leading-snug">
              Compare Features Gated
            </h3>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              Cross-referencing multiple dossiers, running comparative calculations, and declaring suitability leaders requires a <strong className="text-blue-705 font-bold">Pro</strong>, <strong className="text-purple-700 font-bold">Pro+</strong>, or <strong className="text-green-750 font-bold">Enterprise</strong> tier subscription.
            </p>
            
            {isDemoMode && (
              <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-150 text-xs text-blue-800 mt-4 text-left leading-normal">
                ⚡ <strong>Demo Mode:</strong> Hot-swap your plan using the floating plan switcher to try the comparison matrix instantly.
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setShowCompareUpgradeModal(false)}
                className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 md:text-xs font-bold rounded-xl focus:outline-none transition-colors border border-gray-100 cursor-pointer"
              >
                Close Warning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
