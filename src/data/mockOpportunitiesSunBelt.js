/**
 * Mock opportunity data for Sun Belt / fast-growth city archetype.
 * Used for cities like Austin TX, Nashville TN, Denver CO, Miami FL,
 * Phoenix AZ, Charlotte NC, Dallas TX, Atlanta GA, Tampa FL.
 *
 * deepReplace will substitute "Austin, TX" and "Austin" with the user's city.
 */
export const mockOpportunitiesSunBelt = {
  location: "Austin, TX",
  summary: "Austin is in the middle of a decade-long growth surge driven by tech relocation, a strong food and entertainment culture, and a young professional demographic with significant disposable income. The fastest-moving opportunities are in services that reduce time friction for dual-income households, experiences that align with the city's outdoor-active-social identity, and health and wellness concepts that go beyond traditional gym models.",
  topOpportunities: [
    {
      businessType: "Mobile IV Hydration & Wellness Drip Service",
      description: "A nurse practitioner-staffed mobile wellness service delivering IV hydration, vitamin infusions, and NAD+ therapy directly to homes, hotel rooms, and corporate offices throughout Austin.",
      whyItsGood: "Austin's combination of tech workers logging long hours, a thriving nightlife and music festival scene, and a highly health-conscious young professional demographic creates year-round demand for rapid recovery and performance optimization services. No appointment required — clients book via app.",
      scores: {
        capEx: 2,
        overhead: 2,
        laborIntensity: 3,
        competitionLevel: 2,
        overallPotental: 91
      },
      financials: {
        estimatedStartupCost: "$28,000",
        targetMarket: "Health-conscious professionals, event attendees, and remote workers aged 25-45",
        potentialRevenue: "$130,000 - $220,000/year"
      },
      risks: [
        "Must be operated by or under the supervision of a licensed nurse practitioner or physician",
        "Liability insurance requirements are high — medical malpractice coverage is essential",
        "Seasonal peaks around ACL Fest, SXSW, and summer create demand spikes that require staffing flexibility"
      ],
      customerSegment: "Tech workers, festival-goers, athletes, and young professionals aged 25-42 earning $80k+ in Austin",
      bestNearbyArea: "South Congress / South Lamar corridor and the Domain area (North Austin tech campus zone)",
      executiveSummary: "Mobile IV hydration is one of Austin's fastest-growing wellness micro-categories, driven by the city's dual identity as a hard-working tech hub and a hard-playing entertainment destination. With startup costs under $30,000, the ability to operate from a single van, and a recurring client base that books monthly treatments, this business can achieve positive cash flow within 90 days. Austin's major events calendar — SXSW, ACL, Formula One — provides predictable demand spikes that justify seasonal staffing up.",
      marketDemand: {
        summary: "Demand is driven by Austin's active professional and entertainment culture, where rapid recovery and performance optimization services are viewed as a productivity investment, not a luxury.",
        drivers: [
          "Austin added 150,000+ new residents from 2019-2023, majority in the 25-40 age bracket with high disposable income and wellness-first spending priorities",
          "Major annual events (SXSW, ACL Fest, Formula One Grand Prix) draw hundreds of thousands of visitors who represent premium on-demand wellness customers",
          "Corporate wellness budgets at Austin's tech campuses (Apple, Tesla, Oracle, Dell) increasingly include wellness stipends that cover concierge health services"
        ],
        consumerTrends: [
          "Mobile health and wellness services grew 340% nationally from 2018-2023 with Sun Belt cities leading adoption",
          "Preventive health spending among millennials has overtaken reactive healthcare spending for the first time — wellness is now a budgeted line item, not emergency spend",
          "Corporate wellness integration is creating B2B channels: Austin-area tech companies are booking on-site IV days for employees as productivity and retention benefits"
        ],
        targetAudience: "Tech and creative professionals aged 25-42 in South Congress, Zilker, and the Domain corridor who actively spend on health optimization and view recovery services as a performance tool",
        localMarketConditions: "Austin's existing wellness market is dominated by traditional gyms and yoga studios, leaving the high-ticket, rapid-results concierge segment severely underserved. The city's festival infrastructure creates built-in B2C demand spikes with premium pricing tolerance."
      },
      demographicFit: {
        idealCustomer: "A 30-year-old software engineer at a Domain-area tech campus, earning $120,000+, who attends 2-3 Austin music events per year, works out 4x/week, and has already spent money on sauna memberships, red light therapy, or similar biohacking services",
        incomeConsiderations: "Austin's tech-driven median household income now exceeds $90,000 — the target demographic can absorb $150-$275 per IV session without price sensitivity. Corporate booking rates average $400-$600 per session at bulk rates.",
        ageGroups: "Primary: 24-38 (peak wellness adoption, SXSW/ACL attendance, tech salary range); Secondary: 38-52 (established executives with corporate wellness budgets and peak discretionary spending)",
        populationRelevance: "Austin's 78704, 78745, and 78758 ZIP codes collectively added 28,000 residents from 2020-2023 — among the highest growth concentrations in the entire US metro."
      },
      competitiveLandscape: {
        summary: "The mobile IV hydration market in Austin has 4-6 small operators, but none has established dominant brand presence, and corporate/event demand is largely unmet.",
        existingCompetitors: "Drip Hydration and a handful of local operators serve walk-in and app-based booking. None has locked in corporate wellness contracts or event partnerships at scale. Competition is fragmented and early-stage.",
        marketSaturation: "Low",
        competitiveAdvantages: [
          "Corporate wellness contract model creates predictable B2B revenue that single-session competitors cannot match",
          "Austin event calendar (SXSW, ACL, F1) enables pre-booked premium event packages at 2-3x standard session rates",
          "NP-operated model provides the medical credibility that differentiates from lower-cost aesthetician-run competitors",
          "Mobile-first model eliminates clinic overhead, enabling competitive pricing while maintaining healthy margins"
        ]
      },
      startupRequirements: {
        licensing: "Texas Board of Nursing NP license (required), controlled substance license if offering NAD+, General Business License, commercial auto insurance, medical malpractice insurance ($1M minimum), and FDA-compliant IV supply chain documentation",
        staffing: "Founder NP operates solo to start; hire 1 additional NP or RN at 15+ weekly bookings. Administrative support via booking platform (Jane App or similar) handles scheduling without additional staff.",
        equipment: "Medical-grade IV supplies and fluids ($4,000 initial stock), insulated mobile supply kit ($800), medical waste disposal contract ($200/mo), booking platform and website ($150/mo), cargo vehicle or SUV ($18,000-$22,000)",
        operationalComplexity: "Moderate"
      },
      startupCostRange: {
        low: "$18,000",
        expected: "$28,000",
        high: "$42,000"
      },
      revenueModel: {
        summary: "Per-session and package revenue from individual bookings, supplemented by corporate wellness contracts and event partnerships at premium rates.",
        monetizationMethods: [
          "Individual IV sessions: $150-$275 per treatment depending on formulation (hydration, immunity, energy, recovery)",
          "Monthly membership packages: $280-$420/month for 2 sessions + priority booking and member-only formulations",
          "Corporate and event packages: $400-$600/session for on-site wellness days at tech campuses or festival activations"
        ],
        scalabilityPotential: "High. A single NP can serve 4-5 sessions per day at $200 average = $200,000+ annually. Adding a second provider doubles capacity with near-zero additional overhead. The model franchises well across Sun Belt cities."
      },
      strategicRisks: [
        {
          category: "Regulatory",
          risk: "Texas regulatory changes to mobile medical services or IV hydration licensing requirements could require operational restructuring",
          mitigation: "Engage a Texas healthcare attorney pre-launch to ensure full compliance; join the Texas Medical Association to monitor regulatory changes early"
        },
        {
          category: "Execution",
          risk: "NP dependency — if the founding practitioner is unavailable, all revenue stops",
          mitigation: "Build a contractor NP pool of 2-3 trained practitioners from day one, even before full demand justifies it, to ensure schedule coverage and redundancy"
        },
        {
          category: "Market",
          risk: "Seasonal revenue dip in summer when Austin heat reduces outdoor activity and some residents travel",
          mitigation: "Partner with Domain-area gyms and yoga studios for summer referral programs; push corporate bookings in Q3 when wellness budget spending peaks"
        },
        {
          category: "Competitive",
          risk: "A funded national chain (Restore Hyper Wellness) could open Austin locations with strong brand recognition",
          mitigation: "Lock in corporate contracts and event partnerships before national chains scale into the market — relationship depth is harder to replicate than brand spend"
        }
      ],
      opportunityScorecard: {
        marketDemand: 88,
        competition: 84,
        startupComplexity: 80,
        revenuePotential: 82,
        scalability: 76,
        overallScore: 83
      },
      strategicRecommendation: {
        decision: "Proceed",
        rationale: "Low startup cost, a clear and growing addressable market, and Austin's unique combination of tech wealth and event culture make mobile IV hydration one of the highest risk-adjusted opportunities in this market. The corporate wellness channel provides predictable B2B revenue that individual booking models lack. Launch with a founding NP operator and 3 signed corporate accounts before opening to general consumer bookings."
      }
    },
    {
      businessType: "Ghost Kitchen & Virtual Restaurant Brand Operator",
      description: "A licensed commercial kitchen space running 2-3 distinct delivery-only restaurant brands simultaneously — each targeting a different cuisine and customer segment — optimizing the same kitchen staff and equipment for maximum revenue per square foot.",
      whyItsGood: "Austin's restaurant real estate costs have increased 40%+ since 2019, making traditional brick-and-mortar food concepts increasingly risky. Austin's DoorDash and Uber Eats delivery density is among the top 10 in the US, and the city's food-obsessed culture drives consistent delivery order volume across multiple cuisine categories.",
      scores: {
        capEx: 4,
        overhead: 5,
        laborIntensity: 5,
        competitionLevel: 3,
        overallPotental: 84
      },
      financials: {
        estimatedStartupCost: "$55,000",
        targetMarket: "Austin food delivery customers across multiple cuisine segments, 21-45",
        potentialRevenue: "$190,000 - $320,000/year (multi-brand combined)"
      },
      risks: [
        "Platform dependency on DoorDash and Uber Eats, which take 15-30% of each order",
        "Brand building without a physical storefront requires heavy digital marketing investment",
        "Managing multiple brands requires systematic kitchen operations and strong inventory control"
      ],
      customerSegment: "Austin delivery customers aged 22-42 ordering 3+ times per week, across Tex-Mex, Asian fusion, and health-focused cuisine segments",
      bestNearbyArea: "East Austin (78702) or South Congress corridor — highest per-capita delivery order density in the metro",
      executiveSummary: "Ghost kitchens allow an operator to serve Austin's massive food delivery market without the capital exposure of a traditional restaurant. By running multiple virtual brands from a single kitchen, each targeting a different craving and price point, revenue per square foot can exceed that of a traditional dine-in concept at significantly lower risk. Austin's tech-worker delivery culture and its position as one of the top 10 US cities for per-capita food delivery makes this model particularly well-suited to the market.",
      marketDemand: {
        summary: "Austin's food delivery market has grown 65% since 2020 and shows no signs of slowing — driven by the city's expanding tech worker base, long work hours, and a delivery-first dining culture among younger residents.",
        drivers: [
          "Austin added 40,000+ tech jobs from 2020-2023, creating a large cohort of high-income, time-pressed workers who order delivery 3-5x per week",
          "Rising restaurant costs and labor shortages have reduced sit-down dining options in several Austin neighborhoods, pushing more meals to delivery",
          "Austin's food culture drives high order frequency across multiple cuisines — consumers regularly order from 4-6 different restaurant categories per month"
        ],
        consumerTrends: [
          "Ghost kitchen delivery concepts now represent 12% of all restaurant orders in major US cities, up from 3% in 2019",
          "Virtual brand awareness is growing — Austin consumers increasingly seek out ghost kitchen concepts based on cuisine quality, not physical storefront presence",
          "Health-conscious delivery options are the fastest-growing sub-category, with plant-based and macro-balanced concepts growing 3x faster than traditional delivery"
        ],
        targetAudience: "Austin tech professionals aged 25-40 in East Austin, Mueller, and the Domain corridor who order food delivery 3+ times per week and actively explore new restaurant options on delivery apps",
        localMarketConditions: "Austin's ghost kitchen infrastructure has improved significantly — several licensed commercial kitchen rental spaces now operate near East Austin and South Congress, enabling market entry without a long-term lease commitment."
      },
      demographicFit: {
        idealCustomer: "A 29-year-old product manager at an Austin tech company, earning $110,000, who orders lunch delivery 4 days a week, gets dinner delivery 2-3 nights per week, and splits orders across Tex-Mex, Asian, and healthy bowl concepts",
        incomeConsiderations: "Austin's tech workforce median income supports average delivery order sizes of $28-$45, with minimal price sensitivity in the $15-$20 per item range. Premium and specialty concepts can push $18-$25 per item without abandonment.",
        ageGroups: "Primary: 22-38 (highest delivery frequency and platform app usage); Secondary: 38-50 (dual-income households with children, ordering family-size delivery 2-4x weekly)",
        populationRelevance: "East Austin's 78702 ZIP code has the highest delivery order density in the metro — an estimated 2,400 daily delivery transactions in a 1-mile radius according to delivery platform public data."
      },
      competitiveLandscape: {
        summary: "Ghost kitchen operators are an emerging category in Austin — fragmented competition from single-brand operators, but no multi-brand operator with a systematic approach to brand portfolio management.",
        existingCompetitors: "Kitchen United and CloudKitchens operate facilities in Austin but focus on established restaurant brands subletting kitchen space. Independent ghost kitchen operators in Austin are mostly single-brand. No operator runs a deliberate multi-brand portfolio optimized for cross-cuisine delivery volume.",
        marketSaturation: "Low",
        competitiveAdvantages: [
          "Multi-brand model generates 2-3x the revenue per kitchen hour versus single-brand ghost kitchen operators",
          "Algorithm optimization across multiple platforms increases total order visibility — each brand appears independently in DoorDash/Uber Eats search results",
          "Austin's delivery density means a kitchen in East Austin can serve 80% of the highest-order-frequency neighborhoods within a 4-mile radius",
          "Lower overhead than traditional restaurant enables sustainable pricing and faster response to menu testing and consumer feedback"
        ]
      },
      startupRequirements: {
        licensing: "Austin Food Manager Certification (required), City of Austin Food Service Establishment Permit, Texas Cottage Food Law compliance, General Business License; DBA filing for each virtual brand name",
        staffing: "2-3 kitchen staff at launch (1 lead cook + 1-2 prep/packaging staff); ghost kitchen facility typically provides dishwashing and sanitation; grow to 4-5 FTE at $15,000+/month revenue",
        equipment: "Commercial kitchen rental ($2,500-$4,500/month for a turnkey licensed space), small wares and packaging per brand ($3,000-$5,000), tablet POS for each delivery platform ($300), brand photography and app listing setup ($800-$1,500 per brand)",
        operationalComplexity: "Moderate"
      },
      startupCostRange: {
        low: "$35,000",
        expected: "$55,000",
        high: "$80,000"
      },
      revenueModel: {
        summary: "Revenue from delivery platform orders across 2-3 distinct virtual restaurant brands, optimized for different meal occasions and cuisine preferences.",
        monetizationMethods: [
          "Brand A (Tex-Mex bowls): $14-$18 average order item, targeting 30-40 daily orders at peak",
          "Brand B (Asian fusion wraps): $16-$22 average, targeting office lunch and evening delivery windows",
          "Brand C (macro-balanced meal prep boxes): $22-$32, targeting weekly subscription-style repeat ordering"
        ],
        scalabilityPotential: "High. Once the operational system is proven in Austin, the same brand and menu playbook can be licensed to ghost kitchen operators in other Texas cities (Dallas, Houston, San Antonio) with minimal incremental development cost."
      },
      strategicRisks: [
        {
          category: "Market",
          risk: "Delivery platform commission fees (15-30%) compress margins and platform algorithm changes can significantly reduce visibility overnight",
          mitigation: "Build a direct ordering channel (website + loyalty SMS) from day one; aim for 20% of orders direct within 12 months to reduce platform dependency"
        },
        {
          category: "Execution",
          risk: "Managing multiple brand menus, inventory, and quality standards simultaneously in a shared kitchen requires strong SOPs from day one",
          mitigation: "Launch with 2 brands, not 3; perfect the operational system and reach consistent 4.5-star platform ratings before adding a third brand"
        },
        {
          category: "Competitive",
          risk: "Established Austin restaurant brands launching their own ghost kitchen concepts could out-compete on brand recognition",
          mitigation: "Compete on niche specialization and speed of service — established brands are slower to adapt menus and fulfillment than a purpose-built virtual operator"
        },
        {
          category: "Regulatory",
          risk: "Austin's restaurant zoning and food service permit requirements may become more restrictive for ghost kitchen operations",
          mitigation: "Use an established licensed commercial kitchen facility that handles permitting compliance, rather than building out a proprietary space"
        }
      ],
      opportunityScorecard: {
        marketDemand: 84,
        competition: 78,
        startupComplexity: 68,
        revenuePotential: 76,
        scalability: 82,
        overallScore: 77
      },
      strategicRecommendation: {
        decision: "Proceed",
        rationale: "Austin's delivery density and food culture make it one of the best US cities for a systematic ghost kitchen operation. Start with 2 brands targeting different cuisine segments, reach 30+ daily orders per brand before launching a third, and build a direct order channel from month 1 to reduce platform fee exposure."
      }
    },
    {
      businessType: "Upscale Dog Boarding & Daycare with Live Webcams",
      description: "A premium dog daycare and overnight boarding facility offering structured group play, private suites with webcam access, enrichment activities, and daily report cards — targeting Austin's large and growing pet-owner demographic.",
      whyItsGood: "Austin consistently ranks among the top 5 US cities for pet ownership per household, and the city's long-hours tech culture creates daily demand for dog daycare. The existing supply of premium facilities is significantly below demand, evidenced by 3-6 week waitlists at top-rated Austin facilities.",
      scores: {
        capEx: 6,
        overhead: 6,
        laborIntensity: 6,
        competitionLevel: 4,
        overallPotental: 79
      },
      financials: {
        estimatedStartupCost: "$85,000",
        targetMarket: "Austin dog owners in dual-income tech households, aged 26-42",
        potentialRevenue: "$280,000 - $420,000/year"
      },
      risks: [
        "High upfront build-out costs for a facility meeting Texas Department of Agriculture kennel standards",
        "Liability exposure from dog-on-dog incidents requires comprehensive insurance",
        "Staff retention in pet care is challenging — turnover rates are high at the industry average wage"
      ],
      customerSegment: "Austin tech workers aged 26-40 with medium-to-large breed dogs who work 9-12 hour days and can't leave their dog home alone",
      bestNearbyArea: "South Lamar / Bouldin Creek area or Mueller neighborhood — highest dog ownership density relative to available daycare supply",
      executiveSummary: "Premium dog boarding in Austin is a high-margin, high-retention business driven by a simple demographic reality: Austin added hundreds of thousands of young professionals from 2019-2023, most of whom own dogs and work long hours. Existing premium facilities have chronic waitlists, and new supply has not kept pace with demand. The live webcam feature is not a gimmick — it's the single highest-impact conversion and retention tool in the premium pet care category, with 84% of surveyed Austin dog owners willing to pay more for webcam access.",
      marketDemand: {
        summary: "Austin's pet services market is structurally undersupplied relative to dog ownership density — driven by the city's young professional demographic, long work hours, and culture that treats pets as family members.",
        drivers: [
          "Austin has the highest dog ownership rate among major US cities relative to apartment and condo housing stock — creating structural demand for daycare beyond what home owners need",
          "Average Austin tech worker day exceeds 9 hours; dogs left home alone for this duration create welfare and behavioral issues that motivate owners to seek daycare",
          "Post-COVID work patterns have normalized daily dog daycare as a standard household expense for dual-income professional households"
        ],
        consumerTrends: [
          "Premium pet care spending in Austin grew 28% from 2021-2023, outpacing national pet spending growth by 2x",
          "Live webcam and daily report card features are now the primary decision factors for Austin premium dog daycare selection — ahead of price and location",
          "Monthly membership models for pet care grew 40% nationally in 2023, signaling consumer preference for predictable budgeting over per-day pricing"
        ],
        targetAudience: "Tech and creative professionals aged 26-40 in South Lamar, Bouldin Creek, Travis Heights, and Mueller who own medium-to-large breed dogs and work in hybrid or full-time office environments",
        localMarketConditions: "Austin's top-rated dog daycares (Camp Bow Wow, Austin Canine Country Club) have 2-4 week waitlists in high-demand ZIP codes. Google Trends shows 'dog daycare Austin' search volume up 180% since 2019 with no corresponding supply increase."
      },
      demographicFit: {
        idealCustomer: "A 33-year-old Austin tech employee with a Labrador Retriever, living in a 1-bedroom apartment in South Lamar, earning $105,000, who can afford $40-$65/day for premium daycare and values transparency and health monitoring for their dog",
        incomeConsiderations: "Austin target ZIP codes average household incomes of $85,000-$130,000, supporting full-day daycare at $45-$65/day without price resistance. Monthly membership pricing ($800-$1,100/month for unlimited daycare) is within 1% of monthly take-home pay at the median income.",
        ageGroups: "Primary: 26-38 (highest dog ownership and daycare usage rate, most likely to buy monthly memberships); Secondary: 38-50 (established household income, may have 2 dogs, highest revenue per account)",
        populationRelevance: "The 78704 ZIP code (South Lamar/Bouldin) alone has an estimated 8,400 dog-owning households — more than enough to fully book a 50-dog-capacity daycare facility with a waitlist within the first 6 months."
      },
      competitiveLandscape: {
        summary: "Premium dog daycare in Austin is supply-constrained with strong brand loyalty once established — facilities reaching capacity typically maintain 90%+ occupancy for years.",
        existingCompetitors: "Camp Bow Wow operates multiple Austin locations but uses a franchise model with standardized service and limited premium differentiation. Local independents like Austin Canine Country Club are fully booked with waitlists. The mid-market is crowded; the premium tech-forward segment (webcams, app-based report cards, premium suites) is underserved.",
        marketSaturation: "Moderate",
        competitiveAdvantages: [
          "Live webcam access — the single highest-rated feature in Austin's premium pet care survey data — differentiates immediately from franchise competitors",
          "South Lamar location targets the highest dog-owning demographic concentration in Austin with no direct premium competitor within 1.2 miles",
          "Monthly membership model builds predictable recurring revenue and achieves 85-90% retention after the first 3 months",
          "App-based daily report cards and health logging create a data layer that builds owner loyalty and justifies premium pricing"
        ]
      },
      startupRequirements: {
        licensing: "Texas Department of Agriculture Commercial Kennel License (required), City of Austin Business License, Certificate of Occupancy for commercial pet care facility, dog handler insurance ($2M minimum), zoning approval for commercial animal care",
        staffing: "Minimum 1 certified dog handler per 10 dogs (Texas regulation), plus 1 front desk/admin. Launch with 2 trained handlers + 1 manager; scale to 5-6 FTE at full 50-dog capacity",
        equipment: "Commercial facility build-out: indoor play areas with rubberized flooring ($18,000-$25,000), kenneling and suite areas ($12,000-$18,000), webcam system with app integration ($3,000-$5,000), sanitation and odor control systems ($4,000), dog-safe fencing and gates ($6,000-$8,000)",
        operationalComplexity: "High"
      },
      startupCostRange: {
        low: "$62,000",
        expected: "$85,000",
        high: "$130,000"
      },
      revenueModel: {
        summary: "Per-day and monthly membership revenue from daycare and boarding, supplemented by grooming add-ons and premium suite upgrades.",
        monetizationMethods: [
          "Day pass: $42-$65/day depending on dog size and duration; high-frequency customers convert to monthly memberships within 60 days",
          "Monthly unlimited daycare membership: $850-$1,100/month — the primary recurring revenue driver at 65-70% gross margin",
          "Overnight boarding with premium suite: $75-$120/night, highest margin service with strong holiday demand"
        ],
        scalabilityPotential: "Moderate. A 50-dog capacity facility at full utilization generates $350,000-$420,000 annually. A second location is viable by year 3. Grooming, training, and retail product add-ons can lift per-customer revenue by 20-30% without additional space."
      },
      strategicRisks: [
        {
          category: "Execution",
          risk: "A serious dog injury or illness on-site creates both financial liability and immediate reputational damage on Yelp and Google Reviews",
          mitigation: "Maintain rigorous health screening protocols, require current vaccination records for all dogs, and carry comprehensive liability insurance ($2M minimum); install full facility video recording for incident documentation"
        },
        {
          category: "Market",
          risk: "Austin's tech sector layoffs in 2022-2023 showed that corporate downsizing can reduce discretionary pet care spending quickly",
          mitigation: "Build a membership model with 30-day cancellation notice requirements; maintain a waitlist to fill cancellations immediately"
        },
        {
          category: "Regulatory",
          risk: "Texas kennel licensing and zoning requirements vary significantly by Austin city council district — permit approval timelines can delay opening by 3-6 months",
          mitigation: "Engage a commercial real estate attorney familiar with Austin's animal care zoning before signing any lease; select locations in C-1 or C-2 zoned corridors with existing animal care use history"
        },
        {
          category: "Competitive",
          risk: "A well-funded pet care chain (Dogtopia, Wag Hotels) could open a premium Austin location in the same target ZIP codes",
          mitigation: "Lock in the South Lamar location and build strong member loyalty through community events and referral programs before national chains identify and act on the same market gap"
        }
      ],
      opportunityScorecard: {
        marketDemand: 86,
        competition: 72,
        startupComplexity: 55,
        revenuePotential: 80,
        scalability: 65,
        overallScore: 73
      },
      strategicRecommendation: {
        decision: "Proceed with Caution",
        rationale: "Strong market fundamentals and chronic supply shortage make this a genuine opportunity, but the higher operational complexity and upfront capital requirement demand careful execution. Secure your location first, obtain zoning approval before signing, and build your waitlist to 30+ committed members before opening day. South Lamar is the right launch ZIP — do not compromise on location."
      }
    },
    {
      businessType: "Smart Home Technology Installation & Monthly Support",
      description: "A residential smart home integration service specializing in security cameras, smart locks, automated lighting, thermostat optimization, and home network buildouts — sold as a one-time installation plus an optional monthly monitoring and support subscription.",
      whyItsGood: "Austin's massive influx of tech-literate homeowners and renters from Silicon Valley, Seattle, and New York has created a customer base that wants smart home technology but lacks the time or desire to self-install. With Austin's new-construction boom adding thousands of smart-home-ready homes each year, installation demand is structurally growing.",
      scores: {
        capEx: 2,
        overhead: 2,
        laborIntensity: 3,
        competitionLevel: 2,
        overallPotental: 90
      },
      financials: {
        estimatedStartupCost: "$18,000",
        targetMarket: "Austin homeowners and renters aged 28-50 in new construction and remodeled properties",
        potentialRevenue: "$145,000 - $260,000/year"
      },
      risks: [
        "Technology compatibility issues between smart home ecosystems (Google, Apple HomeKit, Amazon Alexa) require ongoing technical training",
        "Residential access creates liability for property damage during installation",
        "Hardware markup margins are thinner when competing with Amazon and Best Buy on device prices"
      ],
      customerSegment: "Tech-literate homeowners aged 30-50 in Austin's new-construction communities and renovated central neighborhoods, earning $100k+",
      bestNearbyArea: "Circle C Ranch, Mueller, and Travis Heights — Austin's highest concentration of new construction and tech transplant homeowners",
      executiveSummary: "Smart home installation is the plumbing of the 2020s — every new Austin home expects it, but reliable professional installation remains hard to find. The recurring monthly support subscription converts a project-based business into a predictable SaaS-style recurring revenue model. Austin's technology-first homeowner demographic, combined with the city's sustained new-construction activity, creates a compounding demand engine that rewards early movers with a strong referral network.",
      marketDemand: {
        summary: "Austin's new-construction boom and tech transplant demographic create structural demand for professional smart home integration that DIY platforms like Best Buy's Geek Squad cannot match for complex multi-device installations.",
        drivers: [
          "Austin issued 42,000+ residential building permits from 2020-2023 — each new home is a potential first-time smart home installation customer",
          "Tech transplants from Silicon Valley and Seattle arrive with smart home expectations that exceed what Austin's existing cable and electrical installers can deliver",
          "Security anxiety in Austin's growing suburban neighborhoods drives demand for professional camera and smart lock installation over DIY setups"
        ],
        consumerTrends: [
          "Smart home device ownership in the US crossed 50% of households in 2023 — installation demand is now mainstream, not early-adopter",
          "Monthly home technology support subscriptions (a la ADT but for smart devices) are a new and rapidly growing revenue model with 35% annual retention improvement over project-only models",
          "Austin homeowners increasingly ask for smart home capability before signing buyer agreements — real estate agents now use smart home integration as a listing differentiator"
        ],
        targetAudience: "Homeowners and long-term renters aged 28-50 in Circle C Ranch, Mueller, Steiner Ranch, and West Lake Hills who own 3+ smart devices but haven't integrated them professionally and want a trusted provider for ongoing support",
        localMarketConditions: "Austin has no dominant local smart home integration brand with strong residential reviews — the category is served by national chains with poor local service reputations and solo electricians without smart device expertise."
      },
      demographicFit: {
        idealCustomer: "A 36-year-old data engineer who bought a new home in Mueller, earns $135,000, has a Nest thermostat, Ring doorbell, and 4 smart bulbs installed himself, but wants the full Lutron system, professional camera coverage, and a reliable person to call when his device ecosystems stop talking to each other",
        incomeConsiderations: "Austin's target new-construction ZIP codes have median household incomes of $100,000-$160,000, supporting one-time installation budgets of $1,500-$6,000 and monthly support contracts of $45-$95/month without price resistance.",
        ageGroups: "Primary: 28-45 (tech-literate, highest smart device ownership, peak new homebuyer age in Austin); Secondary: 50-65 (bought Austin homes before the price surge, now retrofitting for smart capability and security)",
        populationRelevance: "Circle C Ranch (78739) alone added 3,400 net new households from 2020-2023, each with median household incomes over $130,000 — a concentrated target market in a single ZIP code."
      },
      competitiveLandscape: {
        summary: "Austin's smart home installation market is served by national chains with poor local reputation, general electricians without smart device expertise, and solo freelancers with no support model.",
        existingCompetitors: "Best Buy's Total Tech offers installation but has poor Austin reviews for complex projects. Cox and AT&T offer basic smart home services but tied to their hardware ecosystems. Local electricians can install devices but don't build integrated systems. No branded local smart home specialist with strong reputation exists.",
        marketSaturation: "Low",
        competitiveAdvantages: [
          "Monthly support subscription creates recurring revenue and deep client relationships that project-only competitors cannot build",
          "Ecosystem-agnostic positioning (Google, Apple, Amazon) serves the widest possible customer base without hardware lock-in",
          "Austin real estate agent referral network provides a scalable lead channel — agents recommend installers to buyers at closing",
          "Branded fleet vehicle and professional uniforms differentiate from the 'random contractor' experience that frustrates Austin homeowners"
        ]
      },
      startupRequirements: {
        licensing: "Texas Electrical License (if running any new wiring) or partnership with licensed electrician, General Business License, commercial vehicle insurance, general liability insurance ($1M minimum); no special permits for software configuration and device mounting",
        staffing: "Founder operates solo initially; hire a second certified installer at 3+ jobs/week. Administrative support via booking and CRM software ($75/month).",
        equipment: "Professional installation toolkit ($2,500), cable management and mounting hardware ($800 initial), service vehicle branding ($600-$1,200), CRM and invoicing platform ($75/month), demo device kit for sales presentations ($2,000-$3,000)",
        operationalComplexity: "Low"
      },
      startupCostRange: {
        low: "$12,000",
        expected: "$18,000",
        high: "$30,000"
      },
      revenueModel: {
        summary: "Project revenue from new home installations and upgrades, converted to predictable MRR through monthly support and monitoring subscriptions.",
        monetizationMethods: [
          "Starter smart home installation package: $800-$1,500 (doorbell, thermostat, 2 locks, smart lighting in main rooms)",
          "Full home integration: $2,500-$6,000 (full camera coverage, automated lighting zones, security integration, network optimization)",
          "Monthly support subscription: $55-$95/month per household for remote monitoring, device health checks, and priority on-site support"
        ],
        scalabilityPotential: "High. At 50 monthly subscribers at $75/month = $45,000 ARR in recurring revenue before any project work. Adding one installer doubles installation capacity. The referral network compounds as Austin's new-construction market continues to grow."
      },
      strategicRisks: [
        {
          category: "Market",
          risk: "Smart home device manufacturers (Google, Apple, Amazon) could bundle free installation incentives with device purchases, undercutting paid installation demand",
          mitigation: "Compete on complexity and support, not simple device setup — position as the integration specialist for multi-device, multi-ecosystem homes that manufacturer bundles cannot match"
        },
        {
          category: "Execution",
          risk: "A single botched installation causing property damage could trigger costly liability claims and review damage",
          mitigation: "Carry $1M general liability insurance from day one; document every job with pre- and post-installation photos; use written scope agreements before starting any project"
        },
        {
          category: "Competitive",
          risk: "A well-funded smart home startup (Vivint, SimpliSafe Pro) could expand Austin residential market penetration",
          mitigation: "Lock in real estate agent referral relationships and recurring subscriber base before national brands ramp Austin sales activity"
        },
        {
          category: "Regulatory",
          risk: "Texas electrical code changes may require licensed electrician involvement in previously unlicensed installation tasks",
          mitigation: "Maintain a licensed electrician partnership from launch for any work that requires permit pulls, even if the day-to-day work does not currently require it"
        }
      ],
      opportunityScorecard: {
        marketDemand: 87,
        competition: 86,
        startupComplexity: 82,
        revenuePotential: 80,
        scalability: 80,
        overallScore: 84
      },
      strategicRecommendation: {
        decision: "Proceed",
        rationale: "Low startup cost, high recurring revenue potential through the support subscription model, and a clear market gap make this one of the strongest risk-adjusted opportunities in Austin's growing homeowner market. Build the real estate agent referral network in month 1 — it is the single highest-ROI customer acquisition channel and can generate consistent referral volume within 90 days."
      }
    },
    {
      businessType: "Outdoor Fitness Boot Camp & Recovery Studio",
      description: "A boutique fitness concept combining structured outdoor group training sessions (parkways, parks, and private greenspaces) with a small dedicated recovery studio offering cold plunge, sauna, and stretch therapy — the full performance cycle in one offering.",
      whyItsGood: "Austin's year-round outdoor weather, strong fitness culture, and a demographic deeply aligned with performance optimization creates the ideal conditions for an outdoor-first fitness concept. The recovery component differentiates from standard gym models and commands a meaningful price premium.",
      scores: {
        capEx: 4,
        overhead: 4,
        laborIntensity: 4,
        competitionLevel: 3,
        overallPotental: 83
      },
      financials: {
        estimatedStartupCost: "$48,000",
        targetMarket: "Austin fitness enthusiasts aged 25-45 seeking results-driven training in a community environment",
        potentialRevenue: "$160,000 - $280,000/year"
      },
      risks: [
        "Austin's August-September heat exceeds 100°F — outdoor training requires significant program adaptation and heat protocols",
        "Park permit requirements for commercial fitness activities vary by Austin Parks & Recreation district",
        "Instructor dependency — losing a key trainer can trigger member attrition"
      ],
      customerSegment: "Austin fitness-oriented professionals aged 25-45 looking for outdoor community training with built-in recovery, earning $75k+",
      bestNearbyArea: "Zilker Park adjacent (78746) or Brushy Creek area (78717) — highest concentrations of outdoor fitness consumers",
      executiveSummary: "Austin's outdoor lifestyle, young athletic demographic, and rapidly growing interest in recovery modalities (cold plunge, sauna) make an outdoor training plus recovery studio one of the most differentiated fitness concepts possible in this market. By pairing outdoor group training sessions with a small dedicated recovery suite, this business serves the complete performance cycle — which no standard gym or boutique studio in Austin currently delivers in one location. Monthly membership pricing and the viral community effect of outdoor group training create a self-sustaining growth engine.",
      marketDemand: {
        summary: "Austin's fitness market is large and growing, but the boutique differentiation opportunity lies in the recovery segment — where consumer demand has outpaced supply by the widest margin of any wellness category in 2023.",
        drivers: [
          "Austin's year-round fitness outdoor culture creates 10+ months of viable outdoor training weather, enabling a sustainable outdoor-first business model without weather dependency",
          "Recovery modalities (cold plunge, sauna, compression) are the fastest-growing fitness sub-category in Austin — Restore Hyper Wellness and other recovery brands have waitlists at their Austin locations",
          "Community fitness formats drive 3x higher retention rates than solo gym memberships, creating a defensible recurring revenue base once critical membership mass is reached"
        ],
        consumerTrends: [
          "Outdoor group fitness participation increased 180% in Austin from 2020-2023 as COVID-shifted behavior normalized outdoor exercise as a social activity",
          "Recovery studio memberships in Austin sell out consistently — there are fewer than 12 dedicated recovery facilities for a city of 1M+ residents",
          "Fitness consumers increasingly seek 'compound value' from their gym spend — training, community, and recovery in one membership rather than three separate subscriptions"
        ],
        targetAudience: "Performance-oriented Austin professionals aged 26-42 who currently hold 2+ fitness memberships (gym + yoga, or gym + recovery) and are looking for a single concept that consolidates their routine",
        localMarketConditions: "Zilker Park and its surrounding greenspace is Austin's most active outdoor fitness corridor — morning and evening training groups operate daily, confirming demand. Dedicated recovery facilities near this corridor are absent despite clear consumer demand."
      },
      demographicFit: {
        idealCustomer: "A 31-year-old Austin resident in the fitness industry or a tech-sector professional who attends CrossFit 4x/week, does cold plunge monthly at a spa, and has been looking for an outdoor-first community that combines both disciplines at a reasonable monthly cost",
        incomeConsiderations: "Austin target ZIP codes support $180-$250/month fitness memberships without friction — the combined training + recovery offering justifies premium pricing compared to any single-modality gym. The demographic's spending on wellness makes this a budgeted line item.",
        ageGroups: "Primary: 24-38 (peak Austin fitness participation, highest outdoor activity rates, strongest community-driven fitness behavior); Secondary: 38-52 (established income, prioritizing long-term joint health and recovery — the recovery component is the primary draw for this group)",
        populationRelevance: "The 78704, 78746, and 78703 ZIP codes combined have an estimated 65,000 fitness-active adults within 3 miles of Zilker Park — more than enough to build a 150-member recurring revenue base in year one."
      },
      competitiveLandscape: {
        summary: "Austin's boutique fitness market is competitive but not saturated for the outdoor-plus-recovery combined format — no direct competitor currently occupies this positioning.",
        existingCompetitors: "Bootcamp and outdoor fitness operators (F45, Burn Boot Camp) exist in Austin but without a dedicated recovery component. Restore Hyper Wellness has recovery-only locations with waitlists. CrossFit boxes are indoor-only and do not incorporate outdoor training. No concept combines structured outdoor group training with recovery in a single membership.",
        marketSaturation: "Low",
        competitiveAdvantages: [
          "Combined outdoor training + recovery concept is unoccupied in Austin — no direct competitor serves the full performance cycle",
          "Outdoor training has near-zero facility overhead versus indoor boutique studios requiring significant commercial lease investment",
          "Community-first format generates organic social media content and referral volume that no paid advertising can match at equivalent cost",
          "Recovery suite serves members on non-training days, increasing visit frequency and member value beyond the training sessions alone"
        ]
      },
      startupRequirements: {
        licensing: "City of Austin Park Commercial Use Permit (required for group fitness in public parks), Texas personal trainer certification for all instructors (NASM or ACE), General Business License, facility occupancy permit for recovery studio space, liability insurance ($2M minimum), and food handler certification if offering post-workout nutrition products",
        staffing: "Founder as head coach (lead training sessions) + 1 certified assistant trainer at launch. Recovery studio operates with 1 attendant during peak hours. Grow to 3-4 trainers at 100+ active members.",
        equipment: "Cold plunge unit ($4,500-$7,500), infrared sauna (1-2 person, $3,000-$5,500), stretch therapy table and equipment ($1,200), training equipment for outdoor sessions (resistance bands, TRX, cones, $2,000-$3,000), small retail space build-out for recovery studio ($8,000-$14,000)",
        operationalComplexity: "Moderate"
      },
      startupCostRange: {
        low: "$30,000",
        expected: "$48,000",
        high: "$75,000"
      },
      revenueModel: {
        summary: "Monthly membership revenue from training + recovery access, supplemented by drop-in rates, personal training packages, and corporate wellness contracts.",
        monetizationMethods: [
          "All-inclusive membership: $185-$245/month for unlimited outdoor training sessions + 8 recovery sessions per month",
          "Training-only membership: $130-$165/month for group outdoor training sessions (no recovery access)",
          "Corporate wellness contract: $150-$250/employee/month for dedicated monthly boot camp sessions and group recovery experiences at corporate campuses"
        ],
        scalabilityPotential: "Moderate. A 120-member base generates $22,000-$28,000 MRR. A second outdoor location (North Austin or East Austin) is viable by year 2 without facility build-out costs. Recovery studio services can be expanded with additional modalities (compression, red light) to increase per-visit revenue."
      },
      strategicRisks: [
        {
          category: "Market",
          risk: "Austin's extreme summer heat (100°F+ from July-September) significantly reduces outdoor training attendance and may require suspension of outdoor sessions",
          mitigation: "Design Q3 programming with early morning (6am) and evening (7pm) sessions only; partner with an indoor facility for summer months as a temporary alternate venue for members"
        },
        {
          category: "Execution",
          risk: "If the founding coach leaves or becomes unavailable, the community identity — which is built around the trainer relationship — may not survive the transition",
          mitigation: "Build brand identity around the concept and community from day one, not the founder's personal brand; co-coach with a second trainer from the first month to establish dual identity"
        },
        {
          category: "Regulatory",
          risk: "Austin Parks & Recreation commercial permit requirements and fees for outdoor fitness operations may increase",
          mitigation: "Identify 2-3 viable private outdoor training locations (apartment complex greenspaces, church parking lots) as permitted park permit alternatives"
        },
        {
          category: "Competitive",
          risk: "An established Austin gym (Gold's, LA Fitness) could add outdoor programming and recovery suites as member retention features",
          mitigation: "Community depth and the boutique experience are defensible — large gyms cannot replicate small-group outdoor training culture regardless of facility investment"
        }
      ],
      opportunityScorecard: {
        marketDemand: 85,
        competition: 78,
        startupComplexity: 65,
        revenuePotential: 74,
        scalability: 72,
        overallScore: 76
      },
      strategicRecommendation: {
        decision: "Proceed",
        rationale: "The outdoor training plus recovery combination is an unoccupied position in Austin's fitness market that aligns directly with the city's dominant consumer culture. Moderate startup cost, strong community-driven retention once critical mass is reached, and a corporate wellness channel for B2B revenue make this a well-rounded opportunity. Launch near Zilker Park with a founding cohort of 25 committed members before opening general enrollment."
      }
    }
  ],
  methodology: "Simulated market gap analysis calibrated to Sun Belt / fast-growth city demographic and economic indicators. Opportunity selection reflects industries, workforce characteristics, and lifestyle patterns common to tech-hub Sun Belt metros. Live reports use real-time Google Search grounding and Gemini AI synthesis.",
  groundingSources: [
    { title: "US Census Bureau", uri: "https://www.census.gov" },
    { title: "Austin Chamber of Commerce", uri: "https://www.austinchamber.com" },
    { title: "Google Maps", uri: "https://maps.google.com" }
  ]
};

export default mockOpportunitiesSunBelt;
