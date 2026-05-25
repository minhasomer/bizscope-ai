import { isDemoMode } from '../src/config/appConfig';
import { SubscriptionPlan } from '../src/utils/planUtils';
import { assertDemoService } from '../src/lib/guardrails';
import { getPlanLimits, ANONYMOUS_LIMITS, canGeneratePreviewReport } from '../src/config/plans';

export interface UsageState {
  standardUsed: number;
  regionalUsed: number;
  lastStandardReset: string; // ISO string
  lastRegionalReset: string; // ISO string
}

export interface UsageDetails {
  plan: SubscriptionPlan;
  standardLimit: number | null;     // null = unlimited (Enterprise)
  standardUsed: number;
  standardRemaining: number;
  standardResetDate: Date | null;
  regionalLimit: number | null;     // null = unlimited (Enterprise), 0 = locked
  regionalUsed: number;
  regionalRemaining: number;
  regionalResetDate: Date | null;
  canRunStandard: boolean;
  canRunRegional: boolean;
  standardLimitDescription: string;
  resetCycleDescription: string;
}

export class UsageTrackerService {
  private static STORAGE_KEY = 'bizscope_usage_tracking_v1';

  /**
   * Helper to set default usage state for any subscription plan.
   */
  private static getDefaultUsageState(): Record<SubscriptionPlan, UsageState> {
    const now = new Date().toISOString();
    return {
      Explorer: {
        standardUsed: 0,
        regionalUsed: 0,
        lastStandardReset: now,
        lastRegionalReset: now,
      },
      Pro: {
        standardUsed: 0,
        regionalUsed: 0,
        lastStandardReset: now,
        lastRegionalReset: now,
      },
      'Pro+': {
        standardUsed: 0,
        regionalUsed: 0,
        lastStandardReset: now,
        lastRegionalReset: now,
      },
      Enterprise: {
        standardUsed: 0,
        regionalUsed: 0,
        lastStandardReset: now,
        lastRegionalReset: now,
      }
    };
  }

