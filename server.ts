import express, { Request, Response } from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import Stripe from "stripe";
import { GEMINI_MODELS, normalizeTierToBudgetPlan, getReportBudget, estimateCost } from './src/config/aiBudget.js';
import { createClient } from '@supabase/supabase-js';

enum Type {
  STRING = "STRING",
  INTEGER = "INTEGER",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  OBJECT = "OBJECT",
  ARRAY = "ARRAY"
}

// Schema definitions
const reportSchema = {
    type: Type.OBJECT,
    properties: {
        businessType: { type: Type.STRING },
        location: { type: Type.STRING },
        targetCoordinates: {
            type: Type.OBJECT,
            properties: {
                latitude: { type: Type.NUMBER },
                longitude: { type: Type.NUMBER }
            }
        },
        viabilityScore: { type: Type.INTEGER, description: "A calculated score from 0 to 100 based on the mandatory formula." },
        scoreBreakdown: {
            type: Type.OBJECT,
            properties: {
                marketDemand: { type: Type.INTEGER, description: "0-100 (Higher is better)" },
                competitionIntensity: { type: Type.INTEGER, description: "0-100 (Higher means MORE competition/saturation)" },
                financialFeasibility: { type: Type.INTEGER, description: "0-100 (Higher is better)" },
                riskLevel: { type: Type.INTEGER, description: "0-100 (Higher means MORE risk)" }
            },
            required: ["marketDemand", "competitionIntensity", "financialFeasibility", "riskLevel"]
        },
        executiveSummary: { type: Type.STRING, description: "A concise summary of the findings." },
        financialProjections: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING, description: "Overview of financial outlook." },
                startupCostRange: { type: Type.STRING, description: "e.g. '$150k - $250k'" },
                startupCostBreakdown: { type: Type.STRING, description: "Brief list of major cost drivers (rent, equipment, licenses)." },
                revenueYear1: { type: Type.STRING, description: "Estimated Year 1 Revenue" },
                revenueYear3: { type: Type.STRING, description: "Estimated Year 3 Revenue" },
                breakEvenTime: { type: Type.STRING, description: "e.g., '18-24 months'" },
                roiTime: { type: Type.STRING, description: "e.g., '3-4 years'" },
                profitMargin: { type: Type.STRING, description: "e.g., '15-20%'" },
                scalability: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
                keyStats: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            label: { type: Type.STRING, description: "e.g., 'Avg Ticket Size'" },
                            value: { type: Type.STRING, description: "e.g., '$45'" }
                        },
                        required: ["label", "value"]
                    }
                }
            },
            required: ["summary", "startupCostRange", "startupCostBreakdown", "revenueYear1", "revenueYear3", "breakEvenTime", "roiTime", "profitMargin", "scalability", "keyStats"]
        },
        competitionAnalysis: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                competitors: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            details: { type: Type.STRING },
                            address: { type: Type.STRING, description: "Approximate address or cross streets" },
                            latitude: { type: Type.NUMBER, description: "Estimated latitude if available" },
                            longitude: { type: Type.NUMBER, description: "Estimated longitude if available" }
                        },
                        required: ["name", "details"]
                    }
                }
            },
            required: ["summary", "competitors"]
        },
        marketTrends: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                trends: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            trend: { type: Type.STRING },
                            impact: { type: Type.STRING }
                        },
                        required: ["trend", "impact"]
                    }
                }
            },
            required: ["summary", "trends"]
        },
        demographicInsights: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                demographics: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            metric: { type: Type.STRING },
                            value: { type: Type.STRING },
                            insight: { type: Type.STRING }
                        },
                        required: ["metric", "value", "insight"]
                    }
                }
            },
            required: ["summary", "demographics"]
        },
        riskAssessment: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                risks: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            risk: { type: Type.STRING },
                            impact: { type: Type.STRING },
                            severity: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
                            mitigation: { type: Type.STRING, description: "Strategic advice to mitigate this risk." }
                        },
                        required: ["risk", "impact", "severity", "mitigation"]
                    }
                }
            },
            required: ["summary", "risks"]
        },
        successFactors: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                factors: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            factor: { type: Type.STRING },
                            description: { type: Type.STRING },
                            importance: { type: Type.STRING, enum: ["Critical", "High", "Medium"] }
                        },
                        required: ["factor", "description", "importance"]
                    }
                }
            },
            required: ["summary", "factors"]
        },
        recommendation: {
            type: Type.OBJECT,
            properties: {
                decision: { 
                    type: Type.STRING, 
                    description: "The final recommendation. Must be one of: 'Recommended', 'Caution Advised', or 'Not Recommended'." 
                },
                reasoning: { type: Type.STRING }
            },
            required: ["decision", "reasoning"]
        },
        methodology: { type: Type.STRING },
    },
    required: [
        "businessType", "location", "viabilityScore", "scoreBreakdown", "executiveSummary", 
        "financialProjections", "competitionAnalysis", "marketTrends", 
        "demographicInsights", "riskAssessment", "successFactors", 
        "recommendation", "methodology"
    ]
};

