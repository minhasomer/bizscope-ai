/**
 * BizScope Assistant — Intent Classifier
 *
 * Server-side deterministic classification. Runs before the Gemini call so
 * that business-analysis requests are redirected without calling Gemini.
 *
 * Classification cascade (first match wins):
 *  1. Safelist: obvious product/account meta-questions → PRODUCT_HELP
 *  2. Abuse / prompt injection → ABUSE_OR_PROMPT_INJECTION
 *  3. Market gap keywords → MARKET_GAP_ANALYSIS
 *  4. Competitor + location → COMPETITOR_OR_LOCATION_RESEARCH
 *  5. Business viability analysis → NEW_BUSINESS_ANALYSIS
 *  6. Default → PRODUCT_HELP  (system prompt is the second line of defence)
 *
 * Design principle: prefer false negatives over false positives.
 * A product-help question that slips past the block patterns is answered by
 * Gemini under the scope-restricted system prompt. A blocked product question
 * is a worse UX failure.
 */

export type ChatIntent =
  | 'PRODUCT_HELP'
  | 'ACCOUNT_HELP'
  | 'REPORT_EXPLANATION'
  | 'GENERAL_BUSINESS_EDUCATION'
  | 'NEW_BUSINESS_ANALYSIS'
  | 'MARKET_GAP_ANALYSIS'
  | 'COMPETITOR_OR_LOCATION_RESEARCH'
  | 'UNSUPPORTED_ACTION'
  | 'ABUSE_OR_PROMPT_INJECTION';

export function isBlockedIntent(intent: ChatIntent): boolean {
  return (
    intent === 'NEW_BUSINESS_ANALYSIS' ||
    intent === 'MARKET_GAP_ANALYSIS' ||
    intent === 'COMPETITOR_OR_LOCATION_RESEARCH' ||
    intent === 'ABUSE_OR_PROMPT_INJECTION' ||
    intent === 'UNSUPPORTED_ACTION'
  );
}

// ── Shared token sets ─────────────────────────────────────────────────────────

// Named business types (specific enough to signal a real analysis request)
const BIZ =
  '(?:restaurant|cafe|coffee\\s+shop|food\\s+truck|retail\\s+store|shop|salon|hair\\s+salon|' +
  'nail\\s+salon|gym|fitness\\s+center|spa|laundromat|clinic|dental\\s+office|veterinary\\s+clinic|' +
  'bar|brewery|daycare|child\\s+care|car\\s+wash|auto\\s+shop|bakery|pizzeria|hotel|bed\\s+and\\s+breakfast|' +
  'boutique|pet\\s+store|florist|catering|franchise\\s+location)';

// Location indicators (specific enough to signal a real location)
const LOC =
  '(?:[A-Z][a-z]{2,}(?:,?\\s*[A-Z]{2})?|\\b[0-9]{5}\\b|downtown|suburbs?|neighborhood|metro\\s+area)';

// ── 1. Safelist — clearly asking about BizScope, not asking it to do analysis ─

