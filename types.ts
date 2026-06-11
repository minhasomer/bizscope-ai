
export interface UserLocation {
  latitude: number;
  longitude: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Competition {
  name: string;
  details: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface MarketTrend {
  trend: string;
  impact: string;
}

export interface Demographic {
  metric: string;
  value: string;
  insight: string;
}

export interface FinancialMetric {
  label: string;
  value: string;
}

export interface StartupCostItem {
  category: string;
  amount: string;
  notes?: string;
}

export interface StartupSpaceContext {
  sqft?: string;
  monthlyRent?: string;
  buildOutIntensity?: 'Low' | 'Moderate' | 'High';
}

export interface FinancialProjections {
  summary: string;
  startupCostRange: string;
  startupCostBreakdown: string;
  /** Structured line-item breakdown — present on reports generated after Sprint 10. */
  startupCostItems?: StartupCostItem[];
  /** Brick-and-mortar space context — present when applicable. */
  startupSpaceContext?: StartupSpaceContext;
  revenueYear1: string;
  revenueYear3: string;
  breakEvenTime: string;
  roiTime: string;
  profitMargin: string;
  scalability: 'Low' | 'Medium' | 'High';
  keyStats: FinancialMetric[];
}

export interface Risk {
  risk: string;
  impact: string;
  severity: 'Low' | 'Medium' | 'High';
  mitigation: string;
}

export interface SuccessFactor {
  factor: string;
  description: string;
  importance: 'Critical' | 'High' | 'Medium';
}

export interface ScoreBreakdown {
  marketDemand: number;
  competitionIntensity: number;
  financialFeasibility: number;
  riskLevel: number;
}

// ─── Opportunity Dossier section types ────────────────────────────────────────
// Present on full-analysis responses; absent on compact card-only data.

export interface DossierMarketDemand {
  summary: string;
  drivers: string[];
  consumerTrends: string[];
  targetAudience: string;
  localMarketConditions: string;
}

export interface DossierDemographicFit {
  idealCustomer: string;
  incomeConsiderations: string;
  ageGroups: string;
  populationRelevance: string;
}

export interface DossierCompetitiveLandscape {
  summary: string;
  existingCompetitors: string;
  marketSaturation: string; // 'Low' | 'Moderate' | 'High'
  competitiveAdvantages: string[];
}

export interface DossierStartupRequirements {
  licensing: string;
  staffing: string;
  equipment: string;
  operationalComplexity: string; // 'Low' | 'Moderate' | 'High'
}

export interface DossierStartupCostRange {
  low: string;
  expected: string;
  high: string;
}

export interface DossierRevenueModel {
  summary: string;
  monetizationMethods: string[];
  scalabilityPotential: string;
}

export interface DossierStrategicRisk {
  /** 'Market' | 'Regulatory' | 'Competitive' | 'Execution' */
  category: string;
  risk: string;
  mitigation: string;
}

export interface DossierScorecard {
  marketDemand: number;       // 0-100
  competition: number;        // 0-100 (higher = LESS competition = better)
  startupComplexity: number;  // 0-100 (higher = simpler = better)
  revenuePotential: number;   // 0-100
  scalability: number;        // 0-100
  overallScore: number;       // 0-100
}

export interface DossierRecommendation {
  /** 'Proceed' | 'Proceed with Caution' | 'High Potential' | 'Limited Opportunity' */
  decision: string;
  rationale: string;
}

// ─── Business Opportunity ──────────────────────────────────────────────────────

export interface BusinessOpportunity {
  businessType: string;
  description: string;
  whyItsGood: string;
  scores: {
    capEx: number; // 1-10 (1 is low, 10 is high)
    overhead: number; // 1-10
    laborIntensity: number; // 1-10
    competitionLevel: number; // 1-10 (1 is low competition)
    overallPotental: number; // 0-100 — deprecated, kept for fallback
    // Estimated viability sub-scores (0-100, same dimensions as Viability Report)
    estimatedMarketDemand?: number;
    estimatedCompetitionIntensity?: number; // higher = more competitive
    estimatedFinancialFeasibility?: number;
    estimatedRiskLevel?: number;            // higher = more risk
    estimatedViabilityScore?: number;       // formula-derived, same as Viability Report
  };
  financials: {
    estimatedStartupCost: string;
    targetMarket: string;
    potentialRevenue: string;
  };
  risks?: string[];
  customerSegment?: string;
  bestNearbyArea?: string;

  // ── Dossier fields — populated by the expanded full-analysis prompt ──────────
  executiveSummary?: string;
  marketDemand?: DossierMarketDemand;
  demographicFit?: DossierDemographicFit;
  competitiveLandscape?: DossierCompetitiveLandscape;
  startupRequirements?: DossierStartupRequirements;
  startupCostRange?: DossierStartupCostRange;
  revenueModel?: DossierRevenueModel;
  strategicRisks?: DossierStrategicRisk[];
  opportunityScorecard?: DossierScorecard;
  strategicRecommendation?: DossierRecommendation;
}

export interface OpportunityReport {
  location: string;
  summary: string;
  topOpportunities: BusinessOpportunity[];
  methodology: string;
  groundingSources: GroundingSource[];
  // Generation / cache metadata — present on live AI reports, absent on mock
  generationMeta?: {
    model: string;
    isLiveGenerated: boolean;
    estimatedCostUsd: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    generatedAt: string;
  };
  // Cache freshness metadata — added by the server cache layer
  _cached?: boolean;
  _generatedAt?: string;
  _cacheAgeDays?: number;
  _freshnessDays?: number;
  _isStale?: boolean;
  _refreshedFromStale?: boolean;
}

export interface FranchiseTerritoryCheck {
  brandName: string;
  /** Indices into competitionAnalysis.competitors that are same-brand locations. */
  sameBrandIndices: number[];
  sameBrandCount: number;
  /**
   * Always true for any known franchise brand.
   * Territory cannot be confirmed available without direct franchisor confirmation —
   * regardless of what the AI competitor search returned.
   */
  existingPresenceDetected: boolean;
  /**
   * True only when the AI competitor search actually surfaced a same-brand location.
   * Distinct from existingPresenceDetected (which is always true for known franchises).
   */
  sameBrandFoundInSearch: boolean;
}

export interface ViabilityReport {
  businessType: string;
  location: string;
  targetCoordinates?: { latitude: number; longitude: number };
  coordinatesAreReal?: boolean;

  viabilityScore: number;
  scoreBreakdown?: ScoreBreakdown;
  executiveSummary: string;
  
  financialProjections: FinancialProjections;

  competitionAnalysis: {
    summary: string;
    competitors: Competition[];
  };

  marketTrends: {
    summary: string;
    trends: MarketTrend[];
  };

  demographicInsights: {
    summary: string;
    demographics: Demographic[];
  };
  
  // Optional Intelligence Modules
  riskAssessment?: {
    summary: string;
    risks: Risk[];
  };
  
  successFactors?: {
    summary: string;
    factors: SuccessFactor[];
  };

  recommendation: {
    decision: 'Recommended' | 'Caution Advised' | 'Not Recommended' | 'Verification Required';
    reasoning: string;
  };
  
  methodology: string;
  
  groundingSources: GroundingSource[];

  // Optional live regional intelligence
  regionalIntelligence?: RegionalIntelligenceData;

  // Cache metadata
  loadedFromCache?: boolean;
  cachedAt?: string;

  // Franchise territory check — populated client-side after report generation
  franchiseTerritoryCheck?: FranchiseTerritoryCheck;

  // Score adjustment applied when franchise territory risk is detected
  franchiseScoreAdjustment?: {
    originalScore: number;
    adjustment: number;      // always negative
    finalScore: number;
    reason: string;
  };

  // Set when location confidence is low (demo mode heuristic)
  locationWarning?: string;

  // True when generated by the anonymous /api/preview endpoint.
  // Drives the "Create account" CTA banner in ReportDisplay.
  isPreview?: boolean;

  // Generation metadata — present on live Gemini reports, absent on mock
  generationMeta?: {
    model: string;
    isLiveGenerated: boolean;
    estimatedCostUsd: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    generatedAt: string;
  };
  // Cache freshness metadata — added by the server cache layer
  _cached?: boolean;
  _generatedAt?: string;
  _cacheAgeDays?: number;
  _freshnessDays?: number;
  _isStale?: boolean;
  _refreshedFromStale?: boolean;
}

export interface NearbyRegionData {
  name: string;
  demographics: string;
  competition: string;
  opportunity: string;
  details: string;
}

export interface RegionalIntelligenceData {
  isZipMode: boolean;
  targetLocation: string;
  nearbyRegions: NearbyRegionData[];
  countyContext: string;
  economicRadius: string;
  competitiveSpillover: string;
  expansionPotential: string;
  regionalRecommendation: string;
  specificObservationTitle: string;
  specificObservationText: string;

  // Cache metadata
  loadedFromCache?: boolean;
  cachedAt?: string;
}

export interface SavedReport extends ViabilityReport {
  id: string;
  dateSaved: string;
  isFavorite: boolean;
  reportType: 'standard' | 'regional';
}

export interface SavedMarketGapReport {
  id: string;
  dateSaved: string;
  isFavorite: boolean;
  location: string;
  reportData: OpportunityReport;
}

