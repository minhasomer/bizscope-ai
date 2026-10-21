import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ViabilityReport } from '../types';
import { ReportDisplay } from './ReportDisplay';
import { ReportErrorBoundary } from './ReportErrorBoundary';
import { SAMPLES, SAMPLE_REPORT_LOADERS } from './SampleReports';
import { trackEvent } from '../src/utils/analytics';

/**
 * Public page for one real, unedited sample report (?view=sample-<slug>).
 * Rendered with the Pro plan so the map and full financials are visible;
 * Pro never triggers live API calls from ReportDisplay (regional intel is Pro+),
 * and readOnly hides account actions.
 */

interface SampleReportPageProps {
  slug: string;
  onNavigate: (page: string, authMode?: 'login' | 'signup') => void;
}

export const SampleReportPage: React.FC<SampleReportPageProps> = ({ slug, onNavigate }) => {
  const sample = SAMPLES.find((s) => s.slug === slug);
  const [report, setReport] = useState<ViabilityReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = SAMPLE_REPORT_LOADERS[slug];
    if (!load) { setFailed(true); return; }
    let cancelled = false;
    setReport(null);
    load()
      .then((m) => { if (!cancelled) setReport(m.default as ViabilityReport); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [slug]);

  if (!sample || failed) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 text-sm">That sample report isn’t available.</p>
        <button onClick={() => onNavigate('samples')} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer">
          See all sample reports
        </button>
      </div>
    );
  }

  const generatedAt = report?._generatedAt ?? report?.generationMeta?.generatedAt;
  const generated = generatedAt
    ? new Date(generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="bg-gradient-to-b from-gray-50/50 to-white pb-8 print:py-0">
      <div className="bg-[#0a0f1e] border-b border-slate-800/80 px-4 py-4 print:hidden">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <button
              onClick={() => onNavigate('samples')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All sample reports
            </button>
            <p className="mt-1 text-sm text-white font-semibold">
              Real BizScope report{generated && <span className="text-slate-400 font-normal"> · generated {generated}</span>}
            </p>
            <p className="text-xs text-slate-400">Shown exactly as generated — nothing edited.</p>
          </div>
          <button
            onClick={() => { trackEvent('sample_report_cta_clicked', { sample: slug }); onNavigate('home'); }}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-slate-950 text-sm font-bold rounded-xl cursor-pointer"
          >
            Analyze your own idea — free <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-8">
        {report ? (
          <ReportErrorBoundary onNavigate={onNavigate} key={slug}>
            <ReportDisplay report={report} currentPlan="Pro" onNavigate={onNavigate} readOnly />
          </ReportErrorBoundary>
        ) : (
          <p className="text-center text-sm text-gray-400 py-16">Loading report…</p>
        )}
      </div>
    </div>
  );
};
