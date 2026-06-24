
import React from 'react';
import type { ViabilityReport } from '../types';
import { formatLocationDisplay } from '../src/utils/locationUtils';
import { viabilityScoreToAssessment, stripScoreReferences } from '../src/utils/assessmentUtils';
import { AssessmentDot } from './AssessmentDot';
import { normalizeRangeSeparator } from '../src/utils/rangeFormat';

interface ReportSummaryCardProps {
  report: ViabilityReport;
  onViewFull: () => void;
  onRegenerate: () => void;
}

const decisionStyle = (d: string) => {
  if (d === 'Recommended')          return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (d === 'Caution Advised')      return 'bg-amber-50  text-amber-700  border-amber-200';
  if (d === 'Verification Required') return 'bg-orange-50 text-orange-700 border-orange-200';
  return                                    'bg-red-50    text-red-700    border-red-200';
};

export const ReportSummaryCard: React.FC<ReportSummaryCardProps> = ({ report, onViewFull, onRegenerate }) => {
  const {
    viabilityScore: score,
    businessType,
    location,
    recommendation,
    executiveSummary: summary,
    financialProjections: fp,
    franchiseTerritoryCheck: ftc,
    franchiseScoreAdjustment: fsa,
  } = report;

  const assessment = viabilityScoreToAssessment(score);
  const cleanedSummary = stripScoreReferences(summary);
  const truncated = cleanedSummary.length > 220 ? cleanedSummary.slice(0, 220).trimEnd() + '…' : cleanedSummary;

  const stats = [
    { label: 'Est. Startup Cost',   value: fp.startupCostRange },
    { label: 'Est. Year 1 Revenue', value: fp.revenueYear1 },
    { label: 'Est. Break-Even',     value: fp.breakEvenTime },
    { label: 'Est. Profit Margin',  value: fp.profitMargin },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Dark header strip — business identity + score */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              Viability Analysis
            </p>
            <h2 className="text-base font-black text-white leading-tight truncate">{businessType}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{formatLocationDisplay(location)}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Assessment tier badge */}
            <div className={`flex flex-col items-center justify-center w-20 h-14 rounded-xl border ${assessment.bgClass} ${assessment.borderClass} px-2`}>
              <AssessmentDot color={assessment.dotColor} variant={assessment.indicatorVariant} size={20} />
              <span className={`text-[8px] font-black uppercase tracking-wide ${assessment.colorClass} text-center leading-tight mt-0.5`}>{assessment.label}</span>
            </div>
            {/* Decision badge */}
            <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${decisionStyle(recommendation?.decision ?? 'Verification Required')}`}>
              {recommendation?.decision ?? 'Verification Required'}
            </span>
          </div>
        </div>

        {/* Franchise territory warning — shown before executive summary */}
        {ftc && (
          <div className={`px-6 py-3 flex items-start gap-2.5 border-b ${ftc.sameBrandFoundInSearch ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
            <span className="text-base shrink-0 mt-0.5">{ftc.sameBrandFoundInSearch ? '🚫' : '⚠️'}</span>
            <div className="min-w-0">
              <p className={`text-xs font-bold ${ftc.sameBrandFoundInSearch ? 'text-red-800' : 'text-amber-800'}`}>
                {ftc.sameBrandFoundInSearch
                  ? `Same-brand ${ftc.brandName} presence detected nearby — territory may be unavailable.`
                  : `Franchise territory check required — verify availability directly with ${ftc.brandName}.`}
              </p>
              <p className={`text-[11px] mt-0.5 ${ftc.sameBrandFoundInSearch ? 'text-red-600' : 'text-amber-600'}`}>
                See the full analysis for required steps before any investment decision.
              </p>
            </div>
          </div>
        )}

        {/* Executive summary — one paragraph, truncated */}
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed">{truncated}</p>
        </div>

        {/* 4 key financial stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-gray-100 divide-x divide-gray-100">
          {stats.map(({ label, value }) => (
            <div key={label} className="px-5 py-3.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">{label}</p>
              <p className="text-sm font-black text-gray-900">{normalizeRangeSeparator(value)}</p>
            </div>
          ))}
        </div>

        {/* Franchise score note — plain English, no math */}
        {fsa && (
          <div className="px-6 py-3 bg-orange-50/60 border-b border-orange-100 flex items-start gap-2 text-[11px]">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <p className="text-orange-800 leading-relaxed">{fsa.reason} Verify directly with the franchisor before investing.</p>
          </div>
        )}

        {/* Action row */}
        <div className="px-6 py-4 flex flex-wrap items-center gap-3">
          <button
            onClick={onViewFull}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            View Full Analysis
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Re-run Analysis
          </button>
        </div>

      </div>
    </div>
  );
};
