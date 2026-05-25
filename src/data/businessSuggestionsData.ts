export interface BusinessSuggestion {
  name: string;
  type: 'generic' | 'franchise' | 'common'; 
  keywords: string[];
}

export const businessSuggestionsList: BusinessSuggestion[] = [
  // --- DECLARED IN EXAMPLES ---
  // Typing "gut" ->
  {
    name: "gutter cleaning business",
    type: "generic",
    keywords: ["gut", "gutter", "drain", "roof", "cleaning", "maintenance", "exterior", "power washing"]
  },
  {
    name: "gutter installation company",
    type: "generic",
    keywords: ["gut", "gutter", "drain", "roof", "install", "construction", "siding", "exterior"]
  },
  {
    name: "The Brothers That Just Do Gutters",
    type: "franchise",
    keywords: ["gut", "gutter", "drain", "roof", "cleaning", "install", "utility", "franchise", "brothers"]
  },

  // Typing "med" ->
  {
    name: "med spa",
    type: "generic",
    keywords: ["med", "medical", "spa", "beauty", "aesthetic", "skin", "laser", "cosmetics", "dermatology"]
  },
  {
    name: "urgent care",
    type: "generic",
    keywords: ["med", "medical", "health", "care", "clinic", "doctor", "emergency", "clinic", "hospital"]
  },
  {
    name: "primary care clinic",
    type: "generic",
    keywords: ["med", "medical", "health", "care", "clinic", "doctor", "family practice", "physician"]
  },
  {
    name: "concierge medical practice",
    type: "generic",
    keywords: ["med", "medical", "health", "care", "clinic", "doctor", "private", "membership", "concierge"]
  },

  // Typing "mos" ->
  {
    name: "mosquito control business",
    type: "generic",
    keywords: ["mos", "mosquito", "pest", "bug", "spraying", "outdoor", "yard", "insects", "exterminator"]
  },
  {
    name: "Mosquito Joe",
    type: "franchise",
    keywords: ["mos", "mosquito", "pest", "bug", "spraying", "outdoor", "yard", "joe", "franchise"]
  },
  {
    name: "Mosquito Squad",
    type: "franchise",
    keywords: ["mos", "mosquito", "pest", "bug", "spraying", "outdoor", "yard", "squad", "franchise"]
  },

  // Typing "pack" ->
  {
    name: "pack and ship store",
    type: "generic",
    keywords: ["pack", "package", "shipping", "mail", "post", "box", "delivery", "logistics"]
  },
  {
    name: "mailbox rental store",
    type: "generic",
    keywords: ["pack", "package", "shipping", "mail", "post", "box", "rental", "po box", "business address"]
  },
  {
    name: "print and ship center",
    type: "generic",
    keywords: ["pack", "package", "shipping", "mail", "post", "box", "print", "copy", "center", "documents"]
  },

  // --- GENERIC BUSINESS TYPES ---
  {
    name: "Coffee Shop",
    type: "generic",
    keywords: ["cafe", "espresso", "latte", "breakfast", "drink", "beverage", "bakery"]
  },
  {
    name: "Bakery",
    type: "generic",
    keywords: ["bread", "cake", "pastry", "cookies", "dessert", "food", "cupcake"]
  },
  {
    name: "Boutique Fitness Studio",
    type: "generic",
    keywords: ["gym", "fitness", "workout", "exercise", "training", "pilates", "yoga", "spin", "group class"]
  },
  {
    name: "Yoga Studio",
    type: "generic",
    keywords: ["gym", "fitness", "workout", "exercise", "yoga", "meditation", "mindfulness", "wellness"]
  },
  {
    name: "Gym",
    type: "generic",
    keywords: ["gym", "fitness", "workout", "exercise", "training", "weights", "cardio", "health club"]
  },
  {
    name: "Dental Office",
    type: "generic",
    keywords: ["dentist", "health", "medical", "teeth", "care", "clinic", "hygiene", "oral"]
  },
  {
    name: "Law Firm",
    type: "generic",
    keywords: ["law", "lawyer", "attorney", "legal", "counsel", "corporate", "divorce", "litigation"]
  },
  {
    name: "Electrician",
    type: "generic",
    keywords: ["electric", "electrical", "wiring", "repair", "home", "service", "contractor", "lights", "power"]
  },
  {
    name: "Heating & Cooling (HVAC)",
    type: "generic",
    keywords: ["hvac", "heat", "heating", "air", "cooling", "ac", "repair", "home", "service", "contractor", "ventilation"]
  },
  {
    name: "Plumbing Service",
    type: "generic",
    keywords: ["plumber", "plumbing", "pipe", "water", "leak", "repair", "home", "service", "contractor", "drain"]
  },
  {
    name: "Lawn Care",
    type: "generic",
    keywords: ["lawn", "grass", "mowing", "landscaping", "garden", "outdoor", "yard", "trimming", "gardening"]
  },
  {
    name: "Pest Control",
    type: "generic",
    keywords: ["pest", "bug", "termite", "exterminator", "insect", "rodent", "outdoor", "spraying"]
  },
  {
    name: "Auto Repair Shop",
    type: "generic",
    keywords: ["car", "auto", "vehicle", "mechanic", "repair", "engine", "brakes", "transmission", "garage"]
  },
  {
    name: "Beauty Salon",
    type: "generic",
    keywords: ["hair", "nail", "beauty", "salon", "spa", "cosmetics", "makeup", "treatment"]
  },
  {
    name: "Dry Cleaner",
    type: "generic",
    keywords: ["laundry", "clean", "dry", "clothes", "wash", "service", "alterations", "garments"]
  },
  {
    name: "Pet Grooming",
    type: "generic",
    keywords: ["dog", "cat", "pet", "animal", "groom", "wash", "trimming", "mobile pet"]
  },
  {
    name: "Bookstore",
    type: "generic",
    keywords: ["book", "shop", "read", "library", "novel", "literature", "retail"]
  },
  {
    name: "Accounting Firm",
    type: "generic",
    keywords: ["tax", "accountant", "cpa", "finance", "audit", "money", "bookkeeping", "corporate"]
  },
  {
    name: "Daycare Center",
    type: "generic",
    keywords: ["child", "kid", "baby", "care", "school", "preschool", "infant", "toddler", "after school"]
  },
  {
    name: "Real Estate Agency",
    type: "generic",
    keywords: ["house", "home", "property", "buy", "sell", "realtor", "agent", "broker", "brokerage"]
  },
  {
    name: "Liquor Store",
    type: "generic",
    keywords: ["liquor", "alcohol", "wine", "beer", "beverage", "shop", "retail", "spirits"]
  },
  {
    name: "Barber Shop",
    type: "generic",
    keywords: ["barber", "hair", "cut", "shave", "salon", "men", "grooming"]
  },
  {
    name: "Event Planning",
    type: "generic",
    keywords: ["event", "party", "wedding", "planner", "organizer", "corporate", "coordinating", "celebration"]
  },
  {
    name: "Dermatologist Clinic",
    type: "generic",
    keywords: ["skin", "doctor", "medical", "health", "clinic", "dermatologist", "acne", "laser"]
  },
  {
    name: "Nail Salon",
    type: "generic",
    keywords: ["nail", "manicure", "pedicure", "salon", "beauty", "polish", "acrylic"]
  },
  {
    name: "Junk Removal",
    type: "generic",
    keywords: ["junk", "removal", "trash", "haul", "debris", "dump", "disposal", "clutter", "cleanout", "hauling"]
  },
  {
    name: "Halal Restaurant",
    type: "generic",
    keywords: ["halal", "restaurant", "food", "ethnic", "middle eastern", "muslim", "kebab", "mediterranean", "dining"]
  },
  {
    name: "Laundromat",
    type: "generic",
    keywords: ["laundry", "laundromat", "wash", "clean", "coin", "self-service", "clothes", "dryer", "washroom"]
  },
  {
    name: "Home Care Agency",
    type: "generic",
    keywords: ["home", "care", "elderly", "senior", "nurse", "health", "personal care", "in-home", "assisted", "caregiver"]
  },
  {
    name: "Parking Lot Striping",
    type: "generic",
    keywords: ["parking", "lot", "striping", "line", "painting", "asphalt", "marking", "commercial", "pavement"]
  },
  {
    name: "Mobile Car Detailing",
    type: "generic",
    keywords: ["car", "mobile", "detail", "auto", "vehicle", "wash", "polish", "wax", "cleaning", "detailing", "valeting"]
  },
  {
    name: "Aircraft Detailing",
    type: "generic",
    keywords: ["aircraft", "airplane", "plane", "aviation", "detail", "clean", "maintenance", "airport", "jet", "hangar"]
  },

  // --- FRANCHISE NAMES ---
  {
    name: "The UPS Store",
    type: "franchise",
    keywords: ["pack", "package", "shipping", "mail", "post", "box", "print", "copy", "ups", "franchise", "store"]
  },
  {
    name: "FedEx Office",
    type: "franchise",
    keywords: ["pack", "package", "shipping", "mail", "post", "box", "print", "copy", "fedex", "franchise", "office"]
  },
  {
    name: "Great Clips",
    type: "franchise",
    keywords: ["hair", "cut", "barber", "salon", "clips", "great", "franchise"]
  },
  {
    name: "Sport Clips",
    type: "franchise",
    keywords: ["hair", "cut", "barber", "salon", "clips", "sport", "franchise"]
  },
  {
    name: "Massage Envy",
    type: "franchise",
    keywords: ["massage", "spa", "wellness", "therapy", "envy", "body", "franchise"]
  },
  {
    name: "The Joint Chiropractic",
    type: "franchise",
    keywords: ["chiropractor", "back", "pain", "health", "medical", "joint", "alignment", "franchise"]
  },
  {
    name: "OrangeTheory Fitness",
    type: "franchise",
    keywords: ["gym", "fitness", "workout", "training", "orangetheory", "exercise", "franchise"]
  },
  {
    name: "Planet Fitness",
    type: "franchise",
    keywords: ["gym", "fitness", "workout", "exercise", "planet", "franchise"]
  },
  {
    name: "Subway",
    type: "franchise",
    keywords: ["fast", "food", "sandwich", "dining", "sub", "healthy", "franchise"]
  },
  {
    name: "McDonald's",
    type: "franchise",
    keywords: ["fast", "food", "burger", "fries", "dining", "mcdonald", "mcdonalds", "franchise"]
  },
  {
    name: "Anytime Fitness",
    type: "franchise",
    keywords: ["gym", "fitness", "workout", "exercise", "anytime", "24 hour", "franchise"]
  },
  {
    name: "RE/MAX",
    type: "franchise",
    keywords: ["house", "home", "realtor", "agent", "real estate", "remax", "franchise"]
  },
  {
    name: "7-Eleven",
    type: "franchise",
    keywords: ["convenience", "store", "gas", "snack", "slurpee", "franchise"]
  },

  // --- COMMON OR TRADITIONAL NAMES ---
  {
    name: "Main Street Bakery",
    type: "common",
    keywords: ["bakery", "bread", "cake", "food", "local", "pastry"]
  },
  {
    name: "The Coffee Nook",
    type: "common",
    keywords: ["coffee", "cafe", "espresso", "drink", "nook", "local", "cozy"]
  },
  {
    name: "Downtown Dental Practice",
    type: "common",
    keywords: ["dentist", "dental", "teeth", "health", "medical", "downtown", "clinic"]
  },
  {
    name: "Apex Plumbing & Drain",
    type: "common",
    keywords: ["plumber", "plumbing", "pipe", "water", "leak", "repair", "apex", "local"]
  },
  {
    name: "Corner Grocery Market",
    type: "common",
    keywords: ["grocery", "food", "supermarket", "convenience", "store", "corner", "local"]
  },
  {
    name: "Green Valley Landscaping",
    type: "common",
    keywords: ["lawn", "grass", "mowing", "landscaping", "garden", "green", "valley", "local"]
  },
  {
    name: "Elite Physical Therapy",
    type: "common",
    keywords: ["physical", "therapy", "rehab", "health", "medical", "elite", "physio"]
  },
  {
    name: "Neighborhood Auto Works",
    type: "common",
    keywords: ["car", "auto", "vehicle", "mechanic", "repair", "engine", "neighborhood", "local"]
  }
];

