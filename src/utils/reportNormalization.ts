/**
 * Defensive schema normalization for ViabilityReport-shaped objects.
 *
 * Gemini's structured output schema marks these fields as required, but
 * truncated/repaired JSON (see repairTruncatedJSON in api/analyze.ts) or a
 * stale cached entry from before a schema change can still produce a report
 * missing them. ReportDisplay and related components read fields like
 * `recommendation.decision` without a guard, which throws and blanks the
 * whole report view. This fills in safe defaults for any missing/malformed
 * field without altering values that are already present — it does not
 * change recommendation logic, only guarantees the shape.
 */
export function normalizeViabilityReport<T extends Record<string, any>>(report: T): T {
  const r: any = report && typeof report === 'object' ? report : {};

  if (!r.recommendation || typeof r.recommendation !== 'object') {
    r.recommendation = {};
  }
  if (typeof r.recommendation.decision !== 'string') {
    r.recommendation.decision = 'Verification Required';
  }
  if (typeof r.recommendation.reasoning !== 'string') {
    r.recommendation.reasoning = 'Recommendation reasoning was unavailable for this report — please verify details manually.';
  }

  if (!r.competitionAnalysis || typeof r.competitionAnalysis !== 'object') {
    r.competitionAnalysis = {};
  }
  if (typeof r.competitionAnalysis.summary !== 'string') r.competitionAnalysis.summary = '';
  if (!Array.isArray(r.competitionAnalysis.competitors)) r.competitionAnalysis.competitors = [];

  if (!r.marketTrends || typeof r.marketTrends !== 'object') {
    r.marketTrends = {};
  }
  if (typeof r.marketTrends.summary !== 'string') r.marketTrends.summary = '';
  if (!Array.isArray(r.marketTrends.trends)) r.marketTrends.trends = [];

  if (!r.demographicInsights || typeof r.demographicInsights !== 'object') {
    r.demographicInsights = {};
  }
  if (typeof r.demographicInsights.summary !== 'string') r.demographicInsights.summary = '';
  if (!Array.isArray(r.demographicInsights.demographics)) r.demographicInsights.demographics = [];

  if (!r.riskAssessment || typeof r.riskAssessment !== 'object') {
    r.riskAssessment = {};
  }
  if (typeof r.riskAssessment.summary !== 'string') r.riskAssessment.summary = '';
  if (!Array.isArray(r.riskAssessment.risks)) r.riskAssessment.risks = [];

  if (!r.successFactors || typeof r.successFactors !== 'object') {
    r.successFactors = {};
  }
  if (typeof r.successFactors.summary !== 'string') r.successFactors.summary = '';
  if (!Array.isArray(r.successFactors.factors)) r.successFactors.factors = [];

  if (typeof r.methodology !== 'string') r.methodology = '';

  return r as T;
}
