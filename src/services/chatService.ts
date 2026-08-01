/**
 * BizScope Assistant — Client API Service
 *
 * Wraps the POST /api/chat endpoint.
 * Never calls Gemini directly — all AI work happens server-side.
 */

import type { ChatMessage, PageContext } from '../types/chat';
import { supabase } from '../../services/supabaseClient';

// Re-export for convenience
export type { ChatMessage, PageContext };

export interface ChatApiResponse {
  reply: string;
}

export interface ChatApiError {
  error:  string;
  code?:  string;
}

/**
 * Send a conversation to the server and receive the assistant reply.
 * Attaches the Supabase JWT when the user is authenticated.
 */
export async function sendChatMessage(
  messages:    ChatMessage[],
  pageContext?: PageContext,
): Promise<string> {
  // Build the payload — strip client-only fields (id, timestamp)
  const payload = {
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    pageContext: pageContext ?? {},
  };

  // Attach auth token if available
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
    const msg = (data as ChatApiError).error ?? `Request failed (${res.status}).`;
    throw new Error(msg);
  }

  const reply = (data as ChatApiResponse).reply;
  if (!reply) throw new Error('Empty response from assistant.');
  return reply;
}
