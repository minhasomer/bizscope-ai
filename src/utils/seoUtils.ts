// ─── Slug helpers ──────────────────────────────────────────────────────────

/**
 * "new-york-ny" → "New York, NY"
 * "chicago-il"  → "Chicago, IL"
 */
export function slugToCity(slug: string): string {
  const parts = slug.split('-');
  const last = parts[parts.length - 1];
  if (last.length === 2 && /^[a-z]{2}$/.test(last)) {
    const city = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    return `${city}, ${last.toUpperCase()}`;
  }
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

/** "coffee-shop" → "Coffee Shop" */
export function slugToBusiness(slug: string): string {
  return slug.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

/** "New York, NY" → "new-york-ny" */
export function cityToSlug(city: string): string {
  return city.toLowerCase().replace(/,\s*/g, '-').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/** "Coffee Shop" → "coffee-shop" */
export function businessToSlug(business: string): string {
  return business.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ─── Meta generation ───────────────────────────────────────────────────────

export interface SEOMeta {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  canonicalPath: string;
}

export function getBestBusinessesMeta(citySlug: string): SEOMeta {
  const city = slugToCity(citySlug);
  return {
    title: `Best Businesses to Start in ${city} | BizScope`,
    description: `Discover the most profitable and low-competition business ideas in ${city}. AI-powered market analysis reveals top opportunities based on local demographics, competition density, and economic data.`,
    ogTitle: `Best Businesses to Start in ${city}`,
    ogDescription: `AI market analysis reveals the highest-potential business ideas in ${city}. See startup costs, competition levels, and revenue projections.`,
    canonicalPath: `/best-businesses/${citySlug}`,
  };
}

export function getBusinessViabilityMeta(businessSlug: string, citySlug: string): SEOMeta {
  const city = slugToCity(citySlug);
  const business = slugToBusiness(businessSlug);
  return {
    title: `${business} Viability in ${city} | BizScope`,
    description: `Is a ${business} viable in ${city}? Get a detailed AI analysis of startup costs, local competition, demographics, and revenue potential before you invest.`,
    ogTitle: `${business} Viability in ${city}`,
    ogDescription: `Detailed market viability report for ${business} in ${city}. AI-driven analysis of startup costs, competition density, and revenue potential.`,
    canonicalPath: `/viability/${businessSlug}/${citySlug}`,
  };
}

export function getFranchiseOpportunitiesMeta(citySlug: string): SEOMeta {
  const city = slugToCity(citySlug);
  return {
    title: `Best Franchise Opportunities in ${city} | BizScope`,
    description: `Explore top franchise opportunities in ${city}. Compare investment requirements, territory availability, and market fit using real demographic and economic data.`,
    ogTitle: `Best Franchise Opportunities in ${city}`,
    ogDescription: `Find the best franchise investments in ${city}. AI analysis of market fit, competition, and ROI potential for franchise seekers.`,
    canonicalPath: `/franchise-opportunities/${citySlug}`,
  };
}

export function getMarketGapsMeta(citySlug: string): SEOMeta {
  const city = slugToCity(citySlug);
  return {
    title: `Market Gaps in ${city} — Underserved Business Niches | BizScope`,
    description: `Discover underserved business niches and market gaps in ${city}. AI analysis of local demand vs. supply across 50+ business categories reveals hidden opportunities.`,
    ogTitle: `Market Gaps & Underserved Niches in ${city}`,
    ogDescription: `Find unmet demand and market gaps in ${city}. See which business types are underserved and which ZIP codes have the highest opportunity density.`,
    canonicalPath: `/market-gaps/${citySlug}`,
  };
}

// ─── Route matching ────────────────────────────────────────────────────────

export type SEORouteType =
  | 'best-businesses'
  | 'viability'
  | 'franchise-opportunities'
  | 'market-gaps';

export interface SEORouteMatch {
  type: SEORouteType;
  citySlug: string;
  businessSlug?: string;
  meta: SEOMeta;
}

export function parseSEORoute(pathname: string): SEORouteMatch | null {
  const slug = '[a-z0-9][a-z0-9-]*';

  const bestBiz = pathname.match(new RegExp(`^/best-businesses/(${slug})/?$`));
  if (bestBiz) {
    return { type: 'best-businesses', citySlug: bestBiz[1], meta: getBestBusinessesMeta(bestBiz[1]) };
  }

  const viability = pathname.match(new RegExp(`^/viability/(${slug})/(${slug})/?$`));
  if (viability) {
    return {
      type: 'viability',
      businessSlug: viability[1],
      citySlug: viability[2],
      meta: getBusinessViabilityMeta(viability[1], viability[2]),
    };
  }

  const franchise = pathname.match(new RegExp(`^/franchise-opportunities/(${slug})/?$`));
  if (franchise) {
    return { type: 'franchise-opportunities', citySlug: franchise[1], meta: getFranchiseOpportunitiesMeta(franchise[1]) };
  }

  const gaps = pathname.match(new RegExp(`^/market-gaps/(${slug})/?$`));
  if (gaps) {
    return { type: 'market-gaps', citySlug: gaps[1], meta: getMarketGapsMeta(gaps[1]) };
  }

  return null;
}

// ─── Cross-linking data ────────────────────────────────────────────────────

export const FEATURED_CITIES = [
  { name: 'New York, NY', slug: 'new-york-ny' },
  { name: 'Los Angeles, CA', slug: 'los-angeles-ca' },
  { name: 'Chicago, IL', slug: 'chicago-il' },
  { name: 'Houston, TX', slug: 'houston-tx' },
  { name: 'Phoenix, AZ', slug: 'phoenix-az' },
  { name: 'Miami, FL', slug: 'miami-fl' },
  { name: 'Atlanta, GA', slug: 'atlanta-ga' },
  { name: 'Seattle, WA', slug: 'seattle-wa' },
];

export const FEATURED_BUSINESSES = [
  { name: 'Coffee Shop', slug: 'coffee-shop' },
  { name: 'Restaurant', slug: 'restaurant' },
  { name: 'Gym & Fitness Studio', slug: 'gym-fitness-studio' },
  { name: 'Cleaning Service', slug: 'cleaning-service' },
  { name: 'Auto Repair Shop', slug: 'auto-repair-shop' },
  { name: 'Pet Grooming', slug: 'pet-grooming' },
  { name: 'Landscaping', slug: 'landscaping' },
  { name: 'Tutoring Center', slug: 'tutoring-center' },
];
