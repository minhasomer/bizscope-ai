/**
 * Pure mapping functions for the Decision Framework UX (Sprint 11).
 * Converts numeric scores to human-readable tier labels at render time.
 * Scores are never removed from the data model — only the presentation changes.
 */

import type { ViabilityReport } from '../../types';

// ─── Overall Assessment ───────────────────────────────────────────────────────

export interface Assessment {
  label: string;
  emoji: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export function viabilityScoreToAssessment(score: number): Assessment {
  if (score >= 80) return { label: 'Strong Opportunity',          emoji: '🟢', colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50',  borderClass: 'border-emerald-300' };
  if (score >= 70) return { label: 'Attractive Market',           emoji: '🟢', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50',  borderClass: 'border-emerald-200' };
  if (score >= 60) return { label: 'Worth Further Investigation', emoji: '🟡', colorClass: 'text-amber-700',   bgClass: 'bg-amber-50',    borderClass: 'border-amber-300'   };
  if (score >= 50) return { label: 'Proceed Carefully',           emoji: '🟡', colorClass: 'text-amber-600',   bgClass: 'bg-amber-50',    borderClass: 'border-amber-200'   };
  if (score >= 35) return { label: 'Significant Concerns',        emoji: '🔴', colorClass: 'text-rose-700',    bgClass: 'bg-rose-50',     borderClass: 'border-rose-300'    };
  return             { label: 'Not Recommended',                 emoji: '🔴', colorClass: 'text-rose-700',    bgClass: 'bg-rose-50',     borderClass: 'border-rose-200'    };
}

// ─── Category Ratings ─────────────────────────────────────────────────────────

export interface Rating {
  label: string;
  colorClass: string;
  bgClass: string;
}

/** Market Demand: direct (higher score = stronger demand). */
export function scoreToMarketDemandRating(score: number): Rating {
  if (score >= 80) return { label: 'Exceptional', colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50' };
  if (score >= 65) return { label: 'Strong',      colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50' };
  if (score >= 45) return { label: 'Moderate',    colorClass: 'text-amber-600',   bgClass: 'bg-amber-50'   };
  if (score >= 25) return { label: 'Weak',        colorClass: 'text-rose-500',    bgClass: 'bg-rose-50'    };
  return             { label: 'Very Weak',     colorClass: 'text-rose-700',    bgClass: 'bg-rose-50'    };
}

/** Competition: inverse (higher competition score = worse). */
export function scoreToCompetitionRating(score: number): Rating {
  if (score <= 20) return { label: 'Very Low',  colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50' };
  if (score <= 40) return { label: 'Low',       colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50' };
  if (score <= 60) return { label: 'Moderate',  colorClass: 'text-amber-600',   bgClass: 'bg-amber-50'   };
  if (score <= 80) return { label: 'High',      colorClass: 'text-rose-500',    bgClass: 'bg-rose-50'    };
  return             { label: 'Saturated',    colorClass: 'text-rose-700',    bgClass: 'bg-rose-50'    };
}

/**
 * Capital Requirements: derived from financialFeasibility (inverse).
 * Low financial feasibility → high capital burden.
 */
export function scoreToCapitalRating(financialFeasibilityScore: number): Rating {
  if (financialFeasibilityScore >= 80) return { label: 'Low Capital',        colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50' };
  if (financialFeasibilityScore >= 65) return { label: 'Moderate Capital',   colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50' };
  if (financialFeasibilityScore >= 45) return { label: 'Significant Capital', colorClass: 'text-amber-600',  bgClass: 'bg-amber-50'   };
  if (financialFeasibilityScore >= 25) return { label: 'High Capital',       colorClass: 'text-rose-500',    bgClass: 'bg-rose-50'    };
  return                                { label: 'Very High Capital',   colorClass: 'text-rose-700',    bgClass: 'bg-rose-50'    };
}

/**
 * Operational Complexity: derived from riskLevel as a proxy.
 * Higher risk typically correlates with higher operational complexity.
 */
export function scoreToComplexityRating(riskLevelScore: number): Rating {
  if (riskLevelScore <= 20) return { label: 'Simple',         colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50' };
  if (riskLevelScore <= 40) return { label: 'Manageable',     colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50' };
  if (riskLevelScore <= 60) return { label: 'Moderate',       colorClass: 'text-amber-600',   bgClass: 'bg-amber-50'   };
  if (riskLevelScore <= 80) return { label: 'Complex',        colorClass: 'text-rose-500',    bgClass: 'bg-rose-50'    };
  return                     { label: 'Highly Complex', colorClass: 'text-rose-700',    bgClass: 'bg-rose-50'    };
}

/**
 * Growth Potential: derived from marketDemand, adjusted by scalability.
 */
export function scoreToGrowthRating(marketDemandScore: number, scalability?: string): Rating {
  const adj = scalability === 'High' ? 10 : scalability === 'Low' ? -10 : 0;
  const effective = Math.max(0, Math.min(100, marketDemandScore + adj));
  if (effective >= 80) return { label: 'Exceptional', colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50' };
  if (effective >= 65) return { label: 'Strong',      colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50' };
  if (effective >= 45) return { label: 'Moderate',    colorClass: 'text-amber-600',   bgClass: 'bg-amber-50'   };
  if (effective >= 25) return { label: 'Limited',     colorClass: 'text-rose-500',    bgClass: 'bg-rose-50'    };
  return                 { label: 'Weak',        colorClass: 'text-rose-700',    bgClass: 'bg-rose-50'    };
}

/** Risk Level: inverse (higher score = more risk). */
export function scoreToRiskRating(riskLevelScore: number): Rating {
  if (riskLevelScore <= 20) return { label: 'Very Low', colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50' };
  if (riskLevelScore <= 40) return { label: 'Low',      colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50' };
  if (riskLevelScore <= 60) return { label: 'Moderate', colorClass: 'text-amber-600',   bgClass: 'bg-amber-50'   };
  if (riskLevelScore <= 75) return { label: 'Elevated', colorClass: 'text-rose-500',    bgClass: 'bg-rose-50'    };
  return                     { label: 'High',     colorClass: 'text-rose-700',    bgClass: 'bg-rose-50'    };
}

// ─── Decision Guidance ────────────────────────────────────────────────────────

export function getNextStep(decision: string, score?: number): string {
  switch (decision) {
    case 'Recommended':           return 'Proceed to Due Diligence';
    case 'Caution Advised':       return 'Further Validation Recommended';
    case 'Not Recommended':       return 'Not Recommended Without Additional Research';
    case 'Verification Required': return 'Proceed Carefully';
    default: return score != null && score >= 60
      ? 'Further Validation Recommended'
      : 'Not Recommended Without Additional Research';
  }
}

// ─── Confidence Level ─────────────────────────────────────────────────────────

export interface ConfidenceLevel {
  level: 'High' | 'Medium' | 'Low';
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

/** Deterministic confidence from data completeness — no new AI calls. */
export function getConfidenceLevel(report: ViabilityReport): ConfidenceLevel {
  let pts = 0;
  if (report.scoreBreakdown) pts += 2;
  if ((report.competitionAnalysis?.competitors?.length ?? 0) >= 3) pts += 2;
  if ((report.marketTrends?.trends?.length ?? 0) >= 2) pts += 1;
  if ((report.demographicInsights?.demographics?.length ?? 0) >= 2) pts += 1;
  if ((report.groundingSources?.length ?? 0) >= 2) pts += 1;
  if (report.generationMeta?.isLiveGenerated) pts += 2;
  if ((report.riskAssessment?.risks?.length ?? 0) > 0) pts += 1;

  if (pts >= 8) return {
    level: 'High', description: 'Strong data coverage across multiple market signals',
    colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200',
  };
  if (pts >= 5) return {
    level: 'Medium', description: 'Adequate data — validate key assumptions',
    colorClass: 'text-amber-600', bgClass: 'bg-amber-50', borderClass: 'border-amber-200',
  };
  return {
    level: 'Low', description: 'Limited signals — validate with independent research',
    colorClass: 'text-rose-600', bgClass: 'bg-rose-50', borderClass: 'border-rose-200',
  };
}


// ─── PDF helpers (plain text, no JSX) ────────────────────────────────────────

/** Returns the short PDF-safe assessment label for a viability score. */
export function viabilityScoreToPdfLabel(score: number): string {
  if (score >= 80) return 'Strong Opportunity';
  if (score >= 70) return 'Attractive Market';
  if (score >= 60) return 'Worth Further Investigation';
  if (score >= 50) return 'Proceed Carefully';
  if (score >= 35) return 'Significant Concerns';
  return 'Not Recommended';
}

// ─── Executive Summary render-time normalizer ────────────────────────────────

/**
 * Strips score-first phrasing from AI-generated executive summary text.
 * Applied at render time only — never mutates stored data.
 *
 * Replaces patterns such as:
 *   "viability score of 65"              → "overall assessment"
 *   "overall viability score of 65"      → "overall assessment"
 *   "a score of 65/100"                  → "an overall assessment"
 *   "scored 65 out of 100"              → "assessed well"
 *   "65/100 viability"                  → "overall viability"
 */
export function normalizeExecutiveSummary(text: string): string {
  if (!text) return text;
  return text
    .replace(/\b(overall\s+)?viability\s+score\s+of\s+\d+\b/gi, 'overall assessment')
    .replace(/\ba\s+score\s+of\s+\d+\s*\/\s*100\b/gi, 'an overall assessment')
    .replace(/\bscored?\s+\d+\s*(?:\/\s*100|out\s+of\s+100)\b/gi, 'assessed well')
    .replace(/\b\d+\s*\/\s*100\s+viability\b/gi, 'overall viability')
    .replace(/\bviability\s+score\s+of\s+\d+\s*\/\s*100\b/gi, 'overall assessment')
    .replace(/\bscore\s+of\s+\d+\s*\/\s*100\b/gi, 'overall assessment');
}

/**
 * Returns a PDF-safe tier label for a direct (non-inverse) factor score.
 * Used for Market Demand and Financial Feasibility.
 * For Competition and Risk Level, use scoreToCompetitionRating / scoreToRiskRating
 * directly so PDF labels always match browser UI labels exactly.
 */
export function factorScoreToPdfLabel(score: number): string {
  if (score >= 80) return 'Exceptional';
  if (score >= 65) return 'Strong';
  if (score >= 45) return 'Moderate';
  if (score >= 25) return 'Weak';
  return 'Very Weak';
}
