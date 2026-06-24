import React, { useState } from 'react';
import { ProfileService } from '../services/profileService';
import { UserProfile } from '../services/authService';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface TosGateProps {
  user: UserProfile;
  onAccepted: (timestamp: string) => void;
}

export const TosGate: React.FC<TosGateProps> = ({ user, onAccepted }) => {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!accepted || loading) return;
    setLoading(true);
    setError(null);
    try {
      await ProfileService.acceptTos(user.id);
      const timestamp = new Date().toISOString();
      try {
        localStorage.setItem(`bizscope_user_tos_at_${user.email}`, timestamp);
      } catch { /* ignore */ }
      onAccepted(timestamp);
    } catch {
      setError('Could not save your acceptance. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-200 shadow-xl p-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full pointer-events-none -mr-4 -mt-4 opacity-50" />

        {/* Header */}
        <div className="text-center mb-8 relative z-10">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src="/logo.svg" alt="BizScope" className="h-9 w-9 shrink-0" />
            <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
              BizScope<span className="text-[11px] font-semibold text-slate-400 ml-1 normal-case tracking-wide">AI</span>
            </h2>
          </div>
          <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-widest">Terms of Service</p>
        </div>

        <div className="space-y-5 relative z-10">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3.5 text-xs text-blue-800 leading-relaxed">
            Before continuing, please review and accept our Terms of Service and Privacy Policy.
          </div>

          <div className="text-xs text-gray-500 leading-relaxed space-y-1.5">
            <p className="font-semibold text-gray-700">By accepting, you understand that:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>BizScope reports are AI-generated estimates for research purposes only.</li>
              <li>Reports do not constitute financial, legal, or investment advice.</li>
              <li>Results should be independently verified before any investment decision.</li>
            </ul>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => window.open(`${window.location.origin}?view=terms`, '_blank')}
              className="text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
            >
              Terms of Service
            </button>
            <span className="text-gray-300">·</span>
            <button
              type="button"
              onClick={() => window.open(`${window.location.origin}?view=privacy`, '_blank')}
              className="text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
            >
              Privacy Policy
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-start gap-2.5 py-1">
            <input
              id="tos-gate-checkbox"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              disabled={loading}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
            <label
              htmlFor="tos-gate-checkbox"
              className="text-[11px] text-gray-500 leading-relaxed cursor-pointer select-none"
            >
              I have read and agree to the Terms of Service and Privacy Policy.
            </label>
          </div>

          <button
            type="button"
            onClick={handleAccept}
            disabled={!accepted || loading}
            className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-3.5 rounded-xl text-xs font-black uppercase text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md disabled:opacity-55 disabled:cursor-not-allowed tracking-wider cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving…
              </span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Accept &amp; Continue
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-gray-400">
            Signed in as {user.email}
          </p>
        </div>
      </div>
    </div>
  );
};
