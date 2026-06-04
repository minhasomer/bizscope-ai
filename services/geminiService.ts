
import type { ViabilityReport, UserLocation, OpportunityReport, RegionalIntelligenceData } from '../types';
import { mockReport } from '../src/data/mockReport.js';
import { ReportCacheService } from './reportCacheService';
import { mockRegionalReport } from '../src/data/mockRegionalReport.js';
import { mockOpportunities } from '../src/data/mockOpportunities.js';
import { appConfig, isBetaRoleEnabled } from '../src/config/appConfig';
import { assertLiveService } from '../src/lib/guardrails';
import { supabase } from './supabaseClient';

/**
 * Whether Demo Mode is active.
 * Re-exported here for backwards-compat — prefer importing isDemoMode from
 * src/config/appConfig directly in new code.
 */
export const isDemoModeActive = (): boolean => appConfig.isDemoMode;

// Recursive helper for deep values replacement to make mock data look dynamic and premium/customized
function deepReplace(obj: any, replacements: { [key: string]: string }): any {
    if (typeof obj === 'string') {
        let result = obj;
        for (const [key, value] of Object.entries(replacements)) {
            const regex = new RegExp(key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            result = result.replace(regex, value);
        }
        return result;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepReplace(item, replacements));
    }
    if (typeof obj === 'object' && obj !== null) {
        const newObj: any = {};
        for (const [key, value] of Object.entries(obj)) {
            newObj[key] = deepReplace(value, replacements);
        }
        return newObj;
    }
    return obj;
}

// ─── Business-aware mock variation ─────────────────────────────────────────
// Produces deterministic, category-appropriate financial numbers so that
// different business types look genuinely distinct in the Comparative Matrix.

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
  return Math.abs(h);
}