const SAFELIST: RegExp[] = [
  // "how does BizScope…" / "what is BizScope…" / "can BizScope…"
  /\bhow\s+does\s+bizscope\b/i,
  /\bwhat\s+(is|are|does|do)\s+(a\s+)?bizscope\b/i,
  /\b(can|does|will|is|has)\s+bizscope\b/i,
  /\bbizscope\s+(analyze|assess|evaluate|generate|create|produce|calculate|determine|show|tell|explain)\b/i,

  // My account / plan / reports — account help
  /\b(my|the\s+current)\s+(plan|account|subscription|usage\s+limit|daily\s+limit|remaining|quota|saved\s+reports?|report\s+limit)\b/i,

  // Navigation / how-to
  /\bhow\s+(to|do\s+i|can\s+i)\s+(sign\s+in|sign\s+out|sign\s+up|log\s+in|log\s+out|upgrade|downgrade|cancel|refresh\s+a|save|export|navigate|access|delete\s+my|view\s+my|find\s+my|start\s+a)\b/i,

  // Feature definition questions
  /\bwhat\s+is\s+included\s+in\b/i,
  /\bwhat\s+(is|are)\s+(a\s+)?(viability\s+report|market\s+gap\s+discovery|regional\s+intelligence\s+report|assessment\s+tier|business\s+viability\s+report|explorer\s+plan|pro\s+plan|enterprise\s+plan|pro\+\s+plan)\b/i,
  /\bwhat\s+plans?\s+(does\s+bizscope\s+offer|are\s+available|include|offer)\b/i,

  // Report explanation
  /\bwhat\s+does\s+(the\s+)?(score|verdict|tier|grade|assessment\s+result|impact\s+level|demand\s+rating|competition\s+level|significant\s+concerns?|green\s+flag|red\s+flag|cautionary)\b.{0,40}\bmean\b/i,
  /\bhow\s+(does|do)\s+(the\s+)?(scoring|assessment\s+tier|viability\s+report|market\s+gap|report|analysis\s+methodology)\s+(work|calculate|determine|score)\b/i,
  /\bexplain\s+(the\s+)?(score|verdict|tier|assessment|section|breakdown|market\s+gap\s+feature|viability\s+report|bizscope|methodology)\b/i,
  /\bhow\s+should\s+i\s+(interpret|read|understand)\b/i,
  /\bwhat\s+do\s+(these\s+)?(results?|findings?|metrics?|numbers?|percentages?|scores?)\s+mean\b/i,

  // General business concepts (definition only, no location)
  /\b(define|what\s+is)\b.{0,30}\b(startup\s+costs?|break.?even|market\s+demand|market\s+saturation|viability|profit\s+margin|competitive\s+landscape)\b.{0,20}(\?|$)/i,

  // Why does the app / product questions
  /\bwhy\s+does\s+(the\s+)?app\b/i,
  /\bwhy\s+(is|does)\s+bizscope\b/i,
  /\bwhat\s+is\s+the\s+(purpose|goal|point|benefit)\s+of\b/i,

  // Decision Pass product questions — must precede MARKET_GAP_PATTERNS so that
  // "Does Decision Pass include Market Gap?" is caught here (PRODUCT_HELP) instead of
  // being blocked as a MARKET_GAP_ANALYSIS request.
  /\bdecision\s+pa(?:ss?|ck)\b/i,
  /\bone.?time\s+(pass|access|reports?|purchase|research)\b/i,
  /\bpay\s+once\b/i,
  /\bnon.?subscription\s+option\b/i,
];

// ── 2. Abuse / prompt injection ───────────────────────────────────────────────

