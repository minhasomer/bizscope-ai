export const mockRegionalReport = {
  businessType: "Boutique Fitness Studio",
  location: "Orange County, CA",
  targetCoordinates: { latitude: 33.7175, longitude: -117.8311 },
  viabilityScore: 58,
  scoreBreakdown: {
    marketDemand: 65,
    competitionIntensity: 80,
    financialFeasibility: 55,
    riskLevel: 45
  },
  executiveSummary: "A boutique fitness studio in Orange County, CA, has moderate viability. While regional health consciousness is among the highest in the country and households have ample disposable income, the competitive landscape is extremely crowded with premium franchise gyms, Pilates clubs, and private cross-training venues. Strategic differentiation is strictly necessary to succeed here, focusing on highly customized small-group classes or proprietary software tracking.",
  financialProjections: {
    summary: "Moderate capability with tight early cashflows. High marketing budgets will be required to acquire and retain members.",
    startupCostRange: "$160,000 - $240,000",
    startupCostBreakdown: "Commercial lease & design buildout ($95k), specialized Pilates/Pilates Reformer or spin equipment ($60k), branding & local ads campaigns ($25k), emergency cash reserve ($40k).",
    revenueYear1: "$280,000",
    revenueYear3: "$390,000",
    breakEvenTime: "20 months",
    roiTime: "3.8 years",
    profitMargin: "12.0%",
    scalability: "Low",
    keyStats: [
      { label: "Monthly Membership Fee", value: "$165" },
      { label: "Active Members Target", value: "140" },
      { label: "Cost of Acquisition", value: "$110/user" },
      { label: "Monthly Rent & Recs", value: "$9,200" }
    ]
  },
  competitionAnalysis: {
    summary: "Highly saturated premium regional fitness market. Several major boutique franchises operate multiple locations within a 3-mile radius.",
    competitors: [
      {
        name: "Equinox Sports Club",
        details: "Ultra-luxury full facility including gym, spa, pools, classes. High monthly fee, powerful brand loyalty.",
        address: "1980 Main St, Irvine, CA",
        latitude: 33.6826,
        longitude: -117.8541
      },
      {
        name: "OrangeTheory Fitness",
        details: "High-intensity interval training classes. High tech integration, loyal recurring membership base, strong brand marketing.",
        address: "2648 Dupont Dr, Irvine, CA",
        latitude: 33.6781,
        longitude: -117.8465
      },
      {
        name: "Club Pilates",
        details: "Stretched reformer pilates classes. Well-known and popular class format, heavily populated by young professionals.",
        address: "15435 Jeffrey Rd, Irvine, CA",
        latitude: 33.6851,
        longitude: -117.7812
      }
    ]
  },
  marketTrends: {
    summary: "Shift from big-box gym subscriptions towards specialized, hyper-focused community boutique workouts.",
    trends: [
      {
        trend: "Wearable Tech Synchronized Workouts",
        impact: "Requires installation of smart screens and tracker integration to display workout analytics real-time."
      },
      {
        trend: "Hybrid In-Person & Digital Streams",
        impact: "Customers expect virtual access option alongside in-person classes, creating extra digital setup costs."
      },
      {
        trend: "Holistic Wellness Subscriptions",
        impact: "Value addition via wellness counseling, cold plunge access, or juice bar memberships can raise average ticket prices by 40%."
      }
    ]
  },
  demographicInsights: {
    summary: "Large regional population with premium income brackets, though with high living and operational costs.",
    demographics: [
      {
        metric: "County Population (OC)",
        value: "3,185,000",
        insight: "Immense consumer reach and robust target pool for health & fitness services."
      },
      {
        metric: "Median Household Income",
        value: "$127,800",
        insight: "Highly affluent customer base capable of self-funding wellness and boutique gym memberships."
      },
      {
        metric: "Health/Wellness Spending Index",
        value: "158 (US Base 100)",
        insight: "58% higher spending on active life and gym memberships compared to national averages."
      }
    ]
  },
  riskAssessment: {
    summary: "Substantial operational and financial risks mostly revolving around customer acquisition costs and intense brand competition.",
    risks: [
      {
        risk: "Intense Competition & Saturation",
        impact: "High member churn and high customer acquisition costs.",
        severity: "High",
        mitigation: "Develop a proprietary exercise methodology or unique studio atmosphere to defend your niche."
      },
      {
        risk: "High Rent & Lease Lock-in",
        impact: "Inability to maintain positive cashflow if membership lags.",
        severity: "High",
        mitigation: "Negotiate a dynamic tier lease base or start with a sub-leased space to validate the concept."
      },
      {
        risk: "Key Personnel (Trainers) Leaving",
        impact: "Sudden loss of customer base drawn to specific charismatic instructors.",
        severity: "Medium",
        mitigation: "Maintain a clear employment contract and incentivize loyalty via class performance bonuses."
      }
    ]
  },
  successFactors: {
    summary: "Success is dependent on visual brand prestige, strong local PR, and a strong trainer compensation structure.",
    factors: [
      {
        factor: "Trainer Quality & Charisma",
        description: "Instructors who form genuine personal connections are major retention drivers.",
        importance: "Critical"
      },
      {
        factor: "Pre-Opening Membership Sales",
        description: "Securing 80+ members BEFORE the doors open is key to survivability in Year 1.",
        importance: "High"
      },
      {
        factor: "Impeccable Modern Interior",
        description: "Providing premium toiletries, lighting, and locker facilities acts as an elite differentiator.",
        importance: "Medium"
      }
    ]
  },
  recommendation: {
    decision: "Caution Advised",
    reasoning: "While the demographic spends highly on fitness, high costs of entry and heavy competition mean a high rate of failure without a bulletproof unique selling proposition (USP)."
  },
  methodology: "Simulated Orange County regional intelligence model using US Federal Bureau of Labor statistics and County-level economic datasets.",
  groundingSources: [
    { title: "BLS Occupational Outlook - Fitness Instructors CA", uri: "https://www.bls.gov" },
    { title: "CA Department of Finance Demographics", uri: "https://dof.ca.gov" },
    { title: "International Health & Racquet Association (IHRSA) Statistics", uri: "https://www.ihrsa.org" }
  ]
};

export default mockRegionalReport;
