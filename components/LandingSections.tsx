import React from 'react';
import { Check, MapPin, Search, FileText, Rocket, Store, Compass, Lightbulb } from 'lucide-react';
import { SAMPLES } from './SampleReports';
import { AssessmentDot } from './AssessmentDot';
import { viabilityScoreToAssessment } from '../src/utils/assessmentUtils';
import { FAQSection } from './seo/FAQSection';
import { FAQ_ITEMS } from '../src/data/faqContent';
import { trackEvent } from '../src/utils/analytics';

/**
 * Presentational homepage sections shown below the hero for first-time visitors.
 * No form/report logic lives here — the only callbacks are "go back to the form"
 * and page navigation, both owned by Hero.
 *
 * Claims are kept to what the code supports:
 *  - "about a minute": /api/preview has maxDuration = 60.
 *  - Data sources: as stated in src/data/faqContent.ts ("How current is the data…").
 *  - Example card: the illustrative sample from SampleReports (labelled as such there too).
 */

const WHAT_YOU_GET = [
  'A clear viability verdict for your idea in that location',
  'Nearby competitors, found from Google Maps',
  'Estimated startup cost range',
  'Local demand and demographic signals',
  'The key risks, and what to check next',
];

// "Coffee Shop · Austin, TX" — a real report, matching the coffee example people tap most.
const EXAMPLE = SAMPLES.find((s) => s.location === 'Austin, TX') ?? SAMPLES[0];

interface WhatYouGetProps {
  /** Anonymous visitor who still has the free preview — only then do we promise a free report. */
  freePreviewAvailable: boolean;
  onTryIt: () => void;
  onNavigate?: (page: string) => void;
}