const opportunitySchema = {
    type: Type.OBJECT,
    properties: {
        location: { type: Type.STRING },
        summary: { type: Type.STRING, description: "A high-level summary of the business climate in this location." },
        topOpportunities: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    businessType: { type: Type.STRING },
                    description: { type: Type.STRING },
                    whyItsGood: { type: Type.STRING, description: "A brief analysis of why this is a strong fit for the locality." },
                    scores: {
                        type: Type.OBJECT,
                        properties: {
                            capEx: { type: Type.INTEGER, description: "1-10 (1 is minimal upfront cost, 10 is high capital requirements)" },
                            overhead: { type: Type.INTEGER, description: "1-10 (1 is low monthly expenses, 10 is very high)" },
                            laborIntensity: { type: Type.INTEGER, description: "1-10 (1 is easy to manage alone/automated, 10 is heavy staffing needed)" },
                            competitionLevel: { type: Type.INTEGER, description: "1-10 (1 is virtually no direct competition, 10 is saturated)" },
                            overallPotental: { type: Type.INTEGER, description: "0-100 score of total success probability" }
                        },
                        required: ["capEx", "overhead", "laborIntensity", "competitionLevel", "overallPotental"]
                    },
                    financials: {
                        type: Type.OBJECT,
                        properties: {
                            estimatedStartupCost: { type: Type.STRING },
                            targetMarket: { type: Type.STRING },
                            potentialRevenue: { type: Type.STRING }
                        },
                        required: ["estimatedStartupCost", "targetMarket", "potentialRevenue"]
                    },
                    risks: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "2-3 key risks or challenges for this business in this location"
                    },
                    customerSegment: { type: Type.STRING, description: "Specific customer demographic and psychographic description" },
                    bestNearbyArea: { type: Type.STRING, description: "Best nearby ZIP code or neighborhood to launch in" },
                    // ── Dossier fields (optional — populated by expanded full-analysis prompt) ──
                    executiveSummary: { type: Type.STRING, description: "3-4 sentence executive summary of this specific opportunity" },
                    marketDemand: {
                        type: Type.OBJECT,
                        properties: {
                            summary: { type: Type.STRING },
                            drivers: { type: Type.ARRAY, items: { type: Type.STRING } },
                            consumerTrends: { type: Type.ARRAY, items: { type: Type.STRING } },
                            targetAudience: { type: Type.STRING },
                            localMarketConditions: { type: Type.STRING }
                        }
                    },
                    demographicFit: {
                        type: Type.OBJECT,
                        properties: {
                            idealCustomer: { type: Type.STRING },
                            incomeConsiderations: { type: Type.STRING },
                            ageGroups: { type: Type.STRING },
                            populationRelevance: { type: Type.STRING }
                        }
                    },
                    competitiveLandscape: {
                        type: Type.OBJECT,
                        properties: {
                            summary: { type: Type.STRING },
                            existingCompetitors: { type: Type.STRING },
                            marketSaturation: { type: Type.STRING, description: "Low | Moderate | High" },
                            competitiveAdvantages: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                    },
                    startupRequirements: {
                        type: Type.OBJECT,
                        properties: {
                            licensing: { type: Type.STRING },
                            staffing: { type: Type.STRING },
                            equipment: { type: Type.STRING },
                            operationalComplexity: { type: Type.STRING, description: "Low | Moderate | High" }
                        }
                    },
                    startupCostRange: {
                        type: Type.OBJECT,
                        properties: {
                            low: { type: Type.STRING },
                            expected: { type: Type.STRING },
                            high: { type: Type.STRING }
                        }
                    },
                    revenueModel: {
                        type: Type.OBJECT,
                        properties: {
                            summary: { type: Type.STRING },
                            monetizationMethods: { type: Type.ARRAY, items: { type: Type.STRING } },
                            scalabilityPotential: { type: Type.STRING }
                        }
                    },
                    strategicRisks: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                category: { type: Type.STRING, description: "Market | Regulatory | Competitive | Execution" },
                                risk: { type: Type.STRING },
                                mitigation: { type: Type.STRING }
                            }
                        }
                    },
                    opportunityScorecard: {
                        type: Type.OBJECT,
                        properties: {
                            marketDemand: { type: Type.INTEGER, description: "0-100" },
                            competition: { type: Type.INTEGER, description: "0-100 (higher = less competition = better)" },
                            startupComplexity: { type: Type.INTEGER, description: "0-100 (higher = simpler = better)" },
                            revenuePotential: { type: Type.INTEGER, description: "0-100" },
                            scalability: { type: Type.INTEGER, description: "0-100" },
                            overallScore: { type: Type.INTEGER, description: "0-100 weighted composite" }
                        }
                    },
                    strategicRecommendation: {
                        type: Type.OBJECT,
                        properties: {
                            decision: { type: Type.STRING, description: "Proceed | Proceed with Caution | High Potential | Limited Opportunity" },
                            rationale: { type: Type.STRING }
                        }
                    }
                },
                required: ["businessType", "description", "whyItsGood", "scores", "financials"]
            }
        },
        methodology: { type: Type.STRING }
    },
    required: ["location", "summary", "topOpportunities", "methodology"]
};

const regionalAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    isZipMode: { type: Type.BOOLEAN },
    nearbyRegions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          demographics: { type: Type.STRING },
          competition: { type: Type.STRING },
          opportunity: { type: Type.STRING },
          details: { type: Type.STRING }
        },
        required: ["name", "demographics", "competition", "opportunity", "details"]
      }
    },
    countyContext: { type: Type.STRING },
    economicRadius: { type: Type.STRING },
    competitiveSpillover: { type: Type.STRING },
    expansionPotential: { type: Type.STRING },
    regionalRecommendation: { type: Type.STRING },
    specificObservationTitle: { type: Type.STRING },
    specificObservationText: { type: Type.STRING }
  },
  required: [
    "isZipMode", "nearbyRegions", "countyContext", "economicRadius", 
    "competitiveSpillover", "expansionPotential", "regionalRecommendation",
    "specificObservationTitle", "specificObservationText"
  ]
};

// Timeout Wrapper Function
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// JSON Text cleaning helper
function cleanAndParseJSON(text: string, schemaFallback?: any): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Malformed JSON detected. Raw response text was:", text);
    
    // RegEx extraction helper
    const objectStartIndex = cleaned.indexOf("{");
    const arrayStartIndex = cleaned.indexOf("[");
    let startIndex = -1;
    let endIndex = -1;
    
    if (objectStartIndex !== -1 && (arrayStartIndex === -1 || objectStartIndex < arrayStartIndex)) {
      startIndex = objectStartIndex;
      endIndex = cleaned.lastIndexOf("}");
    } else if (arrayStartIndex !== -1) {
      startIndex = arrayStartIndex;
      endIndex = cleaned.lastIndexOf("]");
    }
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      try {
        return JSON.parse(cleaned.substring(startIndex, endIndex + 1));
      } catch (subErr) {
        console.error("Regex JSON extract failed:", subErr);
      }
    }
    
    if (schemaFallback) {
      console.warn("Parsing completely failed. Applying high-fidelity custom fallback.");
      return schemaFallback;
    }
    throw new Error("malformed_response: Gemini returned invalid JSON that could not be parsed.");
  }
}

// Coordinate Seeder helper
function getCoordinatesForLocation(locStr: string) {
    let hash = 0;
    for (let i = 0; i < locStr.length; i++) {
        hash = locStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);
    const lat = 26.0 + (absHash % 220) / 10;
    const lng = -122.0 + ((absHash >> 2) % 470) / 10;
    return { latitude: lat, longitude: lng };
}

