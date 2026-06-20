import React, { useState, useEffect } from 'react';
import type { ViabilityReport } from '../types';
import { CompetitorMap } from './CompetitorMap';
import { SavedReportsService } from '../services/savedReportsService';
import { generateRegionalAnalysis, generateMockRegionalData } from '../services/geminiService';
import { isDemoMode } from '../src/config/appConfig';
import { normalizeRangeSeparator } from '../src/utils/rangeFormat';
import {
  viabilityScoreToAssessment,
  scoreToMarketDemandRating,
  scoreToCompetitionRating,
  scoreToCapitalRating,
  scoreToComplexityRating,
  scoreToGrowthRating,
  scoreToRiskRating,
  getNextStep,
  getConfidenceLevel,
  stripScoreReferences,
} from '../src/utils/assessmentUtils';
import { LiveModeConfirmModal } from './LiveModeConfirmModal';
import { UsageTrackerService } from '../services/usageTrackerService';
import { ReportCacheService } from '../services/reportCacheService';
import { 
  Lock, 
  Unlock, 
  Sparkles, 
  Check, 
  X, 
  AlertTriangle, 
  ShieldCheck, 
  Map, 
  FileDown, 
  Heart, 
  Compass, 
  Building, 
  Coins, 
  Layers, 
  HelpCircle,
  Globe,
  TrendingUp,
  MapPin,
  DollarSign,
  ArrowRight,
  Printer,
  ChevronDown,
  Info,
  Navigation,
  Eye,
  AlertCircle
} from 'lucide-react';
import { 
  SubscriptionPlan, 
  canViewFullFinancials, 
  canViewRegionalIntelligence, 
  canExportPdf, 
  canSaveReports, 
  canCompareReports 
} from '../src/utils/planUtils';
import { PDFService, PDFExportOptions } from '../services/pdfService';
import { formatLocationDisplay } from '../src/utils/locationUtils';

interface ReportDisplayProps {
  report: ViabilityReport;
  currentPlan: SubscriptionPlan;
  onNavigate: (page: string, authMode?: 'login' | 'signup') => void;
  onRegenerate?: () => void;
  /**
   * When true, the regional intelligence section shows a live-mode cost confirmation
   * before making the Gemini API call. Set to `!isDemoMode && isAdmin(user?.role)`.
   * Normal (non-admin) users never see the confirmation — the load fires immediately.
   */
  isAdminOrDev?: boolean;
}

// ─── Pro Insights: derived market metrics ────────────────────────────────────
// These values are modeled client-side from the report's Gemini-generated
// scoreBreakdown + a per-category benchmark table. No additional API call.
// Same report inputs → same outputs (deterministic hash-based variation).

type BizCategory =
  | 'franchise_food' | 'fast_food' | 'cafe' | 'restaurant'
  | 'fitness' | 'home_services' | 'hvac' | 'auto'
  | 'childcare' | 'beauty' | 'retail' | 'healthcare'
  | 'professional' | 'education' | 'general';

interface CategoryBenchmark {
  cpmRange:      [number, number];  // $/CPM
  cpcRange:      [number, number];  // $/click
  interestRange: [number, number];  // 0-100
  yoyRange:      [number, number];  // %
}

const CATEGORY_BENCHMARKS: Record<BizCategory, CategoryBenchmark> = {
  franchise_food: { cpmRange: [11, 19], cpcRange: [1.40, 3.20], interestRange: [78, 91], yoyRange: [7,  15] },
  fast_food:      { cpmRange: [9,  17], cpcRange: [1.20, 2.80], interestRange: [74, 89], yoyRange: [5,  12] },
  cafe:           { cpmRange: [7,  13], cpcRange: [1.10, 2.40], interestRange: [72, 87], yoyRange: [5,  11] },
  restaurant:     { cpmRange: [8,  15], cpcRange: [1.40, 2.90], interestRange: [68, 84], yoyRange: [3,  10] },
  fitness:        { cpmRange: [12, 21], cpcRange: [1.90, 4.20], interestRange: [68, 84], yoyRange: [9,  19] },
  home_services:  { cpmRange: [10, 18], cpcRange: [4.80, 11.50], interestRange: [58, 74], yoyRange: [4,  11] },
  hvac:           { cpmRange: [11, 20], cpcRange: [6.00, 14.00], interestRange: [54, 70], yoyRange: [4,  10] },
  auto:           { cpmRange: [6,  12], cpcRange: [2.80, 6.50], interestRange: [55, 72], yoyRange: [2,   8] },
  childcare:      { cpmRange: [13, 23], cpcRange: [2.40, 5.20], interestRange: [77, 91], yoyRange: [5,  13] },
  beauty:         { cpmRange: [8,  16], cpcRange: [1.40, 3.60], interestRange: [66, 81], yoyRange: [4,  11] },
  retail:         { cpmRange: [8,  14], cpcRange: [0.90, 2.40], interestRange: [60, 77], yoyRange: [2,   8] },
  healthcare:     { cpmRange: [14, 26], cpcRange: [2.40, 5.20], interestRange: [74, 89], yoyRange: [6,  15] },
  professional:   { cpmRange: [14, 29], cpcRange: [2.80, 8.50], interestRange: [50, 67], yoyRange: [3,   9] },
  education:      { cpmRange: [9,  18], cpcRange: [1.80, 4.60], interestRange: [63, 79], yoyRange: [5,  13] },
  general:        { cpmRange: [8,  16], cpcRange: [1.40, 4.00], interestRange: [58, 76], yoyRange: [3,  10] },
};

function classifyBusiness(businessType: string): BizCategory {
  const b = businessType.toLowerCase();
  if (/chick.fil|franchise|mcdonald|subway|taco bell|domino|dunkin|sonic|burger king|wendy/.test(b)) return 'franchise_food';
  if (/fast food|quick.?service|qsr/.test(b)) return 'fast_food';
  if (/coffee|cafe|caf[eé]|bakery|brew(ery)?|espresso|boba|tea house/.test(b)) return 'cafe';
  if (/restaurant|dining|bistro|kitchen|pizz|sushi|ramen|thai|chinese|italian|mexican|grill|bar & grill/.test(b)) return 'restaurant';
  if (/gym|fitness|yoga|pilates|crossfit|studio|workout|spin|barre|martial art|boxing/.test(b)) return 'fitness';
  if (/hvac|heating|cooling|air condition|furnace|duct/.test(b)) return 'hvac';
  if (/plumb|electric|roofing|landscap|lawn|pressure wash|junk removal|handyman|home service|contractor|cleaning service/.test(b)) return 'home_services';
  if (/auto|car wash|detailing|detailer|mechanic|oil change|tire|body shop|towing/.test(b)) return 'auto';
  if (/daycare|child.?care|preschool|nursery|after.school|babysit/.test(b)) return 'childcare';
  if (/salon|hair|nail|spa|barbershop|barber|esthetic|lash|brow|wax/.test(b)) return 'beauty';
  if (/retail|boutique|gift shop|clothing|apparel|footwear|hardware store|grocery|market/.test(b)) return 'retail';
  if (/medical|dental|clinic|therapy|therapist|chiropract|optom|physician|urgent care|physical therapy/.test(b)) return 'healthcare';
  if (/consult|law firm|attorney|accounti|cpa|insurance|financial advis|mortgage|real estate/.test(b)) return 'professional';
  if (/tutor|learning|school|education|training|coaching|college prep/.test(b)) return 'education';
  return 'general';
}

// Stable 0-1 hash from a string — same string always returns same value.
function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return (h % 1000) / 1000;
}

// Blend a value toward an anchor by weight (0=pure range, 1=pure anchor).
function blend(rangeMin: number, rangeMax: number, hashFactor: number, anchor: number, anchorWeight: number): number {
  const rangeMid = rangeMin + hashFactor * (rangeMax - rangeMin);
  return rangeMid * (1 - anchorWeight) + anchor * anchorWeight;
}

export interface ProInsightMetrics {
  interestScore:  number;   // 0-100
  interestLabel:  'High' | 'Moderate' | 'Growing' | 'Emerging';
  yoyGrowth:      number;   // %
  cpm:            number;   // $ per 1,000 impressions
  cpc:            number;   // $ per click
  sourceLabel:    string;   // human-readable provenance note
}

export function deriveProInsightMetrics(report: ViabilityReport): ProInsightMetrics {
  const category  = classifyBusiness(report.businessType);
  const bench     = CATEGORY_BENCHMARKS[category];
  const hashKey   = (report.businessType + '|' + report.location).toLowerCase();
  const h         = stableHash(hashKey);
  const sb        = report.scoreBreakdown;

  // --- Market Interest Score ---
  // Primary signal: Gemini's marketDemand score (0-100) when available.
  // Fallback: category benchmark range + hash variation.
  let interest: number;
  let sourceLabel: string;

  if (sb?.marketDemand != null) {
    // Gemini gave us a direct demand score — use it as the primary anchor,
    // then blend slightly with the category benchmark for realism.
    interest    = blend(bench.interestRange[0], bench.interestRange[1], h, sb.marketDemand, 0.6);
    sourceLabel = 'Demand score from AI analysis · advertising costs are industry-modeled';
  } else {
    interest    = bench.interestRange[0] + h * (bench.interestRange[1] - bench.interestRange[0]);
    sourceLabel = 'Industry-modeled estimates · not location-specific';
  }

  // Competition penalty: high competition eats into addressable demand signal.
  if (sb?.competitionIntensity != null) {
    const compPressure = (sb.competitionIntensity - 50) / 50; // -1 to +1
    interest -= compPressure * 6;
  }
  interest = Math.round(Math.max(48, Math.min(96, interest)));

  const interestLabel: ProInsightMetrics['interestLabel'] =
    interest >= 80 ? 'High' :
    interest >= 65 ? 'Moderate' :
    interest >= 55 ? 'Growing' : 'Emerging';

  // --- YoY Growth ---
  // If market trends text contains positive signals, nudge upward.
  let yoyBase = bench.yoyRange[0] + h * (bench.yoyRange[1] - bench.yoyRange[0]);
  const trendText = (report.marketTrends?.summary ?? '').toLowerCase();
  if (/growing|growth|increas|surge|boom|rising|expand/.test(trendText)) yoyBase += 2.5;
  if (/declin|shrink|contract|down|slow/.test(trendText)) yoyBase -= 2.5;
  const yoyGrowth = Math.round(Math.max(1, Math.min(28, yoyBase)) * 10) / 10;

  // --- CPM ---
  let cpm: number;
  if (sb?.competitionIntensity != null) {
    // High competition = more advertisers bidding = higher CPM.
    const compAnchor = bench.cpmRange[0] + (sb.competitionIntensity / 100) * (bench.cpmRange[1] - bench.cpmRange[0]);
    cpm = blend(bench.cpmRange[0], bench.cpmRange[1], h, compAnchor, 0.5);
  } else {
    cpm = bench.cpmRange[0] + h * (bench.cpmRange[1] - bench.cpmRange[0]);
  }
  cpm = Math.round(cpm * 100) / 100;

  // --- CPC ---
  let cpc: number;
  if (sb?.competitionIntensity != null) {
    const compAnchor = bench.cpcRange[0] + (sb.competitionIntensity / 100) * (bench.cpcRange[1] - bench.cpcRange[0]);
    cpc = blend(bench.cpcRange[0], bench.cpcRange[1], h, compAnchor, 0.5);
  } else {
    cpc = bench.cpcRange[0] + h * (bench.cpcRange[1] - bench.cpcRange[0]);
  }
  cpc = Math.round(cpc * 100) / 100;

  return { interestScore: interest, interestLabel, yoyGrowth, cpm, cpc, sourceLabel };
}

// Reusable Locked Section Component
interface LockedSectionProps {
  currentPlan: SubscriptionPlan;
  requiredPlan: SubscriptionPlan; // 'Pro' or 'Pro+'
  title: string;
  teaser: string;
  onUpgrade: () => void;
  children: React.ReactNode;
}