export const WhatYouGet: React.FC<WhatYouGetProps> = ({ freePreviewAvailable, onTryIt, onNavigate }) => {
  const assessment = viabilityScoreToAssessment(EXAMPLE.viabilityScore);
  return (
    <section className="bg-white py-14 sm:py-16 border-t border-slate-200">
      <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
            What you get in about a minute
          </h2>
          <p className="text-slate-600 mb-6 text-sm sm:text-base leading-relaxed">
            A new storefront or franchise can easily cost six figures. Checking the local market first takes
            about a minute{freePreviewAvailable ? ' — and your first report is free.' : '.'}
          </p>
          <ul className="space-y-3 mb-7">
            {WHAT_YOU_GET.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-slate-800">
                <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => { trackEvent('landing_what_you_get_cta'); onTryIt(); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-400 text-slate-950 text-sm font-bold rounded-xl shadow-md cursor-pointer"
            >
              Check my idea
            </button>
            {onNavigate && (
              <button
                type="button"
                onClick={() => { trackEvent('landing_sample_reports_click'); onNavigate('samples'); }}
                className="text-sm font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                See sample reports →
              </button>
            )}
          </div>
        </div>

        {/* Example report card */}
        <div className="rounded-2xl border border-slate-200 shadow-xl overflow-hidden bg-white">
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 block mb-1">
                {EXAMPLE.category}
              </span>
              <p className="text-lg font-black text-slate-900 leading-tight">{EXAMPLE.businessType}</p>
              <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {EXAMPLE.location}
              </p>
            </div>
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-200 whitespace-nowrap">
              Example report
            </span>
          </div>
          <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${assessment.bgClass} ${assessment.borderClass}`}>
              <AssessmentDot color={assessment.dotColor} variant={assessment.indicatorVariant} size={16} />
              <span className={`text-xs font-black uppercase tracking-wide ${assessment.colorClass}`}>{assessment.label}</span>
            </div>
          </div>
          <div className="px-5 py-4 space-y-2.5 border-b border-slate-100">
            {[
              { label: 'Startup cost', value: EXAMPLE.startupCost },
              { label: 'Year 1 revenue', value: EXAMPLE.year1Revenue },
              { label: 'Break-even', value: EXAMPLE.breakEven },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-sm font-bold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
          <p className="px-5 py-4 text-xs text-slate-500 leading-relaxed italic">“{EXAMPLE.insight}”</p>
          <p className="px-5 pb-4 text-[10px] text-slate-400">Illustrative example. Your report is generated for your idea and location.</p>
        </div>
      </div>
    </section>
  );
};

const STEPS = [
  { Icon: Lightbulb, title: 'Enter your idea', desc: 'Any business or franchise concept, plus a US city or ZIP code.' },
  { Icon: Search, title: 'We research the area', desc: 'Google Search and Maps results, US Census data and local market signals.' },
  { Icon: FileText, title: 'Get your verdict', desc: 'A structured report you can act on — the same framework for every idea.' },
];

export const HowItWorks: React.FC = () => (
  <section className="bg-slate-100 py-14 sm:py-16 border-t border-slate-200">
    <div className="max-w-5xl mx-auto px-4">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8">How it works</h2>
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {STEPS.map(({ Icon, title, desc }, i) => (
          <li key={title} className="flex flex-col gap-3 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-black flex items-center justify-center">{i + 1}</span>
              <Icon className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

const USE_CASES = [
  { Icon: Rocket, title: 'Startups', desc: 'Check there is real demand before you spend money.' },
  { Icon: Store, title: 'Franchise buyers', desc: 'Compare territories by cost, competition and demand.' },
  { Icon: MapPin, title: 'Local businesses', desc: 'Test a second location before you sign a lease.' },
  { Icon: Compass, title: 'Opportunity seekers', desc: 'Find underserved markets with room to grow.' },
];

/** Replaces the three overlapping "what it is" sections with one. */
export const BuiltFor: React.FC = () => (
  <section className="bg-white py-14 sm:py-16">
    <div className="max-w-5xl mx-auto px-4">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-3">
        Who BizScope is for
      </h2>
      <p className="text-slate-500 text-center mb-8 max-w-2xl mx-auto text-sm leading-relaxed">
        It isn’t a chatbot. Every report follows the same framework — demand, competition, costs and risk —
        tailored to the location you pick, so you can compare ideas side by side without knowing what to ask.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {USE_CASES.map(({ Icon, title, desc }) => (
          <div key={title} className="flex flex-col gap-2 p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Icon className="w-5 h-5 text-indigo-700" />
            </div>
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// Questions a first-time visitor asks before trying it; answers come verbatim from the FAQ page.
const HOME_FAQ_QUESTIONS = [
  'Can I try BizScope without creating an account?',
  'How does BizScope identify competitors?',
  'How current is the data in a BizScope report?',
  'How accurate are BizScope reports?',
  'What is Decision Pass?',
  'Does BizScope work for locations outside the United States?',
];
const HOME_FAQS = FAQ_ITEMS.filter((f) => HOME_FAQ_QUESTIONS.includes(f.question));

export const HomeFAQ: React.FC = () => (
  <div className="border-t border-slate-200">
    <FAQSection faqs={HOME_FAQS} title="Questions before you try it" />
  </div>
);

// ── Above-the-fold hero additions ─────────────────────────────────────────────

const PROOF_POINTS = ['Verdict, competitors & startup costs', 'About 1 minute', 'Google Maps + US Census data'];

/** One-glance answer to "what do I get, how long, is it real?" — sits under the hero button. */
export const HeroProofLine: React.FC = () => (
  <ul className="flex flex-wrap justify-center gap-x-3 sm:gap-x-4 gap-y-1 text-[11px] sm:text-sm text-slate-200">
    {PROOF_POINTS.map((p) => (
      <li key={p} className="flex items-center gap-1.5">
        <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
        {p}
      </li>
    ))}
  </ul>
);

interface HeroExampleProps {
  onNavigate?: (page: string) => void;
}

/**
 * Shows what a result looks like without scrolling.
 *  - Below xl: a compact one-row strip under the form.
 *  - xl and up: a small card absolutely positioned to the right of the form (no layout shift).
 */
export const HeroExample: React.FC<HeroExampleProps> = ({ onNavigate }) => {
  const assessment = viabilityScoreToAssessment(EXAMPLE.viabilityScore);
  const openSamples = onNavigate
    ? () => { trackEvent('hero_example_click'); onNavigate(`sample-${EXAMPLE.slug}`); }
    : undefined;
  return (
    <>
      {/* Compact strip (phones, tablets, small laptops) */}
      <button
        type="button"
        onClick={openSamples}
        className="xl:hidden mx-auto mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-slate-300 hover:bg-white/[0.1] cursor-pointer"
      >
        <span className="text-slate-400">Example:</span>
        <span className="font-semibold text-white">{EXAMPLE.businessType}, {EXAMPLE.location}</span>
        <span className="flex items-center gap-1 font-bold text-emerald-300">
          <AssessmentDot color={assessment.dotColor} variant={assessment.indicatorVariant} size={10} />
          {assessment.label}
        </span>
        <span className="text-slate-400">· {EXAMPLE.startupCost} to start</span>
      </button>

      {/* Side card (wide desktop) */}
      <aside className="hidden xl:block absolute left-full top-0 ml-6 w-60 text-left rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Example result</span>
          <p className="text-sm font-black text-slate-900 leading-tight">{EXAMPLE.businessType}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {EXAMPLE.location}</p>
        </div>
        <div className="px-4 py-3 border-b border-slate-100">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${assessment.bgClass} ${assessment.borderClass}`}>
            <AssessmentDot color={assessment.dotColor} variant={assessment.indicatorVariant} size={12} />
            <span className={`text-[10px] font-black uppercase tracking-wide ${assessment.colorClass}`}>{assessment.label}</span>
          </div>
        </div>
        <div className="px-4 py-3 space-y-1.5 border-b border-slate-100">
          {[
            { label: 'Startup cost', value: EXAMPLE.startupCost },
            { label: 'Year 1 revenue', value: EXAMPLE.year1Revenue },
            { label: 'Break-even', value: EXAMPLE.breakEven },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">{label}</span>
              <span className="text-xs font-bold text-slate-900">{value}</span>
            </div>
          ))}
        </div>
        {openSamples && (
          <button type="button" onClick={openSamples} className="w-full px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 text-left cursor-pointer">
            See the full report →
          </button>
        )}
      </aside>
    </>
  );
};
