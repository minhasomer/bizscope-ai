export interface BusinessSuggestion {
  name: string;
  /** Display category shown in the dropdown (e.g. "Food & Beverage", "Home Services"). */
  category: string;
  /** 'independent' = standalone/local business; 'franchise' = branded franchise; 'startup' = tech/online/emerging model. */
  type: 'independent' | 'franchise' | 'startup';
  /** Search keywords — include aliases and common misspellings so the filter is forgiving. */
  keywords: string[];
}

// ─── FRANCHISES ────────────────────────────────────────────────────────────────
const FRANCHISES: BusinessSuggestion[] = [
  { name: "Chick-fil-A",                       category: "Franchise", type: "franchise", keywords: ["chicken", "fast food", "sandwich", "dining", "franchise", "chick fil a", "chickfila"] },
  { name: "Jersey Mike's Subs",                 category: "Franchise", type: "franchise", keywords: ["sandwich", "sub", "deli", "food", "dining", "franchise", "jersey mikes"] },
  { name: "Culver's",                           category: "Franchise", type: "franchise", keywords: ["burger", "fast food", "cheese curds", "food", "dining", "franchise", "culvers"] },
  { name: "The UPS Store",                      category: "Franchise", type: "franchise", keywords: ["pack", "shipping", "mail", "post", "box", "print", "copy", "ups", "franchise"] },
  { name: "Ace Hardware",                       category: "Franchise", type: "franchise", keywords: ["hardware", "tools", "home improvement", "retail", "franchise", "ace"] },
  { name: "Dunkin'",                            category: "Franchise", type: "franchise", keywords: ["coffee", "donut", "breakfast", "drink", "franchise", "dunkin", "dunkin donuts"] },
  { name: "Subway",                             category: "Franchise", type: "franchise", keywords: ["sandwich", "sub", "fast food", "dining", "franchise"] },
  { name: "McDonald's",                         category: "Franchise", type: "franchise", keywords: ["fast food", "burger", "fries", "dining", "mcdonald", "mcdonalds", "franchise"] },
  { name: "Taco Bell",                          category: "Franchise", type: "franchise", keywords: ["taco", "mexican", "fast food", "burritto", "franchise"] },
  { name: "Domino's Pizza",                     category: "Franchise", type: "franchise", keywords: ["pizza", "delivery", "food", "franchise", "dominos"] },
  { name: "Papa Johns",                         category: "Franchise", type: "franchise", keywords: ["pizza", "delivery", "food", "franchise", "papa john"] },
  { name: "Anytime Fitness",                    category: "Franchise", type: "franchise", keywords: ["gym", "fitness", "workout", "exercise", "24 hour", "franchise", "anytime"] },
  { name: "Planet Fitness",                     category: "Franchise", type: "franchise", keywords: ["gym", "fitness", "workout", "exercise", "franchise", "planet"] },
  { name: "Orangetheory Fitness",               category: "Franchise", type: "franchise", keywords: ["gym", "fitness", "hiit", "training", "workout", "franchise", "orangetheory", "orange theory"] },
  { name: "SERVPRO",                            category: "Franchise", type: "franchise", keywords: ["restoration", "water damage", "fire damage", "cleaning", "home service", "franchise", "servpro"] },
  { name: "Molly Maid",                         category: "Franchise", type: "franchise", keywords: ["cleaning", "maid", "home service", "residential", "franchise", "housekeeping", "molly"] },
  { name: "Great Clips",                        category: "Franchise", type: "franchise", keywords: ["hair", "cut", "barber", "salon", "clips", "franchise"] },
  { name: "Supercuts",                          category: "Franchise", type: "franchise", keywords: ["hair", "cut", "salon", "barber", "franchise", "supercuts"] },
  { name: "Kumon",                              category: "Franchise", type: "franchise", keywords: ["tutoring", "education", "math", "reading", "kids", "learning", "academic", "franchise"] },
  { name: "Mathnasium",                         category: "Franchise", type: "franchise", keywords: ["tutoring", "math", "education", "kids", "learning", "franchise", "mathnasium"] },
  { name: "Sylvan Learning",                    category: "Franchise", type: "franchise", keywords: ["tutoring", "education", "learning", "kids", "academic", "test prep", "franchise", "sylvan"] },
  { name: "7-Eleven",                           category: "Franchise", type: "franchise", keywords: ["convenience", "store", "gas", "snack", "slurpee", "franchise", "seven eleven"] },
  { name: "Smoothie King",                      category: "Franchise", type: "franchise", keywords: ["smoothie", "juice", "health", "drink", "wellness", "franchise"] },
  { name: "Crumbl Cookies",                     category: "Franchise", type: "franchise", keywords: ["cookie", "bakery", "dessert", "franchise", "crumbl"] },
  { name: "Nothing Bundt Cakes",                category: "Franchise", type: "franchise", keywords: ["cake", "bakery", "dessert", "bundt", "franchise"] },
  { name: "Buffalo Wild Wings",                 category: "Franchise", type: "franchise", keywords: ["wing", "chicken", "sports bar", "food", "franchise", "bww"] },
  { name: "Wingstop",                           category: "Franchise", type: "franchise", keywords: ["wing", "chicken", "food", "franchise"] },
  { name: "Batteries Plus",                     category: "Franchise", type: "franchise", keywords: ["battery", "phone repair", "bulb", "retail", "franchise"] },
  { name: "Meineke",                            category: "Franchise", type: "franchise", keywords: ["car", "auto", "repair", "brake", "muffler", "franchise", "meineke"] },
  { name: "Jiffy Lube",                         category: "Franchise", type: "franchise", keywords: ["oil change", "car", "auto", "lube", "franchise", "jiffy"] },
  { name: "Valvoline Instant Oil Change",       category: "Franchise", type: "franchise", keywords: ["oil change", "car", "auto", "valvoline", "franchise"] },
  { name: "Marco's Pizza",                      category: "Franchise", type: "franchise", keywords: ["pizza", "food", "delivery", "franchise", "marcos"] },
  { name: "Dutch Bros Coffee",                  category: "Franchise", type: "franchise", keywords: ["coffee", "drive through", "beverage", "drink", "franchise", "dutch"] },
  { name: "Massage Envy",                       category: "Franchise", type: "franchise", keywords: ["massage", "spa", "wellness", "therapy", "franchise"] },
  { name: "The Joint Chiropractic",             category: "Franchise", type: "franchise", keywords: ["chiropractor", "back", "pain", "health", "joint", "alignment", "franchise"] },
  // Home / Outdoor Services
  { name: "The Brothers That Just Do Gutters",  category: "Franchise", type: "franchise", keywords: ["gutter", "brothers gutters", "gutters", "home service", "exterior", "franchise", "brothers"] },
  { name: "Mosquito Joe",                       category: "Franchise", type: "franchise", keywords: ["mosquito", "pest control", "outdoor", "spray", "bug", "yard", "franchise", "mosquito joe"] },
  { name: "Mosquito Squad",                     category: "Franchise", type: "franchise", keywords: ["mosquito", "pest control", "outdoor", "spray", "bug", "yard", "franchise"] },
  { name: "Two Men and a Truck",                category: "Franchise", type: "franchise", keywords: ["moving", "mover", "truck", "relocation", "franchise", "two men"] },
  { name: "1-800-GOT-JUNK",                    category: "Franchise", type: "franchise", keywords: ["junk removal", "junk", "hauling", "trash", "disposal", "franchise", "got junk"] },
  { name: "Mr. Handyman",                       category: "Franchise", type: "franchise", keywords: ["handyman", "repair", "home service", "maintenance", "fix", "franchise"] },
  { name: "ServiceMaster Clean",                category: "Franchise", type: "franchise", keywords: ["restoration", "cleaning", "water damage", "commercial", "franchise", "servicemaster"] },
  { name: "Merry Maids",                        category: "Franchise", type: "franchise", keywords: ["cleaning", "maid", "home service", "residential", "housekeeping", "franchise", "merry maids"] },
  // Food & Beverage
  { name: "Five Guys",                          category: "Franchise", type: "franchise", keywords: ["burger", "fast food", "fries", "dining", "franchise", "five guys"] },
  { name: "Firehouse Subs",                     category: "Franchise", type: "franchise", keywords: ["sandwich", "sub", "food", "dining", "franchise", "firehouse"] },
  { name: "Raising Cane's",                     category: "Franchise", type: "franchise", keywords: ["chicken", "fast food", "tenders", "dining", "franchise", "canes", "raising canes"] },
  { name: "Tropical Smoothie Cafe",             category: "Franchise", type: "franchise", keywords: ["smoothie", "juice", "health", "drink", "cafe", "franchise", "tropical"] },
  { name: "Pizza Hut",                          category: "Franchise", type: "franchise", keywords: ["pizza", "delivery", "food", "dining", "franchise", "pizza hut"] },
  { name: "Little Caesars",                     category: "Franchise", type: "franchise", keywords: ["pizza", "fast food", "food", "dining", "franchise", "little caesars"] },
  // Fitness / Beauty
  { name: "F45 Training",                       category: "Franchise", type: "franchise", keywords: ["gym", "fitness", "hiit", "training", "group", "workout", "franchise", "f45"] },
  { name: "Club Pilates",                       category: "Franchise", type: "franchise", keywords: ["pilates", "reformer", "fitness", "core", "wellness", "franchise", "club pilates"] },
  { name: "Crunch Fitness",                     category: "Franchise", type: "franchise", keywords: ["gym", "fitness", "workout", "exercise", "franchise", "crunch"] },
  { name: "Sport Clips",                        category: "Franchise", type: "franchise", keywords: ["hair", "cut", "barber", "men", "salon", "franchise", "sport clips"] },
  { name: "European Wax Center",                category: "Franchise", type: "franchise", keywords: ["wax", "hair removal", "beauty", "skin", "salon", "franchise", "european wax"] },
  { name: "Hand & Stone Massage",               category: "Franchise", type: "franchise", keywords: ["massage", "spa", "facial", "wellness", "therapy", "franchise", "hand and stone"] },
  // Education
  { name: "Goldfish Swim School",               category: "Franchise", type: "franchise", keywords: ["swim", "swimming", "kids", "lessons", "pool", "aquatic", "franchise", "goldfish"] },
  // Real Estate
  { name: "RE/MAX",                             category: "Franchise", type: "franchise", keywords: ["real estate", "realtor", "broker", "house", "property", "franchise", "remax"] },
  { name: "Keller Williams",                    category: "Franchise", type: "franchise", keywords: ["real estate", "realtor", "broker", "house", "property", "franchise", "keller"] },
  { name: "Century 21",                         category: "Franchise", type: "franchise", keywords: ["real estate", "realtor", "broker", "house", "property", "franchise", "century 21"] },
];

