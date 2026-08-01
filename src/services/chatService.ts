/**
 * BizScope Assistant — Client API Service
 *
 * Wraps the POST /api/chat endpoint.
 * Never calls Gemini directly — all AI work happens server-side.
 */

import type { ChatMessage, PageContext } from '../types/chat';
import { supabase } from '../../services/supabaseClient';

export type { ChatMessage, PageContext };

export interface ChatResult {
  reply:             string;
  remainingMessages?: number;   // undefined = unlimited; 0 = exhausted
  dailyLimit?:        number;
  redirected?:        boolean;  // true if this was a scope redirect
  cta?:               { label: string; path: string };
}

export interface ChatApiError {
  error: string;
  code?: string;
  remainingMessages?: number;
  dailyLimit?: number;
}

/**
 * Tagged error that preserves the server error code for the hook layer.
 */
export class ChatError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly remainingMessages?: number,
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

/**
 * Send a conversation to the server and receive the full response.
 * Attaches the Supabase JWT when authenticated.
 */
export async function sendChatMessage(
  messages:    ChatMessage[],
  pageContext?: PageContext,
): Promise<ChatResult> {
  const payload = {
    messages:    messages.map(m => ({ role: m.role, content: m.content })),
    pageContext:  pageContext ?? {},
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch {
    // No session — proceed as anonymous
  }

  const res = await fetch('/api/chat', {
    method:  'POST',
    headers,
    body:    JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({ error: 'Invalid server response.' })) as any;

  if (!res.ok) {
    const errData = data as ChatApiError;
    throw new ChatError(
      errData.error ?? `Request failed (${res.status}).`,
      errData.code,
      errData.remainingMessages,
    );
  }

  if (!data.reply) throw new ChatError('Empty response from assistant.');

  return {
    reply:             data.reply,
    remainingMessages: data.remainingMessages,
    dailyLimit:        data.dailyLimit,
    redirected:        data.redirected ?? false,
    cta:               data.cta,
  };
}
