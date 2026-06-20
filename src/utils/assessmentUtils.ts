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

/**
 * Plain-language, scoreless explanation of THIS report's overall assessment.
 * Shown next to the Overall Assessment badge so beta users immediately
 * understand their specific outcome without reading the full rating framework.
 * Bands mirror viabilityScoreToAssessment (the two favorable bands share copy).
 */
export function viabilityScoreToPlainExplanation(score: number): string {
  if (score >= 70) return 'The market appears favorable. Continue validating details before investing.';
  if (score >= 60) return 'There are encouraging signs. This opportunity deserves deeper research before investing.';
  if (score >= 50) return 'The opportunity may work, but several risks need closer review.';
  if (score >= 35) return 'Significant concerns were identified. Investigate thoroughly before proceeding.';
  return 'Current market conditions do not appear favorable for this opportunity.';
}

/**
 * Second line of the local explanation: where THIS result sits relative to the
 * overall BizScope framework. Scoreless — describes position, never a number.
 */
export function viabilityScoreToFrameworkContext(score: number): string {
  if (score >= 70) return "This is BizScope's most favorable assessment.";
  if (score >= 60) return 'This is a positive outcome and is generally more favorable than Proceed Carefully.';
  if (score >= 50) return 'This sits in the middle of the assessment range and indicates meaningful risks.';
  if (score >= 35) return 'This indicates more concerns than Proceed Carefully and requires deeper validation.';
  return "This is BizScope's least favorable assessment.";
}

// ─── Assessment Framework (the "How BizScope ratings work" legend) ─────────────

export interface FrameworkTier {
  key: string;
  emoji: string;
  label: string;
  blurb: string;
}

/** The BizScope assessment framework, ordered most → least favorable. */
export const ASSESSMENT_FRAMEWORK: FrameworkTier[] = [
  { key: 'strong',  emoji: '🟢', label: 'Strong Opportunity',          blurb: 'Favorable overall signal.' },
  { key: 'worth',   emoji: '🟢', label: 'Worth Further Investigation', blurb: 'Promising signals that justify deeper research.' },
  { key: 'proceed', emoji: '🟡', label: 'Proceed Carefully',           blurb: 'Viable but risk-sensitive.' },
  { key: 'caution', emoji: '🟠', label: 'Caution Advised',             blurb: 'Meaningful concerns identified.' },
  { key: 'notrec',  emoji: '🔴', label: 'Not Recommended',             blurb: 'Current conditions appear unfavorable.' },
];

/**
 * Index into ASSESSMENT_FRAMEWORK for a given viability score — drives the
 * "You are here" highlight. Collapses the six assessment bands onto the five
 * public framework tiers (the two favorable bands map to Strong Opportunity;
 * the Significant Concerns band maps to Caution Advised).
 */
export function viabilityScoreToFrameworkIndex(score: number): number {
  if (score >= 70) return 0; // Strong Opportunity (incl. Attractive Market band)
  if (score >= 60) return 1; // Worth Further Investigation
  if (score >= 50) return 2; // Proceed Carefully
  if (score >= 35) return 3; // Caution Advised (incl. Significant Concerns band)
  return 4;                  // Not Recommended
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
 * Strips numeric-score phrasing from any AI-generated report prose (executive
 * summary, recommendation reasoning, etc.). Applied at render time only — never
 * mutates stored data. This enforces BizScope's scoreless UX (Decision
 * Framework, Sprint 11): the score lives in the data model and drives
 * color/labels, but is never surfaced as a number in user-visible text.
 *
 * Replacements are sentiment-neutral so a stripped low score is never reworded
 * into an unwarranted positive. Examples:
 *   "a strong viability score of 77"   → "a strong overall assessment"
 *   "an overall score of 62/100"       → "an overall assessment"
 *   "scored 68 out of 100"             → "was assessed"
 *   "rated 62"                         → "was rated"
 *   "achieves 68 out of 100"           → "achieves a strong overall standing" → neutral: "the overall assessment"
 *   "62/100 viability"                 → "overall viability"
 *
 * Currency and other non-score numbers ("$68,000 / 100 units", "62%") are
 * protected via digit/comma/$ lookbehind and a 1–3 digit cap (scores are 0–100).
 */
export function stripScoreReferences(text: string | undefined | null): string {
  if (!text) return text ?? '';

  // Optional "/100" or "out of 100" suffix shared by several patterns.
  const suffix = '(?:\\s*\\/\\s*100|\\s+out\\s+of\\s+100)?';

  let out = text
    // "(overall) viability score of 68" (+ optional /100 | out of 100)
    .replace(new RegExp(`\\b(?:overall\\s+)?viability\\s+score\\s+of\\s+\\d{1,3}${suffix}\\b`, 'gi'), 'overall assessment')
    // "a score of 62/100" / "a score of 62"
    .replace(new RegExp(`\\ba\\s+score\\s+of\\s+\\d{1,3}${suffix}\\b`, 'gi'), 'an overall assessment')
    // generic "score of 62/100" / "score of 62"
    .replace(new RegExp(`\\bscore\\s+of\\s+\\d{1,3}${suffix}\\b`, 'gi'), 'overall assessment')
    // "scored 68 out of 100" / "scored 68/100" / "scored 68"
    .replace(new RegExp(`\\bscored\\s+\\d{1,3}${suffix}\\b`, 'gi'), 'was assessed')
    // "rated 62" (2–3 digits so "rated 4 stars" is untouched; optional /100)
    .replace(new RegExp(`\\brated\\s+\\d{2,3}${suffix}\\b`, 'gi'), 'was rated')
    // bare "68 out of 100" (guard currency/large numbers)
    .replace(/(?<![\d,$])\b\d{1,3}\s+out\s+of\s+100\b/gi, 'the overall assessment')
    // bare "62/100", optionally trailed by "viability" (guard currency/large numbers)
    .replace(/(?<![\d,$])\b\d{1,3}\s*\/\s*100(\s+viability)?\b/gi, (_m, v) => (v ? 'overall viability' : 'the overall assessment'));

  // Grammar tidy after substitution.
  out = out
    .replace(/\ba\s+(overall|an)\b/gi, 'an $1')   // "a overall" → "an overall"
    .replace(/\ban\s+an\b/gi, 'an')
    .replace(/[ \t]{2,}/g, ' ');
  return out;
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