  /**
   * Loads all subscription plans' usage states from localStorage.
   */
  public static getAllUsage(): Record<SubscriptionPlan, UsageState> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse usage stats payload:', e);
    }
    const defaults = this.getDefaultUsageState();
    this.saveAllUsage(defaults);
    return defaults;
  }

  /**
   * Saves all usage states back to localStorage.
   */
  private static saveAllUsage(state: Record<SubscriptionPlan, UsageState>) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to persist usage tracker:', e);
    }
  }

  /**
   * Gets details on limits, current usage, and resets for the current plan.
   * Auto-calculates isExpired (time for reset) and updates the local state.
   */
  public static getDetails(plan: SubscriptionPlan): UsageDetails {
    const allUsage = this.getAllUsage();
    let state = allUsage[plan];

    if (!state) {
      const defaults = this.getDefaultUsageState();
      state = defaults[plan];
      allUsage[plan] = state;
      this.saveAllUsage(allUsage);
    }

    const now = new Date();
    let updated = false;

    // Read limits from the centralised plan config (src/config/plans.ts).
    // Never hardcode per-plan numbers here — change PLAN_LIMITS in plans.ts instead.
    const limits = getPlanLimits(plan);

    // ── 1. Standard report reset ─────────────────────────────────────────────
    // All registered plans now use a monthly reset cycle (or none for Enterprise).
    // 'daily' was removed when Explorer moved from 1/day to 3/month.
    const standardCycleMs =
      limits.standardResetCycle === 'monthly' ? 30 * 24 * 60 * 60 * 1000 :
      null; // 'none' = unlimited, no reset needed

    let standardResetDate: Date | null = null;
    if (standardCycleMs !== null) {
      const lastReset = new Date(state.lastStandardReset);
      const diffMs = now.getTime() - lastReset.getTime();
      standardResetDate = new Date(lastReset.getTime() + standardCycleMs);

      if (diffMs >= standardCycleMs) {
        state.standardUsed = 0;
        state.lastStandardReset = now.toISOString();
        standardResetDate = new Date(now.getTime() + standardCycleMs);
        updated = true;
      }
    }

    // ── 2. Regional report reset ─────────────────────────────────────────────
    const regionalCycleMs =
      limits.regionalResetCycle === 'monthly' ? 30 * 24 * 60 * 60 * 1000 : null;

    let regionalResetDate: Date | null = null;
    if (regionalCycleMs !== null && limits.regionalReportsPerCycle !== 0 && limits.regionalReportsPerCycle !== null) {
      const lastReset = new Date(state.lastRegionalReset);
      const diffMs = now.getTime() - lastReset.getTime();
      regionalResetDate = new Date(lastReset.getTime() + regionalCycleMs);

      if (diffMs >= regionalCycleMs) {
        state.regionalUsed = 0;
        state.lastRegionalReset = now.toISOString();
        regionalResetDate = new Date(now.getTime() + regionalCycleMs);
        updated = true;
      }
    }

    if (updated) {
      this.saveAllUsage(allUsage);
    }

    // Derive limits directly from plans config — null = unlimited, 0 = locked
    const standardLimit = limits.standardReportsPerCycle;
    const regionalLimit = limits.regionalReportsPerCycle;

    // Calculate remaining
    const standardRemaining = standardLimit === null
      ? Infinity
      : Math.max(0, standardLimit - state.standardUsed);

    const regionalRemaining = regionalLimit === null
      ? Infinity
      : Math.max(0, regionalLimit - state.regionalUsed);

    const canRunStandard = standardLimit === null || standardRemaining > 0;
    const canRunRegional = regionalLimit === null || (regionalLimit > 0 && regionalRemaining > 0);

    // Human-readable description fields (used in AccountSettings + Dashboard).
    // Derived from limits config so they stay in sync automatically.
    const standardLimitDescription =
      standardLimit === null
        ? 'Unlimited reports'
        : `${standardLimit} reports per month`;

    const resetCycleDescription =
      limits.standardResetCycle === 'none' ? 'No reset limits' : 'Monthly reset cycle';

    return {
      plan,
      standardLimit,
      standardUsed: state.standardUsed,
      standardRemaining,
      standardResetDate,
      regionalLimit,
      regionalUsed: state.regionalUsed,
      regionalRemaining,
      regionalResetDate,
      canRunStandard,
      canRunRegional,
      standardLimitDescription,
      resetCycleDescription,
    };
  }

  /**
   * Records a standard report generation event.
   */
  public static async incrementStandardUsage(plan: SubscriptionPlan): Promise<void> {
    const isDemo = isDemoMode;

    if (!isDemo) {
      // LIVE MODE: Call backend or increment in Supabase directly
      console.log(`[Usage - Live Mode] Logging standard report run for user under tier: ${plan}`);
      
      /*
      // FUTURE DATABASE WORKSPACE INTEGRATION:
      // When connected to persistent database storage, update the live user metric record:
      try {
        const { data, error } = await supabase.rpc('increment_usage_report', {
          user_email: userEmailAddress,
          plan_tier: plan,
          report_type: 'standard'
        });
        if (error) throw error;
      } catch (dbErr) {
        console.error('Failed to sync live usage record to database schema:', dbErr);
      }
      */
    } else {
      console.log(`[Usage - Demo Mode] Local standard counter incremented under tier: ${plan}`);
    }

    const allUsage = this.getAllUsage();
    const state = allUsage[plan] || {
      standardUsed: 0,
      regionalUsed: 0,
      lastStandardReset: new Date().toISOString(),
      lastRegionalReset: new Date().toISOString(),
    };

    state.standardUsed += 1;
    allUsage[plan] = state;
    this.saveAllUsage(allUsage);
  }

  /**
   * Records a regional analysis generation event.
   */
  public static async incrementRegionalUsage(plan: SubscriptionPlan): Promise<void> {
    const isDemo = isDemoMode;

    if (!isDemo) {
      // LIVE MODE: Call backend or database triggers
      console.log(`[Usage - Live Mode] Logging regional report run for user under tier: ${plan}`);

      /*
      // FUTURE USER INTERFACE SYNC WITH SUPABASE:
      try {
        const { data, error } = await supabase.rpc('increment_usage_report', {
          user_email: userEmailAddress,
          plan_tier: plan,
          report_type: 'regional'
        });
        if (error) throw error;
      } catch (dbErr) {
        console.error('Failed to increment regional study run counts:', dbErr);
      }
      */
    } else {
      console.log(`[Usage - Demo Mode] Local regional counter incremented under tier: ${plan}`);
    }

    const allUsage = this.getAllUsage();
    const state = allUsage[plan] || {
      standardUsed: 0,
      regionalUsed: 0,
      lastStandardReset: new Date().toISOString(),
      lastRegionalReset: new Date().toISOString(),
    };

    state.regionalUsed += 1;
    allUsage[plan] = state;
    this.saveAllUsage(allUsage);
  }

  /**
   * Dev/demo cleanup — resets all plan counters to zero.
   * Guarded: throws in Live Mode to prevent accidental quota resets against real data.
   * The UI button that calls this is already hidden when isDemoMode=false (App.tsx),
   * so this guard is a belt-and-suspenders defence against direct API calls.
   */
  public static resetUsage() {
    // Hard guardrail — must never run in Live Mode.
    assertDemoService('UsageTrackerService.resetUsage');
    console.log('[Usage Reset] Cleaning testing usage limits record');
    const defaults = this.getDefaultUsageState();
    this.saveAllUsage(defaults);
  }

  // ── Anonymous Preview Tracking ─────────────────────────────────────────────
  //
  // Tracks preview report usage for visitors who are NOT logged in.
  // Stored in a separate localStorage key from the plan-based quota.
  //
  // Design rationale:
  //   • One preview report is enough to demonstrate value without Supabase auth.
  //   • Preview reports target Gemini Flash (lowest cost, ~$0.002–$0.004/call).
  //   • The counter NEVER resets — once used, the visitor must register.
  //     This keeps anonymous AI cost bounded at $0.004/visitor maximum.
  //   • In production, server-side IP-rate-limiting should supplement this
  //     client-side check to prevent private-browsing abuse.
  //
  // Anonymous state is independent of plan state. A user can consume their
  // 1 anonymous preview, then register (Explorer) and receive 3 reports/month.

  private static ANONYMOUS_KEY = 'bizscope_anonymous_preview_v1';

  /** Shape of data stored under ANONYMOUS_KEY. */
  private static readAnonymousStore(): { used: number; firstUsedAt: string | null } {
    try {
      const raw = localStorage.getItem(this.ANONYMOUS_KEY);
      if (!raw) return { used: 0, firstUsedAt: null };
      const parsed = JSON.parse(raw);
      return {
        used:        typeof parsed.used === 'number' ? parsed.used : 0,
        firstUsedAt: typeof parsed.firstUsedAt === 'string' ? parsed.firstUsedAt : null,
      };
    } catch {
      return { used: 0, firstUsedAt: null };
    }
  }

  /**
   * Returns the number of preview reports the anonymous visitor has generated.
   * Reads localStorage — call only in a browser context.
   */
  public static getAnonymousPreviewUsed(): number {
    return this.readAnonymousStore().used;
  }

  /**
   * Whether the anonymous visitor may still generate a preview report.
   * Delegates the limit check to canGeneratePreviewReport() in plans.ts
   * so the threshold is defined in one place (ANONYMOUS_LIMITS.previewReports).
   */
  public static canRunAnonymousPreview(): boolean {
    return canGeneratePreviewReport(this.getAnonymousPreviewUsed());
  }

  /**
   * Records a preview report generation event for an anonymous visitor.
   * Should be called immediately after a preview report is successfully returned.
   */
  public static incrementAnonymousPreviewUsage(): void {
    const store = this.readAnonymousStore();
    try {
      localStorage.setItem(this.ANONYMOUS_KEY, JSON.stringify({
        used:        store.used + 1,
        firstUsedAt: store.firstUsedAt ?? new Date().toISOString(),
      }));
      console.log(`[Usage - Anonymous] Preview report used (${store.used + 1}/${ANONYMOUS_LIMITS.previewReports} lifetime total)`);
    } catch (e) {
      console.error('[Usage - Anonymous] Failed to persist preview usage:', e);
    }
  }

  /**
   * Dev/demo only — resets the anonymous preview counter.
   * Guarded: throws in Live Mode.
   */
  public static resetAnonymousPreview(): void {
    assertDemoService('UsageTrackerService.resetAnonymousPreview');
    localStorage.removeItem(this.ANONYMOUS_KEY);
    console.log('[Usage Reset] Anonymous preview counter cleared');
  }
}