function seededFloat(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

type CategoryKey = 'medical' | 'food' | 'wellness' | 'services' | 'retail' | 'tech' | 'finance' | 'general';

const CATEGORY_RANGES: Record<CategoryKey, {
  startupLow: [number,number]; startupHigh: [number,number];
  rev1: [number,number]; rev3Mult: [number,number];
  margin: [number,number]; breakEven: [number,number]; score: [number,number];
}> = {
  medical:  { startupLow:[180000,400000], startupHigh:[350000,800000], rev1:[320000,680000], rev3Mult:[1.5,2.2], margin:[18,34], breakEven:[16,28], score:[70,88] },
  food:     { startupLow:[65000,150000],  startupHigh:[130000,310000], rev1:[200000,450000], rev3Mult:[1.3,1.9], margin:[10,22], breakEven:[12,22], score:[62,82] },
  wellness: { startupLow:[50000,130000],  startupHigh:[120000,260000], rev1:[160000,360000], rev3Mult:[1.4,2.0], margin:[20,36], breakEven:[10,18], score:[65,84] },
  services: { startupLow:[12000,55000],   startupHigh:[40000,110000],  rev1:[100000,280000], rev3Mult:[1.5,2.4], margin:[28,50], breakEven:[5,14],  score:[68,88] },
  retail:   { startupLow:[70000,180000],  startupHigh:[150000,350000], rev1:[180000,500000], rev3Mult:[1.3,1.8], margin:[12,28], breakEven:[14,24], score:[58,80] },
  tech:     { startupLow:[25000,120000],  startupHigh:[80000,280000],  rev1:[120000,420000], rev3Mult:[1.8,3.5], margin:[25,55], breakEven:[8,20],  score:[60,84] },
  finance:  { startupLow:[18000,80000],   startupHigh:[60000,180000],  rev1:[100000,320000], rev3Mult:[1.6,2.8], margin:[22,46], breakEven:[6,16],  score:[63,82] },
  general:  { startupLow:[50000,150000],  startupHigh:[120000,280000], rev1:[160000,400000], rev3Mult:[1.4,2.0], margin:[14,30], breakEven:[10,20], score:[63,82] },
};

function getCategory(businessType: string): CategoryKey {
  const s = businessType.toLowerCase();
  if (/urgent care|medical|dental|clinic|doctor|hospital|therapy|chiro|optom|vet|health center/.test(s)) return 'medical';
  if (/restaurant|food|cafe|coffee|pizza|sushi|burger|kitchen|bakery|bar|grill|diner|halal|taco|bbq|wings/.test(s)) return 'food';
  if (/gym|fitness|yoga|pilates|crossfit|spa|wellness|massage|salon|beauty|barber|nail/.test(s)) return 'wellness';
  if (/cleaning|hvac|plumb|electric|landscap|pest|gutter|junk|detailing|moving|repair|handyman/.test(s)) return 'services';
  if (/retail|store|shop|boutique|clothing|apparel|gift|accessories|furniture|hardware/.test(s)) return 'retail';
  if (/tech|software|app|saas|digital|agency|marketing|web|media/.test(s)) return 'tech';
  if (/real estate|mortgage|insurance|finance|accounting|tax|invest/.test(s)) return 'finance';
  return 'general';
}

function lerp(min: number, max: number, t: number): number {
  return Math.round(min + (max - min) * t);
}

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

// ─── Category-aware realism data maps ────────────────────────────────────────

const MARKET_TRENDS_BY_CATEGORY: Record<CategoryKey, {
  summary: string;
  trends: Array<{ trend: string; impact: string }>;
}> = {
  medical: {
    summary: 'Structural shifts in how patients access and pay for healthcare are creating strong tailwinds for independent urgent care and specialty clinic operators.',
    trends: [
      { trend: 'Telehealth & Hybrid Care Adoption', impact: 'Patients expect digital booking and post-visit follow-up; clinics with hybrid care models reduce no-show rates by up to 40% and expand addressable patient volume without additional physical space.' },
      { trend: 'High-Deductible Plan Migration', impact: 'Growing consumer awareness of out-of-pocket costs drives walk-in traffic to cost-transparent clinics as a lower-cost alternative to emergency room visits.' },
      { trend: 'Preventive & Wellness Integration', impact: 'Clinics bundling routine screenings and wellness panels report 28% higher patient retention and a measurable increase in average revenue per visit.' },
    ],
  },
  food: {
    summary: 'Shift toward specialty sourcing, community-oriented spaces, and flexible consumption models is reshaping the local food and beverage market.',
    trends: [
      { trend: 'Specialty & Artisan Sourcing', impact: 'Premium ingredient sourcing commands a 300–400% markup on finished products, driving margin expansion for quality-focused operators who can credibly justify the premium.' },
      { trend: 'The Third-Place Workspace Effect', impact: 'Extended customer dwell time for remote workers boosts high-margin add-on purchases; requires investment in seating density, connectivity, and power infrastructure.' },
      { trend: 'Sustainable & Local Sourcing Demand', impact: 'Eco-friendly packaging and locally sourced ingredients increase repeat purchase loyalty by up to 35% among Millennial and Gen-Z consumers.' },
    ],
  },
  wellness: {
    summary: 'Consumer wellness spending is accelerating, with strong demand for recurring membership models and integrated mind-body service offerings.',
    trends: [
      { trend: 'Membership & Recurring Revenue Shift', impact: 'Monthly membership structures outperform drop-in models by 2.3× on revenue stability; studios with strong membership bases weather seasonal dips and command higher exit valuations.' },
      { trend: 'Mind-Body Integration Demand', impact: 'Consumer appetite for holistic services combining physical training with stress and recovery management expands upsell opportunities and justifies premium pricing tiers.' },
      { trend: 'Corporate Wellness Contract Growth', impact: 'B2B partnerships with local employers for subsidized wellness programs provide predictable high-margin revenue streams independent of consumer foot traffic.' },
    ],
  },
  services: {
    summary: 'On-demand booking platforms and recurring maintenance models are transforming customer acquisition and retention economics for residential and commercial service businesses.',
    trends: [
      { trend: 'On-Demand Platform Aggregation', impact: 'Platforms like Angi, Thumbtack, and Google Local Services Ads now drive 60–80% of new customer acquisition for residential service operators, reducing reliance on word-of-mouth-only growth.' },
      { trend: 'Recurring Maintenance Subscription Models', impact: 'Monthly and annual service contracts generate predictable recurring revenue and dramatically improve customer lifetime value versus one-time emergency call models.' },
      { trend: 'Eco-Friendly Service Premium', impact: 'Consumer demand for non-toxic, low-impact service methods commands a 15–25% price premium in suburban and affluent residential markets.' },
    ],
  },
  retail: {
    summary: 'Physical retail is bifurcating — commodity products are shifting to e-commerce while curated, experience-driven local retail is building strong consumer loyalty.',
    trends: [
      { trend: 'Experience-Driven Retail Shift', impact: 'Shoppers increasingly visit physical stores for curation and tactile experience rather than price; experiential zones and in-store events increase dwell time and basket size significantly.' },
      { trend: 'Omnichannel Inventory Expectation', impact: 'Consumers expect seamless in-store and online inventory visibility; retailers with integrated omnichannel operations outperform single-channel competitors by 35–40% on revenue per customer.' },
      { trend: 'Independent & Local Preference Growth', impact: 'Post-pandemic consumer sentiment strongly favors locally owned retail over national chains, particularly among Gen-Z and Millennial demographics in urban and suburban markets.' },
    ],
  },
  tech: {
    summary: 'AI-driven delivery, retainer model adoption, and niche specialization are creating strong margin expansion opportunities for focused technology service providers.',
    trends: [
      { trend: 'AI-Augmented Service Delivery', impact: 'Firms embedding AI tools in client deliverables command 30–50% higher project margins and faster delivery cycles, enabling revenue growth without proportional headcount expansion.' },
      { trend: 'Retainer & Subscription Revenue Shift', impact: 'Clients increasingly prefer predictable monthly retainers over project billing; retainer-anchored revenue reduces pipeline risk and dramatically improves business forecasting accuracy.' },
      { trend: 'Privacy-First & Compliance Demand', impact: 'Regulatory pressure around data privacy and security creates sustained demand for compliant technology solutions, particularly in healthcare, fintech, and e-commerce verticals.' },
    ],
  },
  finance: {
    summary: 'Digital service delivery expectations and increasing regulatory complexity are accelerating consolidation while creating openings for nimble independent advisory operators.',
    trends: [
      { trend: 'Digital-First Client Experience', impact: 'Clients now expect online portals, e-signature workflows, and real-time reporting access; firms without digital infrastructure are losing new client acquisition at an accelerating rate.' },
      { trend: 'Regulatory Complexity Growth', impact: 'Increasing tax, compliance, and reporting complexity drives demand for specialized advisory services, supporting premium billing rates and strong multi-year client retention.' },
      { trend: 'Holistic Planning Integration', impact: 'Consumer appetite for integrated services combining tax, investment, and insurance creates powerful cross-sell opportunities and improves long-term client relationship stickiness.' },
    ],
  },
  general: {
    summary: 'Local discovery, loyalty mechanics, and review velocity are the primary competitive levers for independently owned local businesses across categories.',
    trends: [
      { trend: 'Local SEO & Proximity Discovery', impact: 'Over 72% of local business searches result in a same-day visit; Google Business optimization is the highest-ROI acquisition channel for local operators at near-zero incremental cost.' },
      { trend: 'Consumer Loyalty Subscription Demand', impact: 'Businesses with structured membership or loyalty programs report 20–35% higher repeat purchase rates and measurable improvements in customer lifetime value.' },
      { trend: 'Review Velocity as Competitive Moat', impact: 'Local businesses with 50+ Google reviews acquire new customers at 3× the rate of unreviewed competitors; review generation should be a structured operational process from day one.' },
    ],
  },
};

const KEY_STATS_BY_CATEGORY: Record<CategoryKey, Array<{ label: string; value: string }>> = {
  medical:  [{ label: 'Avg Patient Visit Value', value: '$145' },        { label: 'Daily Patient Volume',        value: '52'     }, { label: 'Cost of Care Delivery',   value: '38%'    }, { label: 'Monthly Operating Cost', value: '$42,000' }],
  food:     [{ label: 'Avg Ticket Size',          value: '$9.20' },      { label: 'Daily Transactions',          value: '210'    }, { label: 'Cost of Goods Sold',      value: '28%'    }, { label: 'Monthly Operating Cost', value: '$18,500' }],
  wellness: [{ label: 'Avg Session Value',        value: '$85' },        { label: 'Daily Client Sessions',       value: '38'     }, { label: 'Instructor Cost Ratio',   value: '42%'    }, { label: 'Monthly Operating Cost', value: '$14,200' }],
  services: [{ label: 'Avg Job Value',            value: '$340' },       { label: 'Daily Jobs Completed',        value: '9'      }, { label: 'Material & Labor Cost',   value: '52%'    }, { label: 'Monthly Operating Cost', value: '$11,800' }],
  retail:   [{ label: 'Avg Transaction Size',     value: '$62' },        { label: 'Daily Transactions',          value: '74'     }, { label: 'Cost of Goods Sold',      value: '48%'    }, { label: 'Monthly Operating Cost', value: '$22,000' }],
  tech:     [{ label: 'Avg Project / Retainer',   value: '$3,200' },     { label: 'Active Monthly Clients',      value: '8'      }, { label: 'Delivery Cost Ratio',     value: '38%'    }, { label: 'Monthly Operating Cost', value: '$28,000' }],
  finance:  [{ label: 'Avg Annual Client Fee',    value: '$4,800' },     { label: 'Active Client Accounts',      value: '22'     }, { label: 'Overhead Cost Ratio',     value: '32%'    }, { label: 'Monthly Operating Cost', value: '$19,500' }],
  general:  [{ label: 'Avg Transaction Value',    value: '$95' },        { label: 'Daily Transactions',          value: '28'     }, { label: 'Cost of Goods Sold',      value: '34%'    }, { label: 'Monthly Operating Cost', value: '$16,500' }],
};

const SUCCESS_FACTORS_BY_CATEGORY: Record<CategoryKey, Array<{ factor: string; description: string; importance: string }>> = {
  medical: [
    { factor: 'Insurance Network Credentialing',       description: 'Joining major payer panels (BCBS, Aetna, UHC) before opening is the highest-leverage step; out-of-network clinics capture only 15–20% of available patient volume.',                                                                           importance: 'Critical' },
    { factor: 'EHR & Billing System Efficiency',       description: 'Purpose-built electronic health record and billing systems reduce claim rejection rates and administrative overhead, directly protecting net margin from day one.',                                                                              importance: 'High'     },
    { factor: 'Location Near High-Traffic Corridors',  description: 'Placement within 1–2 miles of a major ER or primary care gap captures high-intent cost-avoidance traffic from patients seeking faster, lower-cost alternatives.',                                                                              importance: 'High'     },
  ],
  food: [
    { factor: 'Micro-Location Selection',              description: 'Securing a storefront near transit nodes, office clusters, or high foot traffic corridors is the single most durable structural advantage for a food and beverage concept.',                                                                    importance: 'Critical' },
    { factor: 'Brand Identity & Visual Experience',    description: 'A distinct, on-brand environment that reinforces identity drives organic social media visibility, increases dwell time, and supports premium pricing versus commodity competitors.',                                                            importance: 'High'     },
    { factor: 'Consistent Product & Service Quality',  description: 'Operational consistency in product execution and service speed is the foundation of customer retention and the primary driver of word-of-mouth in competitive food markets.',                                                                  importance: 'High'     },
  ],
  wellness: [
    { factor: 'Instructor & Staff Retention',          description: 'In wellness businesses, client retention correlates directly with individual staff relationships; losing a key instructor can trigger 20–40% member attrition within 60 days.',                                                               importance: 'Critical' },
    { factor: 'Membership Model Architecture',         description: 'Monthly unlimited memberships with structured pause (not cancel) options create predictable recurring revenue and significantly reduce churn during seasonal slow periods.',                                                                   importance: 'High'     },
    { factor: 'Community & Transformation Marketing',  description: 'Visible client success stories and community challenge events are the primary conversion drivers for new wellness memberships, consistently outperforming paid advertising in this category.',                                                 importance: 'High'     },
  ],
  services: [
    { factor: 'Online Reputation Management',          description: 'Home service businesses with 4.7+ star ratings command 20–35% higher prices and close inbound leads at 2× the rate of lower-rated competitors in the same service area.',                                                                   importance: 'Critical' },
    { factor: 'Route Density & Job Optimization',      description: 'Clustering service routes geographically reduces fuel and drive-time costs by up to 30%, directly improving per-job profitability without any price increase.',                                                                               importance: 'High'     },
    { factor: 'Recurring Maintenance Contract Conversion', description: 'Converting one-time service clients to quarterly or annual maintenance agreements reduces customer acquisition cost and builds predictable monthly revenue.',                                                                              importance: 'High'     },
  ],
  retail: [
    { factor: 'Inventory Turnover Velocity',           description: 'Retailers achieving 6+ annual inventory turns consistently outperform on margin; slow-moving SKUs consume cash and erode profitability faster than any other operational variable.',                                                          importance: 'Critical' },
    { factor: 'Visual Merchandising & Store Experience', description: 'Window displays, in-store layout, and merchandising quality directly influence conversion from passerby to buyer; professional merchandising ROI exceeds paid advertising in local retail.',                                                 importance: 'High'     },
    { factor: 'Loyalty Program & Repeat Purchase Rate', description: 'A well-structured loyalty program increases purchase frequency by 18–28% and dramatically reduces dependence on expensive new customer acquisition campaigns.',                                                                              importance: 'High'     },
  ],
  tech: [
    { factor: 'Portfolio Depth & Case Study Quality',  description: 'Technical buyers evaluate agencies almost exclusively on demonstrated prior work with measurable outcomes; a strong portfolio generates inbound referrals that no paid marketing budget can replicate.',                                        importance: 'Critical' },
    { factor: 'Retainer Conversion from Projects',     description: 'Converting one-time project clients to ongoing retainer agreements is the highest-leverage growth move; retainer clients generate 5× the lifetime revenue of project-only engagements.',                                                     importance: 'High'     },
    { factor: 'Niche Specialization & Positioning',    description: 'Generalist technology firms compete on price; specialists in defined verticals command 40–80% fee premiums and attract inbound referrals from complementary advisors and integrators.',                                                      importance: 'High'     },
  ],
  finance: [
    { factor: 'Credential Visibility & Trust Signaling', description: 'CPA, CFP, or CFA designations prominently displayed in all client-facing materials increase conversion rates by 35–50% and justify premium fee structures over uncredentialed competitors.',                                               importance: 'Critical' },
    { factor: 'Digital Onboarding & Client Portal',    description: 'Streamlined digital onboarding with e-signing, client portals, and automated reporting is the #1 retention driver in the first 90 days of a new client relationship.',                                                                       importance: 'High'     },
    { factor: 'Referral Network Development',          description: 'Strategic relationships with estate attorneys, mortgage brokers, and HR consultants generate 60–75% of new business for established financial practices at near-zero acquisition cost.',                                                     importance: 'High'     },
  ],
  general: [
    { factor: 'Micro-Location & Proximity Advantage',  description: 'Proximity to high foot traffic corridors, transit nodes, or complementary anchor businesses is the most durable structural competitive advantage for a new local business.',                                                                  importance: 'Critical' },
    { factor: 'Digital Presence & Review Velocity',    description: 'Achieving 50+ Google reviews within the first 90 days establishes local SEO authority and dramatically improves conversion from proximity-based searches.',                                                                                   importance: 'High'     },
    { factor: 'Consistent Service Quality',            description: 'In local markets, word-of-mouth is the highest-ROI acquisition channel; operational consistency that generates 5-star reviews compounds faster than any paid strategy.',                                                                      importance: 'High'     },
  ],
};

const RISKS_BY_CATEGORY: Record<CategoryKey, Array<{ risk: string; impact: string; severity: string; mitigation: string }>> = {
  medical: [
    { risk: 'Insurance Credentialing Delays',       impact: 'Revenue launch can be delayed 90–180 days until major payer panels complete clinic approval.',                                                                          severity: 'High',   mitigation: 'Begin credentialing applications 6 months before opening and engage a medical billing service to manage the process in parallel with build-out.' },
    { risk: 'Provider Licensing & Compliance Risk', impact: 'Regulatory violations can result in license suspension and an immediate revenue halt with no grace period.',                                                           severity: 'High',   mitigation: 'Engage a healthcare compliance consultant before opening and implement quarterly internal audits of all provider credentials and DEA registrations.' },
    { risk: 'Malpractice & Liability Exposure',     impact: 'A single adverse event without adequate coverage can generate legal costs exceeding annual revenue.',                                                                  severity: 'Medium', mitigation: 'Secure occurrence-based malpractice coverage at $1M/$3M minimum before seeing the first patient; review policy limits annually as patient volume grows.' },
  ],
  food: [
    { risk: 'Rising Lease & Real Estate Costs',     impact: 'Higher monthly overhead raises the break-even revenue threshold and reduces the margin cushion during the critical ramp-up period.',                                  severity: 'High',   mitigation: 'Secure a 5+5 year long-term lease with locked-in incremental rent caps before committing to the build-out investment.' },
    { risk: 'Health Inspection & Safety Compliance', impact: 'A single failed health inspection can trigger temporary closure and generate lasting reputational damage across review platforms.',                                   severity: 'Medium', mitigation: 'Conduct monthly internal audits using the county health inspection checklist and invest in food safety certification for all food-handling staff.' },
    { risk: 'High Staff Turnover Rates',            impact: 'Inconsistent service quality and recurring training costs erode margin and damage customer experience at the worst possible time.',                                    severity: 'Medium', mitigation: 'Implement competitive scheduling flexibility, tip pooling, and a structured 90-day onboarding program to significantly reduce first-year turnover.' },
  ],
  wellness: [
    { risk: 'Key Instructor Dependency',            impact: 'Departure of a popular instructor can trigger 20–40% member attrition within 60 days of announcement.',                                                               severity: 'High',   mitigation: 'Avoid exclusive client-instructor relationships; cross-train members across multiple staff from day one and build the brand above individual personalities.' },
    { risk: 'Membership Churn in Off-Peak Seasons', impact: 'Summer and post-January churn cycles can reduce active memberships by 15–30% without proactive retention programming.',                                               severity: 'Medium', mitigation: 'Offer structured pause options instead of cancellations, and run re-engagement campaigns 2–3 weeks before historically high-churn periods.' },
    { risk: 'Equipment Capital & Lease Overhead',   impact: 'High upfront equipment and build-out costs extend the break-even timeline significantly compared to service-only business models.',                                   severity: 'Medium', mitigation: 'Negotiate a tenant improvement allowance (TIA) from the landlord and explore equipment leasing to reduce initial capital requirements.' },
  ],
  services: [
    { risk: 'Seasonal Revenue Variability',         impact: 'Demand for most home services drops 20–40% during winter months, creating cash flow gaps that strain operations.',                                                    severity: 'High',   mitigation: 'Build a recurring maintenance contract base before scaling; predictable year-round contracts reduce dependence on seasonal call volume.' },
    { risk: 'Employee Liability & Incident Exposure', impact: 'Property damage, worker injuries, or field no-shows create both direct cost liability and immediate reputational risk online.',                                     severity: 'High',   mitigation: 'Maintain general liability insurance ($1M+), require background checks for all field staff, and implement GPS job tracking for real-time accountability.' },
    { risk: 'Undercutting by Unlicensed Operators', impact: 'Solo and unlicensed operators undercut market pricing by 30–50%, making cost-sensitive lead channels difficult to compete in profitably.',                            severity: 'Medium', mitigation: 'Compete on trust signals — licensing badges, insurance documentation, and review count — rather than price; target quality-conscious residential segments.' },
  ],
  retail: [
    { risk: 'Inventory Overstock & Cash Tie-Up',    impact: 'Excess inventory consumes working capital reserves and forces margin-destroying clearance markdowns that damage brand positioning.',                                  severity: 'High',   mitigation: 'Implement open-to-buy budgeting from day one and set 60%+ full-price sell-through rate targets to discipline reorder decisions.' },
    { risk: 'E-Commerce Substitution Pressure',     impact: 'Online competitors offer identical SKUs with 2-day delivery at lower prices, suppressing in-store traffic for commodity product categories.',                        severity: 'High',   mitigation: 'Differentiate through curated assortment, local expertise, and in-store experiences that online retail structurally cannot replicate.' },
    { risk: 'Anchor Tenant & Foot Traffic Risk',    impact: 'Loss of a nearby anchor tenant can reduce location foot traffic by 30–50% within 6 months of departure.',                                                           severity: 'Medium', mitigation: 'Negotiate co-tenancy clauses in the lease that trigger rent reductions if identified anchor tenants vacate during the term.' },
  ],
  tech: [
    { risk: 'Client Revenue Concentration',         impact: 'A single client representing over 30% of revenue creates existential dependency that threatens business continuity if the relationship ends.',                       severity: 'High',   mitigation: 'Cap any single client at 25% of ARR from month one; actively build a diversified pipeline and document all client relationship context to reduce key-person risk.' },
    { risk: 'Scope Creep & Project Margin Erosion', impact: 'Poorly bounded projects routinely expand 40–80% beyond original estimates, systematically destroying margin on fixed-fee engagements.',                             severity: 'High',   mitigation: 'Implement rigorous SOW discipline, weekly scope check-ins, and clear change order protocols before any project engagement begins.' },
    { risk: 'Talent Acquisition & Retention Costs', impact: 'Technical talent turnover costs 1.5–2× annual salary in replacement, recruitment, and productivity ramp-up.',                                                       severity: 'Medium', mitigation: 'Offer equity participation, location flexibility, and structured career advancement paths to compete with larger employers on non-salary dimensions.' },
  ],
  finance: [
    { risk: 'Regulatory Compliance & Licensing',    impact: 'Operating without proper registration (RIA, broker-dealer, CPA license) triggers regulatory action and immediate reputational damage.',                              severity: 'High',   mitigation: 'Engage a compliance attorney before launch to map all required licenses and registrations for the specific services being offered in this jurisdiction.' },
    { risk: 'Client Trust & Relationship Attrition', impact: 'Loss of a prominent client can trigger social proof erosion; financial advisory practices are highly referral-dependent and attrition can be self-reinforcing.',   severity: 'High',   mitigation: 'Implement a proactive communication cadence — quarterly reviews, market commentary, milestone outreach — to cement loyalty before clients face competitor contact.' },
    { risk: 'Market Downturn Revenue Impact',       impact: 'AUM-based fee models directly link revenue to market performance, creating 15–30% revenue variability in down-market years.',                                       severity: 'Medium', mitigation: 'Diversify revenue with flat retainer-based planning fees and project-based engagements that are independent of market conditions.' },
  ],
  general: [
    { risk: 'Rising Lease & Overhead Costs',        impact: 'Higher monthly fixed costs raise the break-even threshold and reduce margin flexibility during the critical ramp-up period.',                                        severity: 'High',   mitigation: 'Secure a long-term lease with rent escalation caps and negotiate a tenant improvement allowance to reduce initial build-out capital requirements.' },
    { risk: 'Staff Turnover & Service Consistency', impact: 'Inconsistent service quality from staff turnover erodes customer experience and generates negative reviews during the most important brand-building phase.',          severity: 'Medium', mitigation: 'Invest in competitive base pay, structured onboarding, and clear advancement paths; first-year retention is significantly cheaper than recurring recruitment.' },
    { risk: 'Demand Seasonality & Cash Flow Gaps',  impact: 'Seasonal revenue dips strain working capital if operating reserves are insufficient to cover fixed monthly obligations.',                                            severity: 'Low',    mitigation: 'Build 3 months of operating reserves before launch and use slow seasons for marketing investment and pre-sale campaigns to smooth revenue curves.' },
  ],
};

const COMPETITOR_NAMES_BY_CATEGORY: Record<CategoryKey, [string, string, string]> = {
  medical:  ['Metro Urgent Care',          'AFC Urgent Care',           'QuickMed Clinic'          ],
  food:     ['The Local Roast',            'Starbucks',                 'Corner Café & Eatery'     ],
  wellness: ['Peak Performance Studio',    'Orangetheory Fitness',      'Flex & Flow Wellness'     ],
  services: ['ProClean Services',          'ServiceMaster',             'Rapid Response Pros'      ],
  retail:   ['The Local Boutique',         'National Retail Chain',     'Neighborhood Finds Co.'   ],
  tech:     ['Pixel & Code Agency',        'Digital Horizons Group',    'TechCraft Solutions'      ],
  finance:  ['Summit Financial Advisors',  'Edward Jones',              'ClearPath Accounting'     ],
  general:  ['Vanguard Enterprises',       'National Chain Operator',   'Apex Elite Services'      ],
};

const COMPETITOR_DETAILS_BY_CATEGORY: Record<CategoryKey, [string, string, string]> = {
  medical: [
    'Established urgent care with strong local brand and insurance network participation. Consistently long wait times during peak hours create a measurable patient satisfaction gap.',
    'National franchise with standardized care protocols and strong consumer trust equity. Higher overhead structure limits pricing flexibility and the personalized care experience.',
    'Small independent clinic with a loyal patient base. Limited operating hours and walk-in capacity create consistent overflow opportunity for a well-positioned new entrant.',
  ],
  food: [
    'Established local spot with a loyal morning crowd and strong community presence. Limited seating capacity and a narrow menu constrain the revenue ceiling during peak hours.',
    'National chain with high foot traffic and consistent product execution. Lacks the local identity and product differentiation that drives premium pricing and brand loyalty in this market.',
    'Neighborhood café catering to remote workers and students. Strong atmosphere but limited menu depth and no evening service leave significant revenue potential untapped.',
  ],
  wellness: [
    'Established studio with a strong recurring membership base and recognized local brand. Limited class variety and aging equipment are reported friction points among former members.',
    'National franchise offering structured programming and strong brand recognition. Higher price point and rigid scheduling limit appeal for flexibility-seeking wellness consumers.',
    'Boutique studio with a loyal niche following and strong personal instructor relationships. Limited class capacity and restricted operating hours cap the growth potential.',
  ],
  services: [
    'Full-service local operator with a strong residential referral network built over years. Slower response times and an aging equipment fleet generate recurring negative reviews.',
    'Regional franchise with broad name recognition and standardized service execution. Higher overhead drives premium pricing that creates a clear opening for leaner owner-operated competitors.',
    'Small owner-operated business with competitive pricing and low overhead. Limited licensing documentation and informal operations create a trust gap for quality-conscious residential buyers.',
  ],
  retail: [
    'Locally owned shop with a curated selection and strong community following. Inconsistent store hours and limited inventory depth constrain revenue during peak shopping periods.',
    'National chain offering broad product selection and competitive everyday pricing. Lacks the specialized expertise and personalized service that drives loyalty in this product category.',
    'Niche boutique with a passionate owner and distinct aesthetic identity. Minimal online presence and limited marketing reach restrict new customer discovery and acquisition.',
  ],
  tech: [
    'Established local agency with a strong project portfolio and enterprise client relationships. Limited capacity for mid-market engagements creates a clear underserved segment.',
    'Mid-size regional firm with broad service capabilities and institutional client relationships. Slower delivery timelines and rigid pricing structures frustrate agile-focused buyers.',
    'Boutique specialist with high-quality output in a narrow technical niche. No structured sales process and limited capacity restrict revenue growth beyond the founding team.',
  ],
  finance: [
    'Established advisory practice with long-tenured client relationships and a strong referral network. Aging client demographics and limited digital service delivery create retention risk.',
    'National financial brand with broad product access and built-in consumer trust equity. Commission-based model creates a perceived conflict of interest that fee-only positioning addresses directly.',
    'Independent practitioner with deep niche expertise and a loyal client base. Minimal marketing presence and no digital onboarding tools create friction in new client acquisition.',
  ],
  general: [
    'Established local operator with a strong community presence and loyal repeat customer base. Inconsistent service execution and limited digital visibility leave new customer acquisition gaps.',
    'National operator with standardized service delivery and brand recognition. Premium pricing and lack of local personalization create a clear opening for a community-focused alternative.',
    'Small independent operator with low overhead and highly personalized service. Informal operations and minimal marketing investment create trust gaps for quality-conscious buyers.',
  ],
};

const COMPETITION_SUMMARY_BY_CATEGORY: Record<CategoryKey, string> = {
  medical:  'Moderate clinic density with clear patient capacity gaps. Patients actively seek faster, more cost-transparent alternatives to emergency rooms. Existing operators are not fully capturing available walk-in volume.',
  food:     'Active local competitive landscape with clear white space for differentiated concepts. Local consumers actively seek non-chain options with distinct identity and product quality.',
  wellness: 'Established wellness presence in the area, but no single operator owns the premium recurring membership segment. Fragmented competition creates a clear positioning opportunity.',
  services: 'Competitive market with a mix of franchise and independent operators. Significant trust and quality gaps among existing providers create a strong opening for a reliably licensed, well-reviewed entrant.',
  retail:   'Active retail environment with a mix of national chains and independents. Consumer preference for curated local retail is outpacing commodity chain performance in this segment.',
  tech:     'Competitive agency market dominated by generalists. Clear white space for specialized, outcome-focused firms with strong portfolio credentials and a defined vertical niche.',
  finance:  'Established advisory presence from national brands, but limited independent fee-only practitioners. High-net-worth consumer demand for conflict-free advisory services is underserved in this market.',
  general:  'Active local competitive landscape with clear white space. Local consumers are actively seeking alternatives with stronger service consistency and genuine local identity.',
};

const STARTUP_BREAKDOWN_BY_CATEGORY: Record<CategoryKey, string> = {
  medical:  'Clinic build-out & exam room fit-out ($85k), medical equipment & diagnostic devices ($145k), EHR system & credentialing services ($28k), initial supplies, licensing & working capital ($62k).',
  food:     'Lease deposit & restaurant build-out ($45k), commercial kitchen equipment & furniture ($65k), initial inventory, permits & POS system ($18k), marketing launch & working capital ($28k).',
  wellness: 'Studio build-out & specialty flooring ($40k), equipment & fixtures ($45k), booking platform & technology ($12k), marketing launch & working capital ($25k).',
  services: 'Vehicle purchase & fleet branding ($22k), equipment & specialized tools ($18k), licensing, bonding & insurance ($8k), marketing & working capital ($12k).',
  retail:   'Storefront build-out & fixtures ($45k), opening inventory purchase ($85k), POS & e-commerce integration ($12k), marketing launch & working capital ($28k).',
  tech:     'Office setup & workstations ($18k), software licenses & development tooling ($14k), legal & incorporation costs ($8k), initial payroll runway & marketing ($40k).',
  finance:  'Regulatory filings & licensing ($12k), office setup & compliance software ($18k), professional liability insurance ($8k), marketing & client acquisition runway ($22k).',
  general:  'Lease deposit & space build-out ($35k), equipment & operational fixtures ($48k), initial inventory & licenses ($18k), marketing launch & working capital ($19k).',
};

function buildReasoning(
  score: number,
  roiTimeStr: string,
  marginStr: string,
  cat: CategoryKey,
  scoreBreakdown: { marketDemand: number; competitionIntensity: number; financialFeasibility: number; riskLevel: number } | null,
): string {
  const compScore = scoreBreakdown?.competitionIntensity ?? 50;
  const compPhrase = compScore > 62 ? 'manageable competitive intensity' : compScore > 45 ? 'moderate competition' : 'relatively low competition';
  const viabilityAdj = score >= 76 ? 'strong' : score >= 65 ? 'solid' : 'moderate';
  const catLabel: Record<CategoryKey, string> = {
    medical: 'healthcare services', food: 'food & beverage', wellness: 'wellness services',
    services: 'local service demand', retail: 'retail spending', tech: 'technology services',
    finance: 'professional services', general: 'local market demand',
  };
  return `The data shows ${viabilityAdj} consumer demand for ${catLabel[cat]} in this location, with ${compPhrase} and a projected ${marginStr} net margin. At an estimated ${roiTimeStr} return timeline, this market presents a viable path to profitability for an operator ready to execute on the key operational factors identified in this report.`;
}

function applyBusinessVariation(report: any, businessType: string, location: string): void {
  const seed = hashStr((businessType + '|' + location).toLowerCase());
  const t0 = seededFloat(seed);
  const t1 = seededFloat(seed + 1);
  const t2 = seededFloat(seed + 2);
  const t3 = seededFloat(seed + 3);

  const cat = getCategory(businessType);
  const r = CATEGORY_RANGES[cat];

  const startLow  = lerp(r.startupLow[0],  r.startupLow[1],  t0);
  const startHigh = lerp(r.startupHigh[0], r.startupHigh[1], t1);
  const rev1      = lerp(r.rev1[0], r.rev1[1], t2);
  const rev3Mult  = r.rev3Mult[0] + (r.rev3Mult[1] - r.rev3Mult[0]) * t3;
  const rev3      = Math.round(rev1 * rev3Mult / 1000) * 1000;
  const margin    = (r.margin[0] + (r.margin[1] - r.margin[0]) * t1).toFixed(1);
  const breakEven = lerp(r.breakEven[0], r.breakEven[1], t2);
  const score     = lerp(r.score[0], r.score[1], t0);

  report.viabilityScore = score;
  report.financialProjections.startupCostRange = `${fmt(startLow)} - ${fmt(startHigh)}`;
  report.financialProjections.revenueYear1 = fmt(Math.round(rev1 / 1000) * 1000);
  report.financialProjections.revenueYear3 = fmt(rev3);
  report.financialProjections.profitMargin = `${margin}%`;
  report.financialProjections.breakEvenTime = `${breakEven} months`;
  report.financialProjections.roiTime = `${Math.round(breakEven / 12 * 10) / 10 + 0.5} years`;

  const roiTimeStr = report.financialProjections.roiTime as string;

  if (report.scoreBreakdown) {
    report.scoreBreakdown = {
      marketDemand:          lerp(55, 95, seededFloat(seed + 4)),
      competitionIntensity:  lerp(25, 75, seededFloat(seed + 5)),
      financialFeasibility:  lerp(50, 90, seededFloat(seed + 6)),
      riskLevel:             lerp(15, 55, seededFloat(seed + 7)),
    };
  }

  // ── Category-aware content overrides ────────────────────────────────────

  // 1. Market trends
  const trendData = MARKET_TRENDS_BY_CATEGORY[cat];
  if (report.marketTrends) {
    report.marketTrends.summary = trendData.summary;
    report.marketTrends.trends  = trendData.trends;
  }

  // 2. Key stats + startup breakdown
  if (report.financialProjections) {
    report.financialProjections.keyStats              = KEY_STATS_BY_CATEGORY[cat];
    report.financialProjections.startupCostBreakdown  = STARTUP_BREAKDOWN_BY_CATEGORY[cat];
  }

  // 3. Recommendation reasoning (uses actual computed values)
  if (report.recommendation) {
    report.recommendation.reasoning = buildReasoning(
      score, roiTimeStr, `${margin}%`, cat, report.scoreBreakdown,
    );
  }

  // 4. Success factors
  if (report.successFactors) {
    report.successFactors.factors = SUCCESS_FACTORS_BY_CATEGORY[cat];
  }

  // 5. Risk factors
  if (report.riskAssessment) {
    report.riskAssessment.risks = RISKS_BY_CATEGORY[cat];
  }

  // 6. Competitor names, descriptions & competition summary
  if (report.competitionAnalysis) {
    report.competitionAnalysis.summary = COMPETITION_SUMMARY_BY_CATEGORY[cat];
    if (Array.isArray(report.competitionAnalysis.competitors)) {
      const names   = COMPETITOR_NAMES_BY_CATEGORY[cat];
      const details = COMPETITOR_DETAILS_BY_CATEGORY[cat];
      report.competitionAnalysis.competitors.forEach((comp: any, i: number) => {
        if (i < names.length)   comp.name    = names[i];
        if (i < details.length) comp.details = details[i];
      });
    }
  }
}

// Generate seeded, deterministic Map coordinates inside the United States continental boundaries
function getCoordinatesForLocation(locStr: string) {
    let hash = 0;
    for (let i = 0; i < locStr.length; i++) {
        hash = locStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);
    // US Boundaries roughly:
    // Lat: 26.0 to 48.0
    // Lng: -122.0 to -75.0
    const lat = 26.0 + (absHash % 220) / 10;
    const lng = -122.0 + ((absHash >> 2) % 470) / 10;
    return { latitude: lat, longitude: lng };
}


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

export const generateViabilityReport = async (
    businessType: string,
    location: string,
    userLocation: UserLocation | null,
    setLoadingMessage: (message: string) => void,
    planTier: string = 'Explorer',
    forceRegenerate: boolean = false,
    userRole: string = ''
): Promise<ViabilityReport> => {
    const _useLive = !(appConfig.isDemoMode && !isBetaRoleEnabled(userRole));
    console.log(`[BizScope] report routing: role="${userRole}" isDemoMode=${appConfig.isDemoMode} isBetaRoleEnabled=${isBetaRoleEnabled(userRole)} forceRegenerate=${forceRegenerate} → ${_useLive ? 'LIVE /api/analyze' : 'MOCK'}`);

    if (!forceRegenerate) {
        setLoadingMessage("Checking cache records...");
        const cached = await ReportCacheService.get(businessType, location, 'standard', planTier);
        if (cached) {
            setLoadingMessage("Cache hit! Loading report...");
            await new Promise(resolve => setTimeout(resolve, 300));
            return cached as ViabilityReport;
        }
    }

    let result: ViabilityReport;
    if (appConfig.isDemoMode && !isBetaRoleEnabled(userRole)) {
        setLoadingMessage("Checking environment cache...");
        await new Promise(resolve => setTimeout(resolve, 600));
        setLoadingMessage("Analyzing local competition with Google Maps...");
        await new Promise(resolve => setTimeout(resolve, 850));
        setLoadingMessage("Researching market trends, census data, and financial benchmarks...");
        await new Promise(resolve => setTimeout(resolve, 850));
        setLoadingMessage("Synthesizing financial models and strategic risk analysis...");
        await new Promise(resolve => setTimeout(resolve, 700));

        const isRegional = location.toLowerCase().includes('county') || 
                           location.toLowerCase().includes('region') || 
                           location.toLowerCase().includes('state') || 
                           location.toLowerCase().includes('oc') || 
                           location.toLowerCase().includes('orange');
        const baseReport = isRegional ? mockRegionalReport : mockReport;

        const targetBiz = businessType.charAt(0).toUpperCase() + businessType.slice(1);
        const repDict = isRegional ? {
            "Boutique Fitness Studio": targetBiz,
            "boutique fitness studio": businessType.toLowerCase(),
            "fitness studio": businessType.toLowerCase(),
            "fitness market": "industry market",
            "Orange County, CA": location,
            "Orange County": location,
            "OC": location,
            "Irvine, CA": location,
            "gym, spa, pools, classes": "full-service platform operations",
            "Pilates clubs": "local standard competitors",
            "private cross-training venues": "independently run alternatives",
            "Pilates/Pilates Reformer or spin equipment": "premium specialized setup",
            "Equinox Sports Club": "Alpha Prime Competitor",
            "OrangeTheory Fitness": "Summit Core Services",
            "Club Pilates": "Omni Segment Group",
            "health and fitness": "solutions and services",
            "gym memberships": "recurring client subscriptions",
            "active life": "quality lifestyle",
            "trainers": "specialists",
            "trainer": "specialist",
            "instructors": "experts"
        } : {
            "Artisanal Coffee Shop": targetBiz,
            "artisanal coffee shop": businessType.toLowerCase(),
            "coffee shop": businessType.toLowerCase(),
            "specialty coffee": businessType.toLowerCase(),
            "brewing Experiences": "business operations",
            "pour-overs or local artisanal pastries": "custom service options",
            "Brooklyn, NY": location,
            "Brooklyn": location,
            "Atlantic Ave": "Main St",
            "Flatbush Ave": "Broadway",
            "Bedford Ave": "Oak Ave",
            "Brew & Co.": "Vanguard Enterprises",
            "The Grind Coffee House": "Apex Elite Services",
            "specialty coffee beans": "specialized solutions",
            "artisanal beans": "professional services",
            "dining and specialty coffee": "local commerce",
            "baristas": "staff specialists",
            "lattes": "premium options",
            "espresso": "standard operations",
            "pourover": "specialty features",
            "pastries": "accessories",
            "pastry": "accessory"
        };

        const customized = deepReplace(baseReport, repDict);
        customized.businessType = targetBiz;
        customized.location = location;
        applyBusinessVariation(customized, businessType, location);

        const center = getCoordinatesForLocation(location);
        customized.targetCoordinates = center;
        if (customized.competitionAnalysis && Array.isArray(customized.competitionAnalysis.competitors)) {
            customized.competitionAnalysis.competitors = customized.competitionAnalysis.competitors.map((comp: any, index: number) => {
                const offsetLat = (index === 0 ? 0.005 : index === 1 ? -0.004 : 0.003) + (Math.sin(index) * 0.001);
                const offsetLng = (index === 0 ? -0.003 : index === 1 ? 0.005 : -0.005) + (Math.cos(index) * 0.001);
                return {
                    ...comp,
                    latitude: center.latitude + offsetLat,
                    longitude: center.longitude + offsetLng
                };
            });
        }

        result = customized as ViabilityReport;
    } else {
        // assertLiveService is intentionally omitted here. Beta-role users reach
        // this branch while VITE_DEMO_MODE=true — that is by design. The server
        // enforces the role gate independently; this is a frontend routing decision.
        const sessionResult = await supabase?.auth.getSession();
        const token = sessionResult?.data?.session?.access_token ?? null;
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-plan-tier': planTier,
                'x-user-email': localStorage.getItem('bizscope_user_email') || 'anonymous@bizscope.ai',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                businessType,
                location,
                userLocation,
                planTier,
                userEmail: localStorage.getItem('bizscope_user_email') || 'anonymous@bizscope.ai'
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const message = errorData.error || `Server responded with status ${response.status}`;
            throw new Error(message);
        }

        result = await response.json() as ViabilityReport;
    }

    await ReportCacheService.set(businessType, location, 'standard', planTier, result);
    return result;
};

