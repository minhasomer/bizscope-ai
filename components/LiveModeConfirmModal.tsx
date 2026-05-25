import React from 'react';
import { Zap, X, Key, AlertTriangle } from 'lucide-react';

// ─── Props ───────────────────────────────────────────────────────────────────

interface LiveModeConfirmModalProps {
  /** Controls visibility. */
  isOpen: boolean;
  /**
   * Which kind of report is about to be generated.
   * Drives the label shown in the modal body.
   */
  reportType: 'standard' | 'regional';
  /** Business type string entered by the user. */
  businessType: string;
  /** Location string entered by the user. */
  location: string;
  /** Called when the user confirms they want to proceed. */
  onConfirm: () => void;
  /** Called when the user cancels, or clicks the backdrop. */
  onCancel: () => void;
}

// ─── Label helpers ────────────────────────────────────────────────────────────

const REPORT_LABELS: Record<'standard' | 'regional', string> = {
  standard: 'Standard Viability Report',
  regional: 'Regional Intelligence Analysis',
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * LiveModeConfirmModal
 *
 * A cost-protection gate shown to Admin / developer users in Live Mode before
 * any network request that hits the Gemini API.  Normal users never see this —
 * the caller (App.tsx or ReportDisplay.tsx) is responsible for checking
 * `!isDemoMode && isAdmin(user?.role)` before rendering with isOpen=true.
 *
 * Informs the user:
 *  - which report type they are about to generate
 *  - that real API credits will be consumed
 *  - that GEMINI_API_KEY must be configured server-side
 * Offers a clear Confirm and Cancel path.
 */
export const LiveModeConfirmModal: React.FC<LiveModeConfirmModalProps> = ({
  isOpen,
  reportType,
  businessType,
  location,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const reportLabel = REPORT_LABELS[reportType];

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-confirm-title"
    >
      {/* Layout shell */}
      <div className="flex items-center justify-center min-h-screen px-4 pb-20 text-center sm:p-0">

        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-[2px] transition-opacity cursor-pointer"
          onClick={onCancel}
        />
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Card */}
        <div className="relative inline-block align-bottom bg-white rounded-2xl text-left shadow-2xl border border-orange-150 sm:my-8 sm:align-middle sm:max-w-md sm:w-full overflow-hidden animate-fade-in">

          {/* Header */}
          <div className="bg-orange-50 border-b border-orange-100 px-5 py-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-xl border border-orange-200 shrink-0">
              <Zap className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="text-sm font-black text-gray-900 uppercase tracking-wide"
                id="live-confirm-title"
              >
                Live API Request
              </h3>
              <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest">
                Admin preview · real API credits will be consumed
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-orange-100 rounded-lg transition-colors cursor-pointer shrink-0"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Request summary */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-2.5">
            <div className="flex items-baseline justify-between text-xs gap-4">
              <span className="font-bold text-gray-400 uppercase tracking-wider shrink-0">Report type</span>
              <span className="font-black text-gray-900 text-right">{reportLabel}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs gap-4">
              <span className="font-bold text-gray-400 uppercase tracking-wider shrink-0">Business</span>
              <span
                className="font-black text-gray-900 text-right max-w-[65%] truncate"
                title={businessType}
              >
                {businessType || '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs gap-4">
              <span className="font-bold text-gray-400 uppercase tracking-wider shrink-0">Location</span>
              <span
                className="font-black text-gray-900 text-right max-w-[65%] truncate"
                title={location}
              >
                {location || '—'}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              This will send a request to the Express backend which calls the{' '}
              <strong>Gemini AI API</strong> and may consume API credits. Results are cached
              for 30 days to avoid duplicate charges on the same business + location.
            </p>

            {/* API key requirement note */}
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
              <Key className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-px" />
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Requires{' '}
                <code className="font-mono bg-amber-100 border border-amber-200 px-1 py-0.5 rounded text-[10px]">
                  GEMINI_API_KEY
                </code>{' '}
                in your server-side{' '}
                <code className="font-mono bg-amber-100 border border-amber-200 px-1 py-0.5 rounded text-[10px]">
                  .env.local
                </code>
                . If missing, the request will fail with a 401 error and no credits will be
                charged.
              </p>
            </div>

            {/* Admin-only notice */}
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <AlertTriangle className="h-3 w-3 shrink-0 text-gray-300" />
              <span>This confirmation is only shown to Admin users and never to regular users.</span>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 flex justify-end items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 active:bg-orange-700 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5" />
              Generate Live Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