// ─── FOOD & BEVERAGE ──────────────────────────────────────────────────────────
const FOOD_BEVERAGE: BusinessSuggestion[] = [
  { name: "Coffee Shop",                        category: "Food & Beverage", type: "independent", keywords: ["coffee", "cafe", "espresso", "latte", "breakfast", "drink", "beverage", "bakery", "cappuccino"] },
  { name: "Specialty Coffee Shop",              category: "Food & Beverage", type: "independent", keywords: ["coffee", "specialty", "single origin", "cafe", "espresso", "pour over", "roast"] },
  { name: "Bubble Tea Shop",                    category: "Food & Beverage", type: "independent", keywords: ["boba", "bubble tea", "tea", "asian", "drink", "tapioca", "milk tea"] },
  { name: "Smoothie Bar",                       category: "Food & Beverage", type: "independent", keywords: ["smoothie", "juice", "health", "drink", "blend", "fresh", "nutrition", "bar"] },
  { name: "Juice Bar",                          category: "Food & Beverage", type: "independent", keywords: ["juice", "cold pressed", "health", "drink", "smoothie", "fresh", "nutrition"] },
  { name: "Bakery",                             category: "Food & Beverage", type: "independent", keywords: ["bread", "cake", "pastry", "cookies", "dessert", "food", "cupcake", "artisan"] },
  { name: "Donut Shop",                         category: "Food & Beverage", type: "independent", keywords: ["donut", "doughnut", "pastry", "coffee", "bakery", "sweet", "breakfast"] },
  { name: "Ice Cream Shop",                     category: "Food & Beverage", type: "independent", keywords: ["ice cream", "gelato", "frozen", "dessert", "sweet", "cone", "sundae", "sorbet"] },
  { name: "Food Truck",                         category: "Food & Beverage", type: "independent", keywords: ["food truck", "mobile", "street food", "catering", "event", "festival"] },
  { name: "Pizza Restaurant",                   category: "Food & Beverage", type: "independent", keywords: ["pizza", "italian", "food", "restaurant", "dining", "slice", "delivery", "pizza shop"] },
  { name: "Burger Restaurant",                  category: "Food & Beverage", type: "independent", keywords: ["burger", "fast food", "restaurant", "dining", "grill", "beef", "smash burger"] },
  { name: "Sandwich Shop",                      category: "Food & Beverage", type: "independent", keywords: ["sandwich", "sub", "deli", "lunch", "food", "wrap", "panini"] },
  { name: "Breakfast Restaurant",               category: "Food & Beverage", type: "independent", keywords: ["breakfast", "brunch", "cafe", "egg", "pancake", "waffle", "morning", "omelet"] },
  { name: "Fast Casual Restaurant",             category: "Food & Beverage", type: "independent", keywords: ["fast casual", "restaurant", "food", "dining", "counter service", "quick"] },
  { name: "Meal Prep Service",                  category: "Food & Beverage", type: "independent", keywords: ["meal prep", "meal kit", "food", "healthy", "delivery", "diet", "nutrition", "weekly"] },
  { name: "Catering Company",                   category: "Food & Beverage", type: "independent", keywords: ["catering", "food", "event", "wedding", "corporate", "party", "chef", "caterer"] },
  { name: "Ghost Kitchen",                      category: "Food & Beverage", type: "startup",     keywords: ["ghost kitchen", "cloud kitchen", "delivery", "food", "online", "doordash", "virtual restaurant"] },
  { name: "Healthy Bowl Restaurant",            category: "Food & Beverage", type: "independent", keywords: ["bowl", "healthy", "salad", "grain bowl", "poke", "acai", "restaurant", "food"] },
  { name: "Ethnic Grocery Store",               category: "Food & Beverage", type: "independent", keywords: ["grocery", "ethnic", "international", "food", "specialty", "market", "asian", "latin", "halal"] },
  { name: "Specialty Dessert Shop",             category: "Food & Beverage", type: "independent", keywords: ["dessert", "cake", "sweet", "specialty", "chocolate", "pastry", "candy"] },
  { name: "Tea House",                          category: "Food & Beverage", type: "independent", keywords: ["tea", "cafe", "loose leaf", "herbal", "drink", "house", "british", "asian"] },
  { name: "Wine Bar",                           category: "Food & Beverage", type: "independent", keywords: ["wine", "bar", "tasting", "bottle", "restaurant", "pairing", "bistro"] },
  { name: "Local Deli",                         category: "Food & Beverage", type: "independent", keywords: ["deli", "sandwich", "meat", "cheese", "grocery", "local", "lunch", "cold cuts"] },
  { name: "Farmers Market Vendor",              category: "Food & Beverage", type: "independent", keywords: ["farmers market", "produce", "local", "fresh", "vendor", "organic", "farm", "small business"] },
  { name: "Sushi Restaurant",                   category: "Food & Beverage", type: "independent", keywords: ["sushi", "japanese", "seafood", "food", "restaurant", "raw fish", "hibachi", "asian"] },
];