export const generateOpportunityReport = async (
    location: string,
    setLoadingMessage: (message: string) => void
): Promise<OpportunityReport> => {
    if (appConfig.isDemoMode) {
        setLoadingMessage(`Initializing local data streams for ${location}...`);
        await new Promise(resolve => setTimeout(resolve, 700));
        setLoadingMessage("Scraping local demographic indices and business directories...");
        await new Promise(resolve => setTimeout(resolve, 800));
        setLoadingMessage("Analyzing underserved market niches and competitive saturation...");
        await new Promise(resolve => setTimeout(resolve, 800));
        setLoadingMessage("Synthesizing best business opportunities and strategic recommendation ledger...");
        await new Promise(resolve => setTimeout(resolve, 900));

        const customizedOpportunities = deepReplace(mockOpportunities, {
            "Brooklyn, NY": location,
            "Brooklyn": location
        });

        return {
            ...customizedOpportunities,
            location: location
        } as OpportunityReport;
    }

    // Guardrail: this branch must never execute in Demo Mode.
    // Opportunity analysis goes through the Express backend — never directly to Gemini.
    assertLiveService('Gemini /api/opportunities');
    setLoadingMessage(`Analyzing market gaps and underserved sectors in ${location}...`);
    await new Promise(resolve => setTimeout(resolve, 300));
    setLoadingMessage("Synthesizing best business opportunities and calculating financial metrics on server...");

    const response = await fetch('/api/opportunities', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ location })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error || `Server responded with status ${response.status}`;
        throw new Error(message);
    }

    return await response.json() as OpportunityReport;
};

