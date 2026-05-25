import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase config with environment variables, matching guidelines for secure client variables.
// Exported so diagnostic code in profileService.ts can compare the configured URL against JWT issuer.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Safely report configuration state
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) are not set. ' +
    'The app will operate fully in high-fidelity sandbox auth mode for local development and demonstration.'
  );
}

// Create client if configured, otherwise export null to prevent startup crashes.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ── DIAGNOSTIC: log which project this client is pointed at on startup ───────
// Check the browser console immediately after page load — if the project ref here
// does not match the project you ran RLS SQL against, that is the root cause.
if (isSupabaseConfigured) {
  const _projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '(non-supabase URL)';
  console.log('[Supabase Init] Configured URL  :', supabaseUrl);
  console.log('[Supabase Init] Project ref      :', _projectRef);
  // Show enough of the key to identify which project it belongs to without exposing it fully.
  console.log('[Supabase Init] Anon key prefix  :', supabaseAnonKey.slice(0, 32) + '…');
}