// ─── HOME SERVICES ────────────────────────────────────────────────────────────
const HOME_SERVICES: BusinessSuggestion[] = [
  { name: "HVAC Company",                       category: "Home Services", type: "independent", keywords: ["hvac", "heat", "heating", "air", "cooling", "ac", "repair", "home", "service", "contractor", "ventilation", "furnace"] },
  { name: "Plumbing Company",                   category: "Home Services", type: "independent", keywords: ["plumber", "plumbing", "pipe", "water", "leak", "repair", "home", "service", "contractor", "drain", "septic"] },
  { name: "Electrical Contractor",              category: "Home Services", type: "independent", keywords: ["electric", "electrical", "wiring", "repair", "home", "service", "contractor", "lights", "power", "panel"] },
  { name: "Roofing Company",                    category: "Home Services", type: "independent", keywords: ["roofing", "roof", "repair", "installation", "shingles", "contractor", "home", "exterior", "roofer"] },
  { name: "Gutter Cleaning Service",            category: "Home Services", type: "independent", keywords: ["gutter", "drain", "roof", "cleaning", "maintenance", "exterior", "gutters", "downspout"] },
  { name: "Window Cleaning Service",            category: "Home Services", type: "independent", keywords: ["window", "cleaning", "washing", "commercial", "residential", "exterior", "glass"] },
  { name: "Carpet Cleaning Service",            category: "Home Services", type: "independent", keywords: ["carpet", "floor", "cleaning", "tile", "grout", "upholstery", "home service", "steam"] },
  { name: "House Cleaning Service",             category: "Home Services", type: "independent", keywords: ["cleaning", "maid", "house", "home", "residential", "housekeeping", "cleaner", "deep clean"] },
  { name: "Pressure Washing Business",          category: "Home Services", type: "independent", keywords: ["pressure wash", "power wash", "cleaning", "exterior", "driveway", "deck", "home service", "sidewalk"] },
  { name: "Lawn Care Service",                  category: "Home Services", type: "independent", keywords: ["lawn", "grass", "mowing", "landscaping", "garden", "outdoor", "yard", "trimming", "lawn care"] },
  { name: "Landscaping Company",                category: "Home Services", type: "independent", keywords: ["landscaping", "landscape", "lawn", "grass", "mowing", "garden", "outdoor", "yard", "hardscape", "design"] },
  { name: "Tree Trimming Service",              category: "Home Services", type: "independent", keywords: ["tree", "arborist", "trimming", "removal", "stump", "landscaping", "outdoor", "yard", "tree service"] },
  { name: "Pest Control Company",               category: "Home Services", type: "independent", keywords: ["pest", "bug", "termite", "exterminator", "insect", "rodent", "outdoor", "spraying", "pest control"] },
  { name: "Pool Cleaning Service",              category: "Home Services", type: "independent", keywords: ["pool", "swimming", "maintenance", "cleaning", "repair", "service", "chemical", "water", "hot tub"] },
  { name: "Handyman Service",                   category: "Home Services", type: "independent", keywords: ["handyman", "repair", "home service", "contractor", "maintenance", "fix", "odd jobs"] },
  { name: "Home Remodeling Contractor",         category: "Home Services", type: "independent", keywords: ["remodeling", "renovation", "contractor", "home improvement", "general contractor", "build"] },
  { name: "Kitchen Remodeling Business",        category: "Home Services", type: "independent", keywords: ["kitchen", "remodeling", "renovation", "contractor", "cabinets", "countertop", "home improvement"] },
  { name: "Bathroom Remodeling Business",       category: "Home Services", type: "independent", keywords: ["bathroom", "remodeling", "renovation", "contractor", "shower", "tile", "vanity", "home improvement"] },
  { name: "Flooring Installation Company",      category: "Home Services", type: "independent", keywords: ["flooring", "floor", "hardwood", "tile", "carpet", "laminate", "installation", "contractor"] },
  { name: "Painting Company",                   category: "Home Services", type: "independent", keywords: ["painting", "painter", "interior", "exterior", "home", "contractor", "commercial", "residential"] },
  { name: "Garage Door Repair Business",        category: "Home Services", type: "independent", keywords: ["garage door", "door", "repair", "install", "opener", "spring", "home service"] },
  { name: "Fence Installation Business",        category: "Home Services", type: "independent", keywords: ["fence", "fencing", "gate", "install", "repair", "yard", "contractor", "privacy", "wood", "vinyl"] },
  { name: "Solar Installation Company",         category: "Home Services", type: "independent", keywords: ["solar", "panel", "energy", "renewable", "installation", "contractor", "electricity", "roof", "photovoltaic"] },
  { name: "Home Security Installer",            category: "Home Services", type: "independent", keywords: ["security", "alarm", "camera", "cctv", "home security", "installation", "monitoring", "smart home"] },
  { name: "Appliance Repair Service",           category: "Home Services", type: "independent", keywords: ["appliance", "repair", "washer", "dryer", "refrigerator", "dishwasher", "home service", "fix"] },
  { name: "Septic Service",                     category: "Home Services", type: "independent", keywords: ["septic", "tank", "pumping", "drain field", "plumbing", "wastewater", "home service"] },
  { name: "Junk Removal Business",              category: "Home Services", type: "independent", keywords: ["junk", "removal", "trash", "haul", "debris", "dump", "disposal", "clutter", "cleanout", "hauling"] },
  { name: "Moving Company",                     category: "Home Services", type: "independent", keywords: ["moving", "mover", "relocation", "truck", "packing", "home service", "storage", "van", "boxes"] },
  { name: "Storage Facility",                   category: "Home Services", type: "independent", keywords: ["storage", "self-storage", "unit", "locker", "warehouse", "facility", "moving", "rental"] },
  { name: "Snow Removal Service",               category: "Home Services", type: "independent", keywords: ["snow", "removal", "plowing", "ice", "winter", "landscaping", "commercial", "residential", "plow"] },
];

// ─── AUTOMOTIVE ───────────────────────────────────────────────────────────────
const AUTOMOTIVE: BusinessSuggestion[] = [
  { name: "Auto Detailing Business",            category: "Automotive", type: "independent", keywords: ["auto", "car", "detail", "vehicle", "polish", "wax", "cleaning", "detailing", "interior"] },
  { name: "Mobile Auto Detailing",              category: "Automotive", type: "independent", keywords: ["mobile", "auto", "car", "detail", "vehicle", "wash", "polish", "wax", "on-site", "detailing"] },
  { name: "Car Wash",                           category: "Automotive", type: "independent", keywords: ["car wash", "auto", "vehicle", "wash", "detail", "clean", "express", "tunnel"] },
  { name: "Oil Change Shop",                    category: "Automotive", type: "independent", keywords: ["oil change", "car", "auto", "lube", "quick lube", "maintenance", "vehicle"] },
  { name: "Tire Shop",                          category: "Automotive", type: "independent", keywords: ["tire", "wheel", "auto", "car", "rotation", "alignment", "vehicle", "flat"] },
  { name: "Auto Repair Shop",                   category: "Automotive", type: "independent", keywords: ["car", "auto", "vehicle", "mechanic", "repair", "engine", "brakes", "transmission", "garage"] },
  { name: "Brake Repair Shop",                  category: "Automotive", type: "independent", keywords: ["brake", "auto", "car", "repair", "pads", "rotors", "vehicle", "mechanic"] },
  { name: "Transmission Repair Shop",           category: "Automotive", type: "independent", keywords: ["transmission", "auto", "car", "repair", "vehicle", "mechanic", "clutch"] },
  { name: "Body Shop",                          category: "Automotive", type: "independent", keywords: ["body shop", "auto", "car", "collision", "repair", "paint", "dent", "vehicle", "bodywork"] },
  { name: "Windshield Repair Business",         category: "Automotive", type: "independent", keywords: ["windshield", "glass", "crack", "chip", "repair", "auto", "car", "vehicle", "window"] },
  { name: "Mobile Mechanic",                    category: "Automotive", type: "independent", keywords: ["mobile mechanic", "mechanic", "auto", "car", "repair", "on-site", "vehicle", "home visit"] },
  { name: "EV Charging Station Business",       category: "Automotive", type: "startup",     keywords: ["ev", "electric vehicle", "charging", "station", "tesla", "charge", "energy", "plug"] },
  { name: "Fleet Maintenance Service",          category: "Automotive", type: "independent", keywords: ["fleet", "maintenance", "commercial", "truck", "van", "vehicle", "b2b", "service"] },
];