export const generateMockRegionalData = (businessType: string, location: string): RegionalIntelligenceData => {
  const isZip = /\b\d{5}\b/.test(location);
  const cleanLoc = location.replace(/,?\s*\d{5}/g, '').trim();
  
  const targetBiz = businessType.charAt(0).toUpperCase() + businessType.slice(1);
  
  let targetZip = '90210';
  const zipMatch = location.match(/\b\d{5}\b/);
  if (zipMatch) {
    targetZip = zipMatch[0];
  }
  
  if (isZip) {
    const baseZipVal = parseInt(targetZip) || 90210;
    const zips = [
      { zip: (baseZipVal + 1).toString(), name: 'North District' },
      { zip: (baseZipVal - 1).toString(), name: 'South Transit Loop' },
      { zip: (baseZipVal + 4).toString(), name: 'High-Income Suburban Pocket' },
      { zip: (baseZipVal - 3).toString(), name: 'Commercial Gateway Strip' }
    ];
    
    return {
      isZipMode: true,
      targetLocation: location,
      nearbyRegions: [
        {
          name: `${zips[0].zip} (${zips[0].name})`,
          demographics: "$138,500 Median Income",
          competition: "Moderate (4 active)",
          opportunity: "89%",
          details: `Adjacent high density area. Strong market demand for ${targetBiz} services but high real estate overhead. Optimal secondary expansion spot.`
        },
        {
          name: `${zips[1].zip} (${zips[1].name})`,
          demographics: "$104,200 Median Income",
          competition: "Low (1 active)",
          opportunity: "91%",
          details: `Commuter transit zone with strong foot traffic. Extremely underserved for ${targetBiz} with favorable leasing terms.`
        },
        {
          name: `${zips[2].zip} (${zips[2].name})`,
          demographics: "$182,000 Median Income",
          competition: "High (12 active)",
          opportunity: "74%",
          details: `Elite residential segment. High-end disposable income but saturated competitive space. Requires ultra-premium positioning.`
        },
        {
          name: `${zips[3].zip} (${zips[3].name})`,
          demographics: "$92,400 Median Income",
          competition: "None present",
          opportunity: "85%",
          details: `Growing retail corridor strip. Currently 100% white-space. Lower average tickets but high volume potential.`
        }
      ],
      countyContext: `The county housing indices show strong economic stability with annual household count projection climbing by 1.8% year-over-year. The county planning committee approved $45M in municipal infrastructure improvements, signaling sustained long-term growth.`,
      economicRadius: `The 15–25 mile gravitational economic radius accounts for a commuter pool of over 420,000 active individuals. Over 68% of local resident workers report a daily commute within this grid, presenting a powerful opportunity to capture dual-location client touchpoints.`,
      competitiveSpillover: `Direct competitors in nearby zones are underperforming, with localized search query trends showing high customer leakage and unmet demand. By establishing a superior product offering in '${location}', you can intercept an estimated 20-30% of their existing subscriber base.`,
      expansionPotential: `Corporate strategic timeline for regional capture: Phase 1 (Months 1-3) focuses on claiming search map placements and high-authority local backlinks. Phase 2 (Months 4-6) establishes cooperative referral networks with multi-unit properties. Phase 3 (Months 7-12) outlines a capital-efficient secondary launch outline.`,
      regionalRecommendation: `Highly recommended to proceed with local expansion. Focus marketing spend in the immediate adjacent southern ZIP region to capture high-propensity commuters before national chains establish physical footprints.`,
      specificObservationTitle: "Surrounding-Market Observations",
      specificObservationText: `Commuter flow maps confirm that the primary traffic corridor connecting the eastern commercial center with the western shipping cluster runs directly through '${location}'. This creates unique opportunities to run geofenced mobile ad campaigns targeting active workers during typical morning and peak evening travel hours.`
    };
  } else {
    const baseCity = cleanLoc || "Metropolitan";
    return {
      isZipMode: false,
      targetLocation: location,
      nearbyRegions: [
        {
          name: `${baseCity} North`,
          demographics: "Expanding (High Growth)",
          competition: "Low (2 competitors)",
          opportunity: "92%",
          details: `Major residential expansion area. Lots of young families and moving households. Rapidly climbing demand for ${targetBiz}.`
        },
        {
          name: `${baseCity} Heights`,
          demographics: "Stable (High-Income Profile)",
          competition: "Moderate (5 competitors)",
          opportunity: "87%",
          details: `Premium sub-market characterized by corporate executive residents. Ample disposable budget but high lease price index.`
        },
        {
          name: `${baseCity} Valley`,
          demographics: "Emerging (Tech-Corridor Profile)",
          competition: "Under-saturated (0 competitors)",
          opportunity: "94%",
          details: `Tech-corridor hub with massive new retail parks. Ideal playground for a modern ${targetBiz} to claim early regional dominance.`
        },
        {
          name: `${baseCity} South`,
          demographics: "Mature (Moderate Growth)",
          competition: "High (9 competitors)",
          opportunity: "68%",
          details: `Dense commercial center. High competitor saturation and intense price wars. Better treated as a branding anchor rather than early focus.`
        }
      ],
      countyContext: `High-level county trends show steady positive growth across personal services index categories (+4.6% YoY metrics). Multi-family residential permits have reached a five-year peak, ensuring a steady stream of incoming consumers seeking reliable local options.`,
      economicRadius: `A detailed 15–25 mile economic study proves that '${baseCity}' acts as the definitive commercial anchor for surrounding suburbs. Suburban consumers regularly travel into the city center for dining, shopping, and specialized services.`,
      competitiveSpillover: `Competitor leakage maps highlight that existing outlets in ${baseCity} are concentrating solely on the city center, leaving outer residential corridors heavily neglected. Planners should focus distribution or branding capture along these boundary spillover lines.`,
      expansionPotential: `Strategic multi-unit timeline: Months 1-3 target local SEO and organic search dominance. Months 4-6 establish brand presence in North and Valley suburbs using co-sponsored local events. Months 7-12 implement satellite locations or on-demand logistics to serve the entire metro area.`,
      regionalRecommendation: `A dual-phase metropolitan deployment is strongly recommended. Anchor the primary brand flag inside the central zone, then rapidly capture the highly lucrative 'North' and 'Valley' expansion corridors through digital marketing.`,
      specificObservationTitle: "Growth Corridors Identified",
      specificObservationText: `The municipality is extending the northern rapid transit highway extension, which is projected to increase visitor counts to '${baseCity}' by 18,000 daily commuters. This specific corridor is the single highest high-growth route in the state.`
    };
  }
};

