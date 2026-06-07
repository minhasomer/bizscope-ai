import type { IncomingMessage, ServerResponse } from 'http';
import { Resend } from 'resend';

export const maxDuration = 15;

// ─── Response helper ──────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Allows at most MAX_REQUESTS per IP within WINDOW_MS.
// Good enough for a low-traffic beta; resets on cold-start (stateless).

const WINDOW_MS    = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5;               // per IP per window
const ipLog        = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now  = Date.now();
  const entry = ipLog.get(ip);
  if (!entry || now > entry.resetAt) {
    ipLog.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count += 1;
  return false;
}

// ─── Field sanitiser ──────────────────────────────────────────────────────────

function sanitize(s: unknown, maxLen = 2000): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, maxLen);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse,
): Promise<void> {
  // Only POST
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  // CORS preflight (not needed for same-origin Vercel, but defensive)
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ── Rate limit by IP ──────────────────────────────────────────────────────
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    (req as any).socket?.remoteAddress ||
    'unknown';

  if (isRateLimited(ip)) {
    return json(res, 429, {
      error: 'Too many contact requests from this address. Please wait an hour and try again.',
      code: 'RATE_LIMITED',
    });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = req.body ?? {};
  const name    = sanitize(body.name,    100);
  const email   = sanitize(body.email,   200);
  const message = sanitize(body.message, 3000);
  const subject = sanitize(body.subject, 200);

  // ── Server-side validation ────────────────────────────────────────────────
  const errors: Record<string, string> = {};

  if (!name)   errors.name    = 'Name is required.';
  if (!email)  errors.email   = 'Email address is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
               errors.email   = 'Enter a valid email address.';
  if (!message || message.length < 10)
               errors.message = 'Message must be at least 10 characters.';

  if (Object.keys(errors).length > 0) {
    return json(res, 422, { error: 'Validation failed.', errors });
  }

  // ── Check env vars ────────────────────────────────────────────────────────
  const apiKey   = process.env.RESEND_API_KEY;
  const toEmail  = process.env.CONTACT_TO_EMAIL;
  const fromAddr = process.env.CONTACT_FROM_ADDRESS || 'BizScope Contact <contact@bizscope.ai>';

  if (!apiKey || !toEmail) {
    console.error('[contact] Missing RESEND_API_KEY or CONTACT_TO_EMAIL env vars');
    return json(res, 500, {
      error: 'Email service is not configured. Please try again later.',
      code: 'CONFIG_ERROR',
    });
  }

  // ── Send via Resend ───────────────────────────────────────────────────────
  try {
    const resend = new Resend(apiKey);
    const displaySubject = subject
      ? `[BizScope Contact] ${subject}`
      : `[BizScope Contact] Message from ${name}`;

    const { error: sendError } = await resend.emails.send({
      from:    fromAddr,
      to:      [toEmail],
      replyTo: email,
      subject: displaySubject,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
          <div style="background:#4f46e5;padding:24px 32px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800">BizScope — New Contact Message</h1>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
              <tr>
                <td style="padding:8px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;width:90px;vertical-align:top">From</td>
                <td style="padding:8px 0;font-size:14px;color:#111827">${escapeHtml(name)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;vertical-align:top">Email</td>
                <td style="padding:8px 0;font-size:14px"><a href="mailto:${escapeHtml(email)}" style="color:#4f46e5">${escapeHtml(email)}</a></td>
              </tr>
              ${subject ? `<tr>
                <td style="padding:8px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;vertical-align:top">Subject</td>
                <td style="padding:8px 0;font-size:14px;color:#111827">${escapeHtml(subject)}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:8px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;vertical-align:top">Sent</td>
                <td style="padding:8px 0;font-size:14px;color:#111827">${new Date().toUTCString()}</td>
              </tr>
            </table>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;font-size:14px;line-height:1.7;white-space:pre-wrap;color:#374151">${escapeHtml(message)}</div>
            <p style="margin-top:24px;font-size:12px;color:#9ca3af">Reply directly to this email to respond to ${escapeHtml(name)}.</p>
          </div>
        </div>
      `,
      text: `BizScope — New Contact Message\n\nFrom: ${name}\nEmail: ${email}${subject ? `\nSubject: ${subject}` : ''}\nSent: ${new Date().toUTCString()}\n\n${message}`,
    });

    if (sendError) {
      console.error('[contact] Resend error:', sendError);
      return json(res, 502, {
        error: 'Failed to send your message. Please try again.',
        code: 'SEND_ERROR',
      });
    }

    console.log(`[contact] Message sent — from=${email} ip=${ip}`);
    return json(res, 200, { success: true });

  } catch (err: unknown) {
    console.error('[contact] Unexpected error:', err);
    return json(res, 500, {
      error: 'An unexpected error occurred. Please try again.',
      code: 'INTERNAL_ERROR',
    });
  }
}

// ─── HTML escape (no dependency needed) ───────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}
