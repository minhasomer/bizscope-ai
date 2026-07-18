import type { IncomingMessage, ServerResponse } from 'http';
import { json, verifyAuth, getSubscriptionRow } from './_shared.js';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const user = await verifyAuth(req.headers['authorization'] as string | undefined);
  if (!user) {
    return json(res, 401, { error: 'Unauthorized.' });
  }

  const row = await getSubscriptionRow(user.userId);

  if (!row) {
    return json(res, 200, {
      plan:   'Explorer',
      status: 'inactive',
      cancelAtPeriodEnd: false,
      currentPeriodEnd:  null,
    });
  }

  return json(res, 200, {
    plan:              row.plan,
    status:            row.status,
    cancelAtPeriodEnd: (row as any).cancel_at_period_end ?? false,
    currentPeriodEnd:  (row as any).current_period_end   ?? null,
  });
}