// ─── PERSONAL SERVICES ────────────────────────────────────────────────────────
const PERSONAL_SERVICES: BusinessSuggestion[] = [
  { name: "Hair Salon",                         category: "Beauty & Personal Care", type: "independent", keywords: ["hair", "salon", "cut", "color", "style", "beauty", "highlights", "blowout"] },
  { name: "Barber Shop",                        category: "Beauty & Personal Care", type: "independent", keywords: ["barber", "hair", "cut", "shave", "salon", "men", "grooming", "fade"] },
  { name: "Nail Salon",                         category: "Beauty & Personal Care", type: "independent", keywords: ["nail", "manicure", "pedicure", "salon", "beauty", "polish", "acrylic", "gel"] },
  { name: "Spa",                                category: "Beauty & Personal Care", type: "independent", keywords: ["spa", "massage", "facial", "beauty", "wellness", "relaxation", "skin care", "body wrap"] },
  { name: "Massage Therapy Business",           category: "Beauty & Personal Care", type: "independent", keywords: ["massage", "therapy", "spa", "wellness", "relaxation", "deep tissue", "swedish", "therapist"] },
  { name: "Tanning Salon",                      category: "Beauty & Personal Care", type: "independent", keywords: ["tanning", "spray tan", "bronze", "beauty", "salon", "skin", "glow", "uv"] },
  { name: "Med Spa",                            category: "Beauty & Personal Care", type: "independent", keywords: ["med spa", "medspa", "medical", "spa", "beauty", "aesthetic", "skin", "laser", "botox", "filler"] },
  { name: "Personal Training Studio",           category: "Beauty & Personal Care", type: "independent", keywords: ["personal training", "trainer", "fitness", "gym", "workout", "strength", "one on one", "private coach"] },
  { name: "Yoga Studio",                        category: "Beauty & Personal Care", type: "independent", keywords: ["yoga", "meditation", "mindfulness", "wellness", "fitness", "workout", "vinyasa", "hot yoga"] },
  { name: "Pilates Studio",                     category: "Beauty & Personal Care", type: "independent", keywords: ["pilates", "reformer", "fitness", "core", "flexibility", "wellness", "mind body", "studio"] },
  { name: "Martial Arts Studio",                category: "Beauty & Personal Care", type: "independent", keywords: ["martial arts", "karate", "jiu jitsu", "mma", "kickboxing", "bjj", "fitness", "training", "kids"] },
  { name: "Dance Studio",                       category: "Beauty & Personal Care", type: "independent", keywords: ["dance", "studio", "ballet", "hip hop", "salsa", "classes", "performance", "kids", "adult"] },
  { name: "Dry Cleaner",                        category: "Beauty & Personal Care", type: "independent", keywords: ["laundry", "clean", "dry", "clothes", "wash", "service", "alterations", "garments", "pressing"] },
  { name: "Laundromat",                         category: "Beauty & Personal Care", type: "independent", keywords: ["laundry", "laundromat", "wash", "clean", "coin", "self-service", "clothes", "dryer", "washroom"] },
  { name: "Tailoring Service",                  category: "Beauty & Personal Care", type: "independent", keywords: ["tailor", "alterations", "sewing", "clothes", "suit", "hemming", "custom", "dress"] },
  { name: "Shoe Repair Shop",                   category: "Beauty & Personal Care", type: "independent", keywords: ["shoe", "repair", "cobbler", "sole", "heel", "leather", "boot", "sneaker"] },
];

// ─── PET SERVICES ─────────────────────────────────────────────────────────────
const PET_SERVICES: BusinessSuggestion[] = [
  { name: "Pet Grooming Business",              category: "Pet Services", type: "independent", keywords: ["dog", "cat", "pet", "animal", "groom", "wash", "trimming", "mobile pet", "groomer"] },
  { name: "Dog Daycare",                        category: "Pet Services", type: "independent", keywords: ["dog", "daycare", "pet", "animal", "boarding", "play", "care", "dogs"] },
  { name: "Dog Boarding Facility",              category: "Pet Services", type: "independent", keywords: ["dog", "boarding", "kennel", "pet", "animal", "overnight", "sitting", "lodging"] },
  { name: "Pet Sitting Service",                category: "Pet Services", type: "independent", keywords: ["pet", "sitting", "sitter", "dog", "cat", "animal", "in-home", "care", "overnight"] },
  { name: "Dog Walking Service",                category: "Pet Services", type: "independent", keywords: ["dog walking", "dog", "pet", "walk", "exercise", "animal", "daily", "runner"] },
  { name: "Veterinary Clinic",                  category: "Pet Services", type: "independent", keywords: ["vet", "veterinary", "animal", "pet", "clinic", "doctor", "dog", "cat", "health"] },
  { name: "Mobile Vet Clinic",                  category: "Pet Services", type: "independent", keywords: ["mobile vet", "vet", "veterinary", "animal", "pet", "in-home", "clinic", "mobile"] },
  { name: "Pet Supply Store",                   category: "Pet Services", type: "independent", keywords: ["pet", "dog", "cat", "animal", "supply", "food", "accessories", "retail", "store"] },
  { name: "Pet Training Business",              category: "Pet Services", type: "independent", keywords: ["dog training", "pet training", "trainer", "obedience", "behavior", "animal", "classes"] },
  { name: "Aquarium Maintenance Service",       category: "Pet Services", type: "independent", keywords: ["aquarium", "fish", "tank", "maintenance", "cleaning", "marine", "freshwater", "pet"] },
];

// ─── CHILD / FAMILY / EDUCATION ───────────────────────────────────────────────
const EDUCATION: BusinessSuggestion[] = [
  { name: "Daycare Center",                     category: "Education & Childcare", type: "independent", keywords: ["daycare", "childcare", "child", "kid", "baby", "care", "toddler", "infant", "preschool"] },
  { name: "Preschool",                          category: "Education & Childcare", type: "independent", keywords: ["preschool", "pre-k", "child", "kid", "toddler", "early education", "learning", "school"] },
  { name: "Tutoring Center",                    category: "Education & Childcare", type: "independent", keywords: ["tutor", "tutoring", "education", "school", "learning", "academic", "test prep", "sat", "kids"] },
  { name: "Test Prep Business",                 category: "Education & Childcare", type: "independent", keywords: ["test prep", "sat", "act", "gre", "gmat", "exam", "tutoring", "education", "college"] },
  { name: "Music Lessons Studio",               category: "Education & Childcare", type: "independent", keywords: ["music", "lessons", "guitar", "piano", "violin", "voice", "studio", "teaching", "instrument"] },
  { name: "Art Classes Studio",                 category: "Education & Childcare", type: "independent", keywords: ["art", "classes", "studio", "painting", "drawing", "kids", "adult", "creative", "lessons"] },
  { name: "STEM Learning Center",               category: "Education & Childcare", type: "independent", keywords: ["stem", "science", "technology", "math", "coding", "robotics", "kids", "learning", "education"] },
  { name: "Kids Indoor Play Center",            category: "Education & Childcare", type: "independent", keywords: ["indoor play", "kids", "children", "play center", "birthday party", "trampoline", "bounce", "family"] },
  { name: "Children's Party Business",          category: "Education & Childcare", type: "independent", keywords: ["kids party", "birthday party", "children", "entertainment", "balloon", "character", "events"] },
  { name: "Swim School",                        category: "Education & Childcare", type: "independent", keywords: ["swim", "swimming", "kids", "children", "lessons", "pool", "aquatic", "water safety"] },
  { name: "After School Program",               category: "Education & Childcare", type: "independent", keywords: ["after school", "kids", "children", "program", "care", "activities", "tutoring", "enrichment"] },
  { name: "Language School",                    category: "Education & Childcare", type: "independent", keywords: ["language", "school", "esl", "english", "spanish", "mandarin", "classes", "adult", "learning"] },
  { name: "Driving School",                     category: "Education & Childcare", type: "independent", keywords: ["driving school", "drive", "license", "dmv", "teen", "adult", "lessons", "behind the wheel"] },
];

