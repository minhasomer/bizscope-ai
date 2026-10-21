import type { IncomingMessage } from 'http';
import { createHmac } from 'crypto';

/**
 * Per-IP daily limit for anonymous previews (api/preview.ts).
 *
 * The client-side counter (UsageTrackerService, 1 per browser) is bypassed by
 * incognito windows or direct API calls, and the global hourly cap alone lets
 * one visitor exhaust it for everyone. Successful previews are logged to
 * usage_logs with a keyed hash of the client IP; the raw IP is never stored.
 * The limit is above 1 so people sharing an IP (office, mobile carrier) still
 * get their preview.
 */

export const PREVIEW_IP_DAILY_LIMIT = 3;

/** Client IP as seen by Vercel (x-real-ip / first x-forwarded-for hop). Null locally if absent. */
export function clientIp(req: IncomingMessage): string | null {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null;
  return pick(req.headers['x-real-ip']) ?? pick(req.headers['x-forwarded-for'])?.split(',')[0].trim() ?? null;
}

/** HMAC-SHA256 of the IP so it can be matched but not reversed. */
export function hashIp(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(ip).digest('hex');
}

/**
 * True when this IP hash already has PREVIEW_IP_DAILY_LIMIT successful
 * previews in the last 24 hours. Throws on query failure; the caller fails open.
 */
export async function previewIpLimitReached(supabase: any, ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('report_type', 'preview')
    .eq('ip_hash', ipHash)
    .gte('generated_at', since);
  if (error) throw error;
  return typeof count === 'number' && count >= PREVIEW_IP_DAILY_LIMIT;
}