export const generateRegionalAnalysis = async (
  businessType: string,
  location: string,
  planTier: string = 'Explorer',
  forceRegenerate: boolean = false
): Promise<RegionalIntelligenceData> => {
  if (!forceRegenerate) {
    const cached = await ReportCacheService.get(businessType, location, 'regional', planTier);
    if (cached) {
      return cached as RegionalIntelligenceData;
    }
  }

  let result: RegionalIntelligenceData;
  if (appConfig.isDemoMode) {
    result = await generateMockMockDataWithDelay(businessType, location);
  } else {
    // Guardrail: this branch must never execute in Demo Mode.
    // Regional analysis goes through the Express backend — never directly to Gemini.
    assertLiveService('Gemini /api/regional-analysis');
    const regSessionResult = await supabase?.auth.getSession();
    const regToken = regSessionResult?.data?.session?.access_token ?? null;
    const response = await fetch('/api/regional-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-plan-tier': planTier,
        'x-user-email': localStorage.getItem('bizscope_user_email') || 'anonymous@bizscope.ai',
        ...(regToken ? { 'Authorization': `Bearer ${regToken}` } : {}),
      },
      body: JSON.stringify({
        businessType,
        location,
        planTier,
        userEmail: localStorage.getItem('bizscope_user_email') || 'anonymous@bizscope.ai'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error || `Server responded with status ${response.status}`;
      throw new Error(message);
    }

    result = await response.json() as RegionalIntelligenceData;
  }

  await ReportCacheService.set(businessType, location, 'regional', planTier, result);
  return result;
};

const generateMockMockDataWithDelay = async (businessType: string, location: string): Promise<RegionalIntelligenceData> => {
  // Simulate network tick
  await new Promise(resolve => setTimeout(resolve, 350));
  return generateMockRegionalData(businessType, location);
};
