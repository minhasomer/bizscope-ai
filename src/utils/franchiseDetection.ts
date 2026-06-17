/**
 * Franchise detection utility.
 * Zero dependencies — safe to import in both browser (Vite) and Node (API).
 *
 * Keeps a curated list of known franchise brand names and provides:
 *   detectFranchise(input)        → { isFranchise, brandName }
 *   sameBrandInCompetitors()      → how many competitors share the brand name
 *   getFranchiseDensityTier(name) → expected nearby-unit density for the brand
 */

export type FranchiseDensityTier = 'mature_national' | 'established_regional' | 'emerging' | 'unknown';

interface FranchiseEntry {
  name: string;
  tier: FranchiseDensityTier;
}

const KNOWN_FRANCHISES: FranchiseEntry[] = [
  // Fast Food / QSR
  { name: "Chick-fil-A", tier: 'mature_national' },
  { name: "McDonald's", tier: 'mature_national' },
  { name: "Subway", tier: 'mature_national' },
  { name: "Domino's Pizza", tier: 'mature_national' },
  { name: "Five Guys", tier: 'established_regional' },
  { name: "Jersey Mike's", tier: 'established_regional' },
  { name: "Jersey Mike's Subs", tier: 'established_regional' },
  { name: "Firehouse Subs", tier: 'established_regional' },
  { name: "Wingstop", tier: 'established_regional' },
  { name: "Culver's", tier: 'established_regional' },
  { name: "Whataburger", tier: 'established_regional' },
  { name: "In-N-Out Burger", tier: 'established_regional' },
  { name: "Shake Shack", tier: 'established_regional' },
  { name: "Raising Cane's", tier: 'established_regional' },
  { name: "Zaxby's", tier: 'established_regional' },
  { name: "Bojangles", tier: 'established_regional' },
  { name: "Popeyes", tier: 'mature_national' },
  { name: "Hardee's", tier: 'established_regional' },
  // Coffee / Beverages
  { name: "Dutch Bros Coffee", tier: 'established_regional' },
  { name: "Dutch Bros", tier: 'established_regional' },
  { name: "Smoothie King", tier: 'established_regional' },
  { name: "Tropical Smoothie Cafe", tier: 'established_regional' },
  { name: "Dunkin'", tier: 'mature_national' },
  { name: "Dunkin Donuts", tier: 'mature_national' },
  { name: "Starbucks", tier: 'mature_national' },
  // Pizza
  { name: "Marco's Pizza", tier: 'established_regional' },
  { name: "Papa John's", tier: 'mature_national' },
  { name: "Pizza Hut", tier: 'mature_national' },
  { name: "Little Caesars", tier: 'mature_national' },
  // Fitness
  { name: "Anytime Fitness", tier: 'established_regional' },
  { name: "Planet Fitness", tier: 'mature_national' },
  { name: "OrangeTheory Fitness", tier: 'established_regional' },
  { name: "OrangeTheory", tier: 'established_regional' },
  { name: "F45 Training", tier: 'established_regional' },
  { name: "Club Pilates", tier: 'established_regional' },
  { name: "Snap Fitness", tier: 'established_regional' },
  { name: "Crunch Fitness", tier: 'established_regional' },
  // Hair / Beauty
  { name: "Great Clips", tier: 'mature_national' },
  { name: "Sport Clips", tier: 'established_regional' },
  { name: "Supercuts", tier: 'mature_national' },
  { name: "European Wax Center", tier: 'established_regional' },
  // Health / Medical
  { name: "The Joint Chiropractic", tier: 'established_regional' },
  { name: "The Joint", tier: 'established_regional' },
  { name: "Hand & Stone Massage", tier: 'established_regional' },
  { name: "Hand and Stone", tier: 'established_regional' },
  { name: "Massage Envy", tier: 'mature_national' },
  // Home Services
  { name: "SERVPRO", tier: 'mature_national' },
  { name: "ServiceMaster Clean", tier: 'established_regional' },
  { name: "ServiceMaster", tier: 'established_regional' },
  { name: "Molly Maid", tier: 'established_regional' },
  { name: "Merry Maids", tier: 'established_regional' },
  { name: "Two Men and a Truck", tier: 'established_regional' },
  { name: "Mr. Handyman", tier: 'established_regional' },
  { name: "1-800-GOT-JUNK", tier: 'established_regional' },
  { name: "The Brothers That Just Do Gutters", tier: 'emerging' },
  // Pest Control
  { name: "Mosquito Joe", tier: 'emerging' },
  { name: "Mosquito Squad", tier: 'emerging' },
  // Retail / Shipping
  { name: "The UPS Store", tier: 'mature_national' },
  { name: "UPS Store", tier: 'mature_national' },
  { name: "FedEx Office", tier: 'mature_national' },
  { name: "Ace Hardware", tier: 'mature_national' },
  { name: "7-Eleven", tier: 'mature_national' },
  // Education / Tutoring
  { name: "Kumon", tier: 'established_regional' },
  { name: "Sylvan Learning", tier: 'established_regional' },
  { name: "Club Z", tier: 'emerging' },
  { name: "Goldfish Swim School", tier: 'emerging' },
  // Cleaning / B2B
  { name: "Coverall Commercial Cleaning", tier: 'emerging' },
  // Real Estate
  { name: "RE/MAX", tier: 'mature_national' },
  { name: "Keller Williams", tier: 'mature_national' },
  { name: "Century 21", tier: 'mature_national' },
];

export interface FranchiseDetectionResult {
  isFranchise: boolean;
  /** The canonical brand name, normalised from the input (null if not a franchise). */
  brandName: string | null;
}

/**
 * Returns `{ isFranchise: true, brandName }` when the input matches a known
 * franchise brand, case-insensitively. Otherwise returns `{ isFranchise: false, brandName: null }`.
 */
export function detectFranchise(input: string): FranchiseDetectionResult {
  if (!input) return { isFranchise: false, brandName: null };
  const q = input.trim().toLowerCase();

  for (const { name: brand } of KNOWN_FRANCHISES) {
    const brandLower = brand.toLowerCase();
    // Full name match, or input starts-with / includes brand name
    if (q === brandLower || q.includes(brandLower) || brandLower.includes(q)) {
      return { isFranchise: true, brandName: brand };
    }
  }
  return { isFranchise: false, brandName: null };
}

/**
 * Returns the expected nearby-unit density tier for a known franchise brand.
 * 'unknown' for brands not in the curated list (defensive default).
 */
export function getFranchiseDensityTier(brandName: string): FranchiseDensityTier {
  const brandLower = brandName.trim().toLowerCase();
  const entry = KNOWN_FRANCHISES.find(f => f.name.toLowerCase() === brandLower);
  return entry?.tier ?? 'unknown';
}

/**
 * Scans a list of competitor names for same-brand mentions.
 * Returns the indices of competitors that appear to be the same brand.
 */
export function findSameBrandCompetitors(
  brandName: string,
  competitors: { name: string }[],
): number[] {
  const brandLower = brandName.toLowerCase();
  // Use first two significant words of brand name to avoid false negatives
  const brandWords = brandLower.split(/\s+/).filter(w => w.length > 2).slice(0, 2);

  return competitors.reduce<number[]>((acc, comp, i) => {
    const nameLower = comp.name.toLowerCase();
    const isMatch =
      nameLower.includes(brandLower) ||
      brandLower.includes(nameLower) ||
      (brandWords.length >= 1 && brandWords.every(w => nameLower.includes(w)));
    if (isMatch) acc.push(i);
    return acc;
  }, []);
}
