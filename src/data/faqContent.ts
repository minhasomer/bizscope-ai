import type { FAQItem } from '../../components/seo/FAQSection';

/**
 * FAQ content for the BizScope FAQ page.
 * Answers are verified against src/config/plans.ts, server/chat/knowledge.ts,
 * and current API behaviour. Do not edit answers without cross-checking the
 * source files listed in each section comment.
 */

// ── Product / Using BizScope ───────────────────────────────────────────────────

const productFAQs: FAQItem[] = [
  {
    question: 'What is BizScope?',
    answer:
      'BizScope is an AI-powered market research tool that helps you evaluate business ideas before committing time or capital. Enter a business type and a US location, and BizScope generates a structured viability report covering competition, demographics, startup costs, market demand, and risk factors.',
  },
  {
    question: 'Who is BizScope for?',
    answer:
      'BizScope is designed for first-time entrepreneurs validating an idea, franchise buyers researching a territory, and operators planning a second location. It is also useful for local market researchers and investors who need fast, structured market intelligence on a US market.',
  },
  {
    question: 'What does a Business Viability report include?',
    answer:
      'A full report covers: a qualitative viability assessment, an executive summary, startup cost range and breakdown, financial projections (Year 1 and Year 3 revenue, break-even estimate), competitor analysis with nearby business locations, market trends, demographic insights, risk factors with mitigation strategies, and recommended next steps. Some sections require a Pro, Pro+, or Decision Pass plan.',
  },
  {
    question: 'What is Business Concept Refinement?',
    answer:
      'When you enter a broad concept — such as "restaurant" or "retail store" — BizScope may ask a brief clarifying question before running the analysis. This step helps the AI research the right market niche and relevant competitors for your specific concept, rather than a generic category.',
  },
  {
    question: 'How does BizScope identify competitors?',
    answer:
      'BizScope uses Google Maps data and web research to find real, currently operating businesses in or near your target location. Results reflect publicly available location data at the time the report is generated and may not capture every competitor in an area.',
  },
  {
    question: 'What is Market Gap Discovery?',
    answer:
      'Market Gap Discovery identifies potentially underserved business opportunities in a US city or region. It surfaces up to five ranked opportunities, each with demand signals, a competitive overview, and a revenue rationale. Pro and Pro+ subscribers see all five results and can generate an expanded dossier; Explorer (free) users see the top two opportunities.',
  },
  {
    question: 'How current is the data in a BizScope report?',
    answer:
      'BizScope synthesizes data from multiple sources at the time of analysis, including Google Search and Maps results, US Census data, and AI-driven market signals. Reports are cached on the server for up to 90 days. If a recent analysis exists for the same business and location, you will be offered the option to view it or run a fresh analysis with current data.',
  },
];

// ── Accuracy / Decision Support ───────────────────────────────────────────────

const accuracyFAQs: FAQItem[] = [
  {
    question: 'How accurate are BizScope reports?',
    answer:
      'BizScope reports are AI-generated research summaries intended to support early-stage decision-making — not to predict business outcomes. The AI synthesizes publicly available data, which means results reflect gaps in that data. Reports are most useful as a structured starting point for further due diligence, not as a final verdict.',
  },
  {
    question: 'If a report says "Strong Opportunity," should I open the business?',
    answer:
      'A positive assessment means the available market signals look favorable — not that success is guaranteed. Before committing capital, validate key findings locally, consult a financial or legal advisor, and conduct primary research. BizScope is a research aid, not a substitute for professional advice.',
  },
  {
    question: 'What should I do after receiving a BizScope report?',
    answer:
      'Use the report to guide your next research steps: visit the location, talk to potential customers, check local licensing requirements, and consult an accountant or attorney before making financial commitments. For franchise opportunities, confirm territory availability directly with the franchisor — BizScope analyzes market conditions but cannot verify franchise agreements.',
  },
];

// ── Pricing / Access ──────────────────────────────────────────────────────────
// Prices verified against src/config/plans.ts PRICING_CARDS.
// Decision Pass verified against server/chat/knowledge.ts DECISION_PASS.

const pricingFAQs: FAQItem[] = [
  {
    question: 'Can I try BizScope without creating an account?',
    answer:
      'Yes. Visitors who have not signed in can run one free preview report. The preview shows the executive summary and basic market information; full sections including financial projections, competitor maps, and risk details require a free Explorer account or a paid plan.',
  },
  {
    question: 'What is the difference between Explorer, Pro, and Pro+?',
    answer:
      'Explorer is free and includes 3 reports per month with a viability assessment and executive summary — full financial projections, competitor maps, PDF export, and saved reports are not included. Pro ($29/month) provides 20 reports per month with full financials, competitor maps, PDF export, and saved reports. Pro+ ($59/month) adds 50 standard reports and 10 Regional Intelligence analyses per month, covering multi-ZIP, county-level, and expansion strategy data.',
  },
  {
    question: 'What is Decision Pass?',
    answer:
      'Decision Pass is a $19 one-time purchase — not a subscription. It includes 3 Business Viability reports and 1 Market Gap Discovery report, with full report access including financial projections, competitor maps, and PDF export. Credits do not expire, and there is no automatic renewal. Decision Pass does not include ongoing subscription features such as saving reports to your dashboard or Regional Intelligence.',
  },
];

// ── Reports / Data ────────────────────────────────────────────────────────────

const reportsFAQs: FAQItem[] = [
  {
    question: 'Can I save reports and revisit them later?',
    answer:
      'Saving reports to your Venture Hub dashboard is available on Pro, Pro+, and Enterprise plans. Explorer (free) accounts do not include report saving. Pro and higher subscribers can also compare two saved reports side by side.',
  },
  {
    question: 'Can I export a report as a PDF?',
    answer:
      'PDF export is available on Pro, Pro+, and Enterprise plans, and is also included with a Decision Pass purchase. Explorer (free) accounts cannot export PDFs.',
  },
  {
    question: 'Does BizScope work for locations outside the United States?',
    answer:
      'Not currently. BizScope\'s data sources and analysis pipeline are optimized for US markets. Non-US locations are not supported at this time.',
  },
];

// ── Combined export ────────────────────────────────────────────────────────────

export const FAQ_ITEMS: FAQItem[] = [
  ...productFAQs,
  ...accuracyFAQs,
  ...pricingFAQs,
  ...reportsFAQs,
];