/**
 * Searches the curated list based on:
 * 1. Contains input in name (case-insensitive)
 * 2. Contains input in keywords (case-insensitive)
 * 
 * Orders findings by:
 * - Direct starts-with name match first
 * - Includes name match second
 * - Keyword exact/sub-word match third
 */
export const searchBusinessTypes = (userInput: string): BusinessSuggestion[] => {
  if (!userInput) return [];
  const cleanInput = userInput.trim().toLowerCase();
  if (cleanInput.length === 0) return [];

  const startsWithName: BusinessSuggestion[] = [];
  const includesName: BusinessSuggestion[] = [];
  const keywordMatches: BusinessSuggestion[] = [];

  const seenNames = new Set<string>();

  for (const item of businessSuggestionsList) {
    const nameLower = item.name.toLowerCase();
    
    // Check if we hit name direct prefix
    if (nameLower.startsWith(cleanInput)) {
      startsWithName.push(item);
      seenNames.add(item.name);
    } 
    // Check if name contains it
    else if (nameLower.includes(cleanInput)) {
      includesName.push(item);
      seenNames.add(item.name);
    } 
    // Check keyword level matches (e.g. typing "med" matching "Primary Care Clinic" because of keywords)
    else {
      const keywordMatch = item.keywords.some(kw => {
        const kwLower = kw.toLowerCase();
        return kwLower === cleanInput || kwLower.startsWith(cleanInput) || kwLower.includes(cleanInput);
      });
      
      if (keywordMatch && !seenNames.has(item.name)) {
        keywordMatches.push(item);
        seenNames.add(item.name);
      }
    }
  }

  // Combine them according to priority and slice to max top 10 suggestions
  return [...startsWithName, ...includesName, ...keywordMatches].slice(0, 10);
};