const ABUSE_PATTERNS: RegExp[] = [
  /\b(ignore|override|forget|disregard|bypass|skip)\b.{0,40}\b(previous|above|prior|system|instruction|rule|prompt|directive|guidelines?|constraints?)\b/i,
  /\b(you\s+are\s+now|pretend\s+to\s+be|act\s+as|roleplay\s+as|simulate\s+being|impersonate)\b.{0,50}\b(admin|developer|system|different\s+ai|another\s+ai|unrestricted|without\s+restrictions|no\s+rules|open\s+ai|gpt)\b/i,
  /\b(reveal|show|print|output|display|tell\s+me|what\s+is)\b.{0,40}\b(system\s+prompt|your\s+prompt|your\s+instructions?|your\s+rules?|api\s+key|service\s+role\s+key|secret|password|credential|bearer\s+token)\b/i,
  /\b(jailbreak|dan\s+mode|developer\s+mode|god\s+mode|unrestricted\s+mode|no\s+restrictions\s+mode|jail\s+break|do\s+anything\s+now)\b/i,
  /\bgive\s+me\s+(admin|root|elevated|superuser|full)\s+(access|permissions?|privileges?|control)\b/i,
  /\brepeat\s+(after\s+me|the\s+following|everything\s+above|this\s+exactly)\b/i,
  /\bstart\s+your\s+(response|answer|reply|message)\s+with\s+["']?(?:yes|sure|of\s+course|absolutely|i\s+will)\b/i,
  /\bhypothetically\b.{0,80}\bno\s+(rules|restrictions|limits|guidelines|guardrails|filters)\b/i,
  /\bif\s+you\s+(were|are)\s+(not\s+restricted|without\s+rules|unrestricted|free)\b/i,
];

// ── 3. Market gap analysis ────────────────────────────────────────────────────

const MARKET_GAP_PATTERNS: RegExp[] = [
  /\bmarket\s+gap\b/i,
  /\bunderserved\s+(markets?|business(es)?|area|niche|sector|industry|demand|neighborhood|location|community)\b/i,
  /\b(find|identify|discover|locate|show\s+me|list)\b.{0,40}\b(market\s+opportunit|business\s+opportunit|unserved\s+market|underserved\s+niche|gaps\s+in\s+the\s+market)\b/i,
  /\bwhat\s+businesses?\b.{0,50}\b(is\s+missing|are\s+missing|needed|lacking|aren.?t\s+available|not\s+available)\b.{0,60}\b(in|near|around)\b/i,
  /\b(opportunity|demand)\s+(map|analysis|finder|explorer|ranking)\b/i,
  /\brank\b.{0,30}\b(business\s+(opportunit|types?)|market\s+opportunit)\b/i,
  /\bwhich\s+business\s+(type|idea|concept)\b.{0,50}\b(is\s+most\s+needed|has\s+the\s+most\s+demand|is\s+lacking)\b/i,
];

// ── 4. Competitor / location research ─────────────────────────────────────────

const COMPETITOR_PATTERNS: RegExp[] = [
  new RegExp(
    `\\bhow\\s+many\\b.{0,60}\\b${BIZ}\\w*\\b.{0,80}\\b(in|near|around|at)\\b`,
    'i',
  ),
  /\bcompetitor\w*\b.{0,60}\b(in|near|around|at)\b.{0,80}[A-Z][a-z]{2,}/i,
  /\bcompetitor\w*\b.{0,60}\b[0-9]{5}\b/i,
  /\bcompetitor\s+(analysis|research|landscape|count|density|saturation|map)\b.{0,60}\b(in|for|near|at|around)\b/i,
  /\bgenerate\s+(a\s+)?competitor\s+(analysis|research|report)\b/i,
  /\bcompetitive\s+(landscape|analysis|research|overview)\b.{0,60}\b(in|for|near|around)\b/i,
  /\b(research|find|list|count|check)\b.{0,40}\bcompetitors?\b.{0,60}\b(in|near|at|for)\b.{0,80}[A-Z][a-z]{2,}/i,
  /\b[0-9]{5}\b.{0,60}\b(competitors?|competition|business\s+density|saturation)\b/i,
  /\bmarket\s+saturation\b.{0,60}\b(in|near|for)\b.{0,80}[A-Z][a-z]{2,}/i,
];

// ── 5. Business viability analysis ────────────────────────────────────────────

const ANALYSIS_PATTERNS: RegExp[] = [
  // Explicit report generation
  /\b(generate|create|make|produce|write|build|give\s+me|provide)\b.{0,40}\b(viability|business)\s+(report|analysis|dossier)\b/i,
  /\b(run|start|launch|do|perform|conduct)\b.{0,30}\b(viability\s+report|business\s+analysis|opportunity\s+analysis|business\s+research|viability\s+check)\b/i,
  /\brun\s+a\s+report\b/i,

  // Business type + location + success question
  new RegExp(
    `\\b(would|could|can|should|will)\\b.{0,50}\\b(a\\s+)?${BIZ}\\b.{0,100}` +
    `\\b(succeed|work|thrive|do\\s+well|be\\s+profitable|be\\s+viable|be\\s+successful|perform\\s+well|make\\s+money)\\b.{0,80}\\b(in|at|near|for)\\b`,
    'i',
  ),

  // Analyze/evaluate/assess + business type + location
  new RegExp(
    `\\b(analyze|evaluate|assess|research|investigate)\\b.{0,80}\\b(a\\s+)?${BIZ}\\b.{0,120}\\b(in|at|near)\\b.{0,80}${LOC}`,
    'i',
  ),

  // Revenue / startup cost projections for a specific named business type
  new RegExp(
    `\\b(revenue|profit|startup\\s+costs?|launch\\s+costs?|break.?even|financial\\s+projection|earnings\\s+potential)\\b.{0,30}\\bfor\\b.{0,60}\\b(a\\s+)?${BIZ}\\b`,
    'i',
  ),
  /\b(estimate|give\s+me|show\s+me|calculate|what\s+are\s+the)\b.{0,40}\b(startup\s+costs?|revenue\s+forecast|projected\s+revenue|profit\s+margin|break.?even)\b.{0,60}\bfor\b.{0,60}\b(a\s+)?\w+/i,

  // Best city / location for a specific business type
  new RegExp(
    `\\b(best|top|ideal|optimal|worst|cheapest|highest.demand)\\b.{0,50}` +
    `\\b(city|cities|location|market|state|area|region|zip|neighborhood)\\b.{0,80}` +
    `\\bfor\\s+(a\\s+)?${BIZ}\\b`,
    'i',
  ),

  // "Where should I open / start a [business]?"
  new RegExp(
    `\\bwhere\\s+(should\\s+i|would\\s+i|can\\s+i)\\b.{0,50}\\b(open|start|launch|locate|place|put)\\b.{0,60}\\b(a\\s+)?${BIZ}\\b`,
    'i',
  ),

  // "Should I open / start a [business] in [location]?"
  new RegExp(
    `\\bshould\\s+(i|we)\\b.{0,50}\\b(open|start|launch|invest\\s+in)\\b.{0,80}\\b(a\\s+)?${BIZ}\\b.{0,80}\\b(in|at|near)\\b`,
    'i',
  ),

  // Franchise comparison / research
  /\b(compare|rank|versus|vs\.?)\b.{0,60}\bfranchise\w*\b/i,
  /\b(research|investigate|evaluate)\b.{0,40}\bfranchise\w*\b.{0,60}\b(option|choice|opportunity|brand|concept)\b/i,
  /\bfranchise\b.{0,60}\b(vs\.?|versus|compared\s+to|or)\b.{0,60}\bfranchise\b/i,

  // ZIP code + analysis intent
  /\b[0-9]{5}\b.{0,100}\b(viable|viability|demand|market\s+potential|business\s+opportunity|startup)\b/i,
  /\b(viable|opportunity|demand|market\s+potential)\b.{0,100}\b[0-9]{5}\b/i,

  // "Recommend a business for my city / area"
  /\brecommend\b.{0,50}\b(a\s+)?(business|franchise|opportunit)\b.{0,80}\b(for|in|near)\b.{0,80}(my\s+(city|area|location|zip|neighborhood|market)|[A-Z][a-z]{2,}|[0-9]{5})/i,
  /\bwhat\s+business\b.{0,60}\b(should\s+i|would\s+you|do\s+you)\s+(recommend|suggest|advise)\b/i,
  /\bwhich\s+(business|franchise|opportunit)\b.{0,50}\b(is\s+best|ranks\s+highest|performs\s+best|is\s+most\s+profitable)\b/i,

  // Opportunity rankings
  /\b(rank|ranking|ranked)\b.{0,40}\b(these|all|available|top)\b.{0,40}\b(opportunit|business\s+types?|franchise\s+options?)\b/i,

  // "Is [business] viable/a good idea in [location]?"
  new RegExp(
    `\\b(is|would)\\b.{0,40}\\b(a\\s+)?${BIZ}\\b.{0,80}\\b(viable|a\\s+good\\s+idea|a\\s+good\\s+investment|profitable)\\b.{0,80}\\b(in|near|at)\\b`,
    'i',
  ),
];

// ── Public classifier ─────────────────────────────────────────────────────────

/**
 * Classifies the latest user message.
 * Only the latest user message is examined (not full history) for speed and focus.
 */
export function classifyIntent(latestUserMessage: string): ChatIntent {
  const msg = latestUserMessage.trim();
  if (!msg) return 'PRODUCT_HELP';

  for (const p of SAFELIST)            { if (p.test(msg)) return 'PRODUCT_HELP'; }
  for (const p of ABUSE_PATTERNS)      { if (p.test(msg)) return 'ABUSE_OR_PROMPT_INJECTION'; }
  for (const p of MARKET_GAP_PATTERNS) { if (p.test(msg)) return 'MARKET_GAP_ANALYSIS'; }
  for (const p of COMPETITOR_PATTERNS) { if (p.test(msg)) return 'COMPETITOR_OR_LOCATION_RESEARCH'; }
  for (const p of ANALYSIS_PATTERNS)   { if (p.test(msg)) return 'NEW_BUSINESS_ANALYSIS'; }

  return 'PRODUCT_HELP';
}

// ── Redirect text ─────────────────────────────────────────────────────────────

const SCOPE_REDIRECT =
  'I can explain how BizScope evaluates that question, but specific business, location, ' +
  'competitor, franchise, or market analysis must be run through a Business Viability Report ' +
  'or Market Gap Discovery. That ensures the proper research process, report structure, and ' +
  'usage controls are applied.';

const ABUSE_REDIRECT =
  "I'm not able to help with that request. I can answer questions about BizScope features, " +
  'your account, and general business education.';

export function getRedirectMessage(intent: ChatIntent): string {
  if (intent === 'ABUSE_OR_PROMPT_INJECTION') return ABUSE_REDIRECT;
  return SCOPE_REDIRECT;
}

export function getRedirectCta(intent: ChatIntent): { label: string; path: string } | null {
  if (intent === 'MARKET_GAP_ANALYSIS')          return { label: 'Open Market Gap Discovery', path: '/' };
  if (intent === 'NEW_BUSINESS_ANALYSIS')         return { label: 'Run a Viability Report',    path: '/' };
  if (intent === 'COMPETITOR_OR_LOCATION_RESEARCH') return { label: 'Run a Viability Report',  path: '/' };
  return null;
}
