/**
 * Blocked business categories for BizScope beta compliance.
 *
 * These categories are blocked from report generation, Market Gaps analysis,
 * and dossier generation — both client-side (UI validation) and server-side
 * (API guard).  This file is imported by both browser and Node contexts, so
 * it must remain side-effect-free and dependency-free.
 */

export interface BlockedCategoryRule {
  /** Human-readable category name shown in error messages. */
  label: string;
  /** Keywords/phrases matched case-insensitively against the input string. */
  keywords: string[];
}

export const BLOCKED_CATEGORIES: BlockedCategoryRule[] = [
  {
    label: 'Firearms & Weapons',
    keywords: [
      'firearm', 'firearms', 'gun shop', 'gun store', 'gun dealer', 'gun range',
      'shooting range', 'ammunition', 'ammo', 'weapon', 'weapons', 'rifle',
      'pistol', 'handgun', 'armory', 'pawnshop gun', 'tactical gear',
    ],
  },
  {
    label: 'Tobacco',
    keywords: [
      'tobacco', 'cigarette', 'cigars', 'cigar shop', 'cigar lounge',
      'smoke shop', 'smokeshop', 'hookah', 'hookah lounge', 'pipe tobacco',
      'snuff', 'chewing tobacco',
    ],
  },
  {
    label: 'Vaping & E-Cigarettes',
    keywords: [
      'vaping', 'vape', 'vape shop', 'vape store', 'e-cigarette', 'ecig',
      'e-cig', 'vapor shop', 'vapor store', 'juul', 'nicotine pouches',
      'delta-8', 'delta 8',
    ],
  },
  {
    label: 'Alcohol',
    keywords: [
      'liquor store', 'liquor shop', 'alcohol store', 'alcohol retail',
      'wine shop', 'wine store', 'beer store', 'bottle shop', 'off-licence',
      'off licence', 'package store', 'spirits store', 'distillery retail',
      'brewery taproom', 'winery tasting room',
    ],
  },
  {
    label: 'Cannabis & Marijuana',
    keywords: [
      'cannabis', 'marijuana', 'dispensary', 'weed shop', 'pot shop',
      'cannabis dispensary', 'marijuana dispensary', 'cannabis retail',
      'thc', 'cbd dispensary', 'hemp dispensary', 'dab shop',
    ],
  },
  {
    label: 'Adult Entertainment',
    keywords: [
      'adult entertainment', 'strip club', 'gentlemen\'s club', 'adult store',
      'adult shop', 'sex shop', 'adult novelty', 'erotic', 'adult content',
      'adult video', 'adult film', 'escort service', 'massage parlor',
      'nude bar', 'adult club',
    ],
  },
  {
    label: 'Gambling',
    keywords: [
      'casino', 'gambling', 'sports betting', 'betting shop', 'bookmaker',
      'sportsbook', 'poker room', 'poker club', 'slot machine', 'lottery',
      'sweepstakes casino', 'gaming parlor', 'off-track betting', 'otb',
    ],
  },
];

export interface BlockedCategoryMatch {
  matched: true;
  category: string;
  keyword: string;
}

export interface NotBlocked {
  matched: false;
}

export type CategoryCheckResult = BlockedCategoryMatch | NotBlocked;

/**
 * Check whether an input string matches any blocked category.
 * Returns the first match found, or `{ matched: false }`.
 */
export function checkBlockedCategory(input: string): CategoryCheckResult {
  const normalised = input.toLowerCase().trim();
  for (const rule of BLOCKED_CATEGORIES) {
    for (const kw of rule.keywords) {
      // Match whole-word or as a sub-phrase (not just a character prefix)
      if (normalised.includes(kw.toLowerCase())) {
        return { matched: true, category: rule.label, keyword: kw };
      }
    }
  }
  return { matched: false };
}

/**
 * Returns a standardised user-facing error message for a blocked category.
 */
export function blockedCategoryMessage(category: string): string {
  return (
    `BizScope does not support analysis for "${category}" businesses during the beta period. ` +
    `This category is outside our supported scope. Please contact us if you have questions.`
  );
}
