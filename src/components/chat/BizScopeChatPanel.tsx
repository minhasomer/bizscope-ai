import React, { useEffect, useRef, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatComposer } from './ChatComposer';
import { useBizScopeChat, STARTER_QUESTIONS } from '../../hooks/useBizScopeChat';
import type { PageContext } from '../../types/chat';

interface Props {
  onClose:      () => void;
  pageContext?: PageContext;
}

/**
 * BizScope Assistant chat panel.
 * Renders as a sliding panel from the bottom-right on desktop,
 * and a near-full-screen drawer on mobile.
 */
export function BizScopeChatPanel({ onClose, pageContext }: Props) {
  const {
    messages,
    status,
    errorMessage,
    remainingMessages,
    conversationLimitReached,
    sendMessage,
    clearChat,
  } = useBizScopeChat();

  const [draft, setDraft]     = useState('');
  const bottomRef             = useRef<HTMLDivElement>(null);
  const firstFocusRef         = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    firstFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleSubmit() {
    const text = draft.trim();
    if (!text || status === 'loading') return;
    setDraft('');
    sendMessage(text, pageContext);
  }

  function handleStarterQuestion(q: string) {
    if (status === 'loading') return;
    sendMessage(q, pageContext);
  }

  // Navigate within the SPA by dispatching a hashchange / custom event.
  // Falls back to window.location if the app router isn't listening.
  function handleCtaClick(path: string) {
    onClose();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('bizscope:navigate', { detail: { path } }));
    }, 150);
  }

  const showStarters   = messages.length <= 1 && status !== 'loading';
  const dailyExhausted = remainingMessages === 0;
  const composerLocked = dailyExhausted || conversationLimitReached;

  // Remaining-messages label (shown only when close to limit)
  const showRemaining = remainingMessages !== null && remainingMessages <= 5 && !dailyExhausted;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end sm:items-end sm:justify-end pointer-events-none"
      aria-hidden="false"
    >
      {/* Mobile backdrop */}
      <div
        className="absolute inset-0 bg-black/40 sm:hidden pointer-events-auto"
        onClick={onClose}
        aria-label="Close chat"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="BizScope Assistant"
        className={`
          pointer-events-auto relative
          w-full sm:w-[380px]
          h-[85svh] sm:h-[560px]
          max-h-[85svh] sm:max-h-[560px]
          mb-0 sm:mb-24 sm:mr-6
          bg-white rounded-t-2xl sm:rounded-2xl
          shadow-2xl border border-gray-150
          flex flex-col overflow-hidden
          transition-transform duration-200
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-t-2xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white leading-tight truncate">BizScope Assistant</div>
              <div className="text-[10px] text-indigo-200 leading-tight">Ask questions about BizScope</div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Remaining-messages indicator (subtle, shown only when low) */}
            {showRemaining && (
              <span className="text-[10px] text-indigo-200 mr-1">
                {remainingMessages} left today
              </span>
            )}
            <button
              type="button"
              onClick={clearChat}
              title="Clear conversation"
              aria-label="Clear conversation"
              className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              ref={firstFocusRef}
              type="button"
              onClick={onClose}
              title="Close chat"
              aria-label="Close chat"
              className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-4 pt-4 pb-2"
          aria-live="polite"
          aria-label="Conversation"
        >
          {messages.map(msg => (
            <React.Fragment key={msg.id}>
              <ChatMessage message={msg} onCtaClick={handleCtaClick} />
            </React.Fragment>
          ))}

          {/* Loading indicator */}
          {status === 'loading' && (
            <div className="flex justify-start mb-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center mr-2 mt-0.5">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center" aria-label="Assistant is typing">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Non-limit error state */}
          {status === 'error' && errorMessage && (
            <div className="mx-1 mb-3 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600 leading-relaxed" role="alert">
              {errorMessage}
            </div>
          )}

          {/* Conversation limit notice */}
          {conversationLimitReached && (
            <div className="mx-1 mb-3 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700 leading-relaxed">
              Conversation limit reached. Start a new chat to continue — your daily allowance is preserved.
            </div>
          )}

          {/* Daily limit exhausted notice */}
          {dailyExhausted && !conversationLimitReached && (
            <div className="mx-1 mb-3 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 leading-relaxed">
              Today's limit reached. Your allowance resets at midnight UTC.
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Starter questions */}
        {showStarters && (
          <div className="px-4 pb-3 flex flex-col gap-1.5">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">
              Suggested questions
            </p>
            {STARTER_QUESTIONS.map(q => (
              <button
                key={q}
                type="button"
                onClick={() => handleStarterQuestion(q)}
                className="text-left text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl px-3 py-2 transition-colors leading-snug border border-indigo-100"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          disabled={status === 'loading' || composerLocked}
          placeholder={
            conversationLimitReached ? 'Start a new chat to continue…' :
            dailyExhausted           ? 'Daily limit reached…' :
                                       'Ask about BizScope…'
          }
        />
      </div>
    </div>
  );
}
