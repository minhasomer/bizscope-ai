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

  // --- FOOD & BEVERAGE ---
  { name: "Pizza Restaurant", type: "generic", keywords: ["pizza", "italian", "food", "restaurant", "dining", "slice", "delivery"] },
  { name: "Burger Restaurant", type: "generic", keywords: ["burger", "fast", "food", "restaurant", "dining", "grill", "beef"] },
  { name: "Taco Shop", type: "generic", keywords: ["taco", "mexican", "food", "restaurant", "burrito", "enchilada", "tex-mex"] },
  { name: "Ramen Restaurant", type: "generic", keywords: ["ramen", "noodle", "japanese", "food", "restaurant", "soup", "asian"] },
  { name: "Ice Cream Shop", type: "generic", keywords: ["ice cream", "gelato", "frozen", "dessert", "sweet", "cone", "sundae"] },
  { name: "Smoothie & Juice Bar", type: "generic", keywords: ["smoothie", "juice", "health", "drink", "blend", "fresh", "nutrition"] },
  { name: "Boba Tea Shop", type: "generic", keywords: ["boba", "bubble tea", "tea", "asian", "drink", "tapioca", "milk tea"] },
  { name: "Food Truck", type: "generic", keywords: ["food truck", "mobile", "street food", "catering", "event", "festival"] },
  { name: "Catering Company", type: "generic", keywords: ["catering", "food", "event", "wedding", "corporate", "party", "chef"] },
  { name: "Meal Prep Service", type: "generic", keywords: ["meal prep", "meal kit", "food", "healthy", "delivery", "diet", "nutrition"] },
  { name: "Sandwich Shop", type: "generic", keywords: ["sandwich", "sub", "deli", "lunch", "food", "wrap", "panini"] },
  { name: "Sushi Restaurant", type: "generic", keywords: ["sushi", "japanese", "seafood", "food", "restaurant", "raw fish", "hibachi", "asian"] },
  { name: "Breakfast & Brunch Cafe", type: "generic", keywords: ["breakfast", "brunch", "cafe", "egg", "pancake", "waffle", "morning", "omelet"] },
  { name: "Wing Restaurant", type: "generic", keywords: ["wing", "chicken", "food", "restaurant", "buffalo", "fried", "sports bar"] },
  { name: "Ghost Kitchen / Delivery-Only Restaurant", type: "generic", keywords: ["ghost kitchen", "cloud kitchen", "delivery", "food", "online", "doordash", "ubereats"] },

  // --- HEALTH & MEDICAL ---
  { name: "Physical Therapy Clinic", type: "generic", keywords: ["physical therapy", "physio", "rehab", "health", "medical", "sports", "injury", "orthopedic"] },
  { name: "Chiropractic Office", type: "generic", keywords: ["chiropractor", "chiro", "back", "spine", "health", "medical", "alignment", "pain relief"] },
  { name: "GLP-1 Weight Loss Clinic", type: "generic", keywords: ["glp1", "glp-1", "weight loss", "ozempic", "wegovy", "semaglutide", "medical weight", "obesity", "clinic"] },
  { name: "Weight Loss Center", type: "generic", keywords: ["weight loss", "diet", "obesity", "medical", "health", "nutrition", "bariatric", "slim"] },
  { name: "Optometry Practice", type: "generic", keywords: ["optometry", "optometrist", "eye", "vision", "glasses", "contact lens", "health", "medical"] },
  { name: "Mental Health Practice", type: "generic", keywords: ["mental health", "therapy", "therapist", "counseling", "psychologist", "psychiatrist", "anxiety", "depression"] },
  { name: "Podiatry Clinic", type: "generic", keywords: ["podiatry", "foot", "ankle", "podiatrist", "health", "medical", "bunion", "neuropathy"] },
  { name: "Sleep Clinic", type: "generic", keywords: ["sleep", "insomnia", "apnea", "cpap", "health", "medical", "clinic", "specialist"] },
  { name: "IV Hydration & Wellness Lounge", type: "generic", keywords: ["iv", "hydration", "wellness", "vitamin", "infusion", "drip", "health", "recovery", "lounge"] },
  { name: "Speech Therapy Practice", type: "generic", keywords: ["speech", "therapy", "language", "communication", "pediatric", "health", "medical", "stuttering"] },
  { name: "Pediatric Clinic", type: "generic", keywords: ["pediatric", "pediatrician", "child", "kids", "baby", "health", "medical", "family doctor"] },
  { name: "Hormone & TRT Clinic", type: "generic", keywords: ["hormone", "trt", "testosterone", "hrt", "menopause", "andropause", "health", "wellness", "medical"] },
  { name: "Fertility Clinic", type: "generic", keywords: ["fertility", "ivf", "reproductive", "pregnancy", "health", "medical", "infertility", "specialist"] },

  // --- WELLNESS & FITNESS ---
  { name: "Personal Training Studio", type: "generic", keywords: ["personal training", "trainer", "fitness", "gym", "workout", "strength", "one on one", "private coach"] },
  { name: "Pilates Studio", type: "generic", keywords: ["pilates", "reformer", "fitness", "core", "flexibility", "wellness", "mind body"] },
  { name: "Martial Arts School", type: "generic", keywords: ["martial arts", "karate", "jiu jitsu", "mma", "kickboxing", "bjj", "fitness", "training", "kids"] },
  { name: "Dance Studio", type: "generic", keywords: ["dance", "studio", "ballet", "hip hop", "salsa", "classes", "performance", "kids", "adult"] },
  { name: "Float Tank / Sensory Deprivation Center", type: "generic", keywords: ["float", "floatation", "sensory deprivation", "relaxation", "stress", "wellness", "meditation"] },
  { name: "Cryotherapy Center", type: "generic", keywords: ["cryo", "cryotherapy", "cold", "recovery", "wellness", "sports", "athlete", "inflammation"] },
  { name: "Tanning Salon", type: "generic", keywords: ["tanning", "spray tan", "bronze", "beauty", "salon", "skin", "glow"] },
  { name: "Tattoo & Piercing Studio", type: "generic", keywords: ["tattoo", "piercing", "ink", "studio", "art", "body", "permanent makeup"] },

  // --- PROFESSIONAL SERVICES ---
  { name: "Marketing Agency", type: "generic", keywords: ["marketing", "agency", "digital", "advertising", "branding", "social media", "seo", "ppc", "content"] },
  { name: "Web Design & Development Agency", type: "generic", keywords: ["web design", "website", "development", "agency", "digital", "tech", "ux", "frontend"] },
  { name: "IT Support & Managed Services", type: "generic", keywords: ["it", "tech support", "managed services", "msp", "computer", "network", "cybersecurity", "helpdesk"] },
  { name: "Insurance Agency", type: "generic", keywords: ["insurance", "agent", "broker", "life", "auto", "home", "health", "commercial"] },
  { name: "Mortgage Broker", type: "generic", keywords: ["mortgage", "loan", "broker", "home loan", "refinance", "finance", "bank", "lending"] },
  { name: "Financial Planning Practice", type: "generic", keywords: ["financial planning", "wealth management", "investment", "retirement", "advisor", "cfp", "portfolio"] },
  { name: "HR Consulting Firm", type: "generic", keywords: ["hr", "human resources", "staffing", "recruiting", "payroll", "consulting", "workforce"] },
  { name: "Staffing & Recruiting Agency", type: "generic", keywords: ["staffing", "recruiting", "temp agency", "placement", "hire", "employment", "workforce"] },
  { name: "Payroll Services", type: "generic", keywords: ["payroll", "accounting", "tax", "bookkeeping", "small business", "cpa", "hr"] },
  { name: "Photography Studio", type: "generic", keywords: ["photography", "photo", "studio", "portrait", "wedding", "event", "headshot", "product"] },
  { name: "Videography & Production Company", type: "generic", keywords: ["video", "production", "film", "videography", "commercial", "youtube", "marketing", "media"] },
  { name: "Tutoring Center", type: "generic", keywords: ["tutor", "tutoring", "education", "school", "learning", "academic", "test prep", "sat", "kids"] },
  { name: "Printing & Signage Shop", type: "generic", keywords: ["print", "printing", "signage", "sign", "banner", "vinyl", "marketing", "design", "shop"] },

  // --- RETAIL ---
  { name: "Clothing Boutique", type: "generic", keywords: ["clothing", "fashion", "boutique", "apparel", "retail", "style", "women", "dress"] },
  { name: "Pet Supply Store", type: "generic", keywords: ["pet", "dog", "cat", "animal", "supply", "food", "accessories", "retail"] },
  { name: "Vitamin & Supplement Store", type: "generic", keywords: ["vitamin", "supplement", "nutrition", "health", "wellness", "protein", "retail"] },
  { name: "Phone & Computer Repair Shop", type: "generic", keywords: ["phone repair", "screen repair", "iphone", "computer repair", "tech", "electronics", "retail"] },
  { name: "Toy Store", type: "generic", keywords: ["toy", "game", "kids", "children", "play", "education", "retail", "lego"] },
  { name: "Florist", type: "generic", keywords: ["flower", "florist", "floral", "bouquet", "arrangement", "wedding", "event", "plant"] },
  { name: "Furniture Store", type: "generic", keywords: ["furniture", "home", "decor", "interior", "retail", "sofa", "mattress", "bedroom"] },
  { name: "Sporting Goods Store", type: "generic", keywords: ["sporting goods", "sports", "fitness", "outdoor", "equipment", "retail", "gear", "athleisure"] },
  { name: "Vape & Smoke Shop", type: "generic", keywords: ["vape", "smoke", "tobacco", "cbd", "retail", "e-cigarette", "hookah"] },
  { name: "Cannabis Dispensary", type: "generic", keywords: ["cannabis", "dispensary", "marijuana", "cbd", "thc", "weed", "medical", "retail"] },

  // --- HOME SERVICES & TRADES ---
  { name: "Roofing Company", type: "generic", keywords: ["roofing", "roof", "repair", "installation", "shingles", "contractor", "home", "exterior"] },
  { name: "Window Cleaning Service", type: "generic", keywords: ["window", "cleaning", "washing", "commercial", "residential", "exterior", "high rise"] },
  { name: "Pressure Washing Business", type: "generic", keywords: ["pressure wash", "power wash", "cleaning", "exterior", "driveway", "deck", "home service"] },
  { name: "Carpet & Floor Cleaning", type: "generic", keywords: ["carpet", "floor", "cleaning", "tile", "grout", "upholstery", "home service"] },
  { name: "Chimney Sweep & Inspection", type: "generic", keywords: ["chimney", "fireplace", "sweep", "inspection", "cleaning", "home service", "safety"] },
  { name: "Irrigation & Sprinkler Service", type: "generic", keywords: ["irrigation", "sprinkler", "lawn", "watering", "landscape", "home service", "yard"] },
  { name: "Fence Installation & Repair", type: "generic", keywords: ["fence", "fencing", "gate", "install", "repair", "yard", "contractor", "privacy"] },
  { name: "Concrete & Masonry Contractor", type: "generic", keywords: ["concrete", "masonry", "paving", "driveway", "sidewalk", "contractor", "stone", "brick"] },
  { name: "Painting Company", type: "generic", keywords: ["painting", "painter", "interior", "exterior", "home", "contractor", "commercial", "residential"] },
  { name: "Home Inspection Service", type: "generic", keywords: ["home inspection", "inspector", "real estate", "safety", "property", "building", "contractor"] },
  { name: "Pool Service & Maintenance", type: "generic", keywords: ["pool", "swimming", "maintenance", "cleaning", "repair", "service", "chemical", "water"] },
  { name: "Moving Company", type: "generic", keywords: ["moving", "mover", "relocation", "truck", "packing", "home service", "storage", "van"] },
  { name: "Storage Facility", type: "generic", keywords: ["storage", "self-storage", "unit", "locker", "warehouse", "facility", "moving", "rental"] },
  { name: "Security System Installation", type: "generic", keywords: ["security", "alarm", "camera", "cctv", "home security", "installation", "monitoring", "smart home"] },
  { name: "Solar Panel Installation", type: "generic", keywords: ["solar", "panel", "energy", "renewable", "installation", "contractor", "electricity", "roof"] },
  { name: "Snow Removal Service", type: "generic", keywords: ["snow", "removal", "plowing", "ice", "winter", "landscaping", "commercial", "residential"] },
  { name: "Tree Service & Arborist", type: "generic", keywords: ["tree", "arborist", "trimming", "removal", "stump", "landscaping", "outdoor", "yard"] },

  // --- B2B SERVICES ---
  { name: "Commercial Cleaning Company", type: "generic", keywords: ["commercial cleaning", "janitorial", "office cleaning", "facility", "b2b", "maintenance"] },
  { name: "Commercial Landscaping", type: "generic", keywords: ["commercial landscaping", "hoa", "property management", "grounds", "lawn", "b2b", "maintenance"] },
  { name: "Vending Machine Business", type: "generic", keywords: ["vending", "machine", "snack", "drink", "passive income", "b2b", "route", "locations"] },
  { name: "Courier & Last-Mile Delivery", type: "generic", keywords: ["courier", "delivery", "last mile", "logistics", "package", "same day", "b2b"] },
  { name: "Medical Billing Service", type: "generic", keywords: ["medical billing", "coding", "healthcare", "b2b", "revenue cycle", "insurance", "claims"] },

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
  { name: "Chick-fil-A", type: "franchise", keywords: ["chicken", "fast food", "sandwich", "food", "dining", "franchise"] },
  { name: "Domino's Pizza", type: "franchise", keywords: ["pizza", "delivery", "food", "dining", "franchise", "dominos"] },
  { name: "Dunkin'", type: "franchise", keywords: ["coffee", "donut", "breakfast", "drink", "food", "franchise", "dunkin"] },
  { name: "Five Guys", type: "franchise", keywords: ["burger", "fast food", "fries", "food", "dining", "franchise"] },
  { name: "Jersey Mike's Subs", type: "franchise", keywords: ["sandwich", "sub", "deli", "food", "dining", "franchise", "jersey mikes"] },
  { name: "Wingstop", type: "franchise", keywords: ["wing", "chicken", "food", "dining", "franchise"] },
  { name: "Smoothie King", type: "franchise", keywords: ["smoothie", "juice", "health", "drink", "wellness", "franchise"] },
  { name: "Dutch Bros Coffee", type: "franchise", keywords: ["coffee", "drink", "drive through", "beverage", "franchise", "dutch"] },
  { name: "Tropical Smoothie Cafe", type: "franchise", keywords: ["smoothie", "juice", "food", "health", "tropical", "franchise"] },
  { name: "Marco's Pizza", type: "franchise", keywords: ["pizza", "food", "delivery", "dining", "franchise", "marcos"] },
  { name: "Firehouse Subs", type: "franchise", keywords: ["sandwich", "sub", "food", "dining", "franchise", "firehouse"] },
  { name: "Merry Maids", type: "franchise", keywords: ["cleaning", "maid", "home service", "residential", "franchise", "housekeeping"] },
  { name: "ServiceMaster Clean", type: "franchise", keywords: ["cleaning", "restoration", "commercial", "home service", "franchise", "servicemaster"] },
  { name: "Servpro", type: "franchise", keywords: ["restoration", "water damage", "fire damage", "cleaning", "home service", "franchise"] },
  { name: "Two Men and a Truck", type: "franchise", keywords: ["moving", "mover", "relocation", "truck", "home service", "franchise"] },
  { name: "1-800-GOT-JUNK?", type: "franchise", keywords: ["junk", "removal", "hauling", "trash", "debris", "franchise"] },
  { name: "Mr. Handyman", type: "franchise", keywords: ["handyman", "repair", "home service", "contractor", "maintenance", "franchise"] },
  { name: "Coverall Commercial Cleaning", type: "franchise", keywords: ["commercial cleaning", "janitorial", "office", "b2b", "franchise", "coverall"] },
  { name: "Club Pilates", type: "franchise", keywords: ["pilates", "fitness", "wellness", "reformer", "studio", "franchise"] },
  { name: "F45 Training", type: "franchise", keywords: ["fitness", "gym", "hiit", "training", "workout", "franchise", "f45"] },
  { name: "Goldfish Swim School", type: "franchise", keywords: ["swim", "swimming", "kids", "children", "school", "lessons", "franchise"] },
  { name: "Kumon", type: "franchise", keywords: ["tutoring", "education", "math", "reading", "kids", "learning", "academic", "franchise"] },
  { name: "Sylvan Learning", type: "franchise", keywords: ["tutoring", "education", "learning", "kids", "academic", "test prep", "franchise"] },
  { name: "Snap Fitness", type: "franchise", keywords: ["gym", "fitness", "workout", "24 hour", "exercise", "franchise", "snap"] },
  { name: "Hand & Stone Massage", type: "franchise", keywords: ["massage", "spa", "facial", "wellness", "relaxation", "franchise"] },
  { name: "European Wax Center", type: "franchise", keywords: ["wax", "beauty", "salon", "hair removal", "skin", "franchise"] },

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