// ─── HEALTHCARE ───────────────────────────────────────────────────────────────
const HEALTHCARE: BusinessSuggestion[] = [
  { name: "Dental Practice",                    category: "Healthcare", type: "independent", keywords: ["dentist", "dental", "health", "medical", "teeth", "care", "clinic", "hygiene", "oral", "orthodontics"] },
  { name: "Orthodontic Practice",               category: "Healthcare", type: "independent", keywords: ["orthodontics", "braces", "invisalign", "dental", "health", "teeth", "smile", "orthodontist"] },
  { name: "Physical Therapy Clinic",            category: "Healthcare", type: "independent", keywords: ["physical therapy", "physio", "rehab", "health", "medical", "sports", "injury", "orthopedic", "pt"] },
  { name: "Chiropractic Clinic",                category: "Healthcare", type: "independent", keywords: ["chiropractor", "chiro", "back", "spine", "health", "medical", "alignment", "pain relief", "adjustment"] },
  { name: "Urgent Care Clinic",                 category: "Healthcare", type: "independent", keywords: ["urgent care", "med", "medical", "health", "care", "clinic", "doctor", "emergency", "walk in"] },
  { name: "Primary Care Clinic",                category: "Healthcare", type: "independent", keywords: ["primary care", "family doctor", "med", "medical", "health", "clinic", "physician", "gp"] },
  { name: "Mental Health Clinic",               category: "Healthcare", type: "independent", keywords: ["mental health", "therapy", "therapist", "counseling", "psychologist", "psychiatrist", "anxiety", "depression", "wellness"] },
  { name: "Counseling Practice",                category: "Healthcare", type: "independent", keywords: ["counseling", "therapist", "mental health", "therapy", "psychology", "anxiety", "couples", "family"] },
  { name: "Home Health Agency",                 category: "Healthcare", type: "independent", keywords: ["home health", "home care", "nurse", "nursing", "in-home", "elderly", "senior", "caregiver", "agency"] },
  { name: "Senior Care Service",                category: "Healthcare", type: "independent", keywords: ["senior", "elderly", "home care", "caregiver", "nurse", "health", "personal care", "in-home", "assisted"] },
  { name: "Assisted Living Facility",           category: "Healthcare", type: "independent", keywords: ["assisted living", "senior", "elderly", "facility", "nursing", "memory care", "residential care"] },
  { name: "Medical Billing Service",            category: "Healthcare", type: "independent", keywords: ["medical billing", "coding", "healthcare", "b2b", "revenue cycle", "insurance", "claims", "rcm"] },
  { name: "Medical Spa",                        category: "Healthcare", type: "independent", keywords: ["med spa", "medspa", "medical", "spa", "beauty", "aesthetic", "skin", "laser", "botox", "filler", "cosmetic"] },
  { name: "IV Therapy Clinic",                  category: "Healthcare", type: "independent", keywords: ["iv", "hydration", "therapy", "wellness", "vitamin", "infusion", "drip", "health", "recovery"] },
  { name: "Occupational Therapy Clinic",        category: "Healthcare", type: "independent", keywords: ["occupational therapy", "ot", "rehab", "health", "medical", "disability", "pediatric", "adult"] },
  { name: "Speech Therapy Clinic",              category: "Healthcare", type: "independent", keywords: ["speech therapy", "slp", "language", "communication", "pediatric", "health", "medical", "stuttering"] },
  { name: "Diagnostic Imaging Center",          category: "Healthcare", type: "independent", keywords: ["imaging", "mri", "xray", "x-ray", "ct scan", "radiology", "diagnostic", "medical", "health"] },
  { name: "Pharmacy",                           category: "Healthcare", type: "independent", keywords: ["pharmacy", "drug store", "medication", "prescription", "health", "compounding", "retail"] },
  { name: "Weight Loss Clinic",                 category: "Healthcare", type: "independent", keywords: ["weight loss", "glp-1", "ozempic", "semaglutide", "diet", "obesity", "medical weight", "clinic", "bariatric"] },
  { name: "Optometry Practice",                 category: "Healthcare", type: "independent", keywords: ["optometry", "optometrist", "eye", "vision", "glasses", "contact lens", "health", "eyecare"] },
];

// ─── PROFESSIONAL SERVICES ────────────────────────────────────────────────────
const PROFESSIONAL_SERVICES: BusinessSuggestion[] = [
  { name: "Accounting Firm",                    category: "Professional Services", type: "independent", keywords: ["tax", "accountant", "cpa", "finance", "audit", "money", "bookkeeping", "corporate"] },
  { name: "Bookkeeping Service",                category: "Professional Services", type: "independent", keywords: ["bookkeeping", "accounting", "books", "finance", "small business", "quickbooks", "reconciliation"] },
  { name: "Tax Preparation Business",           category: "Professional Services", type: "independent", keywords: ["tax prep", "taxes", "irs", "tax return", "cpa", "accountant", "finance", "seasonal"] },
  { name: "Payroll Service",                    category: "Professional Services", type: "independent", keywords: ["payroll", "hr", "wages", "salary", "employees", "b2b", "small business", "processing"] },
  { name: "Financial Planning Firm",            category: "Professional Services", type: "independent", keywords: ["financial planning", "wealth management", "investment", "retirement", "advisor", "cfp", "portfolio"] },
  { name: "Insurance Agency",                   category: "Professional Services", type: "independent", keywords: ["insurance", "agent", "broker", "life", "auto", "home", "health", "commercial", "independent"] },
  { name: "Real Estate Brokerage",              category: "Professional Services", type: "independent", keywords: ["house", "home", "property", "buy", "sell", "realtor", "agent", "broker", "brokerage", "real estate"] },
  { name: "Property Management Company",        category: "Professional Services", type: "independent", keywords: ["property management", "landlord", "tenant", "rental", "real estate", "leasing", "hoa"] },
  { name: "Law Firm",                           category: "Professional Services", type: "independent", keywords: ["law", "lawyer", "attorney", "legal", "counsel", "corporate", "divorce", "litigation", "firm"] },
  { name: "Immigration Services",               category: "Professional Services", type: "independent", keywords: ["immigration", "visa", "citizenship", "green card", "legal", "attorney", "consulting"] },
  { name: "Notary Service",                     category: "Professional Services", type: "independent", keywords: ["notary", "notarize", "document", "signature", "legal", "mobile notary", "signing"] },
  { name: "Business Consulting Firm",           category: "Professional Services", type: "independent", keywords: ["business consulting", "consultant", "strategy", "management", "advisory", "b2b", "operations"] },
  { name: "HR Consulting Firm",                 category: "Professional Services", type: "independent", keywords: ["hr", "human resources", "consulting", "hiring", "compliance", "benefits", "policy", "b2b"] },
  { name: "Marketing Agency",                   category: "Professional Services", type: "independent", keywords: ["marketing", "agency", "digital", "advertising", "branding", "social media", "seo", "ppc", "content"] },
  { name: "SEO Agency",                         category: "Professional Services", type: "independent", keywords: ["seo", "search engine", "marketing", "google", "digital", "agency", "rank", "organic", "traffic"] },
  { name: "Web Design Agency",                  category: "Professional Services", type: "independent", keywords: ["web design", "website", "design", "agency", "development", "wordpress", "ui", "ux", "frontend"] },
  { name: "Branding Studio",                    category: "Professional Services", type: "independent", keywords: ["branding", "brand", "logo", "identity", "design", "studio", "creative", "marketing"] },
  { name: "Public Relations Firm",              category: "Professional Services", type: "independent", keywords: ["pr", "public relations", "media", "communications", "press", "brand", "reputation", "agency"] },
  { name: "Recruiting Agency",                  category: "Professional Services", type: "independent", keywords: ["recruiting", "staffing", "hire", "headhunter", "talent", "placement", "hr", "employment"] },
  { name: "Staffing Agency",                    category: "Professional Services", type: "independent", keywords: ["staffing", "temp agency", "employment", "workforce", "hiring", "contract", "placement"] },
  { name: "Virtual Assistant Agency",           category: "Professional Services", type: "startup",     keywords: ["virtual assistant", "va", "remote", "admin", "support", "outsourcing", "agency"] },
  { name: "Mortgage Broker",                    category: "Professional Services", type: "independent", keywords: ["mortgage", "loan", "broker", "home loan", "refinance", "finance", "bank", "lending"] },
];

// ─── TECHNOLOGY ───────────────────────────────────────────────────────────────
const TECHNOLOGY: BusinessSuggestion[] = [
  { name: "SaaS Startup",                       category: "Technology", type: "startup",     keywords: ["saas", "software", "startup", "subscription", "product", "tech", "cloud", "b2b", "app"] },
  { name: "AI Consulting Firm",                 category: "Technology", type: "startup",     keywords: ["ai", "artificial intelligence", "machine learning", "consulting", "firm", "automation", "llm", "gpt"] },
  { name: "Managed IT Services",                category: "Technology", type: "independent", keywords: ["it", "msp", "managed services", "tech support", "computer", "network", "helpdesk", "b2b"] },
  { name: "Cybersecurity Company",              category: "Technology", type: "independent", keywords: ["cybersecurity", "security", "it", "compliance", "pen test", "soc", "firewall", "protection"] },
  { name: "App Development Agency",             category: "Technology", type: "independent", keywords: ["app", "mobile", "ios", "android", "development", "agency", "software", "react native"] },
  { name: "Software Development Agency",        category: "Technology", type: "independent", keywords: ["software", "development", "agency", "custom", "web app", "saas", "engineering", "coding"] },
  { name: "Data Analytics Consulting",          category: "Technology", type: "startup",     keywords: ["data", "analytics", "bi", "reporting", "dashboard", "consulting", "insights", "sql", "tableau"] },
  { name: "Cloud Migration Consulting",         category: "Technology", type: "independent", keywords: ["cloud", "aws", "azure", "migration", "consulting", "devops", "infrastructure", "b2b"] },
  { name: "AI Workflow Automation Startup",     category: "Technology", type: "startup",     keywords: ["ai", "automation", "workflow", "startup", "n8n", "zapier", "process", "efficiency", "llm"] },
  { name: "IT Support Company",                 category: "Technology", type: "independent", keywords: ["it support", "helpdesk", "tech support", "computer", "repair", "network", "small business"] },
  { name: "Computer Repair Shop",               category: "Technology", type: "independent", keywords: ["computer", "laptop", "repair", "pc", "mac", "it", "tech", "shop", "fix", "virus"] },
  { name: "Smart Home Installation Business",  category: "Technology", type: "independent", keywords: ["smart home", "home automation", "installation", "iot", "alexa", "google home", "contractor"] },
  { name: "Digital Marketing SaaS",             category: "Technology", type: "startup",     keywords: ["digital marketing", "saas", "software", "ads", "social media", "analytics", "startup", "platform"] },
  { name: "Vertical SaaS for Local Businesses", category: "Technology", type: "startup",     keywords: ["vertical saas", "saas", "local business", "niche software", "industry specific", "startup"] },
  { name: "CRM Consulting Business",            category: "Technology", type: "independent", keywords: ["crm", "salesforce", "hubspot", "consulting", "sales", "implementation", "b2b", "software"] },
  { name: "E-commerce Development Agency",      category: "Technology", type: "independent", keywords: ["ecommerce", "shopify", "woocommerce", "development", "agency", "online store", "website"] },
];

