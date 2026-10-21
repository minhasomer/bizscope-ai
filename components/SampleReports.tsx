
import React from 'react';
import { viabilityScoreToAssessment } from '../src/utils/assessmentUtils';
import { AssessmentDot } from './AssessmentDot';
import { trackEvent } from '../src/utils/analytics';

interface SampleReportsProps {
  onNavigate: (page: string) => void;
  onRunSample?: (businessType: string, location: string) => void;
}

interface SampleCard {
  /** View id suffix: the full report lives at ?view=sample-<slug>. */
  slug: string;
  businessType: string;
  location: string;
  category: string;
  viabilityScore: number;
  startupCost: string;
  year1Revenue: string;
  breakEven: string;
  insight: string;
}

/**
 * Real, unedited reports generated with BizScope (src/data/sampleReports/<slug>.json).
 * Card figures are copied from each report's financialProjections and the
 * insight is the first sentence of its executive summary; a test keeps them in sync.
 */
export const SAMPLES: SampleCard[] = [
  {
    slug: 'urgent-care-clinic-gurnee-il',
    businessType: 'Urgent Care Clinic',
    location: 'Gurnee, IL',
    category: 'Medical / Healthcare',
    viabilityScore: 43,
    startupCost: '$800,000–$1,500,000',
    year1Revenue: '$700,000–$1,200,000',
    breakEven: '24–36 months',
    insight: 'The Gurnee, IL market presents a challenging environment for a new urgent care clinic.',
  },
  {
    slug: 'coffee-shop-austin-tx',
    businessType: 'Coffee Shop',
    location: 'Austin, TX',
    category: 'Food & Beverage',
    viabilityScore: 54,
    startupCost: '$80,000–$300,000',
    year1Revenue: '$350,000–$450,000',
    breakEven: '18–36 months',
    insight: 'Austin presents a dynamic and growing market for coffee, driven by a strong local appreciation for quality and a culture of innovation.',
  },
  {
    slug: 'junk-removal-service-lake-county-il',
    businessType: 'Junk Removal Service',
    location: 'Lake County, IL',
    category: 'Local Services',
    viabilityScore: 58,
    startupCost: '$4,900–$49,000',
    year1Revenue: '$100,000–$180,000',
    breakEven: '12–18 months',
    insight: 'The Lake County, IL market presents a viable opportunity for a new junk removal service, driven by a growing population, high median household income, and increasing consumer awareness for decluttering and eco-friendly disposal.',
  },
];

/** Lazy loaders so the full report JSON is only downloaded on its own page. */
export const SAMPLE_REPORT_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  'urgent-care-clinic-gurnee-il':        () => import('../src/data/sampleReports/urgent-care-clinic-gurnee-il.json'),
  'coffee-shop-austin-tx':               () => import('../src/data/sampleReports/coffee-shop-austin-tx.json'),
  'junk-removal-service-lake-county-il': () => import('../src/data/sampleReports/junk-removal-service-lake-county-il.json'),
};


export const SampleReports: React.FC<SampleReportsProps> = ({ onNavigate, onRunSample }) => {
  return (
    <div className="print:hidden bg-gray-50 min-h-[60vh]">

      {/* Compact page header — not a marketing hero */}
      <div className="bg-[#0a0f1e] border-b border-slate-800/80 px-4 py-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                Sample Reports
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-[10px] text-slate-500 italic">Real, unedited reports — click any card to read the full analysis</span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight leading-snug">
              Example BizScope Reports
            </h1>
          </div>
          <button
            onClick={() => onNavigate('home')}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            Analyze Your Own Idea
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cards grid — immediately visible above fold */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-8">
        {/* Framing line — sets expectation before users touch any card */}
        <p className="text-xs text-gray-400 text-center mb-5">
          These are real BizScope reports, shown exactly as generated. Open any one to see the full analysis.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SAMPLES.map((s) => {
            const assessment = viabilityScoreToAssessment(s.viabilityScore);

            return (
              <div
                key={s.businessType}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden"
              >
                {/* Card header with Demo badge */}
                <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1 block">
                      {s.category}
                    </span>
                    <h3 className="text-base font-black text-gray-900 leading-tight">{s.businessType}</h3>
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {s.location}
                    </p>
                  </div>
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-200 mt-0.5 whitespace-nowrap">
                    Real Report
                  </span>
                </div>

                {/* Assessment badge */}
                <div className="px-5 py-4 flex items-center border-b border-gray-100">
                  <div className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl border ${assessment.bgClass} ${assessment.borderClass} shrink-0`}>
                    <AssessmentDot color={assessment.dotColor} variant={assessment.indicatorVariant} size={20} />
                    <span className={`text-[7px] font-black uppercase tracking-wide ${assessment.colorClass} text-center leading-tight mt-0.5 px-1`}>{assessment.label}</span>
                  </div>
                </div>

                {/* Key stats */}
                <div className="px-5 py-4 space-y-2.5 border-b border-gray-100 flex-1">
                  {[
                    { label: 'Startup Cost',   value: s.startupCost },
                    { label: 'Year 1 Revenue', value: s.year1Revenue },
                    { label: 'Break-Even',      value: s.breakEven },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-xs font-bold text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Insight */}
                <div className="px-5 py-3.5 border-b border-gray-100">
                  <p className="text-xs text-gray-500 leading-relaxed italic">"{s.insight}"</p>
                </div>

                {/* CTAs — read the real report, or run your own for this market */}
                <div className="px-5 py-4">
                  <button
                    onClick={() => { trackEvent('sample_report_opened', { sample: s.slug }); onNavigate(`sample-${s.slug}`); }}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    View Full Report
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                        d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (onRunSample) {
                        onRunSample(s.businessType, s.location);
                      } else {
                        onNavigate('home');
                      }
                    }}
                    className="w-full mt-2 text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Run my own report for this market →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Disclaimer + secondary CTA */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            Results vary by business type, location, and market conditions.
          </p>
          <button
            onClick={() => onNavigate('pricing')}
            className="shrink-0 px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            View Pricing &amp; Plans
          </button>
        </div>
      </div>
    </div>
  );
};
