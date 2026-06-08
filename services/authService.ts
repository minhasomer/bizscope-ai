import { supabase, isSupabaseConfigured } from './supabaseClient';
import { ProfileService } from './profileService';
import { getEffectivePlan } from '../src/utils/planUtils';
import { isDemoMode, betaFullAccess } from '../src/config/appConfig';

// ─── Custom errors ──────────────────────────────────────────────────────────

/**
 * Thrown by signUp when Supabase requires email confirmation before the account
 * is active. The UI should show a verification-pending screen.
 *
 * Covers: fresh signup where confirmation email was sent.
 */
export class EmailConfirmationRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailConfirmationRequiredError';
  }
}

/**
 * Thrown by signUp when the submitted email already has an account.
 *
 * Detection: Supabase anti-enumeration returns { user: <fake>, identities: [],
 * session: null, error: null } for existing emails (both confirmed and
 * unconfirmed). An empty identities array is the reliable signal — a genuine
 * new signup always has identities.length >= 1.
 *
 * Security note: the identities array is already present in the JS SDK
 * response object, so reading it does not introduce new enumeration capability
 * beyond what the API already exposes. We do NOT distinguish confirmed vs
 * unconfirmed (that would require a second API call and is unnecessary for UX).
 */
export class DuplicateEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateEmailError';
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  /**
   * Resolved effective plan (SubscriptionPlan string).
   * In live mode this is derived from role + subscription_tier.
   * In demo mode this comes from the demo-switcher localStorage key.
   */
  plan: string;
  /** Raw role from the Supabase profiles table. Defaults to 'Explorer' in mock mode. */
  role: string;
  /** Raw subscription_tier from the Supabase profiles table. Defaults to 'Explorer' in mock mode. */
  subscription_tier: string;
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  isMock: boolean;
  error: string | null;
}

// ─── Storage keys ───────────────────────────────────────────────────────────

/**
 * Mock/demo sessions are stored in sessionStorage, NOT localStorage.
 *
 * sessionStorage is:
 *  - Preserved across same-tab page refreshes (so F5 keeps the session)
 *  - Cleared when the tab or browser window is closed
 *  - Isolated per tab (no cross-tab bleed)
 *
 * This prevents the most common auth bug: a stale mock session from a previous
 * browser run appearing as "signed in" on the next visit.
 */
const MOCK_USER_KEY = 'bizscope_mock_user';

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Resolve plan/role/subscription_tier from an active Supabase session.
 *
 * Always reads the public.profiles table when Supabase is configured.
 * isDemoMode controls AI/Stripe mock behaviour — it does NOT skip the DB.
 *
 * In Demo Mode with real auth the role still comes from the DB, but the
 * effective plan may be overridden by the demo plan-switcher stored in
 * localStorage (so the DevAdminPanel preview persists across refreshes).
 */
