
import React from 'react';

interface SampleReportsProps {
  onNavigate: (page: string) => void;
  onRunSample?: (businessType: string, location: string) => void;
}

interface SampleCard {
  businessType: string;
  location: string;
  category: string;
  viabilityScore: number;
  decision: string;
  decisionColor: string;
  startupCost: string;
  year1Revenue: string;
  breakEven: string;
  insight: string;
}

const SAMPLES: SampleCard[] = [
  {
    businessType: 'Urgent Care Clinic',
    location: 'Gurnee, IL',
    category: 'Medical / Healthcare',
    viabilityScore: 78,
    decision: 'Recommended',
    decisionColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    startupCost: '$380k – $520k',
    year1Revenue: '$1.1M',
    breakEven: '18 months',
    insight: 'Underserved suburban corridor with high insurance penetration and a growing senior population driving walk-in demand.',
  },
  {
    businessType: 'Artisan Coffee Shop',
    location: 'Austin, TX',
    category: 'Food & Beverage',
    viabilityScore: 74,
    decision: 'Recommended',
    decisionColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    startupCost: '$130k – $195k',
    year1Revenue: '$360k',
    breakEven: '16 months',
    insight: 'Dense tech-worker population with high disposable income and a strong third-place workspace culture.',
  },
  {
    businessType: 'Junk Removal Service',
    location: 'Lake County, IL',
    category: 'Local Services',
    viabilityScore: 68,
    decision: 'Conditionally Recommended',
    decisionColor: 'bg-amber-100 text-amber-700 border-amber-200',
    startupCost: '$35k – $65k',
    year1Revenue: '$185k',
    breakEven: '9 months',
    insight: 'Low barrier to entry with strong seasonal demand — competitive differentiation requires a fleet expansion strategy.',
  },
];

function getScoreColors(score: number): { ring: string; text: string } {
  if (score >= 75) return { ring: 'stroke-emerald-500', text: 'text-emerald-600' };
  if (score >= 60) return { ring: 'stroke-amber-500', text: 'text-amber-600' };
  return { ring: 'stroke-red-400', text: 'text-red-600' };
}

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
              <span className="text-[10px] text-slate-500 italic">Pre-generated illustrative analyses — not live reports</span>
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
          The reports below are pre-generated illustrative examples. Figures are representative estimates, not live-generated analysis.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SAMPLES.map((s) => {
            const colors = getScoreColors(s.viabilityScore);
            const circumference = 2 * Math.PI * 28;
            const offset = circumference - (s.viabilityScore / 100) * circumference;

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
                    Sample Report
                  </span>
                </div>

                {/* Score ring + decision badge */}
                <div className="px-5 py-4 flex items-center gap-4 border-b border-gray-100">
                  <div className="relative shrink-0">
                    <svg width="64" height="64" viewBox="0 0 68 68" className="-rotate-90">
                      <circle cx="34" cy="34" r="28" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                      <circle
                        cx="34" cy="34" r="28" fill="none"
                        className={colors.ring}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-lg font-black ${colors.text}`}>{s.viabilityScore}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1.5">
                      Viability Score
                    </p>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${s.decisionColor}`}>
                      {s.decision}
                    </span>
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

                {/* CTA — ghost style keeps sample preview as visual focus */}
                <div className="px-5 py-4">
                  <button
                    onClick={() => {
                      if (onRunSample) {
                        onRunSample(s.businessType, s.location);
                      } else {
                        onNavigate('home');
                      }
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-300 text-indigo-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Analyze This Market
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                        d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                  <p className="text-[10px] text-gray-400 text-center mt-1.5">Opens a new live report — separate from this example</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Disclaimer + secondary CTA */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            Sample data is representative. Actual outputs vary by business type, location, and market conditions.
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