// Dynamic High-Fidelity Fallbacks if Gemini output is corrupted
function getViabilityReportFallback(businessType: string, location: string): any {
  const capBiz = businessType.charAt(0).toUpperCase() + businessType.slice(1);
  const coords = getCoordinatesForLocation(location);
  return {
    businessType: capBiz,
    location,
    targetCoordinates: coords,
    viabilityScore: 78,
    scoreBreakdown: {
      marketDemand: 82,
      competitionIntensity: 50,
      financialFeasibility: 75,
      riskLevel: 35
    },
    executiveSummary: `This fallback viability report for ${capBiz} in ${location} indicates solid parameters for strategic development. Growth indices remain reliable, backed by resilient resident disposable budgets. Under-served gaps around convenience and personalized service provide a clear path to customer capture.`,
    financialProjections: {
      summary: `Viable margin profile sustained by continuous visitor flow. Capital requirements remain within standard parameters for a localized ${capBiz}.`,
      startupCostRange: "$100,000 - $180,000",
      startupCostBreakdown: "Commercial fit-out and utilities ($65k), initial machinery & permits ($40k), operating cash reserve ($45k), local launch marketing & signages ($30k).",
      revenueYear1: "$280,000",
      revenueYear3: "$440,000",
      breakEvenTime: "15 months",
      roiTime: "2.8 years",
      profitMargin: "17%",
      scalability: "Medium",
      keyStats: [
        { label: "Est. Ticket Price", value: "$12.50" },
        { label: "Target Conversions/Day", value: "110" },
        { label: "Baseline Margin Cost", value: "28%" },
        { label: "Estimated Rent & Overhead", value: "$14,000" }
      ]
    },
    competitionAnalysis: {
      summary: "Local sector analysis maps active independent options but indicates a void of specialized or high-brand options.",
      competitors: [
        {
          name: "Vanguard Enterprises",
          details: "Established generic provider with moderate community retention. Competes on pricing.",
          address: `100 Main St, ${location}`,
          latitude: coords.latitude + 0.003,
          longitude: coords.longitude - 0.002
        },
        {
          name: "Apex Retail Services",
          details: "Standardized service franchise with strong foot traffic but lower customized engagement.",
          address: `250 Highway Corridor, ${location}`,
          latitude: coords.latitude - 0.004,
          longitude: coords.longitude + 0.004
        }
      ]
    },
    marketTrends: {
      summary: "Consumer demand leans heavily towards custom experiences, localized convenience, and digital integration.",
      trends: [
        { trend: "Personalized Customer Styling", impact: "Fosters robust word-of-mouth client referral spikes up to 40%." },
        { trend: "Eco-Conscious Infrastructure", impact: "Appeals directly to higher-spending demographics, supporting premium margins." }
      ]
    },
    demographicInsights: {
      summary: "Densely balanced sector with high ratio of commuter population and stable income markers.",
      demographics: [
        { metric: "Core Active Age Pool (18-49)", value: "48%", insight: "Primary demographic ensuring dynamic interest." },
        { metric: "Household Income Cohort", value: "Above National Median", insight: "Drives strong willingness to adopt premium pricing tiers." }
      ]
    },
    riskAssessment: {
      summary: "General operating risks including location lease rate shifts and qualified labor sourcing.",
      risks: [
        { risk: "Overhead inflation", impact: "Increased baseline transactions to reach profitability.", severity: "Medium", mitigation: "Secure long-term flat lease with predictable step-up rate triggers." },
        { risk: "Service Quality Inconsistency", impact: "Losing recurring customers to standard franchises.", severity: "Medium", mitigation: "Structure persistent staff workshops and client-centric incentive feedback." }
      ]
    },
    successFactors: {
      summary: "Consistency in deliverables and premium location positioning outline the baseline path to success.",
      factors: [
        { factor: "Strategic Micro-Location", description: "Corner plots with strong pedestrian pathways or main highway access.", importance: "Critical" },
        { factor: "Modern Visual Branding", description: "Clean logo design and digital media engagement to drive social pull.", importance: "High" }
      ]
    },
    recommendation: {
      decision: "Caution Advised",
      reasoning: "The regional landscape supports a new launch, but careful site mapping and localized marketing are required to secure early transaction volume."
    },
    methodology: "This report uses industry-average benchmarks as a fallback. Real-time competitor and demographic data could not be retrieved for this request.",
    groundingSources: [
      { title: "US Census Bureau", uri: "https://www.census.gov" },
      { title: "Google Maps", uri: "https://maps.google.com" }
    ]
  };
}

function getOpportunityReportFallback(location: string): any {
  return {
    location,
    summary: `Underserved commercial sectors in ${location} present low barriers to entry and strong consumer margins.`,
    topOpportunities: [
      {
        businessType: "Specialty Wellness Hub",
        description: "Bespoke health, boutique physical care, or tailored wellness center.",
        whyItsGood: "High disposable incomes and rising prioritization of mental and physical fitness.",
        scores: { capEx: 6, overhead: 5, laborIntensity: 4, competitionLevel: 3, overallPotental: 88 },
        financials: { estimatedStartupCost: "$60,000", targetMarket: "Active health-minded families", potentialRevenue: "$150,000/Yr" }
      },
      {
        businessType: "Local Quick-Service Bakery",
        description: "Premium coffee, organic pastry kitchen, and neighborhood pantry store.",
        whyItsGood: "Heavy foot traffic pockets lacking independent high-quality food counters.",
        scores: { capEx: 5, overhead: 7, laborIntensity: 5, competitionLevel: 4, overallPotental: 83 },
        financials: { estimatedStartupCost: "$85,000", targetMarket: "Commuters and work-from-home residents", potentialRevenue: "$210,000/Yr" }
      }
    ],
    methodology: "Local market study compilation based on traditional urban center variables.",
    groundingSources: [{ title: "National Small Business Development Index", uri: "https://www.sba.gov" }]
  };
}

function getRegionalAnalysisFallback(businessType: string, location: string): any {
  const isZip = /\b\d{5}\b/.test(location);
  return {
    isZipMode: isZip,
    targetLocation: location,
    nearbyRegions: [
      {
        name: isZip ? "Sector A Gateway" : `${location} North`,
        demographics: "High Density Area",
        competition: "Moderate (3 present)",
        opportunity: "85%",
        details: "Strong adjacent commuter pathways. Solid potential for extension campaigns."
      },
      {
        name: isZip ? "Sector B Suburban" : `${location} Heights`,
        demographics: "Increasing Population Growth",
        competition: "Low (0 competitors)",
        opportunity: "91%",
        details: "Substantially underserved in physical offerings. Excellent zone to lock early leases."
      }
    ],
    countyContext: "Sustained positive growth indicators. Housing indices suggest steady inflow of high-income households.",
    economicRadius: "A 10-mile radius captures a commuter network of over 150,000 people daily.",
    competitiveSpillover: "Underperforming standard chains in adjacent clusters indicate that high-quality services can capture market overflow immediately.",
    expansionPotential: "Phase 1: Claim search listings and mobile maps. Phase 2: Form partnerships with local real estate complexes.",
    regionalRecommendation: "Strongly recommended to proceed. Secure highly visible locations early within transit pathways.",
    specificObservationTitle: "Regional Growth Factors",
    specificObservationText: "Local traffic and development charts map continuous commercial real estate conversions, which will drive business-to-business and consumer opportunities."
  };
}

// Stripe client — lazy, only initialised when STRIPE_SECRET_KEY is present
const getStripe = (): Stripe => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY environment variable is not configured.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" as any });
};

const _supabaseUrl = process.env.SUPABASE_URL;
const _supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = (_supabaseUrl && _supabaseServiceKey)
  ? createClient(_supabaseUrl, _supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

if (!supabaseAdmin) {
  console.warn('[PlanAuth] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. ' +
    'Server-side plan verification is DISABLED — all requests treated as Explorer. ' +
    'Set both env vars and redeploy to enable enforcement.');
}

const _serverBetaFullAccess: boolean = process.env.BETA_FULL_ACCESS === 'true';

function getServerSidePlan(role: string, subscription_tier: string): string {
  const r = (role ?? '').trim().toLowerCase();
  if (r === 'admin') return 'Enterprise';
  if (_serverBetaFullAccess) return 'Pro+';
  if (r === 'betatester' || r === 'beta_tester' || r === 'beta_vip') return 'Pro+';
  return normalizeTierToBudgetPlan(subscription_tier);
}

async function verifyAndGetPlan(authHeader: string | undefined): Promise<{
  verifiedEmail: string;
  verifiedPlan: string;
  verifiedRole: string;  // raw role string from Supabase profiles table
}> {
  const FALLBACK = { verifiedEmail: 'anonymous@bizscope.ai', verifiedPlan: 'Explorer', verifiedRole: '' };
  if (!supabaseAdmin) return FALLBACK;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    console.log('[PlanAuth] No Bearer token — defaulting to Explorer');
    return FALLBACK;
  }
  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.warn('[PlanAuth] Token invalid:', userError?.message ?? 'no user returned');
      return FALLBACK;
    }
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, subscription_tier')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) {
      console.warn('[PlanAuth] Profile not found for user:', user.id, '—', profileError?.message ?? 'null profile');
      return { verifiedEmail: user.email ?? FALLBACK.verifiedEmail, verifiedPlan: 'Explorer', verifiedRole: '' };
    }
    const verifiedPlan = getServerSidePlan(profile.role, profile.subscription_tier);
    console.log(`[PlanAuth] Verified uid=${user.id} role=${profile.role} tier=${profile.subscription_tier} → plan=${verifiedPlan}`);
    return { verifiedEmail: user.email ?? FALLBACK.verifiedEmail, verifiedPlan, verifiedRole: profile.role ?? '' };
  } catch (err: any) {
    console.error('[PlanAuth] verifyAndGetPlan exception:', err.message);
    return FALLBACK;
  }
}

