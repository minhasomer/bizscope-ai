/**
 * TEMPORARY STAGING-ONLY ENDPOINT — delete immediately after use.
 *
 * Creates (or resets) a fresh Explorer test user for the Pro trial lifecycle
 * test, and returns a one-time magic-link sign-in URL.
 *
 * Guards:
 *   - Only runs when VERCEL_ENV !== 'production'
 *   - Requires a setup secret in the X-Setup-Token header
 *   - Email is pinned to a non-existent domain (no real mail sent)
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const SETUP_SECRET = process.env.TRIAL_SETUP_SECRET ?? '';
const TEST_EMAIL   = 'biztrial-test@bizscope-staging-test.invalid';

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Hard-block in production regardless of anything else.
  if (process.env.VERCEL_ENV === 'production') {
    return json(res, 404, { error: 'Not found.' });
  }

  const token = (req.headers['x-setup-token'] as string | undefined) ?? '';
  if (!SETUP_SECRET || token !== SETUP_SECRET) {
    return json(res, 401, { error: 'Unauthorized.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json(res, 500, { error: 'Supabase not configured.' });
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Delete existing test user if present (clean slate).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: listData } = await (admin.auth.admin as any).listUsers();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prev = (listData?.users as any[])?.find((u: any) => u.email === TEST_EMAIL);
  if (prev) {
    await admin.auth.admin.deleteUser(prev.id);
  }

  // Create the fresh test user with confirmed email.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email:          TEST_EMAIL,
    email_confirm:  true,
    user_metadata:  { display_name: 'Trial Test User' },
  });
  if (createErr || !created?.user) {
    return json(res, 500, { error: createErr?.message ?? 'User creation failed.' });
  }

  // Generate a magic-link so the browser can sign in without a password.
  const appUrl = process.env.APP_URL ?? process.env.VITE_APP_URL ?? '';
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type:         'magiclink',
    email:        TEST_EMAIL,
    options:      { redirectTo: `${appUrl}/pricing` },
  });
  if (linkErr || !link?.properties?.action_link) {
    return json(res, 500, { error: linkErr?.message ?? 'Magic link generation failed.' });
  }

  return json(res, 200, {
    userId:    created.user.id,
    email:     TEST_EMAIL,
    magicLink: link.properties.action_link,
  });
}