export const LockedSection: React.FC<LockedSectionProps> = ({
  currentPlan,
  requiredPlan,
  title,
  teaser,
  onUpgrade,
  children
}) => {
  const isLocked = (() => {
    if (requiredPlan === 'Pro') {
      return currentPlan === 'Explorer';
    }
    if (requiredPlan === 'Pro+') {
      return currentPlan === 'Explorer' || currentPlan === 'Pro';
    }
    return false;
  })();

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative group/lock w-full overflow-hidden rounded-3xl">
      {/* Blurred peek-able premium content outline */}
      <div className="select-none pointer-events-none filter blur-[5px] opacity-25 scale-[0.99] transition-all duration-300">
        {children}
      </div>

      {/* Locking card overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-gray-50/10 backdrop-blur-[1.5px] animate-fade-in print:hidden">
        <div className="max-w-md bg-white p-6 md:p-8 rounded-3xl border border-gray-250/80 shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-blue-300">
          {/* Subtle colored top badge */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>
          
          <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4 border border-indigo-100 shadow-xs animate-bounce">
            <Lock className="w-5 h-5" />
          </div>

          <span className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider mb-3">
            {requiredPlan === 'Pro+' ? 'Pro+ Feature' : 'Pro Feature'}
          </span>

          <h4 className="text-sm font-black text-gray-900 tracking-tight mb-2 uppercase">
            {title}
          </h4>

          <p className="text-xs text-gray-500 mt-1 mb-5 leading-relaxed max-w-sm">
            {teaser}
          </p>

          <button
            onClick={onUpgrade}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Upgrade to Unlock</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Parse the first currency value from a string that may contain ranges,
// suffixes (k/M/B), trailing text, or "+" qualifiers.
// Examples: "$2,500,000 - $3,500,000" → 2500000
//           "$1.5M"                   → 1500000
//           "$120k - $200k"           → 120000
//           "$300,000+ annually"      → 300000
// Returns 0 if no recognisable value is found.
function parseCurrencyStr(s: string): number {
  const m = s.match(/\$\s*([\d,]+(?:\.\d+)?)\s*([kKmMbB]?)/);
  if (!m) return 0;
  const num = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(num)) return 0;
  switch (m[2].toLowerCase()) {
    case 'k': return num * 1_000;
    case 'm': return num * 1_000_000;
    case 'b': return num * 1_000_000_000;
    default:  return num;
  }
}

// Format a raw dollar integer with the appropriate magnitude suffix (k / M / B)
function formatRevLabel(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${Math.round(n / 1_000)}k`;
  return `$${n.toLocaleString()}`;
}

// Year-over-Year Revenue accumulator curve
const RevenueChart: React.FC<{ year1: string; year3: string }> = ({ year1, year3 }) => {
  const val1 = parseCurrencyStr(year1) || 340000;
  const val3 = parseCurrencyStr(year3) || 495000;
  const val0 = 0;
  const val2 = Math.round((val1 + val3) / 2 * 1.05);
  const showYear2Label = val1 > 0 && val3 > 0;

  const points = [
    { year: 'Launch', value: val0, label: '$0' },
    { year: 'Year 1', value: val1, label: normalizeRangeSeparator(year1) },
    { year: 'Year 2', value: val2, label: showYear2Label ? formatRevLabel(val2) : '' },
    { year: 'Year 3', value: val3, label: normalizeRangeSeparator(year3) }
  ];

  const maxVal = Math.max(...points.map(p => p.value)) * 1.1;

  const width = 500;
  const height = 130;
  const paddingX = 45;
  const paddingY = 20;

  const getCoordinates = (index: number, value: number) => {
    const x = paddingX + (index / (points.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - (value / maxVal) * (height - 2 * paddingY);
    return { x, y };
  };

  const coords = points.map((p, i) => getCoordinates(i, p.value));
  
  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const cpX1 = coords[i - 1].x + (coords[i].x - coords[i - 1].x) / 2;
    const cpY1 = coords[i - 1].y;
    const cpX2 = coords[i - 1].x + (coords[i].x - coords[i - 1].x) / 2;
    const cpY2 = coords[i].y;
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${coords[i].x} ${coords[i].y}`;
  }

  const fillD = `${pathD} L ${coords[coords.length - 1].x} ${height - paddingY} L ${coords[0].x} ${height - paddingY} Z`;

  return (
    <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-150 flex flex-col items-center w-full shadow-xs">
      <div className="flex justify-between w-full mb-3 select-none">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Financial growth projection</span>
        <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Revenue Growth Projection
        </span>
      </div>
      <div className="relative w-full h-[100px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.00" />
            </linearGradient>
          </defs>
          
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#E5E7EB" strokeWidth="1" />
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#F3F4F6" strokeWidth="1" />
          <line x1={paddingX} y1={(height - paddingY + paddingY) / 2} x2={width - paddingX} y2={(height - paddingY + paddingY) / 2} stroke="#F3F4F6" strokeWidth="1" />

          <path d={fillD} fill="url(#chartGradient)" />
          <path d={pathD} fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />

          {coords.map((c, i) => (
            <g key={i} className="group">
              <circle cx={c.x} cy={c.y} r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" className="cursor-pointer transition-all duration-200 hover:scale-125" />
              <text x={c.x} y={c.y - 12} textAnchor="middle" className="text-[10px] font-black fill-gray-900 font-sans">
                {points[i].label}
              </text>
              <text x={c.x} y={height - 4} textAnchor="middle" className="text-[9px] font-extrabold fill-gray-400 font-sans uppercase">
                {points[i].year}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

// Animated Viability Score Circle component
const AssessmentBadge: React.FC<{ score: number }> = ({ score }) => {
  const a = viabilityScoreToAssessment(score);
  // Scoreless UX (Decision Framework, Sprint 11): the numeric score stays in the
  // data model and drives color/label, but is NEVER shown as a number. Display
  // the qualitative assessment only.
  return (
    <div className={`flex flex-col items-center justify-center w-36 h-36 md:w-44 md:h-44 rounded-3xl border-2 ${a.bgClass} ${a.borderClass} select-none transition-all duration-300`}>
      <span className="text-4xl md:text-5xl mb-1.5 leading-none">{a.emoji}</span>
      <span className={`text-[10px] font-black uppercase tracking-widest ${a.colorClass} text-center px-3 leading-tight`}>{a.label}</span>
      <span className="text-[9px] text-gray-400 font-semibold mt-1.5 uppercase tracking-wider">Overall Assessment</span>
    </div>
  );
};

// Cleaner modular Card structure with custom header styling
const SectionCard: React.FC<{ 
  title: string; 
  children: React.ReactNode; 
  icon: React.ReactNode; 
  className?: string;
  badge?: React.ReactNode;
  id?: string;
}> = ({ title, children, icon, className = "", badge, id }) => (
  <div id={id} className={`bg-white rounded-3xl p-6 md:p-8 border border-gray-150 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:border-blue-200/50 hover:shadow-xs avoid-break ${className}`}>
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600 rounded-xl p-2.5 border border-blue-150 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <h3 className="text-sm md:text-base font-black text-gray-900 tracking-tight uppercase">{title}</h3>
        </div>
        {badge}
      </div>
      <div className="text-gray-650 leading-relaxed text-sm whitespace-normal">
        {children}
      </div>
    </div>
  </div>
);

// 6-category ratings grid — assessment-first breakdown in the report header
const RatingsGrid: React.FC<{ report: ViabilityReport }> = ({ report }) => {
  const sb = report.scoreBreakdown;
  if (!sb) return null;
  const scalability = report.financialProjections?.scalability;

  const rows: Array<{ category: string; label: string; colorClass: string; bgClass: string }> = [
    { category: 'Market Demand',          ...scoreToMarketDemandRating(sb.marketDemand) },
    { category: 'Competition',            ...scoreToCompetitionRating(sb.competitionIntensity) },
    { category: 'Capital Requirements',   ...scoreToCapitalRating(sb.financialFeasibility) },
    { category: 'Operational Complexity', ...scoreToComplexityRating(sb.riskLevel) },
    { category: 'Growth Potential',       ...scoreToGrowthRating(sb.marketDemand, scalability) },
    { category: 'Risk Level',             ...scoreToRiskRating(sb.riskLevel) },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex-grow">
      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2 flex items-center justify-between">
        <span>Assessment Ratings</span>
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">AI Estimate</span>
      </h4>
      <div className="grid grid-cols-1 gap-2">
        {rows.map(({ category, label, colorClass, bgClass }) => (
          <div key={category} className={`flex justify-between items-center px-3 py-1.5 rounded-xl ${bgClass} border border-current/10`}>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{category}</span>
            <span className={`text-[10px] font-black ${colorClass}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Compact, collapsible "What this means" legend for the scoreless UX. Explains
// the qualitative outcome labels and the rating-pill color scale without ever
// reintroducing a numeric score. print:hidden — the PDF is built independently
// via jsPDF, and this keeps browser print output clean too.
const ASSESSMENT_OUTCOMES: Array<{ label: string; meaning: string; dotClass: string }> = [
  { label: 'Strong Opportunity',          meaning: 'Favorable overall signal. Still validate costs, competition, and local demand.', dotClass: 'bg-emerald-500' },
  { label: 'Worth Further Investigation', meaning: 'Promising signals, but key assumptions need validation before investing.',       dotClass: 'bg-amber-500'   },
  { label: 'Proceed Carefully',           meaning: 'Viable but risk-sensitive. Review weak areas before moving forward.',             dotClass: 'bg-orange-400'  },
  { label: 'Caution Advised',             meaning: 'Material risks present. Do not proceed without deeper validation.',               dotClass: 'bg-orange-500'  },
  { label: 'Not Recommended',             meaning: 'Weak or unfavorable signal based on current market, competition, or economics.',  dotClass: 'bg-rose-500'    },
];

const RATING_SCALE: Array<{ label: string; dotClass: string }> = [
  { label: 'Exceptional · Strong · Low Risk', dotClass: 'bg-emerald-500' },
  { label: 'Moderate · Mixed',                dotClass: 'bg-amber-500'   },
  { label: 'High · Elevated',                 dotClass: 'bg-orange-500'  },
  { label: 'Very High · Severe',              dotClass: 'bg-rose-500'    },
  { label: 'Unknown · Limited Data',          dotClass: 'bg-gray-400'    },
];

const AssessmentLegend: React.FC = () => (
  <details className="mt-5 group print:hidden rounded-2xl border border-gray-150 bg-gray-50/60 open:bg-gray-50/90 transition-colors">
    <summary className="flex items-center gap-2 cursor-pointer select-none px-4 py-2.5 text-[11px] font-bold text-gray-500 hover:text-gray-700 transition-colors list-none">
      <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <span className="uppercase tracking-wider">What this means</span>
      <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto shrink-0 transition-transform group-open:rotate-180" />
    </summary>
    <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 border-t border-gray-100">
      <div className="pt-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Overall Assessment</p>
        <ul className="space-y-2">
          {ASSESSMENT_OUTCOMES.map(({ label, meaning, dotClass }) => (
            <li key={label} className="flex items-start gap-2.5">
              <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
              <span className="text-[11px] leading-snug text-gray-600">
                <strong className="text-gray-800 font-bold">{label}</strong> — {meaning}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="md:pt-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">Rating Scale</p>
        <ul className="space-y-2">
          {RATING_SCALE.map(({ label, dotClass }) => (
            <li key={label} className="flex items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
              <span className="text-[11px] text-gray-600">{label}</span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-gray-400 mt-3 leading-snug">
          Qualitative AI estimates across Market Demand, Competition, Growth Potential, Risk Level, and Capital Requirements — directional guidance, not guarantees.
        </p>
      </div>
    </div>
  </details>
);

// Scrolling Subnav component for easy navigation on mobile / desktops
const ReportSubNav: React.FC<{ activeSection: string; setActiveSection: (id: string) => void }> = ({ activeSection, setActiveSection }) => {
  const items = [
    { id: 'overview', label: 'Executive Summary' },
    { id: 'financials', label: 'Financial Projections' },
    { id: 'strategy', label: 'Risks & Success Factors' },
    { id: 'competition', label: 'Competition' },
    { id: 'demographics', label: 'Demographics & Trends' },
    { id: 'regional', label: 'Regional Insights' },
  ];

  const handleScrollTo = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-gray-250 py-3 px-4 shadow-sm overflow-x-auto no-scrollbar print:hidden">
      <div className="max-w-6xl mx-auto flex gap-1.5 md:gap-3 shrink-0">
        {items.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleScrollTo(item.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-sm border border-blue-650' 
                  : 'bg-gray-100 text-gray-550 hover:bg-gray-200 hover:text-gray-900 border border-gray-150'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const ReportDisplay: React.FC<ReportDisplayProps> = ({ report, currentPlan, onNavigate, onRegenerate, isAdminOrDev = false }) => {
  const [showMapModal, setShowMapModal] = useState(false);
  const [showUpgradeGateModal, setShowUpgradeGateModal] = useState<string | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const handleRegenerateClick = () => {
    if (isDemoMode) {
      if (onRegenerate) onRegenerate();
    } else {
      setShowRegenConfirm(true);
    }
  };

  const handleRegenerateConfirm = () => {
    setShowRegenConfirm(false);
    if (onRegenerate) onRegenerate();
  };

  const [activeSection, setActiveSection] = useState('overview');

  const [showExportModal, setShowExportModal] = useState(false);
  const [isExportLoading, setIsExportLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [options, setOptions] = useState<PDFExportOptions>({
    isWhiteLabelMode: currentPlan === 'Enterprise',
    advisoryFirmName: 'BizScope Premium Advisory',
    clientName: 'Advisory Client',
    accentColor: 'Classic Blue',
    removeWatermark: currentPlan === 'Enterprise'
  });

  useEffect(() => {
    setOptions(prev => ({
      ...prev,
      isWhiteLabelMode: currentPlan === 'Enterprise',
      removeWatermark: currentPlan === 'Enterprise'
    }));
  }, [currentPlan]);
  
  const [regionalData, setRegionalData] = useState<any>(null);
  const [isRegionalLoading, setIsRegionalLoading] = useState(false);
  const [regionalError, setRegionalError] = useState<string | null>(null);
  const [regionalQuotaExceeded, setRegionalQuotaExceeded] = useState(false);
  // True when the live-mode cost confirmation is waiting for the Admin to respond.
  const [awaitingRegionalConfirm, setAwaitingRegionalConfirm] = useState(false);

  /**
   * Execute the actual regional API call — called either directly (non-admin / demo)
   * or by the Admin after confirming the live-mode cost prompt.
   */
  const executeRegionalLoad = React.useCallback(async () => {
    setIsRegionalLoading(true);
    setRegionalError(null);
    try {
      const data = await generateRegionalAnalysis(report.businessType, report.location, currentPlan, false);
      if (data && !data.loadedFromCache) {
        await UsageTrackerService.incrementRegionalUsage(currentPlan);
        window.dispatchEvent(new Event('bizscope_usage_update'));
      }
      setRegionalData(data);
    } catch (err) {
      console.error('Failed to load regional analysis:', err);
      // Fallback to generated mock data so the section still renders something.
      const fallback = generateMockRegionalData(report.businessType, report.location);
      setRegionalData(fallback);
    } finally {
      setIsRegionalLoading(false);
    }
  }, [report.businessType, report.location, currentPlan]);

  useEffect(() => {
    const loadRegional = async () => {
      if (!canViewRegionalIntelligence(currentPlan)) return;

      setIsRegionalLoading(true);
      setRegionalError(null);
      setRegionalQuotaExceeded(false);

      try {
        // Cache hit — serve immediately, no API call and no confirmation needed.
        const cached = await ReportCacheService.get(report.businessType, report.location, 'regional', currentPlan);
        if (cached) {
          setRegionalData(cached);
          return;
        }

        // Quota check before attempting any live call.
        const usage = UsageTrackerService.getDetails(currentPlan);
        if (!usage.canRunRegional) {
          setRegionalQuotaExceeded(true);
          return;
        }

        // Live-mode cost protection: pause and show confirmation to Admin/dev users.
        // Normal users proceed immediately.
        if (!isDemoMode && isAdminOrDev) {
          setAwaitingRegionalConfirm(true);
          return; // executeRegionalLoad() fires only after the user confirms.
        }

        // Demo mode or non-admin live user → load directly.
        await executeRegionalLoad();
      } catch (err) {
        console.error('Failed to load regional analysis component:', err);
        const fallback = generateMockRegionalData(report.businessType, report.location);
        setRegionalData(fallback);
      } finally {
        setIsRegionalLoading(false);
      }
    };
    loadRegional();
  }, [report.businessType, report.location, currentPlan, isAdminOrDev, executeRegionalLoad]);

  const [isSaved, setIsSaved] = useState(() => {
    try {
      const stored = localStorage.getItem('bizscope_saved_reports');
      if (stored) {
        const list = JSON.parse(stored);
        return list.some((r: any) => r.businessType === report.businessType && r.location === report.location);
      }
    } catch (e) {}
    return false;
  });
  const [saveSuccess, setSaveSuccess] = useState('');

  // Reconcile saved-state against the real store (Supabase for signed-in users),
  // not just the localStorage mirror the initializer reads. Without this, the
  // button reverts to "Save to Dashboard" after navigation/refresh even though
  // the report is genuinely saved. Upgrade-only (never clears a known-saved
  // state) so a transient fetch error can't flip a saved report back to unsaved.
  useEffect(() => {
    let cancelled = false;
    SavedReportsService.isReportSaved(report.businessType, report.location)
      .then((saved) => { if (!cancelled && saved) setIsSaved(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [report.businessType, report.location]);

  // Active section scroll tracking scrollspy
  useEffect(() => {
    const sections = ['overview', 'financials', 'strategy', 'competition', 'demographics', 'regional'];
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getSurroundingZIPs = (loc: string) => {
    const normalized = loc.toLowerCase();
    if (normalized.includes('brooklyn') || normalized.includes('ny') || normalized.includes('atlantic') || normalized.includes('flatbush')) {
      return [
        { zip: '11201 (Downtown Brooklyn)', density: 'Very High', medianIncome: '$142,500', competitorsCount: 14, opportunityIndex: '88%' },
        { zip: '11215 (Park Slope)', density: 'High', medianIncome: '$165,000', competitorsCount: 9, opportunityIndex: '94%' },
        { zip: '11211 (Williamsburg)', density: 'Extreme', medianIncome: '$118,000', competitorsCount: 22, opportunityIndex: '54%' },
        { zip: '11225 (Crown Heights)', density: 'Moderate', medianIncome: '$84,000', competitorsCount: 4, opportunityIndex: '81%' },
      ];
    }
    if (normalized.includes('orange') || normalized.includes('irvine') || normalized.includes('ca')) {
      return [
        { zip: '92612 (West Irvine)', density: 'High', medianIncome: '$115,000', competitorsCount: 8, opportunityIndex: '91%' },
        { zip: '92660 (Newport Beach)', density: 'Moderate', medianIncome: '$198,000', competitorsCount: 12, opportunityIndex: '74%' },
        { zip: '92626 (Costa Mesa)', density: 'High', medianIncome: '$92,000', competitorsCount: 15, opportunityIndex: '68%' },
        { zip: '92618 (East Irvine)', density: 'Very High', medianIncome: '$130,000', competitorsCount: 5, opportunityIndex: '96%' },
      ];
    }
    return [
      { zip: 'Core Commercial Dist-A', density: 'High', medianIncome: '$95,505', competitorsCount: 6, opportunityIndex: '89%' },
      { zip: 'Residential Row-B', density: 'Moderate', medianIncome: '$74,000', competitorsCount: 3, opportunityIndex: '75%' },
      { zip: 'Suburban Loop-C', density: 'Low', medianIncome: '$112,020', competitorsCount: 1, opportunityIndex: '92%' },
      { zip: 'Industrial Belt-D', density: 'High', medianIncome: '$83,000', competitorsCount: 11, opportunityIndex: '51%' },
    ];
  };

  const surroundingZips = getSurroundingZIPs(report.location);

  const getLaunchAnalysisText = () => {
    const biz = (report.businessType || '').toLowerCase();
    if (biz.includes('fitness') || biz.includes('gym') || biz.includes('studio') || biz.includes('yoga') || biz.includes('pilates') || biz.includes('workout')) {
      return {
          commuter: "Peak activity registers highest between 6:00 AM - 9:00 AM and 5:00 PM - 8:00 PM, aligning perfectly with pre- and post-work workout preferences.",
          residential: "High-density residential sectors show strong demand for neighborhood-centric class times; mid-morning classes serve remote workers well.",
          lifestyle: "Local resident profiles align with premium health and wellness trends; activewear branding and organic community partnerships can drive up retention by 25%."
      };
    }
    if (biz.includes('coffee') || biz.includes('cafe') || biz.includes('bakery') || biz.includes('restaurant') || biz.includes('food') || biz.includes('brew') || biz.includes('drink')) {
      return {
          commuter: "Pedestrian density registers highest peak between 7:45 AM - 10:15 AM near transit lines, transit pathways, and major avenues.",
          residential: "Suburban-proximate commercial rows host massive remote-working density; peak cup query demands persist in mid-afternoons.",
          lifestyle: "Local customers show immense preference for sustainable, fair-trade alternatives, allowing standard premium markups of up to 35%."
      };
    }
    return {
        commuter: `Optimal operational foot traffic and client visits peaks during standard peak service hours for a ${report.businessType}.`,
        residential: `Neighborhood residential micro-pockets show high local affinity and search queries matching ${report.businessType} services near their homes.`,
        lifestyle: `High disposable income brackets enable strong customer loyalty and word-of-mouth client growth for a high-quality ${report.businessType}.`
    };
  };

  const launchText       = getLaunchAnalysisText();
  const proInsights      = deriveProInsightMetrics(report);

  const handleSaveReport = async () => {
    if (!canSaveReports(currentPlan)) {
      setShowUpgradeGateModal('save');
      return;
    }

    try {
      await SavedReportsService.saveReport(report);
      setIsSaved(true);
      setSaveSuccess('Report saved!');
      setTimeout(() => setSaveSuccess(''), 2500);
    } catch(e) {
      console.error(e);
    }
  };

  const handleExportPDF = () => {
    if (!canExportPdf(currentPlan)) {
      setShowUpgradeGateModal('pdf');
      return;
    }
    // Reset stale state so every modal open starts clean
    setIsExportLoading(false);
    setExportSuccess(null);
    setExportError(null);
    setShowExportModal(true);
  };

  const getRecommendationStyle = (decision: string, riskLevel: number) => {
    // Risk wording is derived from the same scoreToRiskRating() used by the
    // Risk Level rating elsewhere in this report, so the badge never
    // contradicts the report's own risk classification (e.g. "Moderate" risk
    // shown next to a badge that hardcoded "High Risk").
    const riskLabel = scoreToRiskRating(riskLevel).label;
    switch(decision) {
      case 'Recommended':
        return { bg: 'bg-green-50 text-green-800 border-green-200', label: '✅ Recommended' };
      case 'Caution Advised':
        return { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: '⚠️ Caution Advised — Review Risks First' };
      case 'Not Recommended':
        return { bg: 'bg-rose-50 text-rose-800 border-rose-200', label: `❌ Not Recommended — ${riskLabel} Risk` };
      case 'Verification Required':
        return { bg: 'bg-orange-50 text-orange-800 border-orange-200', label: '🔍 Verify Territory Before Investing' };
      default:
        return { bg: 'bg-gray-50 text-gray-800 border-gray-200', label: 'Analysis Complete' };
    }
  };

  const getSeverityColor = (severity: string) => {
    switch(severity) {
        case 'High': return 'bg-rose-50 text-rose-700 border-rose-200 font-extrabold shadow-inner';
        case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200 font-extrabold shadow-inner';
        case 'Low': return 'bg-emerald-50 text-emerald-700 border-emerald-250 font-bold';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getImportanceColor = (importance: string) => {
    switch(importance) {
        case 'Critical': return 'bg-purple-50 text-purple-700 border-purple-200 font-extrabold uppercase tracking-wide';
        case 'High': return 'bg-blue-50 text-blue-700 border-blue-200 font-extrabold';
        case 'Medium': return 'bg-gray-100 text-gray-800 border-gray-200 font-medium';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const recStyle = getRecommendationStyle(report.recommendation?.decision ?? 'Verification Required', report.riskLevel);

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto scroll-smooth">
        {/* Anonymous preview banner — shown when report was generated without an account */}
        {report.isPreview && (
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <div className="text-center sm:text-left">
              <p className="text-white font-black text-sm">You're viewing your free preview</p>
              <p className="text-indigo-200 text-xs mt-0.5">
                Create a free account to save this report, run more analyses, and unlock detailed projections.
              </p>
            </div>
            <button
              onClick={() => onNavigate('settings', 'signup')}
              className="shrink-0 px-5 py-2.5 bg-white text-indigo-700 text-xs font-black rounded-xl hover:bg-indigo-50 transition-colors cursor-pointer shadow-sm whitespace-nowrap"
            >
              Create Free Account
            </button>
          </div>
        )}
        {/* Location confidence warning */}
        {report.locationWarning && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-amber-800 text-sm">
            <span className="text-lg leading-none mt-0.5">⚠️</span>
            <span><strong>Unverified location:</strong> {report.locationWarning}</span>
          </div>
        )}

        {/* Freshness banner — generated date + cache status */}
        {(() => {
          const FRESHNESS_DAYS = report._freshnessDays ?? 90;
          const rawDate = report._generatedAt ?? report.generationMeta?.generatedAt;
          if (!rawDate) return null;
          const genDate = new Date(rawDate);
          const ageDays = Math.floor((Date.now() - genDate.getTime()) / 86_400_000);
          const isOld   = ageDays > FRESHNESS_DAYS;
          return (
            <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl px-5 py-3.5 border text-xs print:hidden ${
              isOld
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : report._refreshedFromStale
                ? 'bg-green-50 border-green-200 text-green-800'
                : report._cached
                ? 'bg-sky-50 border-sky-200 text-sky-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <span className="grow">
                {isOld
                  ? `⏳ This report was generated ${ageDays} day${ageDays !== 1 ? 's' : ''} ago. Local conditions may have changed.`
                  : report._refreshedFromStale
                  ? '✅ Fresh analysis generated today — previous data was outdated.'
                  : report._cached
                  ? `✅ Generated on ${genDate.toLocaleDateString()}. Using a recently generated analysis to keep results consistent across users.`
                  : `✅ Fresh analysis generated on ${genDate.toLocaleDateString()}.`
                }
              </span>
              {isOld && onRegenerate && (
                <button
                  onClick={handleRegenerateClick}
                  className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Refresh with new market research
                </button>
              )}
            </div>
          );
        })()}
        {/* Report freshness note — consistency guardrail (always shown for dated reports) */}
        {(() => {
          const rawDate = report._generatedAt ?? report.generationMeta?.generatedAt;
          if (!rawDate) return null;
          return (
            <p className="text-[11px] text-gray-400 leading-relaxed px-1 print:hidden">
              Generated on {new Date(rawDate).toLocaleDateString()}. Market signals and competitor data may change.
              Refreshing the report may produce updated conclusions.
            </p>
          );
        })()}
        {/* Header and Score Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 md:p-8 relative overflow-hidden">
            {/* Soft decorative visual gradient */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>
            
            <div className="flex flex-col md:flex-row gap-8 mb-8 items-center md:items-start text-center md:text-left">
                <div className="flex flex-col items-center flex-shrink-0 relative">
                    <AssessmentBadge score={report.viabilityScore} />
                </div>
                
                <div className="flex-grow flex flex-col md:flex-row gap-6 w-full md:items-start">
                    <div className="flex-1 text-center md:text-left">
                        {report.loadedFromCache && (
                            <div className="mb-2.5 inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full shadow-xs">
                                <span className="flex h-1.5 w-1.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                </span>
                                <span>Loaded from cache</span>
                                {report.cachedAt && (
                                    <span className="text-amber-600/80 font-semibold text-[10px]">
                                        ({new Date(report.cachedAt).toLocaleDateString()} {new Date(report.cachedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                                    </span>
                                )}
                            </div>
                        )}
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">Business Analysis</span>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight sm:text-4xl mb-1 capitalize leading-none">
                          {report.businessType}
                        </h2>
                        <p className="text-sm text-gray-500 flex items-center justify-center md:justify-start gap-1 mb-4 font-semibold uppercase tracking-wide">
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>Location: <strong className="text-blue-600">{formatLocationDisplay(report.location)}</strong></span>
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          <div className={`inline-block px-3.5 py-1.5 rounded-xl border font-black text-xs uppercase tracking-wider ${recStyle.bg}`}>
                              {recStyle.label}
                          </div>
                          {report.franchiseTerritoryCheck && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 font-black text-xs uppercase tracking-wider">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Territory Availability Unknown
                            </div>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs md:text-sm leading-relaxed max-w-2xl">{report.recommendation?.reasoning ? stripScoreReferences(report.recommendation.reasoning) : 'Recommendation reasoning was unavailable for this report.'}</p>
                        {report.franchiseTerritoryCheck && (
                          <p className="mt-2 text-xs text-amber-700 font-semibold leading-relaxed max-w-2xl">
                            ⚠️ This assessment reflects market conditions only — territory availability is not confirmed. Verify directly with the franchisor before investing.
                          </p>
                        )}
                        {/* AI disclaimer — inside header, near score and recommendation */}
                        {report.generationMeta?.isLiveGenerated && (
                          <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 max-w-2xl print:hidden">
                            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-blue-800 leading-relaxed">
                              <strong>AI-generated estimates</strong> based on market signals, public data, and industry benchmarks.
                              {' '}Financial figures are projections, not guarantees — verify with independent research before investing.
                            </p>
                          </div>
                        )}
                    </div>

                    {/* Assessment Ratings Grid */}
                    {report.scoreBreakdown && (
                        <div className="w-full md:w-1/3 min-w-[280px]">
                            <RatingsGrid report={report} />
                        </div>
                    )}
                </div>
            </div>

            {/* Decision Guidance + Confidence Level */}
            {(() => {
              const nextStep = getNextStep(report.recommendation?.decision ?? 'Verification Required', report.viabilityScore);
              const confidence = getConfidenceLevel(report);
              return (
                <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Recommended Next Step</p>
                    <p className="text-xs font-black text-blue-800">{nextStep}</p>
                  </div>
                  <div className={`${confidence.bgClass} border ${confidence.borderClass} rounded-2xl px-4 py-3`}>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Confidence Level</p>
                    <p className={`text-xs font-black ${confidence.colorClass}`}>{confidence.level}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{confidence.description}</p>
                  </div>
                </div>
              );
            })()}

            {/* Qualitative outcome / rating legend — scoreless-UX explainer */}
            <AssessmentLegend />

            {/* Print Friendly Meta Block */}
            <div className="hidden print:block border-t border-gray-150 pt-4 mt-4 text-xs text-gray-500 flex justify-between uppercase font-mono">
              <span>BizScope Study &bull; Confidentially Generated</span>
              <span>Coordinates: Lat {report.targetCoordinates?.latitude ?? "N/A"} / Lng {report.targetCoordinates?.longitude ?? "N/A"}</span>
              <span>{currentPlan} Plan</span>
            </div>

            {/* Quick Actions Footer Section */}
            <div className="flex flex-wrap gap-2.5 justify-center md:justify-start border-t border-gray-100 pt-6 print:hidden">
                {onRegenerate && (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={handleRegenerateClick}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-xl transition-colors font-extrabold text-xs cursor-pointer"
                      >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Refresh with new market research</span>
                      </button>
                      <span className="text-[10px] text-gray-400 leading-tight max-w-[220px]">
                        Runs new market research and may change your results, since sources and market evidence can change. Counts against your report limit.
                      </span>
                    </div>
                )}
                <button 
                  onClick={() => setShowMapModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-extrabold text-xs  border border-gray-200 cursor-pointer"
                >
                    <Map className="w-3.5 h-3.5" />
                    <span>View Competitor Map</span>
                </button>
                <button 
                  onClick={handleSaveReport}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors font-extrabold text-xs border cursor-pointer ${
                    isSaved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  }`}
                >
                    <span>{canSaveReports(currentPlan) ? '💾' : '🔒'}</span> 
                    <span>{isSaved ? 'Saved to Dashboard' : canSaveReports(currentPlan) ? 'Save to Dashboard' : 'Save Report (Pro)'}</span>
                </button>
                <button 
                  onClick={handleExportPDF}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-xl transition-colors font-extrabold text-xs cursor-pointer"
                >
                    <span>{canExportPdf(currentPlan) ? '📄' : '🔒'}</span>
                    <span>Export PDF</span>
                </button>
                {saveSuccess && (
                  <span className="inline-flex items-center text-xs text-green-600 font-bold bg-green-50 border border-green-200 px-3 py-1 rounded-md animate-pulse">
                     {saveSuccess}
                  </span>
                )}
            </div>
        </div>


        {/* Sticky Report Navigation Block */}
        <ReportSubNav activeSection={activeSection} setActiveSection={setActiveSection} />

        {/* Print Dossier Header Title Block */}
        <div className="hidden print:block border-b-4 border-gray-900 pb-5 mb-5 whitespace-normal">
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">BizScope Business Analysis</h1>
            <p className="text-xs font-mono text-gray-400 mt-1 uppercase">Confidential Business Analysis Report</p>
            <div className="mt-5 grid grid-cols-4 gap-6 text-sm border-t border-gray-100 pt-4">
                <div><span className="text-[10px] font-black text-gray-400 uppercase block">Business</span> {report.businessType}</div>
                <div><span className="text-[10px] font-black text-gray-400 uppercase block">Location</span> {formatLocationDisplay(report.location)}</div>
                <div><span className="text-[10px] font-black text-gray-400 uppercase block">Assessment</span> {viabilityScoreToAssessment(report.viabilityScore).label}</div>
                <div><span className="text-[10px] font-black text-gray-400 uppercase block">Plan</span> {currentPlan}</div>
            </div>
        </div>

        {/* Franchise Territory Check — rendered BEFORE executive summary so it's seen first */}
        {report.franchiseTerritoryCheck && (() => {
          const ftc = report.franchiseTerritoryCheck!;
          // Show distinct location detail (street/address), not the brand name —
          // mapping same-brand units to .name yields "Great Clips, Great Clips, …"
          // which reads like broken output. Addresses are the useful, distinguishing
          // signal; dedupe and omit the parenthetical entirely when none are present.
          const sameBrandAddresses = Array.from(new Set(
            ftc.sameBrandIndices
              .map(i => report.competitionAnalysis.competitors[i]?.address?.trim())
              .filter((a): a is string => Boolean(a))
          ));
          return (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-amber-800">
                      🏪 Franchise Territory Check
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                      {ftc.brandName}
                    </span>
                  </div>

                  {ftc.sameBrandFoundInSearch ? (
                    // AI search actually surfaced same-brand locations
                    <p className="text-sm text-amber-900 leading-relaxed mb-3">
                      <strong>{ftc.sameBrandCount} existing {ftc.brandName} location{ftc.sameBrandCount !== 1 ? 's' : ''}</strong> {ftc.sameBrandCount !== 1 ? 'were' : 'was'} identified near {formatLocationDisplay(report.location)}
                      {sameBrandAddresses.length > 0 && <> ({sameBrandAddresses.join('; ')})</>}.
                      {' '}Nearby units indicate proven consumer demand for this brand but may also mean this territory is already claimed — protected radius rules vary by franchise agreement.
                    </p>
                  ) : (
                    // AI didn't surface same-brand — but that doesn't mean territory is open
                    <p className="text-sm text-amber-900 leading-relaxed mb-3">
                      <strong>{ftc.brandName} is a nationally established franchise brand.</strong>{' '}
                      The competitor search above reflects general market rivals, not a confirmed map of every existing {ftc.brandName} unit.{' '}
                      <strong>Absence from this search does not mean territory is available.</strong>{' '}
                      Your target market and similar areas may already have nearby units or pending agreements that only the franchisor can disclose.
                    </p>
                  )}

                  <div className="bg-amber-100 border border-amber-200 rounded-xl p-3 space-y-1.5 mb-3">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Required steps before any investment decision</p>
                    <p className="text-xs text-amber-800">• Contact {ftc.brandName}'s franchise development team to confirm this territory is open and unprotected</p>
                    <p className="text-xs text-amber-800">• Request and review the Franchise Disclosure Document (FDD) — especially Item 12 (Territory) and Item 20 (existing/planned outlets)</p>
                    <p className="text-xs text-amber-800">• Verify there are no existing franchisees within the protected radius of your target location</p>
                    <p className="text-xs text-amber-800">• Consult a franchise attorney before signing any agreement</p>
                  </div>

                  <p className="text-[11px] text-amber-700 leading-relaxed font-medium border-t border-amber-200 pt-2">
                    <strong>Important:</strong> This assessment and recommendation reflect general market conditions for this business concept. They do not constitute approval to open a {ftc.brandName} franchise and should not be interpreted as confirmation that this territory is available.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Main Grid containing report detailed insights */}
        <div className="space-y-8">

            {/* Executive Summary */}
            <SectionCard
              title="Executive Summary"
              id="overview"
              icon={<Layers className="w-5 h-5 text-blue-600" />}
            >
              <p className="leading-relaxed text-sm text-gray-700 whitespace-normal">{stripScoreReferences(report.executiveSummary)}</p>
            </SectionCard>

            {/* Financial Outlook Card with Locked Pro indicators */}
            {report.financialProjections && (
              <SectionCard
                  title="Financial Projections"
                  id="financials"
                  className="border-l-4 border-l-blue-500 shadow-sm"
                  icon={<Coins className="w-5 h-5 text-blue-600" />}
              >
                  <div className="space-y-6">
                      {/* Methodology note */}
                      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                          <strong>Projected estimates only.</strong> Figures are derived from market signals, public data, and industry benchmarks analyzed by AI — not audited financials. Actual results will vary based on execution, local conditions, and market timing.
                        </p>
                      </div>
                      {/* Basic Startup Cost Range - Always visible to free tier */}
                      <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-150 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Estimated Startup Cost</p>
                              <p className="text-2xl font-black text-gray-900 mt-1">{normalizeRangeSeparator(report.financialProjections.startupCostRange)}</p>
                          </div>
                          <div>
                              <p className="text-xs text-gray-405 font-bold uppercase tracking-wider">Cost Breakdown</p>
                              <p className="text-xs text-gray-650 mt-1 leading-relaxed italic">{report.financialProjections.startupCostBreakdown}</p>
                          </div>
                      </div>

                      {/* Itemized startup cost breakdown — present on reports generated after Sprint 10 */}
                      {Array.isArray(report.financialProjections.startupCostItems) && report.financialProjections.startupCostItems.length > 0 && (
                        <div className="mt-3 border border-gray-150 rounded-2xl overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-150 flex items-center justify-between">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Estimated Startup Cost Breakdown</p>
                            {report.financialProjections.startupSpaceContext?.buildOutIntensity && (
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                report.financialProjections.startupSpaceContext.buildOutIntensity === 'High'
                                  ? 'bg-orange-50 text-orange-600 border-orange-200'
                                  : report.financialProjections.startupSpaceContext.buildOutIntensity === 'Moderate'
                                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                                    : 'bg-green-50 text-green-600 border-green-200'
                              }`}>
                                {report.financialProjections.startupSpaceContext.buildOutIntensity} Build-Out
                              </span>
                            )}
                          </div>

                          {/* Space context row — brick-and-mortar only */}
                          {report.financialProjections.startupSpaceContext && (report.financialProjections.startupSpaceContext.sqft || report.financialProjections.startupSpaceContext.monthlyRent) && (
                            <div className="flex gap-6 px-4 py-2.5 bg-blue-50/40 border-b border-gray-100 text-xs">
                              {report.financialProjections.startupSpaceContext.sqft && (
                                <div>
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Est. Space</span>
                                  <span className="font-semibold text-gray-700">{normalizeRangeSeparator(report.financialProjections.startupSpaceContext.sqft)}</span>
                                </div>
                              )}
                              {report.financialProjections.startupSpaceContext.monthlyRent && (
                                <div>
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Est. Monthly Rent</span>
                                  <span className="font-semibold text-gray-700">{normalizeRangeSeparator(report.financialProjections.startupSpaceContext.monthlyRent)}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Line items */}
                          <div className="divide-y divide-gray-100">
                            {report.financialProjections.startupCostItems.map((item, i) => (
                              <div key={i} className="flex items-start justify-between px-4 py-2 text-xs hover:bg-gray-50/50">
                                <div className="flex-1 min-w-0 pr-4">
                                  <span className="font-medium text-gray-700">{item.category}</span>
                                  {item.notes && <span className="block text-[10px] text-gray-400 mt-0.5">{item.notes}</span>}
                                </div>
                                <span className="font-black text-gray-900 whitespace-nowrap shrink-0">{normalizeRangeSeparator(item.amount)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="px-4 py-2 bg-gray-50 border-t border-gray-150">
                            <p className="text-[9px] text-gray-400 italic">Estimates only — not quotes. Actual costs vary by contractor, market conditions, and build scope.</p>
                          </div>
                        </div>
                      )}

                      <LockedSection
                        currentPlan={currentPlan}
                        requiredPlan="Pro"
                        title="Financial Projections"
                        teaser="Unlock detailed revenue, profit margin, break-even, and ROI projections."
                        onUpgrade={() => onNavigate('pricing')}
                      >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-150 pt-6 animate-fade-in">
                              {/* Year 1 and 3 revenues */}
                              <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Year 1 Revenue Projection</p>
                                          <p className="font-black text-lg md:text-xl text-emerald-600 mt-1">{normalizeRangeSeparator(report.financialProjections.revenueYear1)}</p>
                                          <p className="text-[10px] text-gray-400 mt-1">Estimated total gross revenue in the first full year of operation.</p>
                                      </div>
                                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Year 3 Revenue Projection</p>
                                          <p className="font-black text-lg md:text-xl text-emerald-700 mt-1">{normalizeRangeSeparator(report.financialProjections.revenueYear3)}</p>
                                          <p className="text-[10px] text-gray-400 mt-1">Projected revenue after establishing market presence and customer base.</p>
                                      </div>
                                  </div>
                                  {report.financialProjections.summary && (
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-3">
                                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider mb-1">Projection Basis</p>
                                      <p className="text-xs text-blue-800 leading-relaxed">{report.financialProjections.summary}</p>
                                    </div>
                                  )}
                                  
                                  {/* Timeline & Stats */}
                                  <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                                      <div className="flex flex-col border-r border-gray-150 pr-2">
                                          <span className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Est. Break-Even</span>
                                          <span className="font-black text-blue-600 text-xs mt-1">{normalizeRangeSeparator(report.financialProjections.breakEvenTime)}</span>
                                      </div>
                                      <div className="flex flex-col border-r border-gray-150 px-2">
                                          <span className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Est. ROI Payoff</span>
                                          <span className="font-black text-blue-700 text-xs mt-1">{normalizeRangeSeparator(report.financialProjections.roiTime)}</span>
                                      </div>
                                       <div className="flex flex-col pl-2">
                                          <span className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Est. Net Margin</span>
                                          <span className="font-black text-green-600 text-xs mt-1">{normalizeRangeSeparator(report.financialProjections.profitMargin)}</span>
                                      </div>
                                  </div>
                              </div>

                              {/* Projections Visual SVG Chart */}
                              <div className="flex items-center">
                                  <RevenueChart year1={report.financialProjections.revenueYear1} year3={report.financialProjections.revenueYear3} />
                              </div>

                              {/* Additional Key Stats Grid */}
                              {report.financialProjections.keyStats && report.financialProjections.keyStats.length > 0 && (
                                   <div className="md:col-span-2 pt-4 border-t border-gray-100">
                                      <div className="flex items-baseline gap-2 mb-2.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Key Financial Stats</p>
                                        <p className="text-[9px] text-gray-400 italic">National industry averages — actual figures vary by location and market</p>
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                          {report.financialProjections.keyStats.map((stat, i) => (
                                              <div key={i} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                                  <p className="text-[10px] text-gray-500 mb-0.5 font-medium">{stat.label}</p>
                                                  <p className="font-semibold text-gray-950 text-xs">{normalizeRangeSeparator(stat.value)}</p>
                                              </div>
                                          ))}
                                      </div>
                                   </div>
                              )}
                          </div>
                      </LockedSection>
                  </div>
              </SectionCard>
            )}

            {/* Strategic Risks & Success Factors card */}
            {(report.riskAssessment || report.successFactors) && (
               <SectionCard
                  title="Risks & Success Factors"
                  id="strategy"
                  icon={<ShieldCheck className="w-5 h-5 text-indigo-600" />}
               >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 whitespace-normal">
                      {/* Risks Section */}
                      {report.riskAssessment && (
                          <div className="space-y-4">
                              <h4 className="font-black text-xs text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-1.5">
                                  <span className="text-yellow-600">⚠️</span> Business Risks
                              </h4>
                              <div className="space-y-4">
                                  {/* First Risk item - Always visible to provide high-quality initial value */}
                                  {report.riskAssessment.risks.length > 0 && (
                                      <div className="bg-amber-50/20 p-4 rounded-2xl border border-amber-100/80">
                                          <div className="flex justify-between items-start mb-2 gap-2">
                                              <span className="font-extrabold text-gray-900 text-xs uppercase tracking-wide">{stripScoreReferences(report.riskAssessment.risks[0].risk)}</span>
                                              <span className={`text-[9px] px-2 py-0.5 rounded-full border shrink-0 ${getSeverityColor(report.riskAssessment.risks[0].severity)}`}>
                                                  {report.riskAssessment.risks[0].severity} Severity
                                              </span>
                                          </div>
                                          <p className="text-xs text-gray-650 mb-2 leading-relaxed">{stripScoreReferences(report.riskAssessment.risks[0].impact)}</p>
                                          <p className="text-xs text-gray-500 font-semibold flex items-center gap-1 border-t border-gray-100 pt-2">
                                            <Info className="w-3 h-3 text-amber-500" />
                                            <span>Mitigation: {stripScoreReferences(report.riskAssessment.risks[0].mitigation)}</span>
                                          </p>
                                      </div>
                                  )}

                                  {/* Additional Risks wrapped inside LockedSection */}
                                  {report.riskAssessment.risks.length > 1 && (
                                    <LockedSection
                                      currentPlan={currentPlan}
                                      requiredPlan="Pro"
                                      title="Strategic Risks Analysis"
                                      teaser="Unlock full risk severity analysis and mitigation strategy."
                                      onUpgrade={() => onNavigate('pricing')}
                                    >
                                      <div className="space-y-4">
                                        {report.riskAssessment.risks.slice(1).map((risk, i) => (
                                            <div key={i} className="bg-amber-50/20 p-4 rounded-2xl border border-amber-100/80">
                                                <div className="flex justify-between items-start mb-2 gap-2">
                                                    <span className="font-extrabold text-gray-900 text-xs uppercase tracking-wide">{stripScoreReferences(risk.risk)}</span>
                                                    <span className={`text-[9px] px-2 py-0.5 rounded-full border shrink-0 ${getSeverityColor(risk.severity)}`}>
                                                        {risk.severity} Severity
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-650 mb-2 leading-relaxed">{stripScoreReferences(risk.impact)}</p>
                                                <p className="text-xs text-gray-500 font-semibold flex items-center gap-1 border-t border-grey-100 pt-2">
                                                    <Info className="w-3 h-3 text-amber-500" />
                                                    <span>Mitigation: {stripScoreReferences(risk.mitigation)}</span>
                                                </p>
                                            </div>
                                        ))}
                                      </div>
                                    </LockedSection>
                                  )}
                              </div>
                          </div>
                      )}
                      
                      {/* Success Factors - Always visible */}
                      {report.successFactors && (
                          <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-gray-100 lg:pl-6 pt-6 lg:pt-0">
                              <h4 className="font-black text-xs text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-1.5">
                                  <span className="text-blue-600">🚀</span> Critical Success Factors
                              </h4>
                              <div className="space-y-4">
                                  {report.successFactors.factors.map((factor, i) => (
                                      <div key={i} className="bg-blue-50/20 p-4 rounded-2xl border border-blue-100">
                                          <div className="flex justify-between items-start mb-2 gap-2">
                                              <span className="font-extrabold text-gray-900 text-xs uppercase tracking-wide">{factor.factor}</span>
                                              <span className={`text-[9px] px-2 py-0.5 rounded-full border shrink-0 ${getImportanceColor(factor.importance)}`}>
                                                  {factor.importance} Importance
                                              </span>
                                          </div>
                                          <p className="text-xs text-gray-650 leading-relaxed">{factor.description}</p>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
               </SectionCard>
            )}

            {/* Competition Map Area Embed with Locked Option */}
            <SectionCard
                title="Competitor Map & Market Coverage"
                id="competition"
                className="border-l-4 border-l-emerald-500 shadow-sm"
                icon={<Map className="w-5 h-5 text-emerald-600" />}
            >
                <div className="space-y-4">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Competitor Distribution</p>
                  <p className="text-sm text-gray-600 leading-relaxed mb-2">
                    Map points are based on available location data from the analysis pipeline.{!canViewFullFinancials(currentPlan) && ' Upgrade to Pro to unlock.'}
                  </p>
                  <LockedSection
                    currentPlan={currentPlan}
                    requiredPlan="Pro"
                    title="Competitor Map"
                    teaser="Unlock competitor saturation and location opportunity mapping."
                    onUpgrade={() => onNavigate('pricing')}
                  >
                      <div className="rounded-3xl overflow-hidden border border-gray-150 h-[380px] w-full relative z-10 shadow-xs animate-fade-in">
                          <CompetitorMap
                              competitors={report.competitionAnalysis.competitors}
                              targetCoordinates={report.targetCoordinates}
                              coordinatesAreReal={report.coordinatesAreReal}
                          />
                      </div>
                  </LockedSection>
                </div>
            </SectionCard>

            {/* Competitors List and Market Trends Container row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 whitespace-normal">
                {/* Competition analysis summary lists */}
                <SectionCard 
                  title="Nearby Competitors"
                  icon={<Compass className="w-5 h-5 text-indigo-600" />}
                >
                  <p className="mb-4 text-xs text-gray-400 uppercase font-black tracking-widest">Competitors in this area</p>
                  {report.generationMeta?.isLiveGenerated ? (
                    <>
                      <p className="mb-4 text-sm text-gray-700 leading-relaxed">{stripScoreReferences(report.competitionAnalysis.summary)}</p>
                      <ul className="space-y-4">
                        {report.competitionAnalysis.competitors.map((comp, index) => (
                          <li key={index} className="bg-gray-50/70 p-4 rounded-2xl border border-gray-150 transition-colors hover:bg-white">
                            <div className="font-extrabold text-gray-900 text-xs uppercase tracking-wide">{comp.name}</div>
                            <div className="text-[10px] text-gray-400 mb-2 font-bold uppercase tracking-wide">{comp.address || 'Address documented'}</div>
                            <p className="text-xs text-gray-600 leading-relaxed">{stripScoreReferences(comp.details)}</p>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 px-4 bg-gray-50/60 rounded-2xl border border-dashed border-gray-200 text-center">
                      <p className="text-sm font-bold text-gray-700">Insufficient verified competitor data</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">Real competitor intelligence is only available for live AI-generated reports. Run a new analysis to see verified market data for this location.</p>
                    </div>
                  )}
                </SectionCard>

                {/* Market Trends */}
                <SectionCard
                  title="Market Trends"
                  icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                >
                  <p className="mb-4 text-xs text-gray-400 uppercase font-black tracking-widest">What's driving demand</p>
                  <p className="mb-4 text-sm text-gray-750 leading-relaxed">{stripScoreReferences(report.marketTrends.summary)}</p>
                  <ul className="space-y-4">
                    {report.marketTrends.trends.map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-2 h-2 mt-2 bg-emerald-500 rounded-full"></span>
                        <div>
                          <span className="font-extrabold text-gray-900 text-xs uppercase tracking-wide block">{item.trend}</span>
                          <span className="text-xs text-gray-600 leading-relaxed mt-0.5 block">{stripScoreReferences(item.impact)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
            </div>

            {/* Demographics Insight snapshot card - Always fully visible */}
            <SectionCard
              title="Local Demographics"
              id="demographics"
              icon={<Building className="w-5 h-5 text-rose-500" />}
            >
              <p className="mb-4 text-xs text-gray-400 uppercase font-black tracking-widest">Local population & income</p>
              <p className="mb-6 text-sm text-gray-750 leading-relaxed">{stripScoreReferences(report.demographicInsights.summary)}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {report.demographicInsights.demographics.map((demo, index) => (
                  <div key={index} className="border-l-3 border-purple-500 pl-4 py-3 bg-gray-50/50 rounded-r-2xl pr-4 border border-gray-200/40 relative overflow-hidden transition-all duration-300 hover:bg-white hover:border-purple-250">
                    <div className="text-[10px] uppercase text-gray-400 font-extrabold tracking-widest">{demo.metric}</div>
                    <div className="text-lg font-black text-gray-950 mt-1 leading-none">{demo.value}</div>
                    <p className="text-xs text-gray-600 mt-2.5 leading-relaxed">{demo.insight}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Market Interest & Customer Demand - Pro */}
            <SectionCard
                title="Market Interest & Customer Demand"
                id="niche"
                className="border-l-4 border-l-purple-500"
                icon={<Sparkles className="w-5 h-5 text-purple-600" />}
                badge={
                  !canViewFullFinancials(currentPlan) && (
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                        Pro Feature
                    </span>
                  )
                }
            >
                <LockedSection
                  currentPlan={currentPlan}
                  requiredPlan="Pro"
                  title="Market Interest & Customer Demand Signals"
                  teaser="Unlock customer interest indicators, advertising cost benchmarks, and customer acquisition estimates for your market."
                  onUpgrade={() => onNavigate('pricing')}
                >
                    <div className="animate-fade-in space-y-6">
                        <div className="bg-purple-50/50 border border-purple-100 text-purple-900 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between text-xs gap-3 print:hidden">
                            <span className="flex items-center gap-1.5 font-semibold">
                                <Check className="w-4 h-4 text-purple-500 shrink-0" />
                                <span>Pro Insights Active</span>
                            </span>
                            <span className="text-[10px] text-purple-600 bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide">
                                {proInsights.sourceLabel}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-150 text-center">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Market Interest Rating</p>
                                <p className="text-3xl font-black text-blue-600">{proInsights.interestLabel}</p>
                                <p className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-wide">Consumer Interest Level</p>
                                <p className="text-xs text-emerald-600 font-extrabold mt-1 flex items-center justify-center gap-1">
                                    &uarr; {proInsights.yoyGrowth}% YoY search growth
                                </p>
                                <p className="text-xs text-gray-500 mt-2 leading-relaxed">Consumer demand signal for this category, derived from AI market analysis and industry benchmarks.</p>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-150 text-center">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Advertising Cost Benchmark</p>
                                <p className="text-4xl font-black text-purple-600">${proInsights.cpm.toFixed(2)}</p>
                                <p className="text-xs text-gray-550 mt-2 font-semibold">Cost per 1,000 Ad Impressions (CPM)</p>
                                <p className="text-xs text-gray-500 mt-2 leading-relaxed">Industry-modeled estimate for this category. Actual costs vary by platform, targeting, and local competition.</p>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-150 text-center">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Customer Acquisition Cost</p>
                                <p className="text-4xl font-black text-indigo-600">${proInsights.cpc.toFixed(2)} <span className="text-xs font-normal text-gray-400">/click</span></p>
                                <p className="text-xs text-gray-550 mt-2 font-semibold">Estimated Cost per Interested Lead</p>
                                <p className="text-xs text-gray-500 mt-2 leading-relaxed">Industry-modeled paid digital acquisition cost. Organic and referral channels typically cost significantly less.</p>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-150">
                            <h4 className="font-extrabold text-gray-800 mb-3 text-xs uppercase tracking-wider">Best Areas to Launch</h4>
                            <div className="space-y-3.5 text-xs text-gray-600">
                                <div className="flex gap-2">
                                    <span className="text-blue-500 shrink-0 font-bold">&bull;</span>
                                    <p><strong>High-traffic locations</strong>: {launchText.commuter}</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="text-blue-500 shrink-0 font-bold">&bull;</span>
                                    <p><strong>Residential areas</strong>: {launchText.residential}</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="text-blue-500 shrink-0 font-bold">&bull;</span>
                                    <p><strong>Weekend activity areas</strong>: {launchText.lifestyle}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </LockedSection>
            </SectionCard>
             {/* Regional Intelligence & Adjacent ZIP codes - Pro+ */}
            <SectionCard
                title="Nearby Areas & Regional Insights"
                id="regional"
                className="border-l-4 border-l-indigo-500"
                icon={<Globe className="w-5 h-5 text-indigo-600" />}
                badge={
                  !canViewRegionalIntelligence(currentPlan) && (
                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                        Pro+ Feature
                    </span>
                  )
                }
            >
                <LockedSection
                  currentPlan={currentPlan}
                  requiredPlan="Pro+"
                  title="Regional Intelligence"
                  teaser="Unlock nearby ZIP, county, and expansion opportunity analysis."
                  onUpgrade={() => onNavigate('pricing')}
                >
                    {regionalQuotaExceeded ? (
                        <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center border border-amber-100 shadow-xs">
                                <AlertTriangle className="h-6 w-6 text-amber-500 animate-pulse" />
                            </div>
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                Monthly Regional Limit Reached
                            </span>
                            <h4 className="text-sm font-black text-gray-950 tracking-tight uppercase">
                                Limit Reached (10/Month)
                            </h4>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                You have reached your 10 Regional Intelligence reports for this billing month under your Pro+ plan. Upgrade to <strong>Enterprise</strong> for expanded regional access.
                            </p>
                            <button
                              onClick={() => onNavigate('pricing')}
                              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-755 hover:to-indigo-755 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                            >
                                ⚡ Upgrade to Enterprise for Expanded Access
                            </button>
                        </div>
                    ) : isRegionalLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-3">
                            <Sparkles className="w-8 h-8 text-indigo-500 animate-spin" />
                            <p className="text-xs font-mono font-black text-indigo-700 animate-pulse uppercase tracking-widest">
                                Loading regional data...
                            </p>
                        </div>
                    ) : regionalData ? (
                        <div className="animate-fade-in space-y-6 whitespace-normal text-left">
                            <div className="bg-indigo-50/50 border border-indigo-100 text-indigo-900 p-4 rounded-2xl text-xs flex items-center gap-2 print:hidden">
                                <Check className="w-4 h-4 text-indigo-500 shrink-0" />
                                <span>
                                    <strong>Pro+ Regional Insights Active:</strong> Market context modeled for surrounding sectors near <strong>{formatLocationDisplay(report.location)}</strong>.
                                </span>
                            </div>

                            {/* 1. Nearby ZIP Opportunity Analysis / Surrounding Suburbs Analysis */}
                            <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                                    {regionalData.isZipMode ? "Nearby ZIP Codes" : "Market Zone Analysis"}
                                </p>
                                <div className="overflow-x-auto rounded-2xl border border-gray-150 bg-gray-50/30">
                                    <table className="w-full min-w-[480px] text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-gray-100 border-b border-gray-150 font-black text-gray-400 uppercase tracking-wider">
                                                <th className="py-3.5 px-4 text-[10px]">{regionalData.isZipMode ? "Area" : "Market Zone"}</th>
                                                <th className="py-3.5 px-4 text-[10px]">{regionalData.isZipMode ? "Income Level" : "Growth Status"}</th>
                                                <th className="py-3.5 px-4 text-[10px]">{regionalData.isZipMode ? "Active Competitors" : "Competition"}</th>
                                                <th className="py-3.5 px-4 text-right text-[10px]">Potential Opportunity</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-150 text-gray-700">
                                            {regionalData.nearbyRegions?.map((reg: any, i: number) => (
                                                <tr key={i} className="hover:bg-white/70 transition-colors">
                                                    <td className="py-3 px-4 font-bold text-gray-900">
                                                        <div className="flex flex-col">
                                                            <span>{reg.name}</span>
                                                            <span className="text-[10px] text-gray-400 font-normal mt-0.5">{reg.details}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 font-semibold text-gray-650">{reg.demographics}</td>
                                                    <td className="py-3 px-4 text-gray-600">{reg.competition}</td>
                                                    <td className="py-3 px-4 text-right font-black text-indigo-600 text-sm">{reg.opportunity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* 2 & 3. County-Level Context and 15-25 Mile Economic Radius / Specific Observations */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-blue-50/30 border border-blue-100 p-5 rounded-2xl">
                                    <h4 className="font-extrabold text-blue-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Building className="w-4 h-4 text-blue-500" />
                                        <span>County-Level Market Context</span>
                                    </h4>
                                    <p className="text-xs text-gray-600 leading-relaxed">{stripScoreReferences(regionalData.countyContext)}</p>
                                </div>

                                <div className="bg-purple-50/30 border border-purple-100 p-5 rounded-2xl">
                                    <h4 className="font-extrabold text-purple-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Compass className="w-4 h-4 text-purple-500" />
                                        <span>{regionalData.specificObservationTitle || "Radius Observations"}</span>
                                    </h4>
                                    <p className="text-xs text-gray-600 leading-relaxed">{stripScoreReferences(regionalData.specificObservationText)}</p>
                                </div>
                            </div>

                            {/* 15-25 Mile Economic Radius Callout & Competitive Spillover */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-50/80 border border-gray-200 p-5 rounded-2xl">
                                    <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Globe className="w-4 h-4 text-indigo-500" />
                                        <span>Wider Economic Region (15–25 miles)</span>
                                    </h4>
                                    <p className="text-xs text-gray-600 leading-relaxed">{stripScoreReferences(regionalData.economicRadius)}</p>
                                </div>

                                <div className="bg-gray-50/80 border border-gray-200 p-5 rounded-2xl">
                                    <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        <span>Nearby Market Competition</span>
                                    </h4>
                                    <p className="text-xs text-gray-600 leading-relaxed">{stripScoreReferences(regionalData.competitiveSpillover)}</p>
                                </div>
                            </div>

                            {/* 4 & 5. Expansion potential strategy */}
                            <div className="bg-indigo-50/25 p-6 rounded-2xl border border-indigo-100">
                                <p className="text-xs font-black text-indigo-750 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-indigo-500" />
                                    <span>Expansion Plan (Next 12 Months)</span>
                                </p>
                                <p className="text-xs text-gray-600 leading-relaxed">{stripScoreReferences(regionalData.expansionPotential)}</p>
                            </div>

                            {/* 6. Regional Recommendation Highlight */}
                            <div className="bg-emerald-50/50 border border-emerald-200/60 p-5 rounded-2xl flex flex-col sm:flex-row items-start gap-4">
                                <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-xl shrink-0">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <h5 className="font-extrabold text-emerald-900 text-xs uppercase tracking-wider mb-1">Expansion Recommendation</h5>
                                    <p className="text-xs text-emerald-800 leading-relaxed">{stripScoreReferences(regionalData.regionalRecommendation)}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-xs text-gray-400 uppercase tracking-wider font-mono">Regional data couldn't be loaded.</p>
                        </div>
                    )}
                </LockedSection>
            </SectionCard>

            {/* Strategic Opportunities & Recommended Positioning — Enterprise only */}
            {currentPlan === 'Enterprise' && (
                <SectionCard
                    title="Strategic Opportunities & Recommended Positioning"
                    icon={<Sparkles className="w-5 h-5 text-amber-500" />}
                    badge={
                        <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                            Enterprise Intelligence
                        </span>
                    }
                >
                    <div className="space-y-6">
                        {/* Positioning summary */}
                        <div className="bg-amber-50/50 border border-amber-200/60 p-5 rounded-2xl">
                            <h4 className="font-extrabold text-amber-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-amber-600" />
                                Positioning Summary
                            </h4>
                            <p className="text-sm text-gray-700 leading-relaxed">{report.recommendation?.reasoning ? stripScoreReferences(report.recommendation.reasoning) : 'Recommendation reasoning was unavailable for this report.'}</p>
                            <div className="mt-3 flex items-center gap-3 flex-wrap">
                                <span className={`text-xs font-black px-3 py-1 rounded-full ${
                                    report.recommendation?.decision === 'Recommended' ? 'bg-emerald-100 text-emerald-800' :
                                    report.recommendation?.decision === 'Caution Advised' ? 'bg-amber-100 text-amber-800' :
                                    report.recommendation?.decision === 'Verification Required' ? 'bg-orange-100 text-orange-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                    {report.recommendation?.decision ?? 'Verification Required'}
                                </span>
                                <span className="text-xs text-gray-500">Assessment: <strong className="text-gray-800">{viabilityScoreToAssessment(report.viabilityScore).label}</strong></span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Market Opportunities */}
                            {report.marketTrends?.trends && report.marketTrends.trends.length > 0 && (
                                <div>
                                    <h4 className="font-extrabold text-gray-700 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        Key Market Opportunities
                                    </h4>
                                    <div className="space-y-2.5">
                                        {report.marketTrends.trends.slice(0, 3).map((trend, i) => (
                                            <div key={i} className="flex items-start gap-2.5 bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">
                                                <ArrowRight className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-extrabold text-gray-900 text-xs block">{trend.trend}</span>
                                                    <span className="text-xs text-gray-600 mt-0.5 block">{trend.impact}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Critical Success Drivers */}
                            {report.successFactors?.factors && report.successFactors.factors.length > 0 && (
                                <div>
                                    <h4 className="font-extrabold text-gray-700 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Check className="w-4 h-4 text-blue-500" />
                                        Success Drivers
                                    </h4>
                                    <div className="space-y-2.5">
                                        {report.successFactors.factors.slice(0, 3).map((factor, i) => (
                                            <div key={i} className="flex items-start gap-2.5 bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
                                                <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-extrabold text-gray-900 text-xs block">{factor.factor}</span>
                                                    <span className="text-xs text-gray-600 mt-0.5 block">{factor.description}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Priority Risk Mitigations */}
                        {report.riskAssessment?.risks && report.riskAssessment.risks.length > 0 && (
                            <div>
                                <h4 className="font-extrabold text-gray-700 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    Priority Risk Mitigations
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {report.riskAssessment.risks.slice(0, 4).map((risk, i) => (
                                        <div key={i} className="flex items-start gap-2.5 bg-red-50/40 border border-red-100 p-3 rounded-xl">
                                            <ShieldCheck className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-extrabold text-gray-900 text-xs block">{stripScoreReferences(risk.risk)}</span>
                                                <span className="text-xs text-gray-600 mt-0.5 block">{stripScoreReferences(risk.mitigation)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </SectionCard>
            )}

            {/* Data Freshness & Report Information */}
            <SectionCard
                title="Report Information"
                icon={<Info className="w-5 h-5 text-gray-400" />}
            >
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-6 text-xs">
                        {report.generationMeta?.generatedAt ? (
                            <div>
                                <span className="font-black uppercase text-gray-400 text-[10px] tracking-wider block mb-0.5">Report Generated</span>
                                <span className="text-gray-700">{new Date(report.generationMeta.generatedAt).toLocaleString()}</span>
                            </div>
                        ) : report.cachedAt ? (
                            <div>
                                <span className="font-black uppercase text-gray-400 text-[10px] tracking-wider block mb-0.5">Loaded From Cache</span>
                                <span className="text-gray-700">{new Date(report.cachedAt).toLocaleString()}</span>
                            </div>
                        ) : null}
                        <div>
                            <span className="font-black uppercase text-gray-400 text-[10px] tracking-wider block mb-0.5">Data Source</span>
                            <span className="text-gray-700">{report.generationMeta?.isLiveGenerated ? 'AI-generated' : 'Demo data'}</span>
                        </div>
                    </div>
                    <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs text-gray-400 leading-relaxed italic">
                            Market conditions may change after report generation. This report contains AI-generated business intelligence estimates and should not substitute professional financial, legal, or market research. Verify critical decisions with independent research.
                        </p>
                    </div>
                </div>
            </SectionCard>
        </div>

        {/* Live-mode cost confirmation for regional intelligence — Admin only */}
        <LiveModeConfirmModal
          isOpen={awaitingRegionalConfirm}
          reportType="regional"
          businessType={report.businessType}
          location={report.location}
          onConfirm={() => {
            setAwaitingRegionalConfirm(false);
            executeRegionalLoad();
          }}
          onCancel={() => setAwaitingRegionalConfirm(false)}
        />

        {/* Regeneration Confirmation Modal in Live Mode */}
        {showRegenConfirm && (
          <div className="fixed inset-0 z-50 overflow-y-auto animate-fade-in" aria-labelledby="regen-modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity cursor-pointer" onClick={() => setShowRegenConfirm(false)}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              
              <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-gray-150 p-6">
                <div className="flex items-center gap-3 mb-4 text-amber-600">
                  <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight" id="regen-modal-title">
                    Refresh with new market research?
                  </h3>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed mb-6">
                  Your latest saved analysis is already shown. Refreshing runs new market research
                  and <strong className="text-gray-700">may change your results</strong> — sources and
                  market evidence can shift between runs.
                  <br />
                  <br />
                  It bypasses the shared cache and will count against your report limit.
                </p>

                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                  <button
                    onClick={handleRegenerateConfirm}
                    className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Refresh with new market research
                  </button>
                  <button
                    onClick={() => setShowRegenConfirm(false)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    View latest saved analysis
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Existing Map Modal */}
        {showMapModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity cursor-pointer" onClick={() => setShowMapModal(false)}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              
              <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full border border-gray-150">
                <div className="bg-white px-5 pt-6 pb-4 sm:p-6 sm:pb-6 relative max-w-full">
                  <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
                      <h3 className="text-base font-black text-gray-900 uppercase tracking-tight" id="modal-title">
                          Estimated Competitor Distribution
                      </h3>
                      <button onClick={() => setShowMapModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded-lg hover:bg-gray-100">
                          <X className="h-5 w-5" />
                      </button>
                  </div>
                  
                  <div className="mt-2 relative">
                      {report.generationMeta?.isLiveGenerated ? (
                        <p className="text-xs text-gray-500 mb-4 font-semibold uppercase flex items-center gap-1">
                            <Navigation className="w-3.5 h-3.5 text-blue-500" />
                            <span>Map points for <strong className="text-gray-800">{report.competitionAnalysis.competitors.length}</strong> competitors based on available location data from the analysis pipeline</span>
                        </p>
                      ) : (
                        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-semibold flex items-center gap-2">
                          <span>⚠️</span>
                          <span>Competitor location data is unavailable — this report was not generated from live AI analysis. Run a new report to see real market coverage.</span>
                        </div>
                      )}

                      {report.generationMeta?.isLiveGenerated && canViewFullFinancials(currentPlan) ? (
                          <div className="rounded-2xl overflow-hidden border border-gray-150 h-[450px]">
                              <CompetitorMap
                                  competitors={report.competitionAnalysis.competitors}
                                  targetCoordinates={report.targetCoordinates}
                                  coordinatesAreReal={report.coordinatesAreReal}
                              />
                          </div>
                      ) : report.generationMeta?.isLiveGenerated ? (
                          <div className="relative rounded-2xl overflow-hidden border border-gray-200">
                              <div className="filter blur-[5px] opacity-25 select-none pointer-events-none h-[420px] w-full bg-slate-100 flex items-center justify-center">
                                  <span className="text-gray-400 font-mono">Loading Map Coordinates...</span>
                              </div>
                              
                              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-100 shadow-xs">
                                      <Lock className="w-5 h-5 animate-pulse" />
                                  </div>
                                  <h4 className="text-base font-black text-gray-900 uppercase">Competitor Map — Upgrade to Pro</h4>
                                  <p className="text-xs text-gray-500 max-w-sm mt-1.5 mb-6 leading-relaxed">
                                      The competitor location map is available on Pro and above. Switch plans instantly in the floating switcher to explore it now.
                                  </p>
                                  <div className="flex gap-3 justify-center w-full max-w-xs">
                                      <button 
                                        onClick={() => { setShowMapModal(false); onNavigate('pricing'); }}
                                        className="w-full px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-xl transition-all shadow-md text-xs cursor-pointer"
                                      >
                                        View Plans
                                      </button>
                                      <span className="sr-only">Or bypass below</span>
                                  </div>
                              </div>
                          </div>
                      ) : null}
                  </div>
                </div>
                <div className="bg-gray-50 px-5 py-4 flex flex-col sm:flex-row-reverse border-t border-gray-105">
                  <button 
                      type="button" 
                      className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-xs px-4 py-2 bg-blue-600 text-xs font-bold text-white hover:bg-blue-750 transition-colors sm:ml-3 sm:w-auto cursor-pointer"
                      onClick={() => setShowMapModal(false)}
                  >
                    Close Spatial Map
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Existing upgrade alerts / action gate modals popups */}
        {showUpgradeGateModal && (
            <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="gate-modal-title" role="dialog" aria-modal="true">
                <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity cursor-pointer" onClick={() => setShowUpgradeGateModal(null)}></div>
                    <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                    
                    <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-gray-150">
                        <div className="bg-white px-5 pt-6 pb-5 sm:p-6">
                            <div className="text-center">
                                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-purple-50 text-purple-600 border border-purple-100 mb-4">
                                    <Lock className="h-5 w-5 animate-pulse" />
                                </div>
                                <h3 className="text-base font-black text-gray-900 uppercase" id="gate-modal-title">
                                    {showUpgradeGateModal === 'save' ? 'Save Reports — Pro Required' : 'PDF Export Locked'}
                                </h3>
                                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                                    {showUpgradeGateModal === 'save'
                                        ? 'Saving reports requires a Pro plan or above.'
                                        : 'PDF export is available on Pro and above. Upgrade your plan to download polished advisory reports.'}
                                </p>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3.5 sm:px-6 flex flex-col sm:flex-row-reverse gap-2 border-t border-gray-100">
                            <button
                              onClick={() => { setShowUpgradeGateModal(null); onNavigate('pricing'); }}
                              className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition-colors cursor-pointer"
                            >
                                💎 Upgrade to Pro
                            </button>
                            <button
                              onClick={() => setShowUpgradeGateModal(null)}
                              className="w-full inline-flex justify-center rounded-xl border border-gray-200 shadow-xs px-4 py-2 bg-white text-xs font-bold text-gray-705 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* PDF Compilation Console Dialogue Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in text-left">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-150 shadow-2xl relative overflow-hidden animate-scale-up my-8">
              
              {/* Top Banner accent */}
              <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-pulse"></div>

              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                <div className="text-left font-sans">
                  <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-1.5 uppercase">
                    <span>📄</span> Export PDF
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Customize and download your report as a PDF.</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowExportModal(false); setExportError(null); setExportSuccess(null); }}
                  className="p-1 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Main Content Form */}
              <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                
                {/* Plan status alert badge */}
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-150 text-xs flex justify-between items-center">
                  <div className="text-left font-sans">
                    <p className="text-[10px] uppercase font-extrabold text-gray-400">Your Plan</p>
                    <p className="font-bold text-gray-800">{currentPlan}</p>
                  </div>
                  <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-tight ${
                    currentPlan === 'Enterprise' ? 'bg-emerald-50 text-emerald-800 border-emerald-250 border' :
                    currentPlan === 'Pro+' ? 'bg-purple-50 text-purple-800 border-purple-200 border' :
                    'bg-blue-50 text-blue-800 border-blue-200 border'
                  }`}>
                    {currentPlan} Active
                  </span>
                </div>

                {/* Scope Coverage highlights based on Plan */}
                <div className="space-y-2 text-left">
                  <h4 className="text-[10px] uppercase font-black tracking-wider text-gray-400">What's included:</h4>
                  
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2.5 bg-green-50 border border-green-100 rounded-lg flex items-center gap-1.5 text-green-800 font-bold">
                      <span>✓</span> Executive Summary
                    </div>
                    <div className="p-2.5 bg-green-50 border border-green-100 rounded-lg flex items-center gap-1.5 text-green-800 font-bold">
                      <span>✓</span> Demographics Grid
                    </div>
                    
                    {/* Financial block depending on Pro / Pro+ / Enterprise */}
                    <div className="p-2.5 bg-green-50 border border-green-100 rounded-lg flex items-center gap-1.5 text-green-800 font-bold">
                      <span>✓</span> Financial Projections
                    </div>

                    {/* Regional Block - Only Pro+ and Enterprise */}
                    {canViewRegionalIntelligence(currentPlan) ? (
                      <div className="p-2.5 bg-green-50 border border-green-100 rounded-lg flex items-center gap-1.5 text-green-800 font-bold">
                        <span>✓</span> Regional Insights
                      </div>
                    ) : (
                      <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-1.5 text-amber-800 font-bold" title="Requires Pro+ subscription">
                        <span>🔒</span> Regional Insights (Pro+ only)
                      </div>
                    )}
                  </div>
                </div>

                {/* White-Label Settings Module - Locked for < Enterprise */}
                <div className="border-t border-gray-100 pt-4 space-y-4 text-left">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] uppercase font-black tracking-wider text-gray-400">White-Labeling & Branding Options</h4>
                    {currentPlan !== 'Enterprise' && (
                      <span className="text-[9px] font-bold text-blue-700 bg-blue-50 rounded-md px-1.5 py-0.5 uppercase border border-blue-100">
                        Enterprise Only
                      </span>
                    )}
                  </div>

                  {currentPlan === 'Enterprise' ? (
                    <div className="space-y-3 bg-emerald-50/5 p-4 rounded-xl border border-emerald-100">
                      
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          id="btn-wl-mode"
                          checked={options.isWhiteLabelMode}
                          onChange={(e) => setOptions(prev => ({ ...prev, isWhiteLabelMode: e.target.checked }))}
                          className="w-4 h-4 text-emerald-600 rounded border-gray-350 focus:ring-emerald-500 cursor-pointer"
                        />
                        <label htmlFor="btn-wl-mode" className="text-xs font-bold text-gray-700 cursor-pointer">
                          Enable White-Label Mode
                        </label>
                      </div>

                      {options.isWhiteLabelMode && (
                        <div className="space-y-3 pt-1 animate-fade-in text-xs text-left">
                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Advisory Firm Name</label>
                            <input
                              type="text"
                              value={options.advisoryFirmName}
                              onChange={(e) => setOptions(prev => ({ ...prev, advisoryFirmName: e.target.value }))}
                              className="w-full p-2 bg-white border border-gray-250 rounded-lg focus:outline-none focus:border-emerald-500 text-xs"
                              placeholder="e.g. Bain Partners Advisory"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Prepared For (Client Name)</label>
                            <input
                              type="text"
                              value={options.clientName}
                              onChange={(e) => setOptions(prev => ({ ...prev, clientName: e.target.value }))}
                              className="w-full p-2 bg-white border border-gray-250 rounded-lg focus:outline-none focus:border-emerald-500 text-xs"
                              placeholder="e.g. Venture Capital Fund I"
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id="btn-rm-wm"
                              checked={options.removeWatermark}
                              onChange={(e) => setOptions(prev => ({ ...prev, removeWatermark: e.target.checked }))}
                              className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                            />
                            <label htmlFor="btn-rm-wm" className="text-[11px] font-semibold text-gray-600 cursor-pointer">
                              Remove "BizScope" Brand Marks
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-150 flex items-start gap-3 text-left font-sans">
                      <span className="text-xl">🔒</span>
                      <div className="text-left text-xs text-gray-500">
                        <p className="font-bold text-gray-800 mb-0.5">Custom Corporate White-Labeling Is Locked</p>
                        <p className="leading-relaxed">
                          Enterprise plans can apply custom firm names, client branding, and accent styles, and remove BizScope watermarks entirely. Upgrade to <strong className="text-blue-700 font-bold">Enterprise</strong> to unlock white-label PDF exports.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Accent Color Chooser */}
                  <div className="space-y-1.5 text-xs text-left">
                    <label className="block text-[10px] font-black text-gray-400 uppercase">Consulting Report Accent Motif</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['Classic Blue', 'Charcoal Slate', 'Emerald Forest', 'Executive Navy'] as const).map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setOptions(prev => ({ ...prev, accentColor: color }))}
                          className={`p-2 border text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            options.accentColor === color 
                              ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/10 font-black' 
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Progress / Loading Spinner / Errors */}
                {isExportLoading && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-center gap-3 animate-pulse">
                    <span className="text-lg animate-spin text-blue-600 font-sans">⚙️</span>
                    <span className="text-xs font-bold text-blue-800 text-left">Compiling PDF documents, rendering vector grids...</span>
                  </div>
                )}

                {exportSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 text-center text-xs font-bold text-green-800 animate-bounce">
                    ✨ {exportSuccess}
                  </div>
                )}

                {exportError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-center text-xs font-bold text-red-800">
                    ❌ FAILED: {exportError}
                  </div>
                )}

              </div>

              {/* Footer Buttons */}
              <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center font-sans">
                <button
                  type="button"
                  onClick={() => { setShowExportModal(false); setExportError(null); setExportSuccess(null); }}
                  className="text-xs text-gray-500 hover:text-gray-800 font-bold hover:underline cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  disabled={isExportLoading}
                  onClick={async () => {
                    setIsExportLoading(true);
                    setExportError(null);
                    setExportSuccess(null);
                    try {
                      // Pass actual regional intelligence data if unlocked, else pass undefined
                      const rd = canViewRegionalIntelligence(currentPlan) ? regionalData : undefined;
                      await PDFService.generateReportPDF(report, currentPlan, options, rd);
                      setExportSuccess("PDF Report Exported Successfully!");
                    } catch (e: any) {
                      console.error(e);
                      setExportError(e?.message || "PDF generation engine experienced exceptions. Retry analysis.");
                    } finally {
                      setIsExportLoading(false);
                    }
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Export PDF
                </button>
              </div>

            </div>
          </div>
        )}
    </div>
  );
};
