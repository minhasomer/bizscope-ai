import React, { useState, useEffect } from 'react';
import type { ViabilityReport, ScoreBreakdown } from '../types';
import { CompetitorMap } from './CompetitorMap';
import { SavedReportsService } from '../services/savedReportsService';
import { generateRegionalAnalysis, generateMockRegionalData } from '../services/geminiService';
import { isDemoMode } from '../src/config/appConfig';
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

interface ReportDisplayProps {
  report: ViabilityReport;
  currentPlan: SubscriptionPlan;
  onNavigate: (page: string) => void;
  onRegenerate?: () => void;
  /**
   * When true, the regional intelligence section shows a live-mode cost confirmation
   * before making the Gemini API call. Set to `!isDemoMode && isAdmin(user?.role)`.
   * Normal (non-admin) users never see the confirmation — the load fires immediately.
   */
  isAdminOrDev?: boolean;
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

// Format a raw dollar integer with the appropriate magnitude suffix (k / M / B)
function formatRevLabel(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${Math.round(n / 1_000)}k`;
  return `$${n.toLocaleString()}`;
}

// Year-over-Year Revenue accumulator curve
const RevenueChart: React.FC<{ year1: string; year3: string }> = ({ year1, year3 }) => {
  const val1 = parseInt(year1.replace(/[^0-9]/g, '')) || 340000;
  const val3 = parseInt(year3.replace(/[^0-9]/g, '')) || 495000;
  const val0 = 0;
  const val2 = Math.round((val1 + val3) / 2 * 1.05);

  const points = [
    { year: 'Launch', value: val0, label: '$0' },
    { year: 'Year 1', value: val1, label: year1 },
    { year: 'Year 2', value: val2, label: formatRevLabel(val2) },
    { year: 'Year 3', value: val3, label: year3 }
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
const ScoreCircle: React.FC<{ score: number }> = ({ score }) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1200; // Complete in 1.2s
    const increment = score / (duration / 16); 
    const timer = setInterval(() => {
      start += increment;
      if (start >= score) {
        setAnimatedScore(score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [score]);

  const getScoreColor = () => {
    if (animatedScore >= 70) return 'text-emerald-700 bg-emerald-50';
    if (animatedScore >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  const getStrokeColor = () => {
    if (animatedScore >= 70) return 'stroke-emerald-500';
    if (animatedScore >= 40) return 'stroke-amber-500';
    return 'stroke-rose-500';
  };

  const circumference = 2 * Math.PI * 45; // radius = 45
  const offset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="relative w-36 h-36 md:w-44 md:h-44 group select-none">
      <svg className="w-full h-full transform transition-transform duration-500 group-hover:scale-105" viewBox="0 0 100 100">
        <circle
          className="text-gray-200 stroke-current"
          strokeWidth="6"
          cx="50"
          cy="50"
          r="45"
          fill="transparent"
        ></circle>
        <circle
          className={`${getStrokeColor()} transition-all duration-150 stroke-current`}
          strokeWidth="7"
          strokeLinecap="round"
          cx="50"
          cy="50"
          r="45"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        ></circle>
      </svg>
      <div className={`absolute inset-4 rounded-full flex flex-col items-center justify-center shadow-xs ${getScoreColor()} transition-colors duration-500`}>
        <span className="text-4xl md:text-5xl font-black tracking-tight">{animatedScore}</span>
        <span className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-1">Viability</span>
      </div>
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
  <div id={id} className={`bg-white rounded-3xl p-6 md:p-8 border border-gray-150 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:border-blue-200/50 hover:shadow-xs ${className}`}>
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

// High fidelity score breakdown components
const ScoringBreakdownView: React.FC<{ breakdown: ScoreBreakdown }> = ({ breakdown }) => {
  const [animatedBreakdowns, setAnimatedBreakdowns] = useState({
    marketDemand: 0,
    competitionIntensity: 0,
    financialFeasibility: 0,
    riskLevel: 0
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedBreakdowns({
        marketDemand: breakdown.marketDemand,
        competitionIntensity: breakdown.competitionIntensity,
        financialFeasibility: breakdown.financialFeasibility,
        riskLevel: breakdown.riskLevel
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [breakdown]);

  const getScoreBand = (val: number, inverse: boolean): { label: string; color: string } => {
    if (inverse) {
      // Lower is better for inverse metrics (competition, risk)
      if (val <= 25) return { label: 'Very Low', color: 'text-emerald-600' };
      if (val <= 45) return { label: 'Low', color: 'text-emerald-500' };
      if (val <= 65) return { label: 'Moderate', color: 'text-amber-600' };
      if (val <= 80) return { label: 'High', color: 'text-rose-500' };
      return { label: 'Very High', color: 'text-rose-700' };
    } else {
      if (val <= 25) return { label: 'Very Low', color: 'text-rose-600' };
      if (val <= 45) return { label: 'Low', color: 'text-amber-600' };
      if (val <= 65) return { label: 'Moderate', color: 'text-blue-600' };
      if (val <= 80) return { label: 'High', color: 'text-emerald-600' };
      return { label: 'Very High', color: 'text-emerald-700' };
    }
  };

  const renderBar = (label: string, currentValue: number, isInverse: boolean, weight: string, icon: React.ReactNode, description: string) => {
    let colorClass = 'bg-blue-600';
    if (isInverse) {
      colorClass = currentValue > 60 ? 'bg-rose-500' : currentValue > 30 ? 'bg-amber-500' : 'bg-emerald-500';
    } else {
      colorClass = currentValue >= 70 ? 'bg-emerald-500' : currentValue >= 45 ? 'bg-amber-500' : 'bg-rose-500';
    }
    const band = getScoreBand(currentValue, isInverse);

    return (
      <div className="group/bar mb-4 last:mb-0 select-none">
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="font-extrabold text-gray-800 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
            {icon}
            <span>{label}</span>
            <span className="text-gray-400 font-medium normal-case">({weight})</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold ${band.color}`}>{band.label}</span>
            <span className="font-mono font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md min-w-[42px] text-center border border-gray-200">
              {currentValue}/100
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-150 rounded-full h-2.5 overflow-hidden border border-gray-200/40">
          <div
            className={`h-full rounded-full ${colorClass} transition-all duration-1000 ease-out`}
            style={{ width: `${currentValue}%` }}
          ></div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{description}</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs flex-grow">
      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2 flex items-center justify-between">
        <span>Weighted Score Composition</span>
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">Score Breakdown</span>
      </h4>
      <div className="space-y-4">
        {renderBar("Market Demand", animatedBreakdowns.marketDemand, false, "30%", <TrendingUp className="w-3.5 h-3.5 text-blue-500" />, "Consumer need, search volume, and spending power in your target market area. Higher is better.")}
        {renderBar("Competition Intensity", animatedBreakdowns.competitionIntensity, true, "25%", <MapPin className="w-3.5 h-3.5 text-emerald-500" />, "Density and strength of existing competitors. Lower scores mean less competition and more opportunity for new entrants.")}
        {renderBar("Financial Feasibility", animatedBreakdowns.financialFeasibility, false, "25%", <DollarSign className="w-3.5 h-3.5 text-purple-500" />, "Projected profitability relative to startup capital required and ongoing operational costs. Higher is better.")}
        {renderBar("Risk Sensitivity", animatedBreakdowns.riskLevel, true, "20%", <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />, "Aggregate exposure to market volatility, regulatory change, and execution challenges. Lower scores are more favorable.")}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-350 leading-relaxed">
          Score ranges: 0–25 Very Low · 26–50 Low · 51–75 Moderate · 76–90 High · 91–100 Very High.
          {' '}Competition Intensity and Risk Sensitivity are inverse — lower values are favorable.
        </p>
      </div>
    </div>
  );
};

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

  const launchText = getLaunchAnalysisText();

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
    setShowExportModal(true);
  };

  const getRecommendationStyle = (decision: string) => {
    switch(decision) {
      case 'Recommended':
        return { bg: 'bg-green-50 text-green-800 border-green-200', label: '✅ HIGH VIABILITY STUDY' };
      case 'Caution Advised':
        return { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: '⚠️ MODERATE VIABILITY CAUTION' };
      case 'Not Recommended':
        return { bg: 'bg-rose-50 text-rose-800 border-rose-200', label: '❌ LOW VIABILITY WARNING' };
      default:
        return { bg: 'bg-gray-50 text-gray-800 border-gray-200', label: 'STUDY ANALYSIS COMPLETE' };
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

  const recStyle = getRecommendationStyle(report.recommendation.decision);

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto scroll-smooth">
        {/* Location confidence warning */}
        {report.locationWarning && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-amber-800 text-sm">
            <span className="text-lg leading-none mt-0.5">⚠️</span>
            <span><strong>Unverified location:</strong> {report.locationWarning}</span>
          </div>
        )}
        {/* Header and Score Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 md:p-8 relative overflow-hidden">
            {/* Soft decorative visual gradient */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>
            
            <div className="flex flex-col md:flex-row gap-8 mb-8 items-center md:items-start text-center md:text-left">
                <div className="flex flex-col items-center flex-shrink-0 relative">
                    <ScoreCircle score={report.viabilityScore} />
                </div>
                
                <div className="flex-grow flex flex-col md:flex-row gap-6 w-full">
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
                          <span>Location: <strong className="text-blue-600">{report.location}</strong></span>
                        </p>
                        
                        <div className={`inline-block px-3.5 py-1.5 rounded-xl border font-black text-xs uppercase tracking-wider mb-4 ${recStyle.bg}`}>
                            {recStyle.label}
                        </div>
                        <p className="text-gray-600 text-xs md:text-sm leading-relaxed max-w-2xl">{report.recommendation.reasoning}</p>
                    </div>

                    {/* Score Breakdown Visualization */}
                    {report.scoreBreakdown && (
                        <div className="w-full md:w-1/3 min-w-[280px]">
                            <ScoringBreakdownView breakdown={report.scoreBreakdown} />
                        </div>
                    )}
                </div>
            </div>

            {/* Print Friendly Meta Block */}
            <div className="hidden print:block border-t border-gray-150 pt-4 mt-4 text-xs text-gray-500 flex justify-between uppercase font-mono">
              <span>BizScope Study &bull; Confidentially Generated</span>
              <span>Coordinates: Lat {report.targetCoordinates?.latitude ?? "N/A"} / Lng {report.targetCoordinates?.longitude ?? "N/A"}</span>
              <span>{currentPlan} Plan</span>
            </div>

            {/* Quick Actions Footer Section */}
            <div className="flex flex-wrap gap-2.5 justify-center md:justify-start border-t border-gray-100 pt-6 print:hidden">
                {onRegenerate && (
                    <button 
                      onClick={handleRegenerateClick}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-extrabold text-xs shadow-md cursor-pointer border border-transparent"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Regenerate Analysis</span>
                    </button>
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
                    <span>Download PDF</span>
                </button>
                {saveSuccess && (
                  <span className="inline-flex items-center text-xs text-green-600 font-bold bg-green-50 border border-green-200 px-3 py-1 rounded-md animate-pulse">
                     {saveSuccess}
                  </span>
                )}
            </div>
        </div>

        {/* AI disclaimer — shown only for live Gemini-generated reports */}
        {report.generationMeta?.isLiveGenerated && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3 print:hidden">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                <p className="text-xs text-blue-800 leading-relaxed">
                    <strong>AI-generated business intelligence estimates.</strong>{' '}
                    Verify critical decisions with independent research.
                </p>
            </div>
        )}

        {/* Sticky Report Navigation Block */}
        <ReportSubNav activeSection={activeSection} setActiveSection={setActiveSection} />

        {/* Print Dossier Header Title Block */}
        <div className="hidden print:block border-b-4 border-gray-900 pb-5 mb-5 whitespace-normal">
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">BizScope Business Analysis</h1>
            <p className="text-xs font-mono text-gray-400 mt-1 uppercase">Confidential Business Analysis Report</p>
            <div className="mt-5 grid grid-cols-4 gap-6 text-sm border-t border-gray-100 pt-4">
                <div><span className="text-[10px] font-black text-gray-400 uppercase block">Business</span> {report.businessType}</div>
                <div><span className="text-[10px] font-black text-gray-400 uppercase block">Location</span> {report.location}</div>
                <div><span className="text-[10px] font-black text-gray-400 uppercase block">Viability Score</span> {report.viabilityScore} / 100</div>
                <div><span className="text-[10px] font-black text-gray-400 uppercase block">Plan</span> {currentPlan}</div>
            </div>
        </div>

        {/* Main Grid containing report detailed insights */}
        <div className="space-y-8">
            
            {/* Executive Summary */}
            <SectionCard 
              title="Executive Summary" 
              id="overview"
              icon={<Layers className="w-5 h-5 text-blue-600" />}
            >
              <p className="leading-relaxed text-sm text-gray-700 whitespace-normal">{report.executiveSummary}</p>
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
                      {/* Basic Startup Cost Range - Always visible to free tier */}
                      <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-150 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Estimated Startup Cost</p>
                              <p className="text-2xl font-black text-gray-900 mt-1">{report.financialProjections.startupCostRange}</p>
                          </div>
                          <div className="flex-1 md:max-w-md">
                              <p className="text-xs text-gray-405 font-bold uppercase tracking-wider">Cost Breakdown</p>
                              <p className="text-xs text-gray-650 mt-1 leading-relaxed italic">{report.financialProjections.startupCostBreakdown}</p>
                          </div>
                      </div>

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
                                          <p className="font-black text-lg md:text-xl text-emerald-600 mt-1">{report.financialProjections.revenueYear1}</p>
                                          <p className="text-[10px] text-gray-400 mt-1">Estimated total gross revenue in the first full year of operation.</p>
                                      </div>
                                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Year 3 Revenue Projection</p>
                                          <p className="font-black text-lg md:text-xl text-emerald-700 mt-1">{report.financialProjections.revenueYear3}</p>
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
                                          <span className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Break-Even</span>
                                          <span className="font-black text-blue-600 text-xs mt-1">{report.financialProjections.breakEvenTime}</span>
                                      </div>
                                      <div className="flex flex-col border-r border-gray-150 px-2">
                                          <span className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">ROI Payoff</span>
                                          <span className="font-black text-blue-700 text-xs mt-1">{report.financialProjections.roiTime}</span>
                                      </div>
                                       <div className="flex flex-col pl-2">
                                          <span className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Net Margin</span>
                                          <span className="font-black text-green-600 text-xs mt-1">{report.financialProjections.profitMargin}</span>
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
                                                  <p className="font-semibold text-gray-950 text-xs">{stat.value}</p>
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
                                              <span className="font-extrabold text-gray-900 text-xs uppercase tracking-wide">{report.riskAssessment.risks[0].risk}</span>
                                              <span className={`text-[9px] px-2 py-0.5 rounded-full border shrink-0 ${getSeverityColor(report.riskAssessment.risks[0].severity)}`}>
                                                  {report.riskAssessment.risks[0].severity} Severity
                                              </span>
                                          </div>
                                          <p className="text-xs text-gray-650 mb-2 leading-relaxed">{report.riskAssessment.risks[0].impact}</p>
                                          <p className="text-xs text-gray-500 font-semibold flex items-center gap-1 border-t border-gray-100 pt-2">
                                            <Info className="w-3 h-3 text-amber-500" />
                                            <span>Mitigation: {report.riskAssessment.risks[0].mitigation}</span>
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
                                                    <span className="font-extrabold text-gray-900 text-xs uppercase tracking-wide">{risk.risk}</span>
                                                    <span className={`text-[9px] px-2 py-0.5 rounded-full border shrink-0 ${getSeverityColor(risk.severity)}`}>
                                                        {risk.severity} Severity
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-650 mb-2 leading-relaxed">{risk.impact}</p>
                                                <p className="text-xs text-gray-500 font-semibold flex items-center gap-1 border-t border-grey-100 pt-2">
                                                    <Info className="w-3 h-3 text-amber-500" />
                                                    <span>Mitigation: {risk.mitigation}</span>
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
                title="Competitor location & market analysis"
                id="competition"
                className="border-l-4 border-l-emerald-500 shadow-sm"
                icon={<Map className="w-5 h-5 text-emerald-600" />}
            >
                <div className="space-y-4">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Estimated Competitor Distribution</p>
                  <p className="text-sm text-gray-600 leading-relaxed mb-2">
                    AI-estimated competitor positions plotted from report data. This is a schematic coordinate visualization, not a real-time map service.{!canViewFullFinancials(currentPlan) && ' Upgrade to Pro to unlock.'}
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
                  <p className="mb-4 text-sm text-gray-700 leading-relaxed">{report.competitionAnalysis.summary}</p>
                  <ul className="space-y-4">
                    {report.competitionAnalysis.competitors.map((comp, index) => (
                      <li key={index} className="bg-gray-50/70 p-4 rounded-2xl border border-gray-150 transition-colors hover:bg-white">
                        <div className="font-extrabold text-gray-900 text-xs uppercase tracking-wide">{comp.name}</div>
                        <div className="text-[10px] text-gray-400 mb-2 font-bold uppercase tracking-wide">{comp.address || 'Address documented'}</div>
                        <p className="text-xs text-gray-600 leading-relaxed">{comp.details}</p>
                      </li>
                    ))}
                  </ul>
                </SectionCard>

                {/* Market Trends */}
                <SectionCard 
                  title="Market Trends"
                  icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                >
                  <p className="mb-4 text-xs text-gray-400 uppercase font-black tracking-widest">What's driving demand</p>
                  <p className="mb-4 text-sm text-gray-750 leading-relaxed">{report.marketTrends.summary}</p>
                  <ul className="space-y-4">
                    {report.marketTrends.trends.map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-2 h-2 mt-2 bg-emerald-500 rounded-full"></span>
                        <div>
                          <span className="font-extrabold text-gray-900 text-xs uppercase tracking-wide block">{item.trend}</span>
                          <span className="text-xs text-gray-600 leading-relaxed mt-0.5 block">{item.impact}</span>
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
              <p className="mb-6 text-sm text-gray-750 leading-relaxed">{report.demographicInsights.summary}</p>
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
                                General industry benchmarks — not location-specific
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-150 text-center">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Market Interest Score</p>
                                <p className="text-4xl font-black text-blue-600">92<span className="text-xl">/100</span></p>
                                <p className="text-[10px] font-bold text-blue-500 mt-1">High Interest</p>
                                <p className="text-xs text-emerald-600 font-extrabold mt-1 flex items-center justify-center gap-1">
                                    &uarr; 14.8% YoY search growth
                                </p>
                                <p className="text-xs text-gray-500 mt-2 leading-relaxed">Expected consumer interest and willingness to purchase in this category. General industry benchmark.</p>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-150 text-center">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Advertising Cost Benchmark</p>
                                <p className="text-4xl font-black text-purple-600">$13.80</p>
                                <p className="text-xs text-gray-550 mt-2 font-semibold">Cost per 1,000 Ad Impressions (CPM)</p>
                                <p className="text-xs text-gray-500 mt-2 leading-relaxed">What you might expect to pay to reach 1,000 potential customers online. Actual costs vary by platform and targeting.</p>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-150 text-center">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Customer Acquisition Cost</p>
                                <p className="text-4xl font-black text-indigo-600">$0.95 <span className="text-xs font-normal text-gray-400">/click</span></p>
                                <p className="text-xs text-gray-550 mt-2 font-semibold">Estimated Cost per Interested Lead</p>
                                <p className="text-xs text-gray-500 mt-2 leading-relaxed">Indicative paid digital acquisition cost per lead. Organic and referral channels typically cost less.</p>
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
                                    <strong>Pro+ Regional Insights Active:</strong> Market context modeled for surrounding sectors near <strong>{report.location}</strong>.
                                </span>
                            </div>

                            {/* 1. Nearby ZIP Opportunity Analysis / Surrounding Suburbs Analysis */}
                            <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                                    {regionalData.isZipMode ? "Nearby ZIP Codes" : "Nearby Suburbs"}
                                </p>
                                <div className="overflow-x-auto rounded-2xl border border-gray-150 bg-gray-50/30">
                                    <table className="w-full min-w-[480px] text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-gray-100 border-b border-gray-150 font-black text-gray-400 uppercase tracking-wider">
                                                <th className="py-3.5 px-4 text-[10px]">{regionalData.isZipMode ? "Area" : "Suburb"}</th>
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
                                    <p className="text-xs text-gray-600 leading-relaxed">{regionalData.countyContext}</p>
                                </div>

                                <div className="bg-purple-50/30 border border-purple-100 p-5 rounded-2xl">
                                    <h4 className="font-extrabold text-purple-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Compass className="w-4 h-4 text-purple-500" />
                                        <span>{regionalData.specificObservationTitle || "Radius Observations"}</span>
                                    </h4>
                                    <p className="text-xs text-gray-600 leading-relaxed">{regionalData.specificObservationText}</p>
                                </div>
                            </div>

                            {/* 15-25 Mile Economic Radius Callout & Competitive Spillover */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-50/80 border border-gray-200 p-5 rounded-2xl">
                                    <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Globe className="w-4 h-4 text-indigo-500" />
                                        <span>Wider Economic Region (15–25 miles)</span>
                                    </h4>
                                    <p className="text-xs text-gray-600 leading-relaxed">{regionalData.economicRadius}</p>
                                </div>

                                <div className="bg-gray-50/80 border border-gray-200 p-5 rounded-2xl">
                                    <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        <span>Nearby Market Competition</span>
                                    </h4>
                                    <p className="text-xs text-gray-600 leading-relaxed">{regionalData.competitiveSpillover}</p>
                                </div>
                            </div>

                            {/* 4 & 5. Expansion potential strategy */}
                            <div className="bg-indigo-50/25 p-6 rounded-2xl border border-indigo-100">
                                <p className="text-xs font-black text-indigo-750 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-indigo-500" />
                                    <span>Expansion Plan (Next 12 Months)</span>
                                </p>
                                <p className="text-xs text-gray-600 leading-relaxed">{regionalData.expansionPotential}</p>
                            </div>

                            {/* 6. Regional Recommendation Highlight */}
                            <div className="bg-emerald-50/50 border border-emerald-200/60 p-5 rounded-2xl flex flex-col sm:flex-row items-start gap-4">
                                <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-xl shrink-0">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <h5 className="font-extrabold text-emerald-900 text-xs uppercase tracking-wider mb-1">Expansion Recommendation</h5>
                                    <p className="text-xs text-emerald-800 leading-relaxed">{regionalData.regionalRecommendation}</p>
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
                            <p className="text-sm text-gray-700 leading-relaxed">{report.recommendation.reasoning}</p>
                            <div className="mt-3 flex items-center gap-3 flex-wrap">
                                <span className={`text-xs font-black px-3 py-1 rounded-full ${
                                    report.recommendation.decision === 'Recommended' ? 'bg-emerald-100 text-emerald-800' :
                                    report.recommendation.decision === 'Caution Advised' ? 'bg-amber-100 text-amber-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                    {report.recommendation.decision}
                                </span>
                                <span className="text-xs text-gray-500">Viability Score: <strong className="text-gray-800">{report.viabilityScore}%</strong></span>
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
                                                <span className="font-extrabold text-gray-900 text-xs block">{risk.risk}</span>
                                                <span className="text-xs text-gray-600 mt-0.5 block">{risk.mitigation}</span>
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
                    Regenerate Live Analysis?
                  </h3>
                </div>
                
                <p className="text-xs text-gray-500 leading-relaxed mb-6">
                  Regenerating this viability study will run a fresh AI analysis for this business and location.
                  <br />
                  <br />
                  This bypasses any cached result and will count towards your report quota. Do you wish to proceed?
                </p>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowRegenConfirm(false)}
                    className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegenerateConfirm}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    Yes, Regenerate
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
                      <p className="text-xs text-gray-500 mb-4 font-semibold uppercase flex items-center gap-1">
                          <Navigation className="w-3.5 h-3.5 text-blue-500" />
                          <span>Estimated positions for <strong className="text-gray-800">{report.competitionAnalysis.competitors.length}</strong> competitors based on AI-gathered report data</span>
                      </p>

                      {canViewFullFinancials(currentPlan) ? (
                          <div className="rounded-2xl overflow-hidden border border-gray-150 h-[450px]">
                              <CompetitorMap 
                                  competitors={report.competitionAnalysis.competitors} 
                                  targetCoordinates={report.targetCoordinates}
                              />
                          </div>
                      ) : (
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
                      )}
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
                      setExportSuccess("PDF Dossier Exported Successfully!");
                      setTimeout(() => {
                        setShowExportModal(false);
                        setExportSuccess(null);
                      }, 2000);
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
