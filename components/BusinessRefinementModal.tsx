import React, { useState, useEffect } from 'react';
import type { RefinementOption } from '../src/utils/refinementUtils';

interface BusinessRefinementModalProps {
  originalConcept: string;
  location: string;
  question: string;
  options: RefinementOption[];
  onSelect: (concept: string) => void;
  onKeepGeneral: () => void;
  onDismiss: () => void;
}

export const BusinessRefinementModal: React.FC<BusinessRefinementModalProps> = ({
  originalConcept,
  location,
  question,
  options,
  onSelect,
  onKeepGeneral,
  onDismiss,
}) => {
  const [customConcept, setCustomConcept] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Escape key dismisses the modal without running any analysis.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customConcept.trim();
    if (trimmed) onSelect(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#0f1629] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/10">
          {/* X close button */}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">
            Refine Your Concept
          </p>
          <h2 className="text-lg font-extrabold text-white leading-snug">
            {question}
          </h2>
          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
            A more specific concept helps BizScope identify more relevant competitors, customers,
            and market conditions in{' '}
            <span className="text-slate-300 font-medium">{location}</span>.
          </p>
        </div>

        {/* Options */}
        <div className="px-6 py-4 space-y-2 max-h-72 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              className="w-full text-left px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-indigo-600/30 border border-white/10 hover:border-indigo-500/50 text-sm text-slate-200 font-medium transition-all cursor-pointer group"
            >
              <span className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full border-2 border-slate-500 group-hover:border-indigo-400 shrink-0 transition-colors" />
                {opt.label}
              </span>
            </button>
          ))}

          {/* Other option */}
          {!showCustomInput ? (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="w-full text-left px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-sm text-slate-400 hover:text-slate-200 font-medium transition-all cursor-pointer group"
            >
              <span className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full border-2 border-slate-600 group-hover:border-slate-400 shrink-0 transition-colors" />
                Other — specify my own concept
              </span>
            </button>
          ) : (
            <form onSubmit={handleCustomSubmit} className="px-1">
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  autoFocus
                  value={customConcept}
                  onChange={(e) => setCustomConcept(e.target.value)}
                  placeholder={`e.g., Specialty ${originalConcept.toLowerCase()}`}
                  maxLength={120}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white/95 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 text-sm"
                />
                <button
                  type="submit"
                  disabled={!customConcept.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Use
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={onKeepGeneral}
            className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 hover:border-white/25 text-slate-300 hover:text-white text-sm font-semibold transition-all cursor-pointer"
          >
            Keep it general — analyze "{originalConcept}"
          </button>
        </div>
      </div>
    </div>
  );
};
