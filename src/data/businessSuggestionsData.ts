export interface BusinessSuggestion {
  name: string;
  type: 'generic' | 'franchise' | 'common';
  keywords: string[];
}

// ─── FRANCHISES ───────────────────────────────────────────────────────────────
// Sorted roughly by consumer recognition / search frequency.
const FRANCHISES: BusinessSuggestion[] = [
  { name: "Chick-fil-A",               type: "franchise", keywords: ["chicken", "fast food", "sandwich", "food", "dining", "franchise", "chick fil a"] },
  { name: "Jersey Mike's Subs",         type: "franchise", keywords: ["sandwich", "sub", "deli", "food", "dining", "franchise", "jersey mikes"] },
  { name: "Culver's",                   type: "franchise", keywords: ["burger", "fast food", "cheese curds", "food", "dining", "franchise", "culvers"] },
  { name: "The UPS Store",              type: "franchise", keywords: ["pack", "package", "shipping", "mail", "post", "box", "print", "copy", "ups", "franchise", "store"] },
  { name: "Ace Hardware",               type: "franchise", keywords: ["hardware", "tools", "home improvement", "store", "retail", "franchise", "ace"] },
  { name: "Great Clips",                type: "franchise", keywords: ["hair", "cut", "barber", "salon", "clips", "great", "franchise"] },
  { name: "Anytime Fitness",            type: "franchise", keywords: ["gym", "fitness", "workout", "exercise", "anytime", "24 hour", "franchise"] },
  { name: "SERVPRO",                    type: "franchise", keywords: ["restoration", "water damage", "fire damage", "cleaning", "home service", "franchise", "servpro"] },
  { name: "Molly Maid",                 type: "franchise", keywords: ["cleaning", "maid", "home service", "residential", "franchise", "housekeeping", "molly"] },
  { name: "The Brothers That Just Do Gutters", type: "franchise", keywords: ["gutter", "drain", "roof", "cleaning", "install", "utility", "franchise", "brothers"] },
  { name: "McDonald's",                 type: "franchise", keywords: ["fast food", "burger", "fries", "dining", "mcdonald", "mcdonalds", "franchise"] },
  { name: "Subway",                     type: "franchise", keywords: ["sandwich", "sub", "fast food", "dining", "healthy", "franchise"] },
  { name: "Domino's Pizza",             type: "franchise", keywords: ["pizza", "delivery", "food", "dining", "franchise", "dominos"] },
  { name: "Dunkin'",                    type: "franchise", keywords: ["coffee", "donut", "breakfast", "drink", "food", "franchise", "dunkin"] },
  { name: "Five Guys",                  type: "franchise", keywords: ["burger", "fast food", "fries", "food", "dining", "franchise"] },
  { name: "Wingstop",                   type: "franchise", keywords: ["wing", "chicken", "food", "dining", "franchise"] },
  { name: "Smoothie King",              type: "franchise", keywords: ["smoothie", "juice", "health", "drink", "wellness", "franchise"] },
  { name: "Dutch Bros Coffee",          type: "franchise", keywords: ["coffee", "drink", "drive through", "beverage", "franchise", "dutch"] },
  { name: "Tropical Smoothie Cafe",     type: "franchise", keywords: ["smoothie", "juice", "food", "health", "tropical", "franchise"] },
  { name: "Marco's Pizza",              type: "franchise", keywords: ["pizza", "food", "delivery", "dining", "franchise", "marcos"] },
  { name: "Firehouse Subs",             type: "franchise", keywords: ["sandwich", "sub", "food", "dining", "franchise", "firehouse"] },
  { name: "Sport Clips",                type: "franchise", keywords: ["hair", "cut", "barber", "salon", "clips", "sport", "franchise"] },
  { name: "Massage Envy",               type: "franchise", keywords: ["massage", "spa", "wellness", "therapy", "envy", "body", "franchise"] },
  { name: "OrangeTheory Fitness",       type: "franchise", keywords: ["gym", "fitness", "workout", "training", "orangetheory", "exercise", "franchise"] },
  { name: "Planet Fitness",             type: "franchise", keywords: ["gym", "fitness", "workout", "exercise", "planet", "franchise"] },
  { name: "Snap Fitness",               type: "franchise", keywords: ["gym", "fitness", "workout", "24 hour", "exercise", "franchise", "snap"] },
  { name: "F45 Training",               type: "franchise", keywords: ["fitness", "gym", "hiit", "training", "workout", "franchise", "f45"] },
  { name: "Club Pilates",               type: "franchise", keywords: ["pilates", "fitness", "wellness", "reformer", "studio", "franchise"] },
  { name: "The Joint Chiropractic",     type: "franchise", keywords: ["chiropractor", "back", "pain", "health", "medical", "joint", "alignment", "franchise"] },
  { name: "Hand & Stone Massage",       type: "franchise", keywords: ["massage", "spa", "facial", "wellness", "relaxation", "franchise"] },
  { name: "European Wax Center",        type: "franchise", keywords: ["wax", "beauty", "salon", "hair removal", "skin", "franchise"] },
  { name: "Merry Maids",                type: "franchise", keywords: ["cleaning", "maid", "home service", "residential", "franchise", "housekeeping"] },
  { name: "ServiceMaster Clean",        type: "franchise", keywords: ["cleaning", "restoration", "commercial", "home service", "franchise", "servicemaster"] },
  { name: "Two Men and a Truck",        type: "franchise", keywords: ["moving", "mover", "relocation", "truck", "home service", "franchise"] },
  { name: "1-800-GOT-JUNK?",           type: "franchise", keywords: ["junk", "removal", "hauling", "trash", "debris", "franchise"] },
  { name: "Mr. Handyman",               type: "franchise", keywords: ["handyman", "repair", "home service", "contractor", "maintenance", "franchise"] },
  { name: "Mosquito Joe",               type: "franchise", keywords: ["mosquito", "pest", "bug", "spraying", "outdoor", "yard", "joe", "franchise"] },
  { name: "Mosquito Squad",             type: "franchise", keywords: ["mosquito", "pest", "bug", "spraying", "outdoor", "yard", "squad", "franchise"] },
  { name: "Coverall Commercial Cleaning", type: "franchise", keywords: ["commercial cleaning", "janitorial", "office", "b2b", "franchise", "coverall"] },
  { name: "Goldfish Swim School",       type: "franchise", keywords: ["swim", "swimming", "kids", "children", "school", "lessons", "franchise"] },
  { name: "Kumon",                      type: "franchise", keywords: ["tutoring", "education", "math", "reading", "kids", "learning", "academic", "franchise"] },
  { name: "Sylvan Learning",            type: "franchise", keywords: ["tutoring", "education", "learning", "kids", "academic", "test prep", "franchise"] },
  { name: "RE/MAX",                     type: "franchise", keywords: ["house", "home", "realtor", "agent", "real estate", "remax", "franchise"] },
  { name: "7-Eleven",                   type: "franchise", keywords: ["convenience", "store", "gas", "snack", "slurpee", "franchise"] },
  { name: "FedEx Office",               type: "franchise", keywords: ["shipping", "mail", "print", "copy", "fedex", "franchise", "office"] },
];

