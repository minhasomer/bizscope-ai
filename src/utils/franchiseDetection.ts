/**
 * Franchise detection utility.
 * Zero dependencies — safe to import in both browser (Vite) and Node (API).
 *
 * Keeps a curated list of known franchise brand names and provides:
 *   detectFranchise(input)   → { isFranchise, brandName }
 *   sameBrandInCompetitors() → how many competitors share the brand name
 */

const KNOWN_FRANCHISES: string[] = [
  // Fast Food / QSR
  "Chick-fil-A", "McDonald's", "Subway", "Domino's Pizza", "Five Guys",
  "Jersey Mike's", "Jersey Mike's Subs", "Firehouse Subs", "Wingstop",
  "Culver's", "Whataburger", "In-N-Out Burger", "Shake Shack",
  "Raising Cane's", "Zaxby's", "Bojangles", "Popeyes", "Hardee's",
  // Coffee / Beverages
  "Dutch Bros Coffee", "Dutch Bros", "Smoothie King", "Tropical Smoothie Cafe",
  "Dunkin'", "Dunkin Donuts", "Starbucks",
  // Pizza
  "Marco's Pizza", "Papa John's", "Pizza Hut", "Little Caesars",
  // Fitness
  "Anytime Fitness", "Planet Fitness", "OrangeTheory Fitness", "OrangeTheory",
  "F45 Training", "Club Pilates", "Snap Fitness", "Crunch Fitness",
  // Hair / Beauty
  "Great Clips", "Sport Clips", "Supercuts", "European Wax Center",
  // Health / Medical
  "The Joint Chiropractic", "The Joint",
  "Hand & Stone Massage", "Hand and Stone", "Massage Envy",
  // Home Services
  "SERVPRO", "ServiceMaster Clean", "ServiceMaster",
  "Molly Maid", "Merry Maids", "Two Men and a Truck",
  "Mr. Handyman", "1-800-GOT-JUNK",
  "The Brothers That Just Do Gutters",
  // Pest Control
  "Mosquito Joe", "Mosquito Squad",
  // Retail / Shipping
  "The UPS Store", "UPS Store", "FedEx Office", "Ace Hardware", "7-Eleven",
  // Education / Tutoring
  "Kumon", "Sylvan Learning", "Club Z", "Goldfish Swim School",
  // Cleaning / B2B
  "Coverall Commercial Cleaning",
  // Real Estate
  "RE/MAX", "Keller Williams", "Century 21",
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

  for (const brand of KNOWN_FRANCHISES) {
    const brandLower = brand.toLowerCase();
    // Full name match, or input starts-with / includes brand name
    if (q === brandLower || q.includes(brandLower) || brandLower.includes(q)) {
      return { isFranchise: true, brandName: brand };
    }
  }
  return { isFranchise: false, brandName: null };
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
