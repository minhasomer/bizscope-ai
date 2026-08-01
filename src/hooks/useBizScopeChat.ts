/**
 * useBizScopeChat — Stateful hook for the BizScope Assistant.
 *
 * Manages conversation, loading state, daily-limit tracking, and session persistence.
 * Conversation stored in sessionStorage: persists across in-tab navigation,
 * clears when the tab closes. Not stored in localStorage.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, PageContext, ChatStatus } from '../types/chat';
import { sendChatMessage, ChatError } from '../services/chatService';

const SESSION_KEY    = 'bizscope_chat_history';
const SESSION_REM    = 'bizscope_chat_remaining';
const MAX_MESSAGES   = 24; // keep last 24 messages in state (12 turns)

// ── Starter questions ─────────────────────────────────────────────────────────

export const STARTER_QUESTIONS = [
  'How does a Business Viability Report work?',
  'What is Market Gap Discovery?',
  'What reports are included in my plan?',
  'How do I refresh a saved analysis?',
] as const;

// ── Welcome message ───────────────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  id:        'welcome',
  role:      'assistant',
  content:   "Hi! I'm the BizScope Assistant. I can help you understand reports, Market Gap Discovery, plans, account features, and how to use BizScope. What would you like to know?",
  timestamp: Date.now(),
};

// ── Session storage helpers ───────────────────────────────────────────────────

function loadHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [WELCOME_MESSAGE];
    return parsed as ChatMessage[];
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function saveHistory(messages: ChatMessage[]): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  } catch { /* storage unavailable */ }
}

function loadRemaining(): number | null {
  try {
    const raw = sessionStorage.getItem(SESSION_REM);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  } catch { return null; }
}

function saveRemaining(n: number | null): void {
  try {
    if (n === null) sessionStorage.removeItem(SESSION_REM);
    else sessionStorage.setItem(SESSION_REM, String(n));
  } catch { /* ok */ }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseBizScopeChatReturn {
  messages:                ChatMessage[];
  status:                  ChatStatus;
  errorMessage:            string | null;
  remainingMessages:       number | null;   // null = unlimited; 0 = exhausted
  conversationLimitReached: boolean;
  sendMessage:             (text: string, pageContext?: PageContext) => Promise<void>;
  clearChat:               () => void;
}

export function useBizScopeChat(): UseBizScopeChatReturn {
  const [messages, setMessages]           = useState<ChatMessage[]>(() => loadHistory());
  const [status, setStatus]               = useState<ChatStatus>('idle');
  const [errorMessage, setError]          = useState<string | null>(null);
  const [remainingMessages, setRemaining] = useState<number | null>(() => loadRemaining());
  const [convLimitReached, setConvLimit]  = useState(false);

  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => { saveHistory(messages); }, [messages]);
  useEffect(() => { saveRemaining(remainingMessages); }, [remainingMessages]);

  const sendMessage = useCallback(async (text: string, pageContext?: PageContext) => {
    const trimmed = text.trim();
    if (!trimmed || status === 'loading') return;
    if (remainingMessages === 0) return; // daily limit exhausted — don't call API
    if (convLimitReached) return;        // conversation limit — start a new chat

    const userMsg: ChatMessage = {
      id:        `u-${Date.now()}`,
      role:      'user',
      content:   trimmed,
      timestamp: Date.now(),
    };

    const withUser = [...messagesRef.current, userMsg].slice(-MAX_MESSAGES);
    setMessages(withUser);
    setStatus('loading');
    setError(null);

    try {
      const apiMessages = withUser.filter(m => m.id !== 'welcome');
      const result = await sendChatMessage(apiMessages, pageContext);

      // Update remaining count from server response
      if (typeof result.remainingMessages === 'number') {
        setRemaining(result.remainingMessages);
      }

      const assistantMsg: ChatMessage = {
        id:          `a-${Date.now()}`,
        role:        'assistant',
        content:     result.reply,
        timestamp:   Date.now(),
        redirected:  result.redirected ?? false,
        cta:         result.cta,
      };

      setMessages(prev => [...prev, assistantMsg].slice(-MAX_MESSAGES));
      setStatus('idle');
    } catch (err: unknown) {
      if (err instanceof ChatError) {
        if (err.code === 'DAILY_LIMIT_REACHED') {
          setRemaining(0);
          setError(err.message);
          setStatus('idle'); // not an error state — just exhausted
          // Add a final assistant message explaining the limit
          const limitMsg: ChatMessage = {
            id:        `a-limit-${Date.now()}`,
            role:      'assistant',
            content:   err.message,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, limitMsg].slice(-MAX_MESSAGES));
          return;
        }
        if (err.code === 'CONVERSATION_LIMIT_REACHED') {
          setConvLimit(true);
          const limitMsg: ChatMessage = {
            id:        `a-conv-${Date.now()}`,
            role:      'assistant',
            content:   'This conversation has reached its maximum length. Please start a new chat to continue.',
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, limitMsg].slice(-MAX_MESSAGES));
          setStatus('idle');
          return;
        }
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
      setStatus('error');
    }
  }, [status, remainingMessages, convLimitReached]);

  const clearChat = useCallback(() => {
    const fresh = [{ ...WELCOME_MESSAGE, timestamp: Date.now() }];
    setMessages(fresh);
    setStatus('idle');
    setError(null);
    setConvLimit(false);
    // Do NOT reset remainingMessages — daily limit persists across conversations
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch { /* ok */ }
  }, []);

  return {
    messages,
    status,
    errorMessage,
    remainingMessages,
    conversationLimitReached: convLimitReached,
    sendMessage,
    clearChat,
  };
}
