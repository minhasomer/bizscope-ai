import { SavedReport, ViabilityReport } from '../types';
import { mockSavedReports } from '../src/data/mockSavedReports.js';
import { supabase } from './supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'bizscope_saved_reports';

// Per-user migration flag: set once after localStorage reports are imported into
// Supabase so the one-time import never runs again for that user.
const MIGRATION_FLAG_PREFIX = 'bizscope_reports_migrated_';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns the currently authenticated Supabase user ID, or null. */
async function getAuthUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Converts a raw Supabase DB row into a SavedReport.
 * The full ViabilityReport lives in the report_data JSONB column;
 * mutable metadata (isFavorite, reportType, dateSaved) are separate columns.
 */
function rowToSavedReport(row: Record<string, unknown>): SavedReport {
  return {
    ...(row.report_data as ViabilityReport),
    id: row.id as string,
    dateSaved: row.date_saved as string,
    isFavorite: row.is_favorite as boolean,
    reportType: row.report_type as 'standard' | 'regional',
  };
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadFromLocalStorage(): SavedReport[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);

    // Auto-seed with mock data on first load
    const seeded = (mockSavedReports || []).map((report: any, idx: number) => ({
      ...report,
      id: report.id || `mock-id-${idx + 1}`,
      dateSaved: report.dateSaved || new Date(
        Date.now() - idx * 2 * 24 * 60 * 60 * 1000 - 3 * 3600 * 1000
      ).toISOString(),
      isFavorite: report.isFavorite || idx === 0,
      reportType: report.reportType || (report.regionalIntelligence ? 'regional' : 'standard'),
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return [];
  }
}

function writeToLocalStorage(reports: SavedReport[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

// ─── One-time localStorage → Supabase migration ───────────────────────────────
/**
 * Runs once per user (tracked by a localStorage flag).
 * If the user has local reports and Supabase is empty for them,
 * imports all local reports into Supabase to preserve history.
 * Does nothing if:
 *   - Migration has already run for this user
 *   - localStorage is empty
 *   - Supabase already has records for this user (avoids duplicates)
 */
async function migrateLocalToSupabase(userId: string): Promise<void> {
  const flagKey = `${MIGRATION_FLAG_PREFIX}${userId}`;
  if (localStorage.getItem(flagKey) === 'done') return;

  const localReports = loadFromLocalStorage();
  if (localReports.length === 0) {
    localStorage.setItem(flagKey, 'done');
    return;
  }

  // Only import if Supabase has no rows yet for this user
  const { count, error: countError } = await supabase!
    .from('saved_reports')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    // Table may not exist yet or network error — skip silently, retry next session
    return;
  }

  if (count !== null && count > 0) {
    // User already has Supabase records — skip import to avoid duplicates
    localStorage.setItem(flagKey, 'done');
    return;
  }

  // Build insert rows: strip SavedReport metadata from report_data
  // so the JSONB column only holds the ViabilityReport payload.
  const rows = localReports.map((r) => {
    const { id: _id, dateSaved: _dateSaved, isFavorite, reportType, ...viabilityData } = r;
    return {
      // Let Supabase generate new UUIDs (old local IDs may not be valid UUIDs)
      user_id: userId,
      business_type: r.businessType,
      location: r.location,
      is_favorite: isFavorite,
      report_type: reportType,
      date_saved: r.dateSaved,
      report_data: viabilityData,
    };
  });

  const { error: insertError } = await supabase!
    .from('saved_reports')
    .insert(rows);

  if (insertError) {
    console.warn('[SavedReports] Migration insert failed:', insertError.message);
    // Don't set the flag — allow retry on next load
    return;
  }

  localStorage.setItem(flagKey, 'done');
  console.log(`[SavedReports] Migrated ${rows.length} local report(s) to Supabase for user ${userId}.`);
}

// ─── Public service class ─────────────────────────────────────────────────────

/**
 * Manages Saved Reports with Supabase as the primary store and localStorage
 * as a transparent offline fallback.
 *
 * Routing logic:
 *   - Authenticated + Supabase configured → Supabase (device-independent)
 *   - Otherwise                           → localStorage (device-local)
 *
 * On first authenticated load, any existing localStorage reports are
 * automatically imported into Supabase (one-time migration, no duplicates).
 */
export class SavedReportsService {
  /** @deprecated internal only — kept for backwards compat with existing event listeners */
  private static readonly STORAGE_KEY = STORAGE_KEY;

  // ── Read ───────────────────────────────────────────────────────────────────

  public static async getReports(): Promise<SavedReport[]> {
    const userId = await getAuthUserId();

    if (userId && supabase) {
      // Run migration first (no-op after the first successful run)
      await migrateLocalToSupabase(userId);

      const { data, error } = await supabase
        .from('saved_reports')
        .select('*')
        .eq('user_id', userId)
        .order('date_saved', { ascending: false });

      if (!error && data) {
        return data.map(rowToSavedReport);
      }

      console.warn('[SavedReports] Supabase fetch failed, falling back to localStorage:', error?.message);
    }

    // Offline / unauthenticated fallback
    await new Promise((r) => setTimeout(r, 250));
    return loadFromLocalStorage();
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  public static async saveReport(report: ViabilityReport): Promise<SavedReport> {
    const userId = await getAuthUserId();

    if (userId && supabase) {
      // Check for an existing record with the same (user, businessType, location)
      const { data: existing } = await supabase
        .from('saved_reports')
        .select('*')
        .eq('user_id', userId)
        .ilike('business_type', report.businessType.trim())
        .ilike('location', report.location.trim())
        .maybeSingle();

      if (existing) {
        return rowToSavedReport(existing as Record<string, unknown>);
      }

      const { data, error } = await supabase
        .from('saved_reports')
        .insert({
          user_id: userId,
          business_type: report.businessType,
          location: report.location,
          is_favorite: false,
          report_type: report.regionalIntelligence ? 'regional' : 'standard',
          date_saved: new Date().toISOString(),
          report_data: report,
        })
        .select()
        .single();

      if (!error && data) {
        window.dispatchEvent(new Event('bizscope_reports_changed'));
        return rowToSavedReport(data as Record<string, unknown>);
      }

      console.warn('[SavedReports] Supabase save failed, falling back to localStorage:', error?.message);
    }

    // localStorage fallback
    await new Promise((r) => setTimeout(r, 400));
    const reports = loadFromLocalStorage();

    const existingIndex = reports.findIndex(
      (r) =>
        r.businessType.toLowerCase().trim() === report.businessType.toLowerCase().trim() &&
        r.location.toLowerCase().trim() === report.location.toLowerCase().trim()
    );
    if (existingIndex >= 0) return reports[existingIndex];

    const newReport: SavedReport = {
      ...report,
      id: `saved-${Math.random().toString(36).substring(2, 11)}`,
      dateSaved: new Date().toISOString(),
      isFavorite: false,
      reportType: report.regionalIntelligence ? 'regional' : 'standard',
    };

    reports.unshift(newReport);
    writeToLocalStorage(reports);
    window.dispatchEvent(new Event('bizscope_reports_changed'));
    return newReport;
  }

  // ── Update (favorite toggle) ────────────────────────────────────────────────

  public static async toggleFavorite(id: string): Promise<SavedReport | null> {
    const userId = await getAuthUserId();

    if (userId && supabase) {
      // Fetch current value first
      const { data: current } = await supabase
        .from('saved_reports')
        .select('is_favorite')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (current) {
        const { data, error } = await supabase
          .from('saved_reports')
          .update({ is_favorite: !(current as { is_favorite: boolean }).is_favorite })
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();

        if (!error && data) {
          window.dispatchEvent(new Event('bizscope_reports_changed'));
          return rowToSavedReport(data as Record<string, unknown>);
        }
      }
    }

    // localStorage fallback
    await new Promise((r) => setTimeout(r, 150));
    const reports = loadFromLocalStorage();
    const idx = reports.findIndex((r) => r.id === id);
    if (idx === -1) return null;

    reports[idx].isFavorite = !reports[idx].isFavorite;
    writeToLocalStorage(reports);
    window.dispatchEvent(new Event('bizscope_reports_changed'));
    return reports[idx];
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  public static async deleteReport(id: string): Promise<boolean> {
    const userId = await getAuthUserId();

    if (userId && supabase) {
      const { error } = await supabase
        .from('saved_reports')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (!error) {
        window.dispatchEvent(new Event('bizscope_reports_changed'));
        return true;
      }

      console.warn('[SavedReports] Supabase delete failed, falling back to localStorage:', error?.message);
    }

    // localStorage fallback
    await new Promise((r) => setTimeout(r, 200));
    const reports = loadFromLocalStorage();
    writeToLocalStorage(reports.filter((r) => r.id !== id));
    window.dispatchEvent(new Event('bizscope_reports_changed'));
    return true;
  }
}
