export const mockOpportunities = {
  location: "Brooklyn, NY",
  summary: "Brooklyn is experiencing strong growth in eco-conscious food service and mobile pet care services. High densities of affluent young families and remote tech workers have created immediate opportunities in services prioritizing convenience, sustainability, and specialty quality, with low-to-medium startup requirements.",
  topOpportunities: [
    {
      businessType: "Mobile Eco-Friendly Pet Grooming",
      description: "A fully electric premium mobile pet grooming service that arrives directly at customers' homes. Provides custom baths, haircuts, and tooth cleaning using botanical, organic shampoos.",
      whyItsGood: "High density of pet owners who lack cars or find travel to traditional salons stressful. High focus on organic materials matches local preferences.",
      scores: {
        capEx: 3,
        overhead: 2,
        laborIntensity: 4,
        competitionLevel: 2,
        overallPotental: 92
      },
      financials: {
        estimatedStartupCost: "$35,000",
        targetMarket: "Pet owners with high-income and limited leisure time",
        potentialRevenue: "$120,000 - $180,000/year"
      },
      risks: [
        "Seasonal demand fluctuations during winter months",
        "Vehicle maintenance and fuel cost volatility",
        "Certification and groomer licensing requirements"
      ],
      customerSegment: "Urban pet owners aged 28–45 with household income $80k+, no access to personal vehicle",
      bestNearbyArea: "Park Slope, Brooklyn (11215)"
    },
    {
      businessType: "Micro-Neighborhood Zero-Waste Market",
      description: "A small-footprint retail store selling bulk foods, cleaning liquids, and personal care products where customers bring their own reusable containers to eliminate packaging waste.",
      whyItsGood: "Strong grassroots community alignment. High population density allows high walk-in volume in small commercial sections.",
      scores: {
        capEx: 4,
        overhead: 5,
        laborIntensity: 3,
        competitionLevel: 3,
        overallPotental: 84
      },
      financials: {
        estimatedStartupCost: "$55,000",
        targetMarket: "Sustainability-focused young professionals and families",
        potentialRevenue: "$210,000 - $290,000/year"
      },
      risks: [
        "High initial inventory and dispensing equipment setup",
        "Customer behavior change curve — reusable container habit adoption",
        "Strict health code compliance for open-container bulk sales"
      ],
      customerSegment: "Eco-conscious millennials and Gen Z professionals aged 22–40 in dense urban neighborhoods",
      bestNearbyArea: "Williamsburg, Brooklyn (11211)"
    },
    {
      businessType: "Local Specialty Vertical Farm & Herb Delivery",
      description: "Smart indoor micro-farms using vertical hydroponic setups to grow fresh basil, microgreens, and exotic culinary herbs. Delivers direct-to-restaurants and community subscribers in under 4 hours from harvest.",
      whyItsGood: "Brooklyn restaurants pay highly for extreme freshness and consistent quality. Can be launched in low-rent accessory spaces or garages.",
      scores: {
        capEx: 2,
        overhead: 2,
        laborIntensity: 2,
        competitionLevel: 3,
        overallPotental: 89
      },
      financials: {
        estimatedStartupCost: "$15,000",
        targetMarket: "High-end farm-to-table restaurants and organic foodies",
        potentialRevenue: "$85,000 - $140,000/year"
      },
      risks: [
        "Learning curve for hydroponic nutrient and pH management",
        "Restaurant contract dependency — revenue is B2B concentrated",
        "Equipment failure or power disruption can kill full crop cycles"
      ],
      customerSegment: "Farm-to-table restaurant buyers and weekly subscription CSA households in a 3-mile radius",
      bestNearbyArea: "Bushwick, Brooklyn (11237)"
    },
    {
      businessType: "Remote Worker Co-Living Concierge Service",
      description: "A subscription-based concierge service pairing remote tech workers with premium shared living arrangements, high-speed internet setups, and professional event networking in Brooklyn's growing live-work neighborhoods.",
      whyItsGood: "Large influx of transplant tech workers seeking community and professional networks. Brooklyn's co-working density creates strong partnership channels with existing spaces.",
      scores: {
        capEx: 2,
        overhead: 3,
        laborIntensity: 3,
        competitionLevel: 2,
        overallPotental: 87
      },
      financials: {
        estimatedStartupCost: "$12,000",
        targetMarket: "Remote workers aged 25–38 relocating to Brooklyn from other cities",
        potentialRevenue: "$95,000 - $160,000/year"
      },
      risks: [
        "High tenant turnover risk with short-term living arrangements",
        "Short-term rental regulation changes from NYC housing authority",
        "Business model heavily dependent on sustained remote work trends"
      ],
      customerSegment: "Tech industry remote workers earning $90k–$140k, recently relocated or planning to relocate to NYC metro",
      bestNearbyArea: "DUMBO / Cobble Hill, Brooklyn (11201)"
    },
    {
      businessType: "AI-Powered Children's Tutoring & Enrichment Studio",
      description: "Boutique neighborhood learning center combining one-on-one tutoring with AI-enhanced adaptive curriculum tools for elementary and middle school students. Offers STEM enrichment, creative writing, and critical thinking programs.",
      whyItsGood: "Brooklyn's high density of young families with school-age children and strong parental investment in education creates massive demand for premium learning supplementation beyond public school curricula.",
      scores: {
        capEx: 3,
        overhead: 4,
        laborIntensity: 5,
        competitionLevel: 4,
        overallPotental: 82
      },
      financials: {
        estimatedStartupCost: "$42,000",
        targetMarket: "Parents of school-age children (K–8) in mid-to-high income brackets",
        potentialRevenue: "$175,000 - $240,000/year"
      },
      risks: [
        "Certification and background check compliance for all staff",
        "Seasonal enrollment gaps — summer and holiday period slowdowns",
        "Dependence on retaining qualified, certified tutors in a competitive hiring market"
      ],
      customerSegment: "Parents aged 32–50 with children aged 6–14 in brownstone Brooklyn neighborhoods with $120k+ household income",
      bestNearbyArea: "Brooklyn Heights / Carroll Gardens (11201 / 11231)"
    }
  ],
  methodology: "Simulated market gap analysis using local demographic datasets and county-level small business registration statistics.",
  groundingSources: [
    { title: "NY Small Business Growth Council Data", uri: "https://www.ny.gov" },
    { title: "Sustainable Living Market Survey Core Findings", uri: "https://www.sustain.org" },
    { title: "Google Local Search Volume Analytics", uri: "https://google.com" }
  ]
};

export default mockOpportunities;