async function resolvePlanFromSession(
  userId: string,
  email: string,
  authMeta: Record<string, unknown>,
): Promise<{ plan: string; role: string; subscription_tier: string }> {
  console.log('[Auth] Resolving profile — userId:', userId, '| email:', email);

  const profile = await ProfileService.ensureProfileExists(
    userId,
    email,
    (authMeta.full_name ?? authMeta.fullName ?? authMeta.name ?? '') as string,
    (authMeta.avatar_url ?? authMeta.picture ?? '') as string,
  );

  if (!profile) {
    // Prefer cached role/tier from a previous successful fetch so a Web Lock timeout
    // does not downgrade an Admin back to Explorer for the rest of the session.
    const cachedRole = localStorage.getItem(`bizscope_user_role_${email}`) ?? 'Explorer';
    const cachedTier = localStorage.getItem(`bizscope_user_tier_${email}`) ?? 'Explorer';
    const fallbackPlan = isDemoMode
      ? (localStorage.getItem(`bizscope_user_plan_${email}`) ?? localStorage.getItem('bizscope_user_plan') ?? getEffectivePlan({ role: cachedRole, subscription_tier: cachedTier }, null, betaFullAccess))
      : getEffectivePlan({ role: cachedRole, subscription_tier: cachedTier }, null, betaFullAccess);
    console.warn('[Auth] Profile unavailable — using cached role:', cachedRole, '| plan:', fallbackPlan);
    return { plan: fallbackPlan, role: cachedRole, subscription_tier: cachedTier };
  }

  // In Demo Mode respect any plan override the switcher wrote to localStorage,
  // but always use the real role from the DB (not a hardcoded 'Explorer').
  let plan: string;
  if (isDemoMode) {
    plan =
      localStorage.getItem(`bizscope_user_plan_${email}`) ??
      localStorage.getItem('bizscope_user_plan') ??
      getEffectivePlan({ role: profile.role, subscription_tier: profile.subscription_tier }, null, betaFullAccess);
  } else {
    plan = getEffectivePlan(
      { role: profile.role, subscription_tier: profile.subscription_tier },
      null,
      betaFullAccess,
    );
  }

  console.log('[Auth] Final effective role:', profile.role, '| subscription_tier:', profile.subscription_tier, '| plan:', plan);

  // Cache role, tier, AND the resolved effective plan so that getInitialSession's
  // fast path returns the correct plan on the very next page load — including when
  // betaFullAccess is true. Without caching `plan`, the fast path always fell back
  // to 'Explorer', causing a "Pro Required" flash on Dashboard until the INITIAL_SESSION
  // DB callback fired (500 ms – 8 s later).
  try {
    localStorage.setItem(`bizscope_user_role_${email}`, profile.role);
    localStorage.setItem(`bizscope_user_tier_${email}`, profile.subscription_tier);
    localStorage.setItem(`bizscope_user_plan_${email}`, plan);
  } catch { /* ignore quota errors */ }

  return { plan, role: profile.role, subscription_tier: profile.subscription_tier };
}

// ─── AuthService ────────────────────────────────────────────────────────────

export class AuthService {
  public static isSupabaseActive(): boolean {
    return isSupabaseConfigured && !!supabase;
  }

  public static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ── Session bootstrap ────────────────────────────────────────────────────