// ─── GENERIC BUSINESS IDEAS ────────────────────────────────────────────────────
// Most-searched first, then grouped by category.
const GENERIC: BusinessSuggestion[] = [
  // Top-searched standalone ideas
  { name: "Coffee Shop",                type: "generic", keywords: ["coffee", "cafe", "espresso", "latte", "breakfast", "drink", "beverage", "bakery"] },
  { name: "Auto Detailing",             type: "generic", keywords: ["auto", "car", "detail", "vehicle", "wash", "polish", "wax", "cleaning", "detailing"] },
  { name: "Landscaping Business",       type: "generic", keywords: ["landscaping", "lawn", "grass", "mowing", "garden", "outdoor", "yard", "trimming", "gardening"] },
  { name: "Cleaning Service",           type: "generic", keywords: ["cleaning", "maid", "house", "home", "residential", "janitorial", "housekeeping", "cleaner"] },
  { name: "HVAC Company",               type: "generic", keywords: ["hvac", "heat", "heating", "air", "cooling", "ac", "repair", "home", "service", "contractor", "ventilation"] },
  { name: "Plumbing Business",          type: "generic", keywords: ["plumber", "plumbing", "pipe", "water", "leak", "repair", "home", "service", "contractor", "drain"] },
  { name: "Roofing Company",            type: "generic", keywords: ["roofing", "roof", "repair", "installation", "shingles", "contractor", "home", "exterior"] },
  { name: "Medical Spa",                type: "generic", keywords: ["med", "medical", "spa", "beauty", "aesthetic", "skin", "laser", "cosmetics", "dermatology"] },
  { name: "Urgent Care Clinic",         type: "generic", keywords: ["urgent care", "med", "medical", "health", "care", "clinic", "doctor", "emergency", "hospital"] },
  { name: "Childcare Center",           type: "generic", keywords: ["childcare", "daycare", "child", "kid", "baby", "care", "school", "preschool", "infant", "toddler"] },
  { name: "Senior Home Care",           type: "generic", keywords: ["senior", "elderly", "home care", "caregiver", "nurse", "health", "personal care", "in-home", "assisted"] },
  { name: "Pet Grooming",               type: "generic", keywords: ["dog", "cat", "pet", "animal", "groom", "wash", "trimming", "mobile pet"] },
  { name: "Dog Boarding",               type: "generic", keywords: ["dog", "boarding", "kennel", "pet", "animal", "overnight", "daycare", "sitting"] },
  { name: "Event Venue",                type: "generic", keywords: ["event", "venue", "wedding", "party", "banquet", "hall", "reception", "corporate", "space"] },

  // Food & Beverage
  { name: "Bakery",                     type: "generic", keywords: ["bread", "cake", "pastry", "cookies", "dessert", "food", "cupcake"] },
  { name: "Pizza Restaurant",           type: "generic", keywords: ["pizza", "italian", "food", "restaurant", "dining", "slice", "delivery"] },
  { name: "Burger Restaurant",          type: "generic", keywords: ["burger", "fast food", "restaurant", "dining", "grill", "beef"] },
  { name: "Sandwich Shop",              type: "generic", keywords: ["sandwich", "sub", "deli", "lunch", "food", "wrap", "panini"] },
  { name: "Taco Shop",                  type: "generic", keywords: ["taco", "mexican", "food", "restaurant", "burrito", "enchilada", "tex-mex"] },
  { name: "Breakfast & Brunch Cafe",    type: "generic", keywords: ["breakfast", "brunch", "cafe", "egg", "pancake", "waffle", "morning", "omelet"] },
  { name: "Wing Restaurant",            type: "generic", keywords: ["wing", "chicken", "food", "restaurant", "buffalo", "fried", "sports bar"] },
  { name: "Sushi Restaurant",           type: "generic", keywords: ["sushi", "japanese", "seafood", "food", "restaurant", "raw fish", "hibachi", "asian"] },
  { name: "Ramen Restaurant",           type: "generic", keywords: ["ramen", "noodle", "japanese", "food", "restaurant", "soup", "asian"] },
  { name: "Ice Cream Shop",             type: "generic", keywords: ["ice cream", "gelato", "frozen", "dessert", "sweet", "cone", "sundae"] },
  { name: "Smoothie & Juice Bar",       type: "generic", keywords: ["smoothie", "juice", "health", "drink", "blend", "fresh", "nutrition"] },
  { name: "Boba Tea Shop",              type: "generic", keywords: ["boba", "bubble tea", "tea", "asian", "drink", "tapioca", "milk tea"] },
  { name: "Food Truck",                 type: "generic", keywords: ["food truck", "mobile", "street food", "catering", "event", "festival"] },
  { name: "Catering Company",           type: "generic", keywords: ["catering", "food", "event", "wedding", "corporate", "party", "chef"] },
  { name: "Meal Prep Service",          type: "generic", keywords: ["meal prep", "meal kit", "food", "healthy", "delivery", "diet", "nutrition"] },
  { name: "Ghost Kitchen",              type: "generic", keywords: ["ghost kitchen", "cloud kitchen", "delivery", "food", "online", "doordash", "ubereats"] },

  // Health & Medical
  { name: "Dental Office",              type: "generic", keywords: ["dentist", "dental", "health", "medical", "teeth", "care", "clinic", "hygiene", "oral"] },
  { name: "Primary Care Clinic",        type: "generic", keywords: ["primary care", "family doctor", "med", "medical", "health", "clinic", "physician"] },
  { name: "Physical Therapy Clinic",    type: "generic", keywords: ["physical therapy", "physio", "rehab", "health", "medical", "sports", "injury", "orthopedic"] },
  { name: "Chiropractic Office",        type: "generic", keywords: ["chiropractor", "chiro", "back", "spine", "health", "medical", "alignment", "pain relief"] },
  { name: "GLP-1 Weight Loss Clinic",   type: "generic", keywords: ["glp1", "glp-1", "weight loss", "ozempic", "wegovy", "semaglutide", "medical weight", "obesity", "clinic"] },
  { name: "Weight Loss Center",         type: "generic", keywords: ["weight loss", "diet", "obesity", "medical", "health", "nutrition", "bariatric", "slim"] },
  { name: "Mental Health Practice",     type: "generic", keywords: ["mental health", "therapy", "therapist", "counseling", "psychologist", "psychiatrist", "anxiety", "depression"] },
  { name: "Optometry Practice",         type: "generic", keywords: ["optometry", "optometrist", "eye", "vision", "glasses", "contact lens", "health", "medical"] },
  { name: "Pediatric Clinic",           type: "generic", keywords: ["pediatric", "pediatrician", "child", "kids", "baby", "health", "medical", "family doctor"] },
  { name: "IV Hydration & Wellness Lounge", type: "generic", keywords: ["iv", "hydration", "wellness", "vitamin", "infusion", "drip", "health", "recovery", "lounge"] },
  { name: "Hormone & TRT Clinic",       type: "generic", keywords: ["hormone", "trt", "testosterone", "hrt", "menopause", "andropause", "health", "wellness", "medical"] },
  { name: "Dermatologist Clinic",       type: "generic", keywords: ["skin", "doctor", "medical", "health", "clinic", "dermatologist", "acne", "laser"] },
  { name: "Podiatry Clinic",            type: "generic", keywords: ["podiatry", "foot", "ankle", "podiatrist", "health", "medical", "bunion", "neuropathy"] },
  { name: "Speech Therapy Practice",    type: "generic", keywords: ["speech", "therapy", "language", "communication", "pediatric", "health", "medical", "stuttering"] },

  // Wellness & Fitness
  { name: "Gym",                        type: "generic", keywords: ["gym", "fitness", "workout", "exercise", "training", "weights", "cardio", "health club"] },
  { name: "Boutique Fitness Studio",    type: "generic", keywords: ["gym", "fitness", "workout", "exercise", "training", "pilates", "yoga", "spin", "group class"] },
  { name: "Yoga Studio",                type: "generic", keywords: ["yoga", "meditation", "mindfulness", "wellness", "fitness", "workout"] },
  { name: "Pilates Studio",             type: "generic", keywords: ["pilates", "reformer", "fitness", "core", "flexibility", "wellness", "mind body"] },
  { name: "Personal Training Studio",   type: "generic", keywords: ["personal training", "trainer", "fitness", "gym", "workout", "strength", "one on one", "private coach"] },
  { name: "Martial Arts School",        type: "generic", keywords: ["martial arts", "karate", "jiu jitsu", "mma", "kickboxing", "bjj", "fitness", "training", "kids"] },
  { name: "Dance Studio",               type: "generic", keywords: ["dance", "studio", "ballet", "hip hop", "salsa", "classes", "performance", "kids", "adult"] },
  { name: "Tanning Salon",              type: "generic", keywords: ["tanning", "spray tan", "bronze", "beauty", "salon", "skin", "glow"] },
  { name: "Cryotherapy Center",         type: "generic", keywords: ["cryo", "cryotherapy", "cold", "recovery", "wellness", "sports", "athlete", "inflammation"] },
  { name: "Float Tank Center",          type: "generic", keywords: ["float", "floatation", "sensory deprivation", "relaxation", "stress", "wellness", "meditation"] },

  // Beauty & Personal Care
  { name: "Beauty Salon",               type: "generic", keywords: ["hair", "nail", "beauty", "salon", "spa", "cosmetics", "makeup", "treatment"] },
  { name: "Barber Shop",                type: "generic", keywords: ["barber", "hair", "cut", "shave", "salon", "men", "grooming"] },
  { name: "Nail Salon",                 type: "generic", keywords: ["nail", "manicure", "pedicure", "salon", "beauty", "polish", "acrylic"] },
  { name: "Tattoo & Piercing Studio",   type: "generic", keywords: ["tattoo", "piercing", "ink", "studio", "art", "body", "permanent makeup"] },

  // Home Services & Trades
  { name: "Electrician",                type: "generic", keywords: ["electric", "electrical", "wiring", "repair", "home", "service", "contractor", "lights", "power"] },
  { name: "Gutter Cleaning Business",   type: "generic", keywords: ["gutter", "drain", "roof", "cleaning", "maintenance", "exterior", "power washing"] },
  { name: "Junk Removal",               type: "generic", keywords: ["junk", "removal", "trash", "haul", "debris", "dump", "disposal", "clutter", "cleanout", "hauling"] },
  { name: "Moving Company",             type: "generic", keywords: ["moving", "mover", "relocation", "truck", "packing", "home service", "storage", "van"] },
  { name: "Painting Company",           type: "generic", keywords: ["painting", "painter", "interior", "exterior", "home", "contractor", "commercial", "residential"] },
  { name: "Pressure Washing Business",  type: "generic", keywords: ["pressure wash", "power wash", "cleaning", "exterior", "driveway", "deck", "home service"] },
  { name: "Pool Service & Maintenance", type: "generic", keywords: ["pool", "swimming", "maintenance", "cleaning", "repair", "service", "chemical", "water"] },
  { name: "Tree Service & Arborist",    type: "generic", keywords: ["tree", "arborist", "trimming", "removal", "stump", "landscaping", "outdoor", "yard"] },
  { name: "Lawn Care",                  type: "generic", keywords: ["lawn", "grass", "mowing", "landscaping", "garden", "outdoor", "yard", "trimming", "gardening"] },
  { name: "Pest Control",               type: "generic", keywords: ["pest", "bug", "termite", "exterminator", "insect", "rodent", "outdoor", "spraying"] },
  { name: "Mosquito Control Business",  type: "generic", keywords: ["mosquito", "pest", "bug", "spraying", "outdoor", "yard", "insects", "exterminator"] },
  { name: "Window Cleaning Service",    type: "generic", keywords: ["window", "cleaning", "washing", "commercial", "residential", "exterior", "high rise"] },
  { name: "Carpet & Floor Cleaning",    type: "generic", keywords: ["carpet", "floor", "cleaning", "tile", "grout", "upholstery", "home service"] },
  { name: "Solar Panel Installation",   type: "generic", keywords: ["solar", "panel", "energy", "renewable", "installation", "contractor", "electricity", "roof"] },
  { name: "Security System Installation", type: "generic", keywords: ["security", "alarm", "camera", "cctv", "home security", "installation", "monitoring", "smart home"] },
  { name: "Home Inspection Service",    type: "generic", keywords: ["home inspection", "inspector", "real estate", "safety", "property", "building", "contractor"] },
  { name: "Fence Installation & Repair", type: "generic", keywords: ["fence", "fencing", "gate", "install", "repair", "yard", "contractor", "privacy"] },
  { name: "Concrete & Masonry Contractor", type: "generic", keywords: ["concrete", "masonry", "paving", "driveway", "sidewalk", "contractor", "stone", "brick"] },
  { name: "Irrigation & Sprinkler Service", type: "generic", keywords: ["irrigation", "sprinkler", "lawn", "watering", "landscape", "home service", "yard"] },
  { name: "Snow Removal Service",       type: "generic", keywords: ["snow", "removal", "plowing", "ice", "winter", "landscaping", "commercial", "residential"] },
  { name: "Chimney Sweep & Inspection", type: "generic", keywords: ["chimney", "fireplace", "sweep", "inspection", "cleaning", "home service", "safety"] },
  { name: "Storage Facility",           type: "generic", keywords: ["storage", "self-storage", "unit", "locker", "warehouse", "facility", "moving", "rental"] },

  // Automotive
  { name: "Auto Repair Shop",           type: "generic", keywords: ["car", "auto", "vehicle", "mechanic", "repair", "engine", "brakes", "transmission", "garage"] },
  { name: "Car Wash",                   type: "generic", keywords: ["car wash", "auto", "vehicle", "wash", "detail", "clean", "express", "tunnel"] },

  // Professional Services
  { name: "Law Firm",                   type: "generic", keywords: ["law", "lawyer", "attorney", "legal", "counsel", "corporate", "divorce", "litigation"] },
  { name: "Accounting Firm",            type: "generic", keywords: ["tax", "accountant", "cpa", "finance", "audit", "money", "bookkeeping", "corporate"] },
  { name: "Real Estate Agency",         type: "generic", keywords: ["house", "home", "property", "buy", "sell", "realtor", "agent", "broker", "brokerage"] },
  { name: "Insurance Agency",           type: "generic", keywords: ["insurance", "agent", "broker", "life", "auto", "home", "health", "commercial"] },
  { name: "Marketing Agency",           type: "generic", keywords: ["marketing", "agency", "digital", "advertising", "branding", "social media", "seo", "ppc", "content"] },
  { name: "IT Support & Managed Services", type: "generic", keywords: ["it", "tech support", "managed services", "msp", "computer", "network", "cybersecurity", "helpdesk"] },
  { name: "Financial Planning Practice", type: "generic", keywords: ["financial planning", "wealth management", "investment", "retirement", "advisor", "cfp", "portfolio"] },
  { name: "Mortgage Broker",            type: "generic", keywords: ["mortgage", "loan", "broker", "home loan", "refinance", "finance", "bank", "lending"] },
  { name: "Staffing & Recruiting Agency", type: "generic", keywords: ["staffing", "recruiting", "temp agency", "placement", "hire", "employment", "workforce"] },
  { name: "Tutoring Center",            type: "generic", keywords: ["tutor", "tutoring", "education", "school", "learning", "academic", "test prep", "sat", "kids"] },
  { name: "Photography Studio",         type: "generic", keywords: ["photography", "photo", "studio", "portrait", "wedding", "event", "headshot", "product"] },
  { name: "Event Planning",             type: "generic", keywords: ["event", "party", "wedding", "planner", "organizer", "corporate", "coordinating", "celebration"] },
  { name: "Printing & Signage Shop",    type: "generic", keywords: ["print", "printing", "signage", "sign", "banner", "vinyl", "marketing", "design", "shop"] },

  // Retail
  { name: "Clothing Boutique",          type: "generic", keywords: ["clothing", "fashion", "boutique", "apparel", "retail", "style", "women", "dress"] },
  { name: "Pet Supply Store",           type: "generic", keywords: ["pet", "dog", "cat", "animal", "supply", "food", "accessories", "retail"] },
  { name: "Florist",                    type: "generic", keywords: ["flower", "florist", "floral", "bouquet", "arrangement", "wedding", "event", "plant"] },
  { name: "Bookstore",                  type: "generic", keywords: ["book", "shop", "read", "library", "novel", "literature", "retail"] },
  { name: "Dry Cleaner",                type: "generic", keywords: ["laundry", "clean", "dry", "clothes", "wash", "service", "alterations", "garments"] },
  { name: "Laundromat",                 type: "generic", keywords: ["laundry", "laundromat", "wash", "clean", "coin", "self-service", "clothes", "dryer", "washroom"] },
  { name: "Parking Lot Striping",       type: "generic", keywords: ["parking", "lot", "striping", "line", "painting", "asphalt", "marking", "commercial", "pavement"] },
  { name: "Vending Machine Business",   type: "generic", keywords: ["vending", "machine", "snack", "drink", "passive income", "b2b", "route", "locations"] },

  // B2B / Commercial
  { name: "Commercial Cleaning Company", type: "generic", keywords: ["commercial cleaning", "janitorial", "office cleaning", "facility", "b2b", "maintenance"] },
  { name: "Commercial Landscaping",     type: "generic", keywords: ["commercial landscaping", "hoa", "property management", "grounds", "lawn", "b2b", "maintenance"] },
  { name: "Medical Billing Service",    type: "generic", keywords: ["medical billing", "coding", "healthcare", "b2b", "revenue cycle", "insurance", "claims"] },
];

export const businessSuggestionsList: BusinessSuggestion[] = [...FRANCHISES, ...GENERIC];

/**
 * Searches the curated list.
 * Priority: name starts-with > name includes > keyword match.
 * Returns up to 10 results, deduped by name.
 */
export const searchBusinessTypes = (userInput: string): BusinessSuggestion[] => {
  if (!userInput) return [];
  const q = userInput.trim().toLowerCase();
  if (!q) return [];

  const startsWithName: BusinessSuggestion[] = [];
  const includesName: BusinessSuggestion[] = [];
  const keywordMatches: BusinessSuggestion[] = [];
  const seen = new Set<string>();

  for (const item of businessSuggestionsList) {
    const nameLower = item.name.toLowerCase();
    if (nameLower.startsWith(q)) {
      startsWithName.push(item);
      seen.add(item.name);
    } else if (nameLower.includes(q)) {
      includesName.push(item);
      seen.add(item.name);
    } else {
      const kwMatch = item.keywords.some(kw => kw.toLowerCase().includes(q));
      if (kwMatch && !seen.has(item.name)) {
        keywordMatches.push(item);
        seen.add(item.name);
      }
    }
  }

  return [...startsWithName, ...includesName, ...keywordMatches].slice(0, 10);
};