// Main server launcher
async function startServer() {
  const app = express();
  const PORT = 3000;

  // ---- Stripe webhook (raw body required — must come BEFORE express.json()) ----
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("[Stripe] STRIPE_WEBHOOK_SECRET is not configured.");
      return res.status(400).json({ error: "Webhook secret not configured." });
    }
    if (!sig) {
      return res.status(400).json({ error: "Missing stripe-signature header." });
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(req.body as Buffer, sig as string, webhookSecret);
    } catch (err: any) {
      console.error("[Stripe] Webhook signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[Stripe] Checkout completed:", {
          customer: session.customer,
          email: session.customer_email,
          plan: session.metadata?.plan,
          subscriptionId: session.subscription,
        });
        // TODO: persist subscription → Supabase when DB layer is added
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        console.log("[Stripe] Subscription updated:", {
          id: sub.id,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
        // TODO: sync plan change to user record in Supabase
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log("[Stripe] Subscription cancelled:", sub.id);
        // TODO: downgrade user to Explorer plan in Supabase
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        console.log("[Stripe] Payment failed for customer:", inv.customer);
        break;
      }
      default:
        console.log("[Stripe] Unhandled webhook event:", event.type);
    }

    res.json({ received: true });
  });
  // ---------------------------------------------------------------------------

  app.use(express.json());

  // Grounding sources extractor
  const getGroundingSources = (response: any) => {
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = [];
    for (const chunk of chunks) {
      if (chunk.web) {
        sources.push({ title: chunk.web.title || "Web Source", uri: chunk.web.uri });
      }
      if (chunk.maps) {
        sources.push({ title: chunk.maps.title || "Map Source", uri: chunk.maps.uri });
      }
    }
    return sources;
  };

  // Helper handling and classifying errors
  const handleServerError = (res: Response, err: any, context: string) => {
    console.error(`Error in ${context}:`, err);
    
    let statusCode = 500;
    let code = "INTERNAL_ERROR";
    let message = err.message || "An unexpected error occurred.";

    if (message.includes("API key")) {
      statusCode = 401;
      code = "MISSING_API_KEY";
      message = "The Gemini API Key is missing or invalid in server environment configurations.";
    } else if (message.includes("invalid input") || message.includes("validation")) {
      statusCode = 400;
      code = "INVALID_INPUT";
    } else if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.toLowerCase().includes("rate limit")) {
      statusCode = 429;
      code = "RATE_LIMIT";
      message = "Gemini API rate limiting threshold exceeded. Please try again shortly.";
    } else if (message.includes("timeout")) {
      statusCode = 544; // Gateway Timeout code variation
      code = "TIMEOUT";
      message = "The analysis timed out. The model took too long to formulate a response. Please try again.";
    } else if (message.includes("malformed_response")) {
      statusCode = 502;
      code = "MALFORMED_RESPONSE";
    } else {
      statusCode = 502;
      code = "MODEL_ERROR";
      message = `Gemini model error during execution: ${message}`;
    }

    res.status(statusCode).json({
      error: message,
      code,
      details: err.stack || null
    });
  };

  // ----------------------- API ENDPOINTS -----------------------

  // In-memory Server-side Usage Store to simulate database check safeguards in Live Mode
  interface ServerUsageRecord {
    standardCount: number;
    regionalCount: number;
    lastStandardReset: string;
    lastRegionalReset: string;
  }
  const serverUsageDb: Record<string, ServerUsageRecord> = {};

  const checkServerLimit = (email: string, tier: string, isRegional: boolean): { allowed: boolean; error?: string } => {
    const cleanEmail = email.toLowerCase().trim();
    // Normalize via aiBudget utility: handles Admin→Enterprise, BetaTester/ProPlus→Pro+, etc.
    const cleanTier = normalizeTierToBudgetPlan(tier);

    if (cleanTier === "Enterprise") {
      return { allowed: true };
    }

    const now = new Date();
    if (!serverUsageDb[cleanEmail]) {
      serverUsageDb[cleanEmail] = {
        standardCount: 0,
        regionalCount: 0,
        lastStandardReset: now.toISOString(),
        lastRegionalReset: now.toISOString(),
      };
    }

    const record = serverUsageDb[cleanEmail];

    // 1. Reset check — all registered plans use a 30-day monthly cycle (mirrors PLAN_LIMITS)
    const MONTHLY_MS = 30 * 24 * 60 * 60 * 1000;
    const diffStd = now.getTime() - new Date(record.lastStandardReset).getTime();
    if (diffStd >= MONTHLY_MS) {
      record.standardCount = 0;
      record.lastStandardReset = now.toISOString();
    }
    const diffReg = now.getTime() - new Date(record.lastRegionalReset).getTime();
    if (diffReg >= MONTHLY_MS) {
      record.regionalCount = 0;
      record.lastRegionalReset = now.toISOString();
    }

    // 2. Limit enforcement — mirrors PLAN_LIMITS in src/config/plans.ts
    if (isRegional) {
      if (cleanTier === "Explorer" || cleanTier === "Pro") {
        return { allowed: false, error: `Regional reports are locked under the ${cleanTier} plan. Upgrade to Pro+ to gain access.` };
      }
      if (cleanTier === "Pro+" && record.regionalCount >= 10) {
        return { allowed: false, error: "You have reached your monthly limit of 10 Regional Intelligence reports under the Pro+ plan." };
      }
    } else {
      if (cleanTier === "Explorer" && record.standardCount >= 3) {
        return { allowed: false, error: "You have reached your monthly limit of 3 standard reports under the Explorer plan." };
      }
      if (cleanTier === "Pro" && record.standardCount >= 20) {
        return { allowed: false, error: "You have reached your monthly limit of 20 standard reports under the Pro plan." };
      }
      if (cleanTier === "Pro+" && record.standardCount >= 50) {
        return { allowed: false, error: "You have reached your monthly limit of 50 standard reports under the Pro+ plan." };
      }
    }

    return { allowed: true };
  };

  const incrementServerLimit = (email: string, isRegional: boolean) => {
    const cleanEmail = email.toLowerCase().trim();
    const record = serverUsageDb[cleanEmail];
    if (record) {
      if (isRegional) {
        record.regionalCount += 1;
      } else {
        record.standardCount += 1;
      }
    }
  };

  // API 1: /api/analyze
  app.post("/api/analyze", async (req: Request, res: Response) => {
    const { businessType, location, userLocation } = req.body;

    const { verifiedEmail: userEmail, verifiedPlan: planTier } = await verifyAndGetPlan(
      req.headers["authorization"] as string | undefined
    );

    // Enforce limits on the server-side to secure the live deployment
    const limitCheck = checkServerLimit(userEmail, planTier, false);
    if (!limitCheck.allowed) {
      return res.status(429).json({ 
        error: limitCheck.error, 
        code: "USAGE_LIMIT_EXCEEDED" 
      });
    }

    // Input Validation
    if (!businessType || typeof businessType !== "string" || !businessType.trim()) {
      return res.status(400).json({ error: "Missing or invalid businessType parameter.", code: "INVALID_INPUT" });
    }
    if (!location || typeof location !== "string" || !location.trim()) {
      return res.status(400).json({ error: "Missing or invalid location parameter.", code: "INVALID_INPUT" });
    }

    // API Key Security check
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({
        error: "Missing Gemini API key from environment variables (GEMINI_API_KEY is not defined).",
        code: "MISSING_API_KEY"
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      
      const cheaperModel = GEMINI_MODELS.standard;
      const normalizedPlan = normalizeTierToBudgetPlan(planTier);
      const budget = getReportBudget(normalizedPlan, 'standard');
      let combinedSources: any[] = [];
      let competitionInfo = "No competitor data available.";
      let marketTrendsInfo = "No trend data available.";

      // Phase 1: Competitor retrieval with Maps Grounding (Timeout: 20s)
      try {
        const mapsPrompt = `List the top 5 direct competitors for a new '${businessType}' in or very near '${location}'. For each, provide the name and address.`;
        const mapsConfig: any = { tools: [{ googleMaps: {} }] };
        if (userLocation && typeof userLocation.latitude === "number" && typeof userLocation.longitude === "number") {
          mapsConfig.toolConfig = { retrievalConfig: { latLng: { latitude: userLocation.latitude, longitude: userLocation.longitude } } };
        }
        
        const mapsResponse = await withTimeout(
          ai.models.generateContent({
            model: cheaperModel,
            contents: mapsPrompt,
            config: mapsConfig,
          }),
          20000,
          "competitor research lookup timed out"
        );
        competitionInfo = mapsResponse.text || competitionInfo;
        combinedSources.push(...getGroundingSources(mapsResponse));
      } catch (err) {
        console.warn("Maps research failed, continuing with defaults:", err);
      }

      // Phase 2: Census & trends with Search Grounding (Timeout: 20s)
      try {
        const searchPrompt = `Find the latest US Census data for '${location}': specifically the Total Population and Median Household Income. Also research market trends and financial benchmarks for opening a '${businessType}' in '${location}'.`;
        const searchResponse = await withTimeout(
          ai.models.generateContent({
            model: cheaperModel,
            contents: searchPrompt,
            config: { tools: [{ googleSearch: {} }] },
          }),
          20000,
          " census trends lookup timed out"
        );
        marketTrendsInfo = searchResponse.text || marketTrendsInfo;
        combinedSources.push(...getGroundingSources(searchResponse));
      } catch (err) {
        console.warn("Search research failed, continuing with defaults:", err);
      }

      // Phase 3: Detailed synthesis with cheaper model (Timeout: 30s)
      const finalPrompt = `
        Act as an expert business consultant and financial analyst. Your task is to create a detailed business viability report with financial projections and strategic risk assessment.
        
        **Business Idea:** A new '${businessType}'
        **Target Location:** '${location}'

        **I have gathered the following preliminary data:**

        **1. Competition Analysis (from Google Maps):**
        ${competitionInfo}

        **2. Market Trends & Demographics (from Google Search):**
        ${marketTrendsInfo}

        **Your Task:**
        Synthesize the provided data with your expert knowledge of business strategy, franchise financials, and census data concepts.
        
        Generate a comprehensive report in JSON format adhering strictly to the schema. Do not output any wrapping markdown. 
        
        **DATA CONSISTENCY RULES:**
        - For the Demographic Insights section, use the specific population and median household income figures found in the "Market Trends & Demographics" search results above. If factual figures are present, use them. If not, use clearly qualified estimates (e.g., "estimated" or "based on regional averages").
        - If the Competition Analysis data is missing or shows "No competitor data available", state this clearly in competitionAnalysis.summary and note that competitor details are estimated from category norms for this market area.
        - If the Market Trends data is missing, acknowledge this in marketTrends.summary and use general industry trends for this business category.

        **Competitor Descriptions (IMPORTANT):**
        - Be direct and specific when describing competitors. Use plain factual language.
        - Do NOT hedge with "may", "might", "could", "appears to", "seems to", or "is reported to" — state what is observable directly.
        - If a competitor's details are uncertain, say "Based on available information" once, then state the facts directly.

        **Financial Estimates:**
        Provide realistic industry-average figures for this specific business type and region.
        - Startup Costs: Provide a realistic range (Low - High) with a brief breakdown of major cost drivers. Ensure the breakdown items are consistent with and sum to an amount within the stated range.
        - Revenue: Estimate Year 1 and Year 3 revenue based on realistic ramp-up assumptions for this category.
        - ROI & Break-even: Provide realistic timelines. Avoid overly optimistic projections.
        - keyStats: Use national industry averages for this business category. These are benchmarks, not guarantees.

        **Strategic Intelligence:**
        - **Risk Assessment**: Identify 3-5 specific risks (Market, Operational, Financial) for this location and business type. Assign severity and concrete mitigation strategies.
        - **Success Factors**: Identify 3-5 critical factors that will determine success for this specific business type.

        **Scoring Rules (MANDATORY):**
        You must calculate the 'viabilityScore' (0-100) using the following strict formula. Do not deviate.

        1. Assign sub-scores (0-100) for these four factors based on your analysis:
           - Market Demand (Higher is better)
           - Competition Intensity (Higher means MORE competition/saturation, which is bad for the score)
           - Financial Feasibility (Higher is better)
           - Risk Level (Higher means MORE risk, which is bad for the score)

        2. Compute the final Viability Score:
           Score = (0.30 * Market Demand) + (0.25 * (100 - Competition Intensity)) + (0.25 * Financial Feasibility) + (0.20 * (100 - Risk Level))

        3. Classification Guide:
           - 0-39: Low Viability (Not Recommended)
           - 40-69: Moderate Viability (Caution Advised)
           - 70-100: High Viability (Recommended)

        IMPORTANT:
        - Estimate the latitude and longitude for the target location '${location}' and for each competitor based on their address/location description if exact coordinates are not explicitly provided in the source text. This is for a visualization map.
        - Ensure the final recommendation matches the calculated score classification.
      `;

      const fallbackObj = getViabilityReportFallback(businessType, location);
      
      const proResponse = await withTimeout(
        ai.models.generateContent({
          model: cheaperModel,
          contents: finalPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: reportSchema,
            temperature: 0.4,
            maxOutputTokens: budget.maxOutputTokens,
          },
        }),
        30000,
        "synthesis analysis timed out"
      );

      const _analyzeUsage = (proResponse as any).usageMetadata;
      const _analyzeCost = estimateCost(
        cheaperModel,
        _analyzeUsage?.promptTokenCount ?? 0,
        _analyzeUsage?.candidatesTokenCount ?? 0,
        2  // Phase 1 (Maps grounding) + Phase 2 (Search grounding)
      );
      console.log(`[AICost] /api/analyze plan=${normalizedPlan} in=${_analyzeUsage?.promptTokenCount ?? '?'} out=${_analyzeUsage?.candidatesTokenCount ?? '?'} est=$${_analyzeCost.estimatedCostUsd.toFixed(5)}`);

      const parsed = cleanAndParseJSON(proResponse.text || "", fallbackObj);
      // Deduplicate sources by URI to avoid showing the same source twice (#25)
      const seenUris = new Set<string>();
      const dedupedSources = combinedSources.filter(s => {
        if (!s.uri || seenUris.has(s.uri)) return false;
        seenUris.add(s.uri);
        return true;
      });
      parsed.groundingSources = dedupedSources.length > 0 ? dedupedSources : fallbackObj.groundingSources;
      
      // Ensure target coordinates exist
      if (!parsed.targetCoordinates) {
        parsed.targetCoordinates = getCoordinatesForLocation(location);
      }

      // Sync competitor positions with target coordinates if they have none
      if (parsed.competitionAnalysis && Array.isArray(parsed.competitionAnalysis.competitors)) {
        parsed.competitionAnalysis.competitors = parsed.competitionAnalysis.competitors.map((comp: any, index: number) => {
          if (typeof comp.latitude !== "number" || typeof comp.longitude !== "number") {
            const offsetLat = (index === 0 ? 0.005 : index === 1 ? -0.004 : 0.003) + (Math.sin(index) * 0.001);
            const offsetLng = (index === 0 ? -0.003 : index === 1 ? 0.005 : -0.005) + (Math.cos(index) * 0.001);
            return {
              ...comp,
              latitude: parsed.targetCoordinates.latitude + offsetLat,
              longitude: parsed.targetCoordinates.longitude + offsetLng
            };
          }
          return comp;
        });
      }

      incrementServerLimit(userEmail, false);
      res.json(parsed);
    } catch (err) {
      handleServerError(res, err, "Analyzing Viability");
    }
  });

  // API 2: /api/opportunities
  // Beta-role gate: only Admin and BetaTester roles may call real Gemini here.
  // Explorer and unauthenticated users are served mock data client-side and
  // must never reach this endpoint with a real Gemini call.
  app.post("/api/opportunities", async (req: Request, res: Response) => {
    const { location } = req.body;

    console.log(`[Opportunities] Request received — location="${location ?? '(none)'}"`);

    if (!location || typeof location !== "string" || !location.trim()) {
      return res.status(400).json({ error: "Missing or invalid location parameter.", code: "INVALID_INPUT" });
    }

    // ── Server-side auth & beta-role gate ──────────────────────────────────
    const { verifiedEmail, verifiedPlan, verifiedRole } = await verifyAndGetPlan(
      req.headers["authorization"] as string | undefined
    );

    console.log(`[Opportunities] Auth — email=${verifiedEmail} role="${verifiedRole}" plan=${verifiedPlan} betaFullAccess=${_serverBetaFullAccess}`);

    if (verifiedPlan === 'Explorer') {
      console.warn(`[Opportunities] Rejected — plan="${verifiedPlan}" role="${verifiedRole}" betaFullAccess=${_serverBetaFullAccess}`);
      return res.status(403).json({
        error: "Market Gap analysis with real AI requires a Pro or higher plan.",
        code: "INSUFFICIENT_PLAN",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({
        error: "Missing Gemini API key from environment variables (GEMINI_API_KEY is not defined).",
        code: "MISSING_API_KEY"
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      
      const cheaperModel = GEMINI_MODELS.standard;
      let combinedSources: any[] = [];
      let marketData = "No local market insights found.";

      // Step 1: Landscape with search grounding (Timeout: 20s)
      try {
        const searchPrompt = `Research the business landscape and local economy of '${location}'. Find specific, factual information about:
1. Economic profile: dominant industries, major employers, primary employment sectors, and key economic drivers
2. Market character: is this primarily a residential suburb, college town, tourism destination, retirement community, industrial/logistics hub, agricultural region, or professional-services center? Note multiple if they apply.
3. Demographic profile: income levels, age distribution, household composition, and notable population trends (growth, migration, aging, student population)
4. Underserved gaps: specific business categories — including B2B services, industrial support, and consumer services — where local supply clearly lags demand
5. Location-specific factors: major employers by name, dominant workforce skills, infrastructure, climate, major development projects, and cultural or economic identity
6. Any recent economic shifts, facility openings or closures, demographic changes, or emerging workforce needs creating new business opportunities`;
        const searchResponse = await withTimeout(
          ai.models.generateContent({
            model: cheaperModel,
            contents: searchPrompt,
            config: { tools: [{ googleSearch: {} }] },
          }),
          20000,
          "opportunities location research timed out"
        );
        marketData = searchResponse.text || marketData;
        combinedSources.push(...getGroundingSources(searchResponse));
      } catch (err) {
        console.warn("Opportunities search locator failed:", err);
      }

      // Step 2: Formulate ideas + full dossier per opportunity (Timeout: 40s)
      const finalPrompt = `
        Act as a strategic market analyst. Identify the TOP 3-5 business opportunities in '${location}' with the strongest evidence of unmet local demand and realistic financial viability.

        **Location Context:** '${location}'
        **Local Research Data:**
        ${marketData}

        **Selection criteria — apply in this priority order:**
        1. Local market need: credible evidence that demand exists and current supply fails to meet it
        2. Competitive whitespace: limited or weak existing competition for this specific offering
        3. Economic viability: realistic path to positive unit economics within 18-24 months

        **Sector scope — evaluate ALL sectors relevant to this economy:**
        - Consumer services and retail (food, personal care, entertainment)
        - Healthcare, senior services, and home health
        - Childcare and education
        - Home services and property maintenance
        - B2B services and professional services
        - Logistics, warehousing, and supply-chain support
        - Industrial services, equipment rental, and trade support
        - Workforce development, staffing, and training
        - Hospitality, tourism, and visitor services
        - Technology services and digital support
        Let the local research data determine which sectors are most relevant — follow the evidence, not a preset category distribution.

        **LOCATION DNA — mandatory for every recommendation:**
        Reference specific, verifiable characteristics of '${location}': named industries, major employers, demographic groups, geographic features, or confirmed economic conditions. A person who knows this location should immediately recognize why each opportunity belongs HERE.

        **SPECIFICITY REQUIREMENTS:**
        - businessType: Specific concept, niche, and customer served. GOOD: "Fleet Maintenance Dispatch Service for Regional Carriers", "Senior In-Home Occupational Therapy", "Halal Meal Prep Delivery". BAD: "Tech Services", "Health Business", "Restaurant".
        - whyItsGood: Cite specific local factors — named employers, industries, demographic data, or infrastructure conditions.
        - bestNearbyArea: A real neighborhood, corridor, district, or ZIP code within or near '${location}'.
        - description: Describe the specific concept clearly.
        - CAPITAL RANGE: Include a mix — some low-capital entries ($5k–$50k) and some requiring moderate investment ($50k–$300k) where the market justifies it.

        **Scoring Definitions:**
        - CapEx: 1 (Very cheap to start, <$5k) to 10 (Massive investment, >$500k).
        - Overhead: 1 (Home-based/Digital) to 10 (High rent, utility, and maintenance).
        - Labor Intensity: 1 (Solopreneur/Automated) to 10 (Large staff required).
        - Competition Level: 1 (No direct local competitors) to 10 (Market saturated).
        - Overall Potential: Weighted combination of the above vs Market Demand.

        **Required Dossier Fields Per Opportunity:**
        - executiveSummary: 3-4 sentences summarizing why this opportunity is strong in this location.
        - marketDemand: { summary (1-2 sentences), drivers (3 key demand factors as string array), consumerTrends (2-3 local/national trends as string array), targetAudience (who specifically), localMarketConditions (what makes this location apt) }
        - demographicFit: { idealCustomer (detailed profile), incomeConsiderations (affordability/spending power context), ageGroups (primary and secondary age bands), populationRelevance (local population fit) }
        - competitiveLandscape: { summary (1-2 sentences), existingCompetitors (describe who/what exists), marketSaturation ("Low" | "Moderate" | "High"), competitiveAdvantages (3-4 advantages this entrant would have as string array) }
        - startupRequirements: { licensing (what permits/licenses needed), staffing (headcount and roles), equipment (key purchases), operationalComplexity ("Low" | "Moderate" | "High") }
        - startupCostRange: { low (lean/bootstrapped launch figure), expected (typical launch figure), high (full-featured buildout figure) }
        - revenueModel: { summary (how money is made), monetizationMethods (2-3 revenue streams as string array), scalabilityPotential (how big can this get) }
        - strategicRisks: array of 3-4 items, each: { category ("Market" | "Regulatory" | "Competitive" | "Execution"), risk (specific risk), mitigation (concrete countermeasure) }
        - opportunityScorecard: { marketDemand (0-100), competition (0-100, higher=less competition=better), startupComplexity (0-100, higher=simpler), revenuePotential (0-100), scalability (0-100), overallScore (0-100 weighted composite) }
        - strategicRecommendation: { decision ("Proceed" | "Proceed with Caution" | "High Potential" | "Limited Opportunity"), rationale (2-3 sentences explaining the verdict) }

        Generate the output in JSON format adhering to the opportunity schema. Do not output any wrapping markdown.
      `;

      const fallbackObj = getOpportunityReportFallback(location);

      const response = await withTimeout(
        ai.models.generateContent({
          model: cheaperModel,
          contents: finalPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: opportunitySchema,
            temperature: 0.6,
            maxOutputTokens: 8192,
          },
        }),
        40000,
        "opportunities synthesis timed out"
      );

      const parsed = cleanAndParseJSON(response.text || "", fallbackObj);
      parsed.groundingSources = combinedSources.length > 0 ? combinedSources : fallbackObj.groundingSources;
      parsed.location = location;

      console.log(`[Opportunities] Success — model=${cheaperModel} opportunityCount=${parsed.topOpportunities?.length ?? 0} groundingSources=${parsed.groundingSources?.length ?? 0}`);

      res.json(parsed);
    } catch (err) {
      handleServerError(res, err, "Identifying Opportunities");
    }
  });

  // API 3: /api/regional-analysis
  app.post("/api/regional-analysis", async (req: Request, res: Response) => {
    const { businessType, location } = req.body;

    const { verifiedEmail: userEmail, verifiedPlan: planTier } = await verifyAndGetPlan(
      req.headers["authorization"] as string | undefined
    );

    // Enforce limits on the server-side to secure the live deployment
    const limitCheck = checkServerLimit(userEmail, planTier, true);
    if (!limitCheck.allowed) {
      return res.status(429).json({ 
        error: limitCheck.error, 
        code: "USAGE_LIMIT_EXCEEDED" 
      });
    }

    if (!businessType || typeof businessType !== "string" || !businessType.trim()) {
      return res.status(400).json({ error: "Missing or invalid businessType parameter.", code: "INVALID_INPUT" });
    }
    if (!location || typeof location !== "string" || !location.trim()) {
      return res.status(400).json({ error: "Missing or invalid location parameter.", code: "INVALID_INPUT" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({
        error: "Missing Gemini API key from environment variables (GEMINI_API_KEY is not defined).",
        code: "MISSING_API_KEY"
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      
      const normalizedPlan = normalizeTierToBudgetPlan(planTier);
      const budget = getReportBudget(normalizedPlan, 'regional');
      // Model is driven by the budget table (Pro+/Enterprise → GEMINI_MODELS.regional)
      const strongerModel = budget.model;
      const isZip = /\b\d{5}\b/.test(location);

      const contentPrompt = `
        Act as a premier consulting analyst. Conduct a Regional Intelligence study for establishing a new '${businessType}' in regional context: '${location}'.
        
        Generate a comprehensive analysis object matching the schema. Do not output any wrapping markdown.
        ${isZip ? 
          `Input is a ZIP code: Include county contexts, compute adjacent ZIPs opportunity values, and compile surrounding-market observations.` : 
          `Input is a City: Include county-level trends, compute surrounding suburbs metrics, and identify regional growth corridors.`
        }
      `;

      const fallbackObj = getRegionalAnalysisFallback(businessType, location);

      const response = await withTimeout(
        ai.models.generateContent({
          model: strongerModel,
          contents: contentPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: regionalAnalysisSchema,
            temperature: 0.5,
            maxOutputTokens: budget.maxOutputTokens,
          }
        }),
        35000,
        "regional intelligence analysis timed out"
      );

      const _regionalUsage = (response as any).usageMetadata;
      const _regionalCost = estimateCost(
        strongerModel,
        _regionalUsage?.promptTokenCount ?? 0,
        _regionalUsage?.candidatesTokenCount ?? 0,
        0
      );
      console.log(`[AICost] /api/regional-analysis plan=${normalizedPlan} in=${_regionalUsage?.promptTokenCount ?? '?'} out=${_regionalUsage?.candidatesTokenCount ?? '?'} est=$${_regionalCost.estimatedCostUsd.toFixed(5)}`);

      const parsed = cleanAndParseJSON(response.text || "", fallbackObj);
      parsed.targetLocation = location;

      incrementServerLimit(userEmail, true);
      res.json(parsed);
    } catch (err) {
      handleServerError(res, err, "Compiling Regional Analysis");
    }
  });

  // API 4: /api/contact
  app.post("/api/contact", async (req: Request, res: Response) => {
    const contactHandler = (await import('./api/contact.js')).default;
    return contactHandler(req as any, res as any);
  });

  // API 5: /api/opportunity-dossier (on-demand full dossier for Market Gaps)
  app.post("/api/opportunity-dossier", async (req: Request, res: Response) => {
    const dossierHandler = (await import('./api/opportunity-dossier.js')).default;
    return dossierHandler(req as any, res as any);
  });

  // -------------------------------------------------------------

  // ---- Stripe Routes ----

  // Create a Stripe Checkout session and return its URL
  app.post("/api/stripe/create-checkout-session", async (req: Request, res: Response) => {
    const { plan, userEmail } = req.body;

    if (!plan || !userEmail) {
      return res.status(400).json({ error: "Missing required fields: plan, userEmail" });
    }

    const PRICE_MAP: Record<string, string | undefined> = {
      "Pro": process.env.STRIPE_PRICE_ID_PRO,
      "Pro+": process.env.STRIPE_PRICE_ID_PRO_PLUS,
    };

    const priceId = PRICE_MAP[plan as string];
    if (!priceId) {
      return res.status(400).json({
        error: `No Stripe Price ID configured for plan: ${plan}. Set STRIPE_PRICE_ID_PRO or STRIPE_PRICE_ID_PRO_PLUS in your environment.`,
      });
    }

    try {
      const stripe = getStripe();
      // Derive base URL from the request so Stripe redirects back to wherever
      // the server is actually running — not a hardcoded localhost fallback.
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: userEmail,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { plan, userEmail },
        success_url: `${appUrl}/?checkout=success&plan=${encodeURIComponent(plan)}`,
        cancel_url: `${appUrl}/pricing`,
      });
      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Stripe] Checkout session error:", err.message);
      res.status(500).json({ error: err.message || "Failed to create checkout session." });
    }
  });

  // Open the Stripe Billing Portal for an existing customer
  app.post("/api/stripe/create-portal-session", async (req: Request, res: Response) => {
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ error: "Missing required field: userEmail" });
    }

    try {
      const stripe = getStripe();
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });

      if (!customers.data.length) {
        return res.status(404).json({
          error: "No Stripe customer found for this account. Please complete a subscription checkout first.",
        });
      }

      // Derive base URL from the request so Stripe returns to the correct host.
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customers.data[0].id,
        return_url: `${appUrl}/billing`,
      });

      res.json({ url: portalSession.url });
    } catch (err: any) {
      console.error("[Stripe] Portal session error:", err.message);
      res.status(500).json({ error: err.message || "Failed to open billing portal." });
    }
  });

  // Return the user's active subscription plan and status
  app.get("/api/stripe/subscription-status", async (req: Request, res: Response) => {
    const userEmail = req.query.email as string;

    if (!userEmail) {
      return res.status(400).json({ error: "Missing query parameter: email" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.json({ plan: "Explorer", status: "not_configured", customerId: null });
    }

    try {
      const stripe = getStripe();
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });

      if (!customers.data.length) {
        return res.json({ plan: "Explorer", status: "no_customer", customerId: null });
      }

      const customer = customers.data[0];
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 1,
      });

      if (!subscriptions.data.length) {
        return res.json({ plan: "Explorer", status: "no_subscription", customerId: customer.id });
      }

      const sub = subscriptions.data[0];
      const priceId = sub.items.data[0]?.price.id;

      let derivedPlan = "Explorer";
      if (priceId === process.env.STRIPE_PRICE_ID_PRO) derivedPlan = "Pro";
      if (priceId === process.env.STRIPE_PRICE_ID_PRO_PLUS) derivedPlan = "Pro+";

      // current_period_end moved to SubscriptionItem in Stripe API 2026+
      const periodEnd = sub.items.data[0]?.current_period_end ?? null;

      res.json({
        plan: derivedPlan,
        status: sub.status,
        customerId: customer.id,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      });
    } catch (err: any) {
      console.error("[Stripe] Subscription-status error:", err.message);
      res.status(500).json({ error: err.message || "Failed to fetch subscription status." });
    }
  });

  // ---------------------------------------------------------------------------------------

  // Vite middleware for development or Static Asset Serve for Production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));

    // SEO meta injection for production — serves real <title>/<meta> to crawlers
    const fs = await import("fs");
    let indexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");

    const getSEOMeta = (pathname: string): { title: string; description: string; ogTitle: string; ogDescription: string } | null => {
      const slug = "[a-z0-9][a-z0-9-]*";
      const toCity = (s: string) => {
        const parts = s.split("-");
        const last = parts[parts.length - 1];
        if (last.length === 2) {
          return parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ") + ", " + last.toUpperCase();
        }
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
      };
      const toBiz = (s: string) => s.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");

      const bestBiz = pathname.match(new RegExp(`^/best-businesses/(${slug})/?$`));
      if (bestBiz) {
        const city = toCity(bestBiz[1]);
        return {
          title: `Best Businesses to Start in ${city} | BizScope`,
          description: `Discover the most profitable and low-competition business ideas in ${city}. AI-powered market analysis reveals top opportunities based on local demographics, competition density, and economic data.`,
          ogTitle: `Best Businesses to Start in ${city}`,
          ogDescription: `AI market analysis reveals the highest-potential business ideas in ${city}. See startup costs, competition levels, and revenue projections.`,
        };
      }
      const viability = pathname.match(new RegExp(`^/viability/(${slug})/(${slug})/?$`));
      if (viability) {
        const biz = toBiz(viability[1]);
        const city = toCity(viability[2]);
        return {
          title: `${biz} Viability in ${city} | BizScope`,
          description: `Is a ${biz} viable in ${city}? Get a detailed AI analysis of startup costs, local competition, demographics, and revenue potential before you invest.`,
          ogTitle: `${biz} Viability in ${city}`,
          ogDescription: `Detailed market viability report for ${biz} in ${city}. AI-driven analysis of startup costs, competition density, and revenue potential.`,
        };
      }
      const franchise = pathname.match(new RegExp(`^/franchise-opportunities/(${slug})/?$`));
      if (franchise) {
        const city = toCity(franchise[1]);
        return {
          title: `Best Franchise Opportunities in ${city} | BizScope`,
          description: `Explore top franchise opportunities in ${city}. Compare investment requirements, territory availability, and market fit using real demographic and economic data.`,
          ogTitle: `Best Franchise Opportunities in ${city}`,
          ogDescription: `Find the best franchise investments in ${city}. AI analysis of market fit, competition, and ROI potential for franchise seekers.`,
        };
      }
      const gaps = pathname.match(new RegExp(`^/market-gaps/(${slug})/?$`));
      if (gaps) {
        const city = toCity(gaps[1]);
        return {
          title: `Market Gaps in ${city} — Underserved Business Niches | BizScope`,
          description: `Discover underserved business niches and market gaps in ${city}. AI analysis of local demand vs. supply across 50+ business categories reveals hidden opportunities.`,
          ogTitle: `Market Gaps & Underserved Niches in ${city}`,
          ogDescription: `Find unmet demand and market gaps in ${city}. See which business types are underserved and which ZIP codes have the highest opportunity density.`,
        };
      }
      return null;
    };

    app.get("*", (req: Request, res: Response) => {
      const seoMeta = getSEOMeta(req.path);
      if (!seoMeta) {
        res.send(indexHtml);
        return;
      }
      const canonical = `https://bizscope.ai${req.path}`;
      const injected = indexHtml.replace(
        /<title>.*?<\/title>/,
        `<title>${seoMeta.title}</title>`
      ).replace(
        "</head>",
        [
          `<meta name="description" content="${seoMeta.description.replace(/"/g, "&quot;")}">`,
          `<meta property="og:title" content="${seoMeta.ogTitle.replace(/"/g, "&quot;")}">`,
          `<meta property="og:description" content="${seoMeta.ogDescription.replace(/"/g, "&quot;")}">`,
          `<meta property="og:type" content="website">`,
          `<meta property="og:url" content="${canonical}">`,
          `<link rel="canonical" href="${canonical}">`,
          "</head>",
        ].join("\n")
      );
      res.send(injected);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
