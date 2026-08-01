import React from 'react';
import type { ChatMessage as ChatMessageType } from '../../types/chat';

interface Props {
  message: ChatMessageType;
  onCtaClick?: (path: string) => void;
}

/** Renders a single chat message bubble with optional redirect CTA. */
export function ChatMessage({ message, onCtaClick }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center mr-2 mt-0.5"
          aria-hidden="true"
        >
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      )}
      <div className="flex flex-col max-w-[85%] gap-1.5">
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-indigo-600 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }`}
        >
          {message.content.split('\n').map((line, i, arr) => (
            <React.Fragment key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>

        {/* CTA button for scope-redirect messages */}
        {!isUser && message.cta && (
          <button
            type="button"
            onClick={() => onCtaClick?.(message.cta!.path)}
            className="self-start text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl px-3 py-1.5 transition-colors font-medium"
          >
            {message.cta.label} →
          </button>
        )}
      </div>
    </div>
  );
}
