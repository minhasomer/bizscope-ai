import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { BizScopeChatPanel } from './BizScopeChatPanel';
import type { PageContext } from '../../types/chat';

interface Props {
  pageContext?: PageContext;
}

/**
 * Floating chat entry point — renders as a fixed button in the lower-right corner.
 * Clicking opens the BizScopeChatPanel.
 * Only rendered when VITE_BIZSCOPE_CHAT_ENABLED=true.
 */
export function BizScopeChatButton({ pageContext }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating button — always visible when feature is enabled */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open BizScope Assistant"
          title="BizScope Assistant"
          className="
            fixed bottom-6 right-6 z-40
            w-14 h-14 rounded-full
            bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
            text-white shadow-lg shadow-indigo-200/60
            flex items-center justify-center
            transition-all duration-150
            focus:outline-none focus:ring-4 focus:ring-indigo-300
          "
        >
          <MessageCircle className="w-6 h-6" aria-hidden="true" />
        </button>
      )}

      {/* Chat panel — rendered in a portal-like fixed overlay */}
      {isOpen && (
        <BizScopeChatPanel
          onClose={() => setIsOpen(false)}
          pageContext={pageContext}
        />
      )}
    </>
  );
}
