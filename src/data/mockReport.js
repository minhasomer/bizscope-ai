export const mockReport = {
  businessType: "Artisanal Coffee Shop",
  location: "Brooklyn, NY",
  targetCoordinates: { latitude: 40.6782, longitude: -73.9442 },
  viabilityScore: 82,
  scoreBreakdown: {
    marketDemand: 88,
    competitionIntensity: 45,
    financialFeasibility: 78,
    riskLevel: 30
  },
  executiveSummary: "The proposed artisanal coffee shop in Brooklyn shows exceptional promise due to highly favorable demographic trends, robust local foot traffic, and a strong culture of supporting independent boutique businesses. While competition is moderately active in the micro-neighborhood, the high median household income and density of remote-working professionals create an underserved niche for premium specialty brewing Experiences, distinct from large chains.",
  financialProjections: {
    summary: "Solid financial outlook with steady margins. High initial traffic will drive rapid awareness, and returning customers will stabilize revenue.",
    startupCostRange: "$120,000 - $185,000",
    startupCostBreakdown: "Lease deposit ($18k), commercial espresso equipment & build-out ($75k), initial inventory & licenses ($22k), working capital & marketing ($35k).",
    revenueYear1: "$340,000",
    revenueYear3: "$495,000",
    breakEvenTime: "14 months",
    roiTime: "2.5 years",
    profitMargin: "18.5%",
    scalability: "Medium",
    keyStats: [
      { label: "Avg Ticket Size", value: "$6.85" },
      { label: "Daily Transactions", value: "180" },
      { label: "Cost of Goods Sold", value: "24%" },
      { label: "Monthly Operating Cost", value: "$16,500" }
    ]
  },
  competitionAnalysis: {
    summary: "Active local competitive landscape but with clear white spaces. Local customers actively seek non-chain alternatives. There are three primary competitors within a 1-mile radius, but none offer premium pour-overs or local artisanal pastries.",
    competitors: [
      {
        name: "Brew & Co.",
        details: "Established local shop with loyal patio crowd. Offers basic drip and lattes. High seating capacity but slower service.",
        address: "592 Atlantic Ave, Brooklyn, NY",
        latitude: 40.6835,
        longitude: -73.9754
      },
      {
        name: "Starbucks",
        details: "National chain offering standardized products. High foot traffic but lack of local artisanal appeal.",
        address: "411 Flatbush Ave, Brooklyn, NY",
        latitude: 40.6798,
        longitude: -73.9734
      },
      {
        name: "The Grind Coffee House",
        details: "Cozy quiet spot catering heavily to remote students. Limited pastry menu and no specialty espresso options.",
        address: "1024 Bedford Ave, Brooklyn, NY",
        latitude: 40.6872,
        longitude: -73.9555
      }
    ]
  },
  marketTrends: {
    summary: "Shift toward single-origin organic coffee beans and social community hubs post-work-from-home revolution.",
    trends: [
      {
        trend: "Single-Origin Specialty Craze",
        impact: "Premium pricing power, allowing average bean markup of 400% with high margin on drip variants."
      },
      {
        trend: "The Remote Workspace Hub",
        impact: "Extended dwell time boosts high-margin snack purchases, though requires robust Wi-Fi and power outlet plans."
      },
      {
        trend: "Sustainable Practices Demand",
        impact: "Eco-friendly cups and fair-trade sourcing are crucial; increases customer loyalty by up to 35% among Gen-Z."
      }
    ]
  },
  demographicInsights: {
    summary: "Densely populated urban center with high concentration of disposable income and young professionals.",
    demographics: [
      {
        metric: "Total Population (1-mi)",
        value: "92,450",
        insight: "Highly dense neighborhood providing dependable base of walk-in traffic."
      },
      {
        metric: "Median Household Income",
        value: "$114,200",
        insight: "Substantially above the national average, ensuring strong price tolerance for artisanal beans."
      },
      {
        metric: "Age Distribution (20-44)",
        value: "54%",
        insight: "Prime demographic group that allocates significant monthly spend to dining and specialty coffee."
      }
    ]
  },
  riskAssessment: {
    summary: "Managed risks mostly centered around high rental costs and staff retention in competitive markets.",
    risks: [
      {
        risk: "Rising Lease & Real Estate Costs",
        impact: "Higher monthly overhead and break-even targets.",
        severity: "High",
        mitigation: "Secure a 5+5 year long-term lease contract with locked-in incremental rent caps."
      },
      {
        risk: "High Staff Turnover Rates",
        impact: "Inconsistent service quality and high training costs.",
        severity: "Medium",
        mitigation: "Implement a profit-sharing incentive model and provide competitive hourly wages."
      },
      {
        risk: "Seasonal Drop in Cold Months",
        impact: "Lower walk-in traffic in heavy winter.",
        severity: "Low",
        mitigation: "Launch a loyalty membership subscription and expand heated delivery/takeout channels."
      }
    ]
  },
  successFactors: {
    summary: "Execution excellence on interior visual identity and customer experience form the cornerstone of profitability.",
    factors: [
      {
        factor: "Micro-Location Selection",
        description: "Securing a corner plot near transit lines or office clusters is vital for high impulse traffic.",
        importance: "Critical"
      },
      {
        factor: "Aesthetic Appeal & Design",
        description: "Creating an Instagram-worthy cozy environment that acts as a neighborhood focal point.",
        importance: "High"
      },
      {
        factor: "Consistent Specialty Quality",
        description: "Training baristas to global SCA standards to justify premium pricing over standard chains.",
        importance: "High"
      }
    ]
  },
  recommendation: {
    decision: "Recommended",
    reasoning: "The data shows high consumer appetite, strong financial viability, and a clear path to high returns (2.5 years ROI), making this an excellent startup option in this specific location despite prime rent costs."
  },
  methodology: "This is a sample report using industry-average benchmarks and illustrative data. Live reports are generated using real-time Google Maps competitor data, US Census demographics, and Gemini AI synthesis.",
  groundingSources: [
    { title: "US Census Bureau", uri: "https://www.census.gov" },
    { title: "National Coffee Association", uri: "https://www.ncausa.org" },
    { title: "Google Maps", uri: "https://maps.google.com" }
  ]
};

export default mockReport;
