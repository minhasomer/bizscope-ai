/**
 * useBizScopeChat — Stateful hook for the BizScope Assistant.
 *
 * Manages the conversation, loading state, and session persistence.
 * Conversation is stored in sessionStorage: persists across in-tab navigation
 * but clears when the tab closes. Full chat content is NOT stored in localStorage.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, PageContext, ChatStatus } from '../types/chat';
import { sendChatMessage } from '../services/chatService';

const SESSION_KEY = 'bizscope_chat_history';
const MAX_MESSAGES = 40; // keep last 40 messages in state (20 turns)

// ─── Starter questions ────────────────────────────────────────────────────────

export const STARTER_QUESTIONS = [
  'How does a Business Viability Report work?',
  'What is Market Gap Discovery?',
  'What reports are included in my plan?',
  'How do I refresh a saved analysis?',
] as const;

// ─── Welcome message ──────────────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  id:        'welcome',
  role:      'assistant',
  content:   "Hi! I'm the BizScope Assistant. I can help you understand reports, Market Gap Discovery, plans, account features, and how to use BizScope. What would you like to know?",
  timestamp: Date.now(),
};

// ─── Session storage helpers ──────────────────────────────────────────────────

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
    // Persist only the most recent messages to avoid bloating sessionStorage
    const toSave = messages.slice(-MAX_MESSAGES);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(toSave));
  } catch {
    // sessionStorage quota exceeded or unavailable — silently skip
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseBizScopeChatReturn {
  messages:      ChatMessage[];
  status:        ChatStatus;
  errorMessage:  string | null;
  sendMessage:   (text: string, pageContext?: PageContext) => Promise<void>;
  clearChat:     () => void;
}

export function useBizScopeChat(): UseBizScopeChatReturn {
  const [messages, setMessages]     = useState<ChatMessage[]>(() => loadHistory());
  const [status, setStatus]         = useState<ChatStatus>('idle');
  const [errorMessage, setError]    = useState<string | null>(null);

  // Keep a ref so sendMessage closure always reads the latest messages
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Persist to sessionStorage whenever messages change
  useEffect(() => { saveHistory(messages); }, [messages]);

  const sendMessage = useCallback(async (text: string, pageContext?: PageContext) => {
    const trimmed = text.trim();
    if (!trimmed || status === 'loading') return;

    const userMsg: ChatMessage = {
      id:        `u-${Date.now()}`,
      role:      'user',
      content:   trimmed,
      timestamp: Date.now(),
    };

    // Append user message immediately
    const withUser = [...messagesRef.current, userMsg].slice(-MAX_MESSAGES);
    setMessages(withUser);
    setStatus('loading');
    setError(null);

    try {
      // Send only the non-welcome history to the API
      const apiMessages = withUser.filter(m => m.id !== 'welcome');
      const reply = await sendChatMessage(apiMessages, pageContext);

      const assistantMsg: ChatMessage = {
        id:        `a-${Date.now()}`,
        role:      'assistant',
        content:   reply,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg].slice(-MAX_MESSAGES));
      setStatus('idle');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
      setStatus('error');
    }
  }, [status]);

  const clearChat = useCallback(() => {
    const fresh = [{ ...WELCOME_MESSAGE, timestamp: Date.now() }];
    setMessages(fresh);
    setStatus('idle');
    setError(null);
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ok */ }
  }, []);

  return { messages, status, errorMessage, sendMessage, clearChat };
}