// ─── RETAIL ───────────────────────────────────────────────────────────────────
const RETAIL: BusinessSuggestion[] = [
  { name: "Boutique Clothing Store",            category: "Retail", type: "independent", keywords: ["clothing", "fashion", "boutique", "apparel", "retail", "style", "women", "dress", "curated"] },
  { name: "Sneaker Store",                      category: "Retail", type: "independent", keywords: ["sneaker", "shoe", "footwear", "retail", "nike", "jordan", "streetwear", "resell"] },
  { name: "Gift Shop",                          category: "Retail", type: "independent", keywords: ["gift", "shop", "retail", "souvenir", "novelty", "present", "greeting card"] },
  { name: "Toy Store",                          category: "Retail", type: "independent", keywords: ["toy", "kids", "children", "games", "educational", "retail", "play", "lego"] },
  { name: "Bookstore",                          category: "Retail", type: "independent", keywords: ["book", "shop", "read", "library", "novel", "literature", "retail", "used books"] },
  { name: "Convenience Store",                  category: "Retail", type: "independent", keywords: ["convenience", "store", "snack", "gas", "retail", "quick", "tobacco", "lottery"] },
  { name: "Specialty Grocery Store",            category: "Retail", type: "independent", keywords: ["grocery", "specialty", "market", "organic", "natural", "food", "gourmet", "local"] },
  { name: "Health Food Store",                  category: "Retail", type: "independent", keywords: ["health food", "organic", "natural", "supplement", "vitamin", "grocery", "wellness", "store"] },
  { name: "Beauty Supply Store",                category: "Retail", type: "independent", keywords: ["beauty supply", "hair", "cosmetics", "makeup", "beauty", "retail", "wigs", "salon products"] },
  { name: "Sporting Goods Store",               category: "Retail", type: "independent", keywords: ["sporting goods", "sports", "fitness", "outdoor", "retail", "equipment", "gear", "athletic"] },
  { name: "Outdoor Gear Store",                 category: "Retail", type: "independent", keywords: ["outdoor", "gear", "hiking", "camping", "adventure", "retail", "equipment", "sporting"] },
  { name: "Furniture Store",                    category: "Retail", type: "independent", keywords: ["furniture", "home", "sofa", "bed", "retail", "decor", "interior", "living room"] },
  { name: "Home Decor Store",                   category: "Retail", type: "independent", keywords: ["home decor", "decor", "interior", "design", "retail", "accessories", "gifts", "art"] },
  { name: "Jewelry Store",                      category: "Retail", type: "independent", keywords: ["jewelry", "ring", "necklace", "diamond", "gold", "silver", "retail", "custom"] },
  { name: "Cell Phone Repair Store",            category: "Retail", type: "independent", keywords: ["phone repair", "cell phone", "iphone", "android", "screen", "fix", "retail", "mobile"] },
  { name: "Thrift Store",                       category: "Retail", type: "independent", keywords: ["thrift", "secondhand", "used", "consignment", "vintage", "resale", "charity", "retail"] },
  { name: "Consignment Shop",                   category: "Retail", type: "independent", keywords: ["consignment", "secondhand", "used", "thrift", "resale", "clothing", "furniture", "vintage"] },
  { name: "Party Supply Store",                 category: "Retail", type: "independent", keywords: ["party supply", "balloon", "decoration", "event", "birthday", "costume", "retail"] },
  { name: "Smoke Shop",                         category: "Retail", type: "independent", keywords: ["smoke shop", "tobacco", "cigar", "vape", "hookah", "retail", "head shop"] },
  { name: "Hardware Store",                     category: "Retail", type: "independent", keywords: ["hardware", "tools", "home improvement", "plumbing", "electrical", "nuts and bolts", "retail", "lumber"] },
  { name: "Vending Machine Business",           category: "Retail", type: "independent", keywords: ["vending", "machine", "snack", "drink", "passive income", "b2b", "route", "locations", "automated"] },
];

// ─── B2B / INDUSTRIAL ─────────────────────────────────────────────────────────
const B2B_INDUSTRIAL: BusinessSuggestion[] = [
  { name: "Commercial Cleaning Company",        category: "Business Services", type: "independent", keywords: ["commercial cleaning", "janitorial", "office cleaning", "facility", "b2b", "maintenance", "corporate"] },
  { name: "Office Cleaning Business",           category: "Business Services", type: "independent", keywords: ["office cleaning", "commercial", "janitorial", "workspace", "b2b", "facility", "daily"] },
  { name: "Janitorial Service",                 category: "Business Services", type: "independent", keywords: ["janitorial", "cleaning", "facility", "commercial", "b2b", "maintenance", "custodial"] },
  { name: "Security Guard Company",             category: "Business Services", type: "independent", keywords: ["security guard", "security", "protection", "guard", "b2b", "commercial", "patrol"] },
  { name: "Courier Service",                    category: "Business Services", type: "independent", keywords: ["courier", "delivery", "local delivery", "same day", "logistics", "b2b", "messenger"] },
  { name: "Local Delivery Business",            category: "Business Services", type: "independent", keywords: ["delivery", "local delivery", "courier", "logistics", "last mile", "route", "b2b"] },
  { name: "Logistics Company",                  category: "Business Services", type: "independent", keywords: ["logistics", "freight", "shipping", "supply chain", "warehouse", "distribution", "b2b"] },
  { name: "Freight Brokerage",                  category: "Business Services", type: "independent", keywords: ["freight", "broker", "trucking", "logistics", "shipping", "load board", "carrier", "b2b"] },
  { name: "Equipment Rental Company",           category: "Business Services", type: "independent", keywords: ["equipment rental", "tools", "construction", "rental", "machinery", "b2b", "contractor"] },
  { name: "Tool Rental Business",               category: "Business Services", type: "independent", keywords: ["tool rental", "tools", "equipment", "rental", "construction", "b2b", "DIY", "contractor"] },
  { name: "Commercial Landscaping",             category: "Business Services", type: "independent", keywords: ["commercial landscaping", "hoa", "property management", "grounds", "lawn", "b2b", "maintenance"] },
  { name: "Print Shop",                         category: "Business Services", type: "independent", keywords: ["print shop", "printing", "signage", "sign", "banner", "vinyl", "marketing", "design", "graphic"] },
  { name: "Signage Company",                    category: "Business Services", type: "independent", keywords: ["signage", "sign", "banner", "vinyl", "commercial", "outdoor", "trade show", "b2b"] },
  { name: "Waste Management Business",          category: "Business Services", type: "independent", keywords: ["waste", "trash", "garbage", "hauling", "disposal", "commercial", "dumpster", "recycling"] },
  { name: "Recycling Business",                 category: "Business Services", type: "independent", keywords: ["recycling", "scrap", "metal", "ewaste", "environmental", "waste", "b2b", "sustainability"] },
  { name: "Uniform Rental Service",             category: "Business Services", type: "independent", keywords: ["uniform", "workwear", "rental", "laundry", "apparel", "b2b", "commercial", "service"] },
  { name: "Commercial Laundry Service",         category: "Business Services", type: "independent", keywords: ["commercial laundry", "linen", "hospital", "hotel", "laundry", "b2b", "uniform", "bulk"] },
  { name: "Industrial Cleaning Business",       category: "Business Services", type: "independent", keywords: ["industrial cleaning", "factory", "manufacturing", "pressure washing", "b2b", "facility", "degreasing"] },
];

