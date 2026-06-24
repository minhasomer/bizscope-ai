import { supabase, isSupabaseConfigured, supabaseUrl } from './supabaseClient';

export interface SupabaseProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  subscription_tier: string;
  tos_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export class ProfileService {
  static isActive(): boolean {
    return isSupabaseConfigured && !!supabase;
  }

  /**
   * Internal: fetches a profile with a tri-state result so ensureProfileExists()
   * can distinguish "timed out" (Supabase Web Lock contention — row may already
   * exist) from "genuinely missing" (PGRST116 — row needs to be created).
   * External callers should use getUserProfile(), which normalises 'timeout' → null.
   */
  private static async _fetchProfile(userId: string): Promise<SupabaseProfile | null | 'timeout'> {
    if (!this.isActive()) return null;

    console.log('[Profile] Fetching profile for user:', userId);

    // Diagnostic: the SDK calls auth.getSession() internally before firing any
    // PostgREST HTTP request (to build the Authorization: Bearer header).
    // If a background token-refresh holds the navigator.locks Web Lock, the
    // HTTP request to /rest/v1/profiles is never made and the promise hangs
    // silently.  This fire-and-forget timer makes that lock contention visible.
    const authDiagStart = Date.now();
    const authDiagTimer = setTimeout(() => {
      console.error(
        '[Profile] HANG DIAGNOSIS — auth.getSession() has not responded within 2s.',
        '\n  Root cause: Supabase navigator.locks Web Lock held by a background token refresh.',
        '\n  The SDK awaits this lock internally before every PostgREST request.',
        '\n  No HTTP request to /rest/v1/profiles will fire until the lock is released.',
        '\n  userId:', userId,
      );
    }, 2000);
    void supabase!.auth.getSession()
      .then(({ data }) => {
        clearTimeout(authDiagTimer);
        const ms = Date.now() - authDiagStart;
        if (ms > 300) {
          console.warn('[Profile] auth.getSession() took', ms, 'ms — lock was contended for user:', userId);
        } else {
          console.log('[Profile] auth.getSession() OK in', ms, 'ms — initiating Supabase query for user:', userId);
        }

        // ── ENV/JWT MISMATCH DIAGNOSTIC ───────────────────────────────────────
        // Decodes the active JWT to compare its issuer project ref against the
        // configured VITE_SUPABASE_URL. A mismatch here is the exact cause of
        // "42501 / 403 on public.profiles even with correct RLS" — Supabase
        // rejects the token because it was signed by a different project.
        const token = data.session?.access_token;
        if (token) {
          try {
            // JWT payload is the second base64url segment. atob requires standard base64.
            const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(b64)) as {
              iss?: string; sub?: string; exp?: number; role?: string;
            };
            const jwtRef = payload.iss?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
            const cfgRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

            console.log('[Profile DIAG] ─── JWT / Project cross-check ───');
            console.log('[Profile DIAG] JWT iss      :', payload.iss ?? '(missing)');
            console.log('[Profile DIAG] JWT sub      :', payload.sub ?? '(missing)');
            console.log('[Profile DIAG] JWT role     :', payload.role ?? '(missing)');
            console.log('[Profile DIAG] JWT exp      :', payload.exp ? new Date(payload.exp * 1000).toISOString() : '(missing)');
            console.log('[Profile DIAG] Configured URL:', supabaseUrl);
            console.log('[Profile DIAG] JWT project ref:', jwtRef ?? '(not a supabase.co iss)');
            console.log('[Profile DIAG] Cfg project ref:', cfgRef ?? '(not a supabase.co URL)');

            if (jwtRef && cfgRef && jwtRef !== cfgRef) {
              console.error(
                '[Profile DIAG] ⚠️  PROJECT MISMATCH DETECTED\n' +
                '  JWT was issued by  : ' + jwtRef + '.supabase.co\n' +
                '  Requests going to  : ' + cfgRef + '.supabase.co\n' +
                '  Fix: clear browser localStorage/cookies (the cached token is from\n' +
                '       a different Supabase project), or check VITE_SUPABASE_URL.'
              );
            } else if (!jwtRef) {
              console.warn('[Profile DIAG] iss is not a supabase.co URL — custom auth issuer?', payload.iss);
            } else {
              console.log('[Profile DIAG] ✓ Project refs match —', cfgRef);
            }

            if (payload.sub && payload.sub !== userId) {
              console.error(
                '[Profile DIAG] ⚠️  UID MISMATCH\n' +
                '  auth.uid() in JWT  : ' + payload.sub + '\n' +
                '  userId arg queried : ' + userId + '\n' +
                '  RLS policy "auth.uid() = id" will deny this row.'
              );
            } else if (payload.sub) {
              console.log('[Profile DIAG] ✓ JWT sub matches userId arg —', userId);
            }
          } catch (e) {
            console.error('[Profile DIAG] JWT decode failed (token malformed?):', e);
          }
        } else {
          console.warn(
            '[Profile DIAG] ⚠️  No access_token in session — request will be sent\n' +
            '  without Authorization header. RLS auth.uid() will be null → 42501.'
          );
        }
        // ── END ENV/JWT MISMATCH DIAGNOSTIC ──────────────────────────────────
      })
      .catch(e => {
        clearTimeout(authDiagTimer);
        console.error('[Profile] auth.getSession() threw before PostgREST query:', e, 'userId:', userId);
      });

    const TIMEOUT_MS = 8000;

    try {
      const result = await Promise.race([
        supabase!.from('profiles').select('*').eq('id', userId).single(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Supabase query timed out after ${TIMEOUT_MS}ms`)),
            TIMEOUT_MS,
          )
        ),
      ]);

      const { data, error } = result as {
        data: SupabaseProfile | null;
        error: { code: string; message: string } | null;
      };

      console.log(
        '[Profile] Supabase query returned — data:',
        data ? 'found' : 'null',
        '| error:',
        error ? `${error.code}: ${error.message}` : 'none',
      );

      if (error) {
        // PGRST116 = "no rows found" — not a real error, profile just doesn't exist yet
        if (error.code === 'PGRST116') {
          console.log('[Profile] No profile row found for user:', userId);
        } else {
          console.error('[Profile] getUserProfile error:', error.code, error.message);
        }
        return null;
      }

      if (data) {
        console.log('[Profile] Profile found — role:', data.role, '| subscription_tier:', data.subscription_tier);
      } else {
        console.log('[Profile] Data is null with no error for user:', userId);
      }

      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('timed out')) {
        console.error('[Profile] getUserProfile TIMEOUT for user:', userId,
          '— Supabase did not respond within', TIMEOUT_MS, 'ms');
        return 'timeout';
      }
      console.error('[Profile] getUserProfile exception for user:', userId, '—', msg);
      return null;
    }
  }

  /**
   * Fetch a user's profile row from the profiles table.
   * Returns null if Supabase is not configured, the row doesn't exist, or a
   * timeout occurred. Callers that need to distinguish timeout from missing
   * should use the private _fetchProfile() method within this class.
   */
  static async getUserProfile(userId: string): Promise<SupabaseProfile | null> {
    const result = await this._fetchProfile(userId);
    return result === 'timeout' ? null : result;
  }

  /**
   * Re-fetch the profile from Supabase, bypassing any cached state.
   * Use this after a Stripe webhook is known to have updated the tier.
   */
  static async refreshUserProfile(userId: string): Promise<SupabaseProfile | null> {
    return this.getUserProfile(userId);
  }

  /**
   * Ensure a profile row exists for the given user.
   * The DB trigger should create this on signup, but this is a safe fallback
   * for OAuth redirects or any race where the trigger didn't fire yet.
   * Never overwrites role or subscription_tier — only inserts with defaults
   * if the row is genuinely missing.
   */
  static async ensureProfileExists(
    userId: string,
    email: string,
    fullName?: string,
    avatarUrl?: string,
  ): Promise<SupabaseProfile | null> {
    if (!this.isActive()) return null;

    // 1. Try to read the existing row first (trigger may have already created it).
    //    Use _fetchProfile() to distinguish "timed out" from "genuinely missing".
    //    On timeout, skip INSERT — the row likely exists; next auth event will retry.
    const fetchResult = await this._fetchProfile(userId);
    if (fetchResult === 'timeout') {
      console.warn(
        '[Profile] Skipping INSERT — profile query timed out; profile may already exist. ' +
        'Will retry on next auth event. User:', userId,
      );
      return null;
    }
    if (fetchResult) return fetchResult;

    // 2. Row is missing — insert with defaults
    console.log('[Profile] No profile found — creating row for user:', userId, '| email:', email);

    // Wrap insert with the same timeout guard — the auth lock blocks INSERT too
    let insertError: { code: string; message: string } | null = null;
    try {
      const insertResult = await Promise.race([
        supabase!.from('profiles').insert({
          id: userId,
          email,
          full_name: fullName ?? '',
          avatar_url: avatarUrl ?? '',
          role: 'Explorer',
          subscription_tier: 'Explorer',
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Profile insert timed out after 8000ms')),
            8000,
          )
        ),
      ]);
      insertError = (insertResult as { data: null; error: { code: string; message: string } | null }).error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Profile] ensureProfileExists insert timeout/exception for user:', userId, '—', msg);
      return null;
    }

    if (insertError) {
      // 23505 = unique_violation — profile was inserted between our check and insert (race)
      if (insertError.code === '23505') {
        console.log('[Profile] Race condition on insert (23505) — refetching profile for user:', userId);
        return this.getUserProfile(userId);
      }
      console.error('[Profile] ensureProfileExists insert error:', insertError.code, insertError.message);
      return null;
    }

    // 3. Explicit refetch to confirm the row is readable with any trigger-applied defaults
    console.log('[Profile] Profile row created — refetching to confirm for user:', userId);
    const confirmed = await this.getUserProfile(userId);
    if (confirmed) {
      console.log('[Profile] Confirmed profile after create — role:', confirmed.role, '| subscription_tier:', confirmed.subscription_tier);
    } else {
      console.warn('[Profile] Refetch after create returned null for user:', userId);
    }
    return confirmed;
  }

  /**
   * Record Terms of Service acceptance for a user.
   * Best-effort — non-fatal if Supabase is unavailable.
   */
  static async acceptTos(userId: string): Promise<void> {
    if (!this.isActive()) return;
    const { error } = await supabase!
      .from('profiles')
      .update({ tos_accepted_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) {
      console.error('[ProfileService] acceptTos error:', error.message);
      throw new Error(error.message);
    }
  }

  /**
   * Update only the display name in the profiles table.
   * Does not touch role or subscription_tier (RLS also enforces this).
   */
  static async updateDisplayName(
    userId: string,
    fullName: string,
  ): Promise<SupabaseProfile | null> {
    if (!this.isActive()) return null;

    const { data, error } = await supabase!
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[ProfileService] updateDisplayName error:', error.message);
      return null;
    }

    return data as SupabaseProfile;
  }
}
