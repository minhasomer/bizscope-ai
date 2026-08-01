/**
 * BizScope Assistant — Request Validation
 *
 * Validates and sanitizes the incoming /api/chat request body.
 * All user-supplied content is untrusted and must pass these guards.
 */

export const MAX_MESSAGE_LENGTH   = 2_000;   // characters per individual message
export const MAX_HISTORY_MESSAGES = 20;      // total messages in conversation history
export const MAX_ROUTE_LENGTH     = 200;
export const MAX_REPORT_TYPE_LEN  = 50;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PageContext {
  route?:      string;
  reportType?: string;
}

export interface ValidatedChatRequest {
  messages:    ChatMessage[];
  pageContext: PageContext;
}

export type ValidationResult =
  | { ok: true;  data: ValidatedChatRequest }
  | { ok: false; error: string; code: string };

function sanitizeString(s: unknown, maxLen: number): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, maxLen);
}

function isValidRole(r: unknown): r is 'user' | 'assistant' {
  return r === 'user' || r === 'assistant';
}

export function validateChatRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.', code: 'INVALID_BODY' };
  }

  const raw = body as Record<string, unknown>;

  // ── messages ──────────────────────────────────────────────────────────────
  if (!Array.isArray(raw.messages)) {
    return { ok: false, error: 'messages must be an array.', code: 'INVALID_MESSAGES' };
  }

  if (raw.messages.length === 0) {
    return { ok: false, error: 'messages array cannot be empty.', code: 'EMPTY_MESSAGES' };
  }

  // Silently truncate to the allowed history window (keep the most recent messages)
  const rawMessages = raw.messages.slice(-MAX_HISTORY_MESSAGES);

  const messages: ChatMessage[] = [];
  for (let i = 0; i < rawMessages.length; i++) {
    const m = rawMessages[i];
    if (!m || typeof m !== 'object') {
      return { ok: false, error: `messages[${i}] is not an object.`, code: 'INVALID_MESSAGE' };
    }
    const msg = m as Record<string, unknown>;

    if (!isValidRole(msg.role)) {
      return {
        ok: false,
        error: `messages[${i}].role must be "user" or "assistant".`,
        code: 'INVALID_ROLE',
      };
    }

    const content = sanitizeString(msg.content, MAX_MESSAGE_LENGTH);
    if (!content) {
      return {
        ok: false,
        error: `messages[${i}].content is missing or empty.`,
        code: 'EMPTY_CONTENT',
      };
    }

    messages.push({ role: msg.role, content });
  }

  // Last message must be from the user
  if (messages[messages.length - 1].role !== 'user') {
    return {
      ok: false,
      error: 'The last message must be from the user.',
      code: 'INVALID_TURN_ORDER',
    };
  }

  // ── pageContext (optional, untrusted) ─────────────────────────────────────
  const pc = raw.pageContext && typeof raw.pageContext === 'object'
    ? raw.pageContext as Record<string, unknown>
    : {};

  const pageContext: PageContext = {
    route:      sanitizeString(pc.route,      MAX_ROUTE_LENGTH)      || undefined,
    reportType: sanitizeString(pc.reportType, MAX_REPORT_TYPE_LEN)   || undefined,
  };

  return { ok: true, data: { messages, pageContext } };
}