// ─── REAL ESTATE / LOCAL DEVELOPMENT ─────────────────────────────────────────
const REAL_ESTATE: BusinessSuggestion[] = [
  { name: "Coworking Space",                    category: "Real Estate Services", type: "startup",     keywords: ["coworking", "office space", "shared office", "workspace", "startup", "flexible", "hot desk"] },
  { name: "Event Venue",                        category: "Real Estate Services", type: "independent", keywords: ["event", "venue", "wedding", "party", "banquet", "hall", "reception", "corporate", "space"] },
  { name: "Wedding Venue",                      category: "Real Estate Services", type: "independent", keywords: ["wedding", "venue", "event", "reception", "ceremony", "banquet", "barn", "outdoor"] },
  { name: "Self Storage Facility",              category: "Real Estate Services", type: "independent", keywords: ["self storage", "storage", "unit", "locker", "climate controlled", "facility", "rental"] },
  { name: "RV Storage Facility",                category: "Real Estate Services", type: "independent", keywords: ["rv storage", "boat storage", "vehicle storage", "outdoor storage", "facility", "rental"] },
  { name: "Short-Term Rental Management",       category: "Real Estate Services", type: "startup",     keywords: ["airbnb", "vrbo", "short term rental", "vacation rental", "property management", "str"] },
  { name: "Real Estate Photography",            category: "Real Estate Services", type: "independent", keywords: ["real estate photography", "photo", "drone", "matterport", "listing", "virtual tour", "realtor"] },
  { name: "Home Inspection Business",           category: "Real Estate Services", type: "independent", keywords: ["home inspection", "inspector", "real estate", "safety", "property", "building", "contractor"] },
  { name: "Property Maintenance Company",       category: "Real Estate Services", type: "independent", keywords: ["property maintenance", "hoa", "landlord", "repairs", "facility", "real estate", "upkeep"] },
  { name: "Parking Lot Business",               category: "Real Estate Services", type: "independent", keywords: ["parking", "lot", "garage", "urban", "rental", "monthly", "commercial", "real estate"] },
];

// ─── CREATIVE / EVENTS ────────────────────────────────────────────────────────
const CREATIVE_EVENTS: BusinessSuggestion[] = [
  { name: "Photography Studio",                 category: "Entertainment & Recreation", type: "independent", keywords: ["photography", "photo", "studio", "portrait", "wedding", "event", "headshot", "product", "photographer"] },
  { name: "Videography Business",               category: "Entertainment & Recreation", type: "independent", keywords: ["video", "videography", "wedding", "event", "film", "production", "youtube", "content"] },
  { name: "Event Planning Business",            category: "Entertainment & Recreation", type: "independent", keywords: ["event", "party", "wedding", "planner", "organizer", "corporate", "coordinating", "celebration"] },
  { name: "Wedding Planning Business",          category: "Entertainment & Recreation", type: "independent", keywords: ["wedding", "planner", "event", "ceremony", "reception", "bridal", "coordinator"] },
  { name: "DJ Service",                         category: "Entertainment & Recreation", type: "independent", keywords: ["dj", "music", "event", "wedding", "party", "club", "entertainment", "sound"] },
  { name: "Party Rental Business",              category: "Entertainment & Recreation", type: "independent", keywords: ["party rental", "bounce house", "tables", "chairs", "tent", "event", "equipment", "linen"] },
  { name: "Bounce House Rental",                category: "Entertainment & Recreation", type: "independent", keywords: ["bounce house", "inflatable", "party", "kids", "rental", "jumper", "event"] },
  { name: "Photo Booth Rental",                 category: "Entertainment & Recreation", type: "independent", keywords: ["photo booth", "party", "event", "wedding", "rental", "photos", "props", "entertainment"] },
  { name: "Floral Shop",                        category: "Entertainment & Recreation", type: "independent", keywords: ["flower", "florist", "floral", "bouquet", "arrangement", "wedding", "event", "plant", "fresh"] },
  { name: "Local Media Company",                category: "Entertainment & Recreation", type: "startup",     keywords: ["media", "local news", "content", "publication", "blog", "newsletter", "journalism"] },
  { name: "Podcast Studio",                     category: "Entertainment & Recreation", type: "startup",     keywords: ["podcast", "studio", "recording", "audio", "content", "creator", "production", "rental"] },
  { name: "Content Creation Studio",            category: "Entertainment & Recreation", type: "startup",     keywords: ["content", "creator", "video", "youtube", "social media", "studio", "production", "brand"] },
];

// ─── FITNESS / WELLNESS ───────────────────────────────────────────────────────
const FITNESS_WELLNESS: BusinessSuggestion[] = [
  { name: "Gym",                                category: "Fitness & Wellness", type: "independent", keywords: ["gym", "fitness", "workout", "exercise", "training", "weights", "cardio", "health club"] },
  { name: "Boutique Fitness Studio",            category: "Fitness & Wellness", type: "independent", keywords: ["boutique fitness", "gym", "fitness", "workout", "studio", "pilates", "yoga", "spin", "group class"] },
  { name: "CrossFit Gym",                       category: "Fitness & Wellness", type: "independent", keywords: ["crossfit", "gym", "fitness", "hiit", "wod", "barbell", "functional", "workout", "box"] },
  { name: "Nutrition Coaching Business",        category: "Fitness & Wellness", type: "independent", keywords: ["nutrition", "coaching", "diet", "health", "wellness", "food", "meal plan", "weight loss"] },
  { name: "Wellness Center",                    category: "Fitness & Wellness", type: "independent", keywords: ["wellness", "center", "holistic", "health", "spa", "meditation", "recovery", "massage"] },
  { name: "Recovery Studio",                    category: "Fitness & Wellness", type: "startup",     keywords: ["recovery", "cryotherapy", "ice bath", "compression", "sauna", "athlete", "wellness", "float"] },
  { name: "Sauna Studio",                       category: "Fitness & Wellness", type: "startup",     keywords: ["sauna", "infrared", "steam", "wellness", "detox", "recovery", "health", "studio"] },
  { name: "Cold Plunge Studio",                 category: "Fitness & Wellness", type: "startup",     keywords: ["cold plunge", "ice bath", "cold therapy", "recovery", "wellness", "health", "athlete"] },
  { name: "Sports Training Facility",           category: "Fitness & Wellness", type: "independent", keywords: ["sports training", "athlete", "performance", "gym", "fitness", "coaching", "youth sports"] },
  { name: "Float Tank Center",                  category: "Fitness & Wellness", type: "independent", keywords: ["float", "floatation", "sensory deprivation", "relaxation", "stress", "wellness", "meditation"] },
  { name: "Cryotherapy Center",                 category: "Fitness & Wellness", type: "independent", keywords: ["cryo", "cryotherapy", "cold", "recovery", "wellness", "sports", "athlete", "inflammation"] },
  { name: "Physical Recovery Clinic",           category: "Fitness & Wellness", type: "independent", keywords: ["recovery", "physical therapy", "sports", "injury", "rehab", "clinic", "athlete", "performance"] },
];

