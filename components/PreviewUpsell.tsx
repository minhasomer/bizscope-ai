import React, { useEffect, useRef } from 'react';
import { X, Check, ArrowRight } from 'lucide-react';
import { trackEvent } from '../src/utils/analytics';

/**
 * Sign-up prompt shown right after an anonymous visitor's free preview report
 * loads, when interest is highest. Shown at most once per session; anonymous
 * visitors only get one preview (bizscope_anonymous_preview_v1 never resets),
 * so in practice it shows once per browser. Signed-in users never see it.
 *
 * The list must match what a free Explorer account really includes
 * (PRICING_CARDS in src/config/plans.ts). The upgrade offer comes after sign-in.
 */

export const PREVIEW_UPSELL_SHOWN_KEY = 'bizscope_preview_upsell_shown';

const FREE_ACCOUNT_ITEMS = [
  '3 free reports every month',
  'Startup cost range for your idea',
  'Viability score breakdown',
  'Market trends snapshot',
];

interface PreviewUpsellProps {
  onClose: () => void;
  onSignUp: () => void;
}

export const PreviewUpsell: React.FC<PreviewUpsellProps> = ({ onClose, onSignUp }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the main button and close on Escape.
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('[data-primary]')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const dismiss = () => {
    trackEvent('preview_upsell_dismissed');
    onClose();
  };

  const signUp = () => {
    trackEvent('preview_upsell_signup_clicked');
    onClose();
    onSignUp();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 print:hidden"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-upsell-title"
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-8 sm:pb-6"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={dismiss}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 id="preview-upsell-title" className="text-xl font-extrabold text-gray-900 pr-8">
          You’ve seen the preview. Here’s what a free account adds:
        </h2>
        <ul className="mt-4 space-y-2.5">
          {FREE_ACCOUNT_ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-emerald-700" />
              </span>
              {item}
            </li>
          ))}
        </ul>

        <button
          type="button"
          data-primary
          onClick={signUp}
          className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-500 hover:bg-orange-400 text-slate-950 text-sm font-bold rounded-xl"
        >
          Create Free Account <ArrowRight className="w-4 h-4" />
        </button>
        <p className="mt-2 text-center text-xs text-gray-500">No credit card needed.</p>
      </div>
    </div>
  );
};
