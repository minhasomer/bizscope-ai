import { isDemoMode } from '../src/config/appConfig';

export interface CacheEntry {
  businessType: string;
  location: string;
  reportType: 'standard' | 'regional';
  planTier: string;
  report: any;
  timestamp: string; // ISO String
  modelId?: string;          // Gemini model that generated this entry; absent for mock
  isLiveGenerated?: boolean; // false/absent = mock, true = real Gemini call
}

export class ReportCacheService {
  private static STORAGE_KEY = 'bizscope_report_cache';

  /**
   * Bumped when report generation logic changes in a way that makes old
   * cached entries unsafe to serve as-is (e.g. Phase 4 shadow-mode preview
   * fields are now computed and expected on every report). Bumping this
   * changes every cache key, so old entries become unreachable (effectively
   * evicted) without needing an explicit migration pass.
   */
  private static CACHE_VERSION = 'v2-phase4-shadow';

  /**
   * Generates a unique key for the cache entry lookup.
   */
  private static makeKey(businessType: string, location: string, reportType: 'standard' | 'regional', planTier: string): string {
    const cleanBiz = businessType.toLowerCase().trim();
    const cleanLoc = location.toLowerCase().trim();
    const cleanTier = planTier.toLowerCase().trim();
    return `${this.CACHE_VERSION}||${cleanBiz}||${cleanLoc}||${reportType}||${cleanTier}`;
  }

  /**
   * Loads all cache entries from localStorage.
   */
  private static loadAllEntries(): Record<string, CacheEntry> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error('Failed to parse report cache:', e);
      return {};
    }
  }

  /**
   * Saves all cache entries to localStorage.
   */
  private static saveAllEntries(entries: Record<string, CacheEntry>) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error('Failed to write report cache to storage:', e);
    }
  }

  /**
   * Attempts to retrieve a matching report from the cache.
   * Checks expiration (30 days maximum).
   */
  public static async get(
    businessType: string,
    location: string,
    reportType: 'standard' | 'regional',
    planTier: string
  ): Promise<any | null> {
    const isDemo = isDemoMode;

    if (!isDemo) {
      // LIVE MODE: Check local storage cache first, then prepare structure for future microservices/Supabase caching.
      console.log(`[Cache Search - Live Mode] Looking up cached report for ${businessType} in ${location} (${reportType}, Tier: ${planTier})`);
      
      /*
      // FUTURE SUPABASE INTEGRATION PIPELINE STRUCTURE:
      // Once you connect to Supabase, replace this block with direct persistent table requests:
      try {
        const { data, error } = await supabase
          .from('report_cache')
          .select('report, timestamp')
          .eq('business_type', businessType.toLowerCase().trim())
          .eq('location', location.toLowerCase().trim())
          .eq('report_type', reportType)
          .eq('plan_tier', planTier.toLowerCase().trim())
          .single();
        if (data && !error) {
          const age = Date.now() - new Date(data.timestamp).getTime();
          const limitMs = 30 * 24 * 60 * 60 * 1000;
          if (age < limitMs) {
            return { ...data.report, loadedFromCache: true, cachedAt: data.timestamp };
          }
        }
      } catch (dbErr) {
        console.error('Live database cache pipeline failure, falling back to local fallback:', dbErr);
      }
      */
    } else {
      console.log(`[Cache Search - Demo Mode] Looking up local cache: ${businessType} in ${location} (${reportType})`);
    }

    // Checking localStorage cache
    const entries = this.loadAllEntries();
    const key = this.makeKey(businessType, location, reportType, planTier);
    const entry = entries[key];

    if (!entry) {
      return null;
    }

    // Verify cache age does not exceed 30 days
    const cacheDate = new Date(entry.timestamp);
    const ageInMs = Date.now() - cacheDate.getTime();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    if (ageInMs > thirtyDaysInMs) {
      console.log(`[Cache Expired] Entry found is older than 30 days (${Math.floor(ageInMs / (24 * 3600 * 1000))} days old)`);
      // Evict expired entry
      delete entries[key];
      this.saveAllEntries(entries);
      return null;
    }

    // In live mode, never serve a cached mock/demo report — force a live regeneration.
    // This prevents stale demo-mode reports (seeded before beta access was granted)
    // from surfacing fake competitors and a "Demo data" label to live users.
    if (!isDemo && !entry.isLiveGenerated) {
      console.log(`[Cache Skip] Cached entry is demo/mock data in live mode — forcing live regeneration.`);
      return null;
    }

    console.log(`[Cache Hit] Serving cached report from ${entry.timestamp}`);
    return {
      ...entry.report,
      loadedFromCache: true,
      cachedAt: entry.timestamp,
    };
  }

  /**
   * Saves a report to the cache with the current timestamp.
   */
  public static async set(
    businessType: string,
    location: string,
    reportType: 'standard' | 'regional',
    planTier: string,
    report: any
  ): Promise<void> {
    const isDemo = isDemoMode;
    const timestamp = new Date().toISOString();

    if (!isDemo) {
      // LIVE MODE: Save to localStorage cache, and prepare/comment structure for future DB sync.
      console.log(`[Cache Store - Live Mode] Storing newly generated live report for ${businessType} in ${location}`);

      /*
      // FUTURE SUPABASE INTEGRATION PIPELINE STRUCTURE:
      // This structural comment maps how the live database sync is performed:
      try {
        await supabase
          .from('report_cache')
          .upsert({
            business_type: businessType.toLowerCase().trim(),
            location: location.toLowerCase().trim(),
            report_type: reportType,
            plan_tier: planTier.toLowerCase().trim(),
            report: report,
            timestamp: timestamp
          }, { onConflict: 'business_type,location,report_type,plan_tier' });
      } catch (dbErr) {
        console.error('Failed to sync report with external Supabase table:', dbErr);
      }
      */
    } else {
      console.log(`[Cache Store - Demo Mode] Storing local report for ${businessType} in ${location}`);
    }

    // Ensure we don't save the temporary metadata properties to raw cached data
    const cleanedReport = { ...report };
    delete cleanedReport.loadedFromCache;
    delete cleanedReport.cachedAt;

    const entries = this.loadAllEntries();
    const key = this.makeKey(businessType, location, reportType, planTier);

    entries[key] = {
      businessType: businessType.trim(),
      location: location.trim(),
      reportType,
      planTier,
      report: cleanedReport,
      timestamp,
      modelId: report.generationMeta?.model,
      isLiveGenerated: report.generationMeta?.isLiveGenerated,
    };

    this.saveAllEntries(entries);
  }

  /**
   * Clears an entry from the cache (e.g. for forced regenerations).
   */
  public static async invalidate(
    businessType: string,
    location: string,
    reportType: 'standard' | 'regional',
    planTier: string
  ): Promise<void> {
    console.log(`[Cache Invalidation] Removing entry for ${businessType} in ${location} (${reportType}, Tier: ${planTier})`);
    
    // In live mode, future database deletion queries would go here
    /*
    try {
      await supabase
        .from('report_cache')
        .delete()
        .eq('business_type', businessType.toLowerCase().trim())
        .eq('location', location.toLowerCase().trim())
        .eq('report_type', reportType)
        .eq('plan_tier', planTier.toLowerCase().trim());
    } catch (e) {}
    */

    const entries = this.loadAllEntries();
    const key = this.makeKey(businessType, location, reportType, planTier);
    if (entries[key]) {
      delete entries[key];
      this.saveAllEntries(entries);
    }
  }
}
