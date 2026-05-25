import { SavedReport, ViabilityReport } from '../types';
import { mockSavedReports } from '../src/data/mockSavedReports.js';

/**
 * Service to manage Saved Reports in the private Venture Hub dashboard.
 * Designed with standard async Promises to make transitioning to database architectures (e.g. Supabase, Firebase, Postgres API) seamless.
 */
export class SavedReportsService {
  private static STORAGE_KEY = 'bizscope_saved_reports';

  /**
   * Helper to fetch reports and trigger automatic seeding if empty
   */
  private static loadFromRawStorage(): SavedReport[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Auto-prime/seed with standard mock reports
      const seeded = (mockSavedReports || []).map((report: any, idx: number) => ({
        ...report,
        id: report.id || `mock-id-${idx + 1}`,
        dateSaved: report.dateSaved || new Date(Date.now() - idx * 2 * 24 * 60 * 60 * 1000 - 3 * 3600 * 1000).toISOString(),
        isFavorite: report.isFavorite || idx === 0, // favorite first one as a demo
        reportType: report.reportType || (report.regionalIntelligence ? 'regional' : 'standard')
      }));
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    } catch (e) {
      console.error('Failed to parse saved reports:', e);
      return [];
    }
  }

  /**
   * Get all saved reports
   * Simulates a micro network latency (e.g., 200ms) to feel like a real database fetch and test loading states properly.
   */
  public static async getReports(): Promise<SavedReport[]> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return this.loadFromRawStorage();
  }

  /**
   * Save a viability report
   */
  public static async saveReport(report: ViabilityReport): Promise<SavedReport> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const reports = this.loadFromRawStorage();
    
    // Check if exactly same businessType and location already exists
    const existingIndex = reports.findIndex(
      (r) => 
        r.businessType.toLowerCase().trim() === report.businessType.toLowerCase().trim() && 
        r.location.toLowerCase().trim() === report.location.toLowerCase().trim()
    );

    if (existingIndex >= 0) {
      return reports[existingIndex];
    }

    const newReport: SavedReport = {
      ...report,
      id: `saved-${Math.random().toString(36).substring(2, 11)}`,
      dateSaved: new Date().toISOString(),
      isFavorite: false,
      reportType: report.regionalIntelligence ? 'regional' : 'standard'
    };

    reports.unshift(newReport); // newest goes at the top
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
    window.dispatchEvent(new Event('bizscope_reports_changed'));
    return newReport;
  }

  /**
   * Toggle favorite status
   */
  public static async toggleFavorite(id: string): Promise<SavedReport | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const reports = this.loadFromRawStorage();
    const idx = reports.findIndex((r) => r.id === id);
    if (idx === -1) return null;

    reports[idx].isFavorite = !reports[idx].isFavorite;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
    window.dispatchEvent(new Event('bizscope_reports_changed'));
    return reports[idx];
  }

  /**
   * Delete a saved report by ID
   */
  public static async deleteReport(id: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const reports = this.loadFromRawStorage();
    const filtered = reports.filter((r) => r.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('bizscope_reports_changed'));
    return true;
  }
}
