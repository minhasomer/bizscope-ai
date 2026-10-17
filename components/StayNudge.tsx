import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { trackEvent } from '../src/utils/analytics';
import { chatEnabled } from '../src/config/appConfig';

/**
 * Bounce-reduction prompts for anonymous visitors who still have their free preview:
 *  - Sticky bottom bar on small screens, shown once the visitor scrolls past the
 *    form, that jumps back to it.
 *  - "Before you go" nudge, shown once per session: on desktop when the pointer
 *    leaves through the top of the window (exit intent); on touch devices after
 *    INACTIVITY_MS without the visitor touching the form (most mobile traffic is
 *    in Meta's in-app browser, where there is no exit-intent signal).
 * Both stay hidden once the visitor engages with the form.
 */

const INACTIVITY_MS = 12_000;
const EXIT_INTENT_MIN_MS = 3_000;
const NUDGE_SHOWN_KEY = 'bizscope_stay_nudge_shown';
const BAR_DISMISSED_KEY = 'bizscope_sticky_cta_dismissed';
const EXAMPLES = ['Coffee Shop', 'Med Spa', 'HVAC Company', 'Daycare Center'];

function sessionFlag(key: string): boolean {
  try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
}
function setSessionFlag(key: string): void {
  try { sessionStorage.setItem(key, '1'); } catch { /* storage unavailable */ }
}

interface StayNudgeProps {
  /** Anonymous visitor with a free preview left, not currently loading/viewing results. */
  enabled: boolean;
  /** The hero form — used to detect engagement and to scroll back to. */
  formRef: React.RefObject<HTMLFormElement | null>;
  /** Runs the free preview through the hero's normal submit path. */
  onRun: (businessType: string, location: string) => void | Promise<void>;
  /** Scrolls to the hero form and focuses the business input. */
  onEnterOwnIdea: () => void;
}

export const StayNudge: React.FC<StayNudgeProps> = ({ enabled, formRef, onRun, onEnterOwnIdea }) => {
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [barDismissed, setBarDismissed] = useState(() => sessionFlag(BAR_DISMISSED_KEY));
  const [selected, setSelected] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const cityRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Engagement: any focus inside the hero form means the visitor is trying the tool.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onFocusIn = () => setEngaged(true);
    form.addEventListener('focusin', onFocusIn);
    return () => form.removeEventListener('focusin', onFocusIn);
  }, [formRef]);

  // Nudge triggers.
  useEffect(() => {
    if (!enabled || engaged || nudgeOpen || sessionFlag(NUDGE_SHOWN_KEY)) return;

    const show = (trigger: 'exit_intent' | 'inactivity') => {
      if (sessionFlag(NUDGE_SHOWN_KEY)) return;
      setSessionFlag(NUDGE_SHOWN_KEY);
      setNudgeOpen(true);
      trackEvent('stay_nudge_shown', { trigger });
    };

    const isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    if (isTouch) {
      const timer = window.setTimeout(() => show('inactivity'), INACTIVITY_MS);
      return () => window.clearTimeout(timer);
    }

    const mountedAt = Date.now();
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 0 && Date.now() - mountedAt >= EXIT_INTENT_MIN_MS) {
        show('exit_intent');
      }
    };
    document.addEventListener('mouseout', onMouseOut);
    return () => document.removeEventListener('mouseout', onMouseOut);
  }, [enabled, engaged, nudgeOpen]);

  // Sticky bar: visible after a little scrolling, while the form is off-screen.
  useEffect(() => {
    if (!enabled || barDismissed) { setBarVisible(false); return; }
    const update = () => {
      const rect = formRef.current?.getBoundingClientRect();
      const formOnScreen = !!rect && rect.bottom > 0 && rect.top < window.innerHeight;
      setBarVisible(!formOnScreen && window.scrollY > 120);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [enabled, barDismissed, formRef]);

  // Dialog: focus the first control and close on Escape.
  useEffect(() => {
    if (!nudgeOpen) return;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissNudge(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [nudgeOpen]);

  useEffect(() => {
    if (selected) cityRef.current?.focus();
  }, [selected]);

  // Close everything once the visitor starts a report or signs in.
  useEffect(() => {
    if (!enabled) setNudgeOpen(false);
  }, [enabled]);

  const dismissNudge = () => {
    setNudgeOpen(false);
    trackEvent('stay_nudge_dismissed');
  };

  const pickExample = (example: string) => {
    setSelected(example);
    trackEvent('stay_nudge_example_selected', { example });
  };

  const runReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !city.trim()) return;
    trackEvent('stay_nudge_submitted', { example: selected });
    setNudgeOpen(false);
    await onRun(selected, city.trim());
  };

  const enterOwnIdea = () => {
    setNudgeOpen(false);
    trackEvent('stay_nudge_own_idea');
    onEnterOwnIdea();
  };

  if (!enabled) return null;

  return (
    <>
      {barVisible && !nudgeOpen && (
        // When the floating chat button (bottom-6 right-6, h-14) is on, sit above it instead of under it.
        <div className={`md:hidden fixed bottom-0 inset-x-0 z-40 px-3 print:hidden ${chatEnabled ? 'pb-[88px]' : 'pb-3'}`}>
          <div className="flex items-center gap-2 bg-slate-900/95 backdrop-blur border border-white/10 rounded-2xl shadow-2xl pl-4 pr-2 py-2">
            <p className="flex-1 text-sm text-white font-semibold leading-tight">
              Your first report is free
              <span className="block text-xs text-slate-300 font-normal">No signup needed</span>
            </p>
            <button
              type="button"
              onClick={() => { trackEvent('sticky_cta_clicked'); onEnterOwnIdea(); }}
              className="flex items-center gap-1 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold rounded-xl"
            >
              Try it free <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => { setSessionFlag(BAR_DISMISSED_KEY); setBarDismissed(true); trackEvent('sticky_cta_dismissed'); }}
              className="p-2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {nudgeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 print:hidden"
          onClick={(e) => { if (e.target === e.currentTarget) dismissNudge(); }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stay-nudge-title"
            className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-8 sm:pb-6"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={dismissNudge}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 id="stay-nudge-title" className="text-xl font-extrabold text-gray-900 pr-8">
              Before you go — try it free
            </h2>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Get a free viability report for a business idea in your area — costs, competition and a clear
              recommendation. No account needed.
            </p>

            <form onSubmit={runReport} className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Pick an idea to check</p>
              <div className="grid grid-cols-2 gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    aria-pressed={selected === example}
                    onClick={() => pickExample(example)}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                      selected === example
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-200 text-gray-800 hover:border-indigo-400'
                    }`}
                  >
                    {example}
                  </button>
                ))}
              </div>

              {selected && (
                <div className="mt-4" data-clarity-mask="True">
                  <label htmlFor="stay-nudge-city" className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                    Where would you open it?
                  </label>
                  <input
                    id="stay-nudge-city"
                    ref={cityRef}
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City, State or ZIP"
                    autoComplete="address-level2"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="submit"
                    disabled={!city.trim()}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl"
                  >
                    Run my free report <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </form>

            <div className="mt-4 flex items-center justify-between text-sm">
              <button type="button" onClick={enterOwnIdea} className="font-semibold text-indigo-600 hover:underline">
                Enter my own idea
              </button>
              <button type="button" onClick={dismissNudge} className="text-gray-500 hover:text-gray-700">
                No thanks
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
