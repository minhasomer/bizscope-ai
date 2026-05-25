
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

export interface FinancialProjections {
  summary: string;
  startupCostRange: string;
  startupCostBreakdown: string;
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

export interface BusinessOpportunity {
  businessType: string;
  description: string;
  whyItsGood: string;
  scores: {
    capEx: number; // 1-10 (1 is low, 10 is high)
    overhead: number; // 1-10
    laborIntensity: number; // 1-10
    competitionLevel: number; // 1-10 (1 is low competition)
    overallPotental: number; // 0-100
  };
  financials: {
    estimatedStartupCost: string;
    targetMarket: string;
    potentialRevenue: string;
  };
  risks?: string[];
  customerSegment?: string;
  bestNearbyArea?: string;
}

export interface OpportunityReport {
  location: string;
  summary: string;
  topOpportunities: BusinessOpportunity[];
  methodology: string;
  groundingSources: GroundingSource[];
}

export interface ViabilityReport {
  businessType: string;
  location: string;
  targetCoordinates?: { latitude: number; longitude: number };

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
    decision: 'Recommended' | 'Caution Advised' | 'Not Recommended';
    reasoning: string;
  };
  
  methodology: string;
  
  groundingSources: GroundingSource[];

  // Optional live regional intelligence
  regionalIntelligence?: RegionalIntelligenceData;

  // Cache metadata
  loadedFromCache?: boolean;
  cachedAt?: string;
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