// ─── STARTUP / ONLINE BUSINESS ────────────────────────────────────────────────
const STARTUP_ONLINE: BusinessSuggestion[] = [
  { name: "Marketplace Startup",                category: "Startup & Online", type: "startup",     keywords: ["marketplace", "platform", "two-sided", "startup", "buyers", "sellers", "online", "app"] },
  { name: "Subscription Box Business",          category: "Startup & Online", type: "startup",     keywords: ["subscription box", "subscription", "monthly box", "ecommerce", "curated", "direct to consumer"] },
  { name: "Online Course Business",             category: "Startup & Online", type: "startup",     keywords: ["online course", "e-learning", "education", "digital", "teaching", "udemy", "revenue", "content"] },
  { name: "Coaching Business",                  category: "Startup & Online", type: "startup",     keywords: ["coaching", "coach", "consulting", "online", "personal development", "business coach", "life coach"] },
  { name: "Niche E-commerce Store",             category: "Startup & Online", type: "startup",     keywords: ["ecommerce", "online store", "shopify", "niche", "product", "dropship", "direct to consumer"] },
  { name: "Local Services Marketplace",         category: "Startup & Online", type: "startup",     keywords: ["marketplace", "local services", "on demand", "platform", "startup", "app", "home services"] },
  { name: "B2B Lead Generation Business",       category: "Startup & Online", type: "startup",     keywords: ["lead generation", "b2b", "sales", "marketing", "data", "outreach", "agency", "prospecting"] },
  { name: "Newsletter Business",                category: "Startup & Online", type: "startup",     keywords: ["newsletter", "email", "content", "substack", "subscriber", "media", "audience", "publishing"] },
  { name: "Creator Tools Startup",              category: "Startup & Online", type: "startup",     keywords: ["creator economy", "tools", "startup", "software", "influencer", "content creator", "saas"] },
  { name: "Fractional CFO Service",             category: "Startup & Online", type: "startup",     keywords: ["fractional cfo", "cfo", "finance", "b2b", "consulting", "small business", "startup", "outsourced"] },
  { name: "Fractional CMO Service",             category: "Startup & Online", type: "startup",     keywords: ["fractional cmo", "cmo", "marketing", "b2b", "consulting", "small business", "outsourced"] },
  { name: "Remote Staffing Agency",             category: "Startup & Online", type: "startup",     keywords: ["remote staffing", "remote work", "offshore", "virtual assistant", "outsourcing", "b2b", "talent"] },
  { name: "Notary Signing Agent Business",      category: "Startup & Online", type: "independent", keywords: ["notary", "signing agent", "real estate", "mobile", "closing", "document", "loan signing"] },
];

// ─── Combined list ─────────────────────────────────────────────────────────────
// Franchises are included but NOT first so the empty-focus slice is diverse.
export const businessSuggestionsList: BusinessSuggestion[] = [
  ...FOOD_BEVERAGE,
  ...HOME_SERVICES,
  ...HEALTHCARE,
  ...PERSONAL_SERVICES,
  ...AUTOMOTIVE,
  ...PET_SERVICES,
  ...EDUCATION,
  ...PROFESSIONAL_SERVICES,
  ...TECHNOLOGY,
  ...RETAIL,
  ...B2B_INDUSTRIAL,
  ...REAL_ESTATE,
  ...CREATIVE_EVENTS,
  ...FITNESS_WELLNESS,
  ...STARTUP_ONLINE,
  ...FRANCHISES,
];

/**
 * Shown in the dropdown when the user focuses the input without typing.
 * Grouped by category for browsable discovery. Items are sorted so the same
 * category stays contiguous — Hero groups these with visible category headers.
 * 2–3 items per major category; franchises included but not dominant.
 */
export const DEFAULT_SUGGESTIONS: BusinessSuggestion[] = [
  // Food & Beverage
  { name: "Coffee Shop",                       category: "Food & Beverage",            type: "independent", keywords: [] },
  { name: "Ice Cream Shop",                    category: "Food & Beverage",            type: "independent", keywords: [] },
  { name: "Food Truck",                        category: "Food & Beverage",            type: "independent", keywords: [] },
  // Home Services
  { name: "HVAC Company",                      category: "Home Services",              type: "independent", keywords: [] },
  { name: "Plumbing Company",                  category: "Home Services",              type: "independent", keywords: [] },
  { name: "Lawn Care Service",                 category: "Home Services",              type: "independent", keywords: [] },
  // Healthcare
  { name: "Physical Therapy Clinic",           category: "Healthcare",                 type: "independent", keywords: [] },
  { name: "Dental Practice",                   category: "Healthcare",                 type: "independent", keywords: [] },
  { name: "Weight Loss Clinic",                category: "Healthcare",                 type: "independent", keywords: [] },
  // Fitness & Wellness
  { name: "Gym",                               category: "Fitness & Wellness",         type: "independent", keywords: [] },
  { name: "Yoga Studio",                       category: "Fitness & Wellness",         type: "independent", keywords: [] },
  // Automotive
  { name: "Auto Repair Shop",                  category: "Automotive",                 type: "independent", keywords: [] },
  { name: "Auto Detailing Business",           category: "Automotive",                 type: "independent", keywords: [] },
  // Education & Childcare
  { name: "Daycare Center",                    category: "Education & Childcare",      type: "independent", keywords: [] },
  { name: "Tutoring Center",                   category: "Education & Childcare",      type: "independent", keywords: [] },
  // Professional Services
  { name: "Accounting Firm",                   category: "Professional Services",      type: "independent", keywords: [] },
  { name: "Marketing Agency",                  category: "Professional Services",      type: "independent", keywords: [] },
  { name: "Insurance Agency",                  category: "Professional Services",      type: "independent", keywords: [] },
  // Retail
  { name: "Boutique Clothing Store",           category: "Retail",                     type: "independent", keywords: [] },
  { name: "Convenience Store",                 category: "Retail",                     type: "independent", keywords: [] },
  // Technology
  { name: "Managed IT Services",               category: "Technology",                 type: "independent", keywords: [] },
  { name: "Computer Repair Shop",              category: "Technology",                 type: "independent", keywords: [] },
  // Beauty & Personal Care
  { name: "Hair Salon",                        category: "Beauty & Personal Care",     type: "independent", keywords: [] },
  { name: "Nail Salon",                        category: "Beauty & Personal Care",     type: "independent", keywords: [] },
  { name: "Med Spa",                           category: "Beauty & Personal Care",     type: "independent", keywords: [] },
  // Pet Services
  { name: "Pet Grooming Business",             category: "Pet Services",               type: "independent", keywords: [] },
  { name: "Dog Daycare",                       category: "Pet Services",               type: "independent", keywords: [] },
  // Entertainment & Recreation
  { name: "Photography Studio",               category: "Entertainment & Recreation",  type: "independent", keywords: [] },
  { name: "Event Planning Business",           category: "Entertainment & Recreation", type: "independent", keywords: [] },
  // Business Services
  { name: "Commercial Cleaning Company",       category: "Business Services",          type: "independent", keywords: [] },
  { name: "Security Guard Company",            category: "Business Services",          type: "independent", keywords: [] },
  // Real Estate Services
  { name: "Coworking Space",                   category: "Real Estate Services",       type: "startup",     keywords: [] },
  { name: "Event Venue",                       category: "Real Estate Services",       type: "independent", keywords: [] },
  // Franchise
  { name: "Chick-fil-A",                       category: "Franchise",                  type: "franchise",   keywords: [] },
  { name: "Jersey Mike's Subs",                category: "Franchise",                  type: "franchise",   keywords: [] },
  { name: "Anytime Fitness",                   category: "Franchise",                  type: "franchise",   keywords: [] },
  { name: "The Brothers That Just Do Gutters", category: "Franchise",                  type: "franchise",   keywords: [] },
].map(stub => {
  const full = businessSuggestionsList.find(b => b.name === stub.name);
  return full ?? stub;
});

/**
 * Searches the curated list.
 *
 * Priority: name starts-with > name includes > category includes > keyword match.
 * Searches: name, category, and all keywords (which include aliases).
 * Returns up to 10 results, deduped by name.
 */
export const searchBusinessTypes = (userInput: string): BusinessSuggestion[] => {
  if (!userInput) return [];
  const q = userInput.trim().toLowerCase();
  if (!q) return [];

  const startsWithName: BusinessSuggestion[] = [];
  const includesName:   BusinessSuggestion[] = [];
  const categoryMatch:  BusinessSuggestion[] = [];
  const keywordMatch:   BusinessSuggestion[] = [];
  const seen = new Set<string>();

  for (const item of businessSuggestionsList) {
    const nameLower = item.name.toLowerCase();
    const catLower  = item.category.toLowerCase();

    if (nameLower.startsWith(q)) {
      if (!seen.has(item.name)) { startsWithName.push(item); seen.add(item.name); }
    } else if (nameLower.includes(q)) {
      if (!seen.has(item.name)) { includesName.push(item); seen.add(item.name); }
    } else if (catLower.includes(q)) {
      if (!seen.has(item.name)) { categoryMatch.push(item); seen.add(item.name); }
    } else {
      const kwMatch = item.keywords.some(kw => kw.toLowerCase().includes(q));
      if (kwMatch && !seen.has(item.name)) { keywordMatch.push(item); seen.add(item.name); }
    }
  }

  return [...startsWithName, ...includesName, ...categoryMatch, ...keywordMatch].slice(0, 10);
};
