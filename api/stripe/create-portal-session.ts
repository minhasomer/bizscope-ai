import type { IncomingMessage, ServerResponse } from 'http';
import { json, verifyAuth, getStripe, getSupabaseAdmin } from './_shared.js';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const user = await verifyAuth(req.headers['authorization'] as string | undefined);
  if (!user) {
    return json(res, 401, { error: 'Unauthorized.' });
  }

  const { data: row } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.userId)
    .single();

  if (!row?.stripe_customer_id) {
    return json(res, 404, { error: 'No billing account found for this user.' });
  }

  const appUrl = process.env.APP_URL ?? process.env.VITE_APP_URL ?? '';
  const stripe = getStripe();

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   row.stripe_customer_id,
    return_url: `${appUrl}/billing`,
  });

  return json(res, 200, { url: portalSession.url });
}