  /**
   * Load the initial session on page load (called once from App.tsx).
   *
   * Decision tree:
   *  1. Supabase configured → only trust Supabase session. If no Supabase session,
   *     the user is NOT signed in. Never fall through to mock recovery — that would
   *     auto-sign-in with stale localStorage/sessionStorage data after logout.
   *  2. Supabase NOT configured → pure sandbox environment; restore mock session
   *     from sessionStorage if one exists (written by signInAsDemo / signIn mock path).
   */
  public static async getInitialSession(): Promise<{ user: UserProfile | null; isMock: boolean }> {
    if (this.isSupabaseActive()) {
      try {
        const { data: { session }, error } = await supabase!.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          const authUser = session.user;
          const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
          const email = authUser.email ?? '';

          // FAST PATH: build identity directly from the JWT — no DB call.
          //
          // resolvePlanFromSession() (DB round-trip: 500 ms–8 s) is intentionally
          // skipped here. Instead we seed the plan from the localStorage cache that
          // the subscription writes on every successful profile fetch. On first-ever
          // load the cache is empty and we default to 'Explorer'; the
          // INITIAL_SESSION handler in subscribeToAuthChanges fires concurrently
          // and updates plan/role from the DB in the background.
          const cachedPlan = (
            localStorage.getItem(`bizscope_user_plan_${email}`) ??
            localStorage.getItem('bizscope_user_plan') ??
            'Explorer'
          );
          const cachedRole = localStorage.getItem(`bizscope_user_role_${email}`) ?? 'Explorer';
          const cachedTier = localStorage.getItem(`bizscope_user_tier_${email}`) ?? 'Explorer';

          localStorage.setItem('bizscope_user_email', email);

          console.log('[Auth] getInitialSession fast-path — plan from cache:', cachedPlan, '| role from cache:', cachedRole);

          return {
            user: {
              id: authUser.id,
              email,
              fullName: (meta.full_name ?? meta.fullName ?? meta.name ?? email.split('@')[0]) as string,
              avatarUrl:
                (meta.avatar_url ?? meta.picture ?? '') as string ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${email}`,
              plan: cachedPlan,
              // role and subscription_tier are seeded from localStorage cache written by
              // resolvePlanFromSession on a previous successful profile fetch. This ensures
              // the correct role is available immediately even when the Supabase Web Lock
              // is held by a background token refresh and the profile DB query times out.
              // The INITIAL_SESSION handler will overwrite these once the lock releases.
              role: cachedRole,
              subscription_tier: cachedTier,
            },
            isMock: false,
          };
        }
      } catch (err) {
        console.error('[AuthService] getInitialSession error:', err);
      }

      // Supabase is configured but returned no session → the user is signed out.
      // DO NOT fall through to mock recovery — a stale sessionStorage/localStorage
      // entry must not silently restore a ghost session after logout.
      return { user: null, isMock: false };
    }

    // ── Supabase NOT configured → pure sandbox ──────────────────────────────
    // Attempt to restore a mock session that was explicitly created this browser
    // session (stored in sessionStorage, not localStorage).
    try {
      const stored = sessionStorage.getItem(MOCK_USER_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserProfile;
        if (parsed?.email) {
          localStorage.setItem('bizscope_user_email', parsed.email);
          return {
            user: { role: 'Explorer', subscription_tier: 'Explorer', ...parsed },
            isMock: true,
          };
        }
      }
    } catch {
      // Corrupt sessionStorage — start fresh.
      sessionStorage.removeItem(MOCK_USER_KEY);
    }

    return { user: null, isMock: true };
  }

  // ── Auth actions ─────────────────────────────────────────────────────────

  /**
   * Create a demo-only session without touching Supabase.
   * Only available when Supabase is NOT configured (env vars missing).
   * When Supabase IS configured, real auth must be used instead.
   * Session stored in sessionStorage — discarded when the tab closes.
   */
  public static signInAsDemo(plan: string): UserProfile {
    if (this.isSupabaseActive()) {
      throw new Error(
        'Demo login is not available when Supabase is configured. Use your real credentials or Google sign-in.',
      );
    }
    console.log('[Auth] Using demo login — Supabase not configured');

    const planSlug = plan.toLowerCase().replace(/\+/g, 'plus').replace(/\s+/g, '-');
    const demoUser: UserProfile = {
      id: `demo-${planSlug}-user`,
      email: `demo_${planSlug}@bizscope.demo`,
      fullName: `Demo ${plan} User`,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=Demo${plan}`,
      plan,
      role: 'Explorer',
      subscription_tier: 'Explorer',
    };

    sessionStorage.setItem(MOCK_USER_KEY, JSON.stringify(demoUser));
    return demoUser;
  }

  public static async signUp(
    email: string,
    password: string,
    fullName: string,
    defaultPlan: string = 'Explorer',
    tosAcceptedAt?: string,
  ): Promise<UserProfile> {
    if (!this.isValidEmail(email)) throw new Error('Please enter a valid email address.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters long.');

    if (this.isSupabaseActive()) {
      const redirectTo = (import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin;
      const { data, error } = await supabase!.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName,
            avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${fullName || email}`,
          },
        },
      });

      if (error) throw new Error(error.message);

      const user = data.user;

      // ── Duplicate-email detection ─────────────────────────────────────────────
      // Supabase anti-enumeration: existing email → { user: <fake>, session: null }
      // with no real error. The discriminator is `identities`:
      //
      //   New signup (real user)      → identities is an Array with ≥1 entries
      //   Existing email (fake user)  → identities is [] (explicitly empty array)
      //
      // IMPORTANT: identities === undefined is NOT treated as a duplicate.
      // A genuine new user with email confirmation pending can have the identities
      // field absent from the signup response (depends on Supabase JS client version
      // and project configuration). Treating undefined as a duplicate causes a
      // false-positive "Account already exists" for real new signups, including
      // emails that were previously deleted and re-registered.
      //
      // The only reliable anti-enumeration signal is identities: [] (present and
      // explicitly empty). undefined falls through to EmailConfirmationRequiredError.
      //
      // Also catches the legacy case where data.user itself is null (older Supabase
      // behavior where the anti-enum response omitted the user object entirely).
      const identities = data.user?.identities;
      const identitiesIsEmpty =
        // user is null/undefined entirely (legacy Supabase anti-enum shape)
        !data.user ||
        // identities present and explicitly empty — the real anti-enum signal
        (Array.isArray(identities) && identities.length === 0);

      // ── Temporary signup diagnostics — remove after duplicate-signup investigation ──
      console.group('[Auth][SignUp] Supabase response diagnostics');
      console.log('hasUser:           ', !!data.user);
      console.log('hasSession:        ', !!data.session);
      console.log('identitiesValue:   ', identities);
      console.log('identitiesIsArray: ', Array.isArray(identities));
      console.log('identitiesLength:  ', Array.isArray(identities) ? identities.length : 'n/a (not array)');
      console.log('identitiesIsEmpty: ', identitiesIsEmpty);
      console.log('willThrowDuplicate:', !data.session && identitiesIsEmpty);
      console.log('branchDetail: ',
        !data.user
          ? 'BRANCH: !data.user (user object absent)'
          : (Array.isArray(identities) && identities.length === 0)
            ? 'BRANCH: identities is [] (Supabase anti-enum signal — email exists)'
            : !data.session
              ? 'BRANCH: session null, identities present → EmailConfirmationRequired'
              : 'BRANCH: session present → immediate sign-in'
      );
      console.groupEnd();
      // ── End diagnostics ────────────────────────────────────────────────────────

      if (!data.session && identitiesIsEmpty) {
        throw new DuplicateEmailError(
          'An account with this email already exists. Please sign in, or reset your password if you\'ve forgotten it.',
        );
      }

      // No session, identities present → genuine new signup, confirmation email sent.
      if (!user || !data.session) {
        throw new EmailConfirmationRequiredError(
          'Account created. Please check your email to verify your account before signing in.',
        );
      }

      // Store ToS acceptance timestamp in the profiles table if available.
      // This is best-effort — a missing profiles row (race condition on trigger) is
      // non-fatal; the timestamp is also stored in user metadata as a fallback.
      if (tosAcceptedAt) {
        try {
          await supabase!.from('profiles').update({ tos_accepted_at: tosAcceptedAt }).eq('id', user.id);
        } catch {
          // Non-fatal — timestamp also captured in auth metadata below
          console.warn('[Auth] Could not store tos_accepted_at in profiles table.');
        }
        // Also store in user metadata as a secondary record
        await supabase!.auth.updateUser({ data: { tos_accepted_at: tosAcceptedAt } }).catch(() => null);
      }

      if (isDemoMode) {
        localStorage.setItem(`bizscope_user_plan_${email}`, defaultPlan);
      }
      localStorage.setItem('bizscope_user_email', email);

      return {
        id: user.id,
        email: user.email ?? email,
        fullName,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${fullName || email}`,
        plan: defaultPlan,
        role: 'Explorer',
        subscription_tier: 'Explorer',
      };
    }

    // Mock flow (no Supabase) — store in sessionStorage.
    await new Promise(r => setTimeout(r, 800));
    const emailLower = email.toLowerCase().trim();
    const mockUser: UserProfile = {
      id: `mock-user-${Math.random().toString(36).substring(2, 10)}`,
      email: emailLower,
      fullName: fullName || emailLower.split('@')[0],
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${fullName || emailLower}`,
      plan: defaultPlan,
      role: 'Explorer',
      subscription_tier: 'Explorer',
    };
    sessionStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    localStorage.setItem(`bizscope_user_plan_${emailLower}`, defaultPlan);
    localStorage.setItem('bizscope_user_plan', defaultPlan);
    localStorage.setItem('bizscope_user_email', emailLower);
    return mockUser;
  }

  public static async signIn(email: string, password: string): Promise<UserProfile> {
    if (!this.isValidEmail(email)) throw new Error('Please enter a valid email address.');
    if (!password) throw new Error('Please input your account password.');

    if (this.isSupabaseActive()) {
      const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const user = data.user;
      if (!user) throw new Error('A severe runtime error occurred during sign in.');

      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const emailAddr = user.email ?? email;
      const { plan, role, subscription_tier } = await resolvePlanFromSession(user.id, emailAddr, meta);

      localStorage.setItem('bizscope_user_email', emailAddr);
      if (isDemoMode) localStorage.setItem('bizscope_user_plan', plan);

      return {
        id: user.id,
        email: emailAddr,
        fullName: (meta.full_name ?? meta.fullName ?? emailAddr.split('@')[0]) as string,
        avatarUrl:
          (meta.avatar_url ?? '') as string ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${emailAddr}`,
        plan,
        role,
        subscription_tier,
      };
    }

    // Mock flow (no Supabase) — store in sessionStorage.
    await new Promise(r => setTimeout(r, 600));
    const emailLower = email.toLowerCase().trim();
    if (password.length < 4) throw new Error('Please enter a valid password (min 4 characters).');
    const savedPlan = localStorage.getItem(`bizscope_user_plan_${emailLower}`) || 'Explorer';
    const mockUser: UserProfile = {
      id: `mock-user-${Array.from(emailLower).reduce((a, c) => a + c.charCodeAt(0), 0)}`,
      email: emailLower,
      fullName: emailLower.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' '),
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${emailLower}`,
      plan: savedPlan,
      role: 'Explorer',
      subscription_tier: 'Explorer',
    };
    sessionStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    localStorage.setItem(`bizscope_user_plan_${emailLower}`, savedPlan);
    localStorage.setItem('bizscope_user_plan', savedPlan);
    localStorage.setItem('bizscope_user_email', emailLower);
    return mockUser;
  }

  /**
   * Always redirects to real Google OAuth via Supabase.
   * Never creates a mock user — if Supabase is not configured, throws a clear error.
   * Demo login (signInAsDemo) is a separate, unrelated code path.
   */
  public static async signInWithGoogle(): Promise<{ url: string }> {
    if (!this.isSupabaseActive()) {
      throw new Error(
        'Google sign-in requires Supabase. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
      );
    }
    console.log('[Auth] Using real Supabase Google OAuth');
    // Prefer VITE_APP_URL so one fixed canonical origin can be added to
    // Supabase's Allowed Redirect URLs list in the dashboard.
    // Falls back to window.location.origin for local dev.
    const redirectTo = (import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin;
    const { data, error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams: { prompt: 'select_account' } },
    });
    if (error) throw new Error(error.message);
    if (!data.url) {
      throw new Error(
        'Google sign-in is not configured. Enable the Google provider in Supabase Dashboard → Authentication → Providers.',
      );
    }
    return { url: data.url };
  }

  public static async resendConfirmationEmail(email: string): Promise<void> {
    if (!this.isSupabaseActive()) return; // no-op in mock mode
    const { error } = await supabase!.auth.resend({ type: 'signup', email });
    if (error) throw new Error(error.message);
  }

  public static async resetPassword(email: string): Promise<boolean> {
    if (!this.isValidEmail(email)) throw new Error('Please enter a valid email address.');
    if (this.isSupabaseActive()) {
      const redirectTo = (import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin;
      const { error } = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw new Error(error.message);
      return true;
    }
    await new Promise(r => setTimeout(r, 500));
    return true;
  }

  /**
   * Sign out of both Supabase and any mock/demo session.
   * Clears sessionStorage (demo sessions) AND any legacy localStorage mock keys
   * from older app versions so nothing can auto-restore a ghost session.
   */
  public static async signOut(): Promise<void> {
    if (this.isSupabaseActive()) {
      try {
        await supabase!.auth.signOut();
      } catch (err) {
        console.error('[AuthService] Supabase signOut error:', err);
      }
    }

    // Clear mock/demo session state from both storage types.
    // sessionStorage holds current demo sessions; localStorage holds legacy entries.
    sessionStorage.removeItem(MOCK_USER_KEY);
    localStorage.removeItem(MOCK_USER_KEY);
    localStorage.removeItem('bizscope_user_email');
  }

  // ── Profile updates ──────────────────────────────────────────────────────

  public static async updateProfile(userEmail: string, fullName: string): Promise<UserProfile> {
    if (!fullName?.trim()) throw new Error('Full name cannot be blank.');

    if (this.isSupabaseActive()) {
      const { data, error } = await supabase!.auth.updateUser({
        data: { full_name: fullName.trim() },
      });
      if (error) throw new Error(error.message);

      const authUser = data.user!;
      const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
      const emailAddr = authUser.email ?? userEmail;

      await ProfileService.updateDisplayName(authUser.id, fullName.trim());

      const profile = await ProfileService.getUserProfile(authUser.id);
      const { plan, role, subscription_tier } = profile
        ? {
            plan: isDemoMode
              ? localStorage.getItem(`bizscope_user_plan_${emailAddr}`) || 'Explorer'
              : getEffectivePlan(
                  { role: profile.role, subscription_tier: profile.subscription_tier },
                  null,
                  betaFullAccess,
                ),
            role: profile.role,
            subscription_tier: profile.subscription_tier,
          }
        : { plan: 'Explorer', role: 'Explorer', subscription_tier: 'Explorer' };

      return {
        id: authUser.id,
        email: emailAddr,
        fullName: fullName.trim(),
        avatarUrl:
          (meta.avatar_url ?? '') as string ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${fullName.trim()}`,
        plan,
        role,
        subscription_tier,
      };
    }

    // Mock update — patch the sessionStorage record.
    const stored = sessionStorage.getItem(MOCK_USER_KEY);
    if (!stored) throw new Error('No active user session found to update.');
    const parsed: UserProfile = JSON.parse(stored);
    parsed.fullName = fullName.trim();
    parsed.avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${fullName.trim()}`;
    sessionStorage.setItem(MOCK_USER_KEY, JSON.stringify(parsed));
    return parsed;
  }

  /** Persist the active demo-mode plan switcher value. No-op outside local dev. */
  public static saveUserPlan(email: string, plan: string): void {
    if (!import.meta.env.DEV) return;
    const emailLower = email.toLowerCase().trim();
    localStorage.setItem(`bizscope_user_plan_${emailLower}`, plan);
    localStorage.setItem('bizscope_user_plan', plan);
  }

  // ── Real-time auth state ─────────────────────────────────────────────────

  /** Set a new password for the currently authenticated user (used during PASSWORD_RECOVERY session). */
  public static async updatePassword(newPassword: string): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  public static subscribeToAuthChanges(
    onUserChange: (user: UserProfile | null) => void,
    onPasswordRecovery?: () => void,
  ): () => void {
    if (!this.isSupabaseActive() || !supabase) return () => {};

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          // Clear ALL mock/demo state so nothing ghost-signs-in on next load.
          sessionStorage.removeItem(MOCK_USER_KEY);
          localStorage.removeItem(MOCK_USER_KEY);
          localStorage.removeItem('bizscope_user_email');
          onUserChange(null);
          return;
        }

        if (
          session?.user &&
          (event === 'INITIAL_SESSION' ||
            event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'USER_UPDATED' ||
            event === 'PASSWORD_RECOVERY')
        ) {
          const authUser = session.user;
          const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
          const email = authUser.email ?? '';

          localStorage.setItem('bizscope_user_email', email);

          try {
            const { plan, role, subscription_tier } = await resolvePlanFromSession(
              authUser.id,
              email,
              meta,
            );

            onUserChange({
              id: authUser.id,
              email,
              fullName: (meta.full_name ?? meta.fullName ?? meta.name ?? email.split('@')[0]) as string,
              avatarUrl:
                (meta.avatar_url ?? meta.picture ?? '') as string ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${email}`,
              plan,
              role,
              subscription_tier,
            });
            if (event === 'PASSWORD_RECOVERY') onPasswordRecovery?.();

            // Strip the bare '#' that Supabase's implicit-grant OAuth flow leaves in
            // the URL after redirecting back from the provider (e.g. Google).
            // Supabase extracts the access_token from the hash automatically, but the
            // '#' character itself remains and is visible in the address bar.
            if (event === 'SIGNED_IN' && typeof window !== 'undefined' && window.location.hash === '#') {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }

            // If INITIAL_SESSION resolved to Explorer with no cached role, the
            // profile fetch likely hit Supabase Web Lock contention during the
            // background token refresh and timed out at 8 s.  Schedule a single
            // retry 15 s later — by then the lock will have released and the
            // real role (e.g. Admin) will be readable from the DB.
            if (
              event === 'INITIAL_SESSION' &&
              role === 'Explorer' &&
              !localStorage.getItem(`bizscope_user_role_${email}`)
            ) {
              console.log('[Auth] INITIAL_SESSION returned Explorer with empty role cache — scheduling profile retry in 15 s');
              setTimeout(async () => {
                console.log('[Auth] Profile retry — re-fetching after Web Lock window');
                try {
                  const retry = await resolvePlanFromSession(authUser.id, email, meta);
                  if (retry.role !== 'Explorer') {
                    console.log('[Auth] Profile retry succeeded — role:', retry.role, '| plan:', retry.plan);
                    onUserChange({
                      id: authUser.id,
                      email,
                      fullName: (meta.full_name ?? meta.fullName ?? meta.name ?? email.split('@')[0]) as string,
                      avatarUrl:
                        (meta.avatar_url ?? meta.picture ?? '') as string ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${email}`,
                      plan: retry.plan,
                      role: retry.role,
                      subscription_tier: retry.subscription_tier,
                    });
                  } else {
                    console.warn('[Auth] Profile retry still returned Explorer — Web Lock may still be held');
                  }
                } catch (retryErr) {
                  console.error('[Auth] Profile retry failed:', retryErr);
                }
              }, 15_000);
            }
          } catch (err) {
            console.error('[AuthService] subscribeToAuthChanges profile fetch failed:', err);
            // Use cached role/tier so a token-refresh Web Lock timeout does not
            // downgrade an Admin to Explorer for the duration of the session.
            const cachedRole = localStorage.getItem(`bizscope_user_role_${email}`) ?? 'Explorer';
            const cachedTier = localStorage.getItem(`bizscope_user_tier_${email}`) ?? 'Explorer';
            onUserChange({
              id: authUser.id,
              email,
              fullName: (meta.full_name ?? email.split('@')[0]) as string,
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${email}`,
              plan: isDemoMode
                ? (localStorage.getItem(`bizscope_user_plan_${email}`) ?? localStorage.getItem('bizscope_user_plan') ?? getEffectivePlan({ role: cachedRole, subscription_tier: cachedTier }, null, betaFullAccess))
                : getEffectivePlan({ role: cachedRole, subscription_tier: cachedTier }, null, betaFullAccess),
              role: cachedRole,
              subscription_tier: cachedTier,
            });
            if (event === 'PASSWORD_RECOVERY') onPasswordRecovery?.();
          }
        }
      },
    );

    return () => subscription.unsubscribe();
  }
}
