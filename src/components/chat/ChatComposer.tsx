import React, { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface Props {
  value:        string;
  onChange:     (v: string) => void;
  onSubmit:     () => void;
  disabled:     boolean;
  placeholder?: string;
}

/**
 * Chat message composer: auto-grows textarea, Enter sends, Shift+Enter newline.
 */
export function ChatComposer({ value, onChange, onSubmit, disabled, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea up to a maximum height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t border-gray-100 bg-white">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? 'Ask a question…'}
        aria-label="Chat message"
        className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 disabled:opacity-50 min-h-[40px] max-h-[140px] overflow-y-auto leading-relaxed"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {disabled ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        ) : (
          <Send className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
