import React, { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { AuthService } from '../services/authService';

interface ResetPasswordPageProps {
  onSuccess: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await AuthService.updatePassword(password);
      setDone(true);
      setTimeout(onSuccess, 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 animate-fade-in">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400" />

          <div className="p-8">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                <Lock className="w-5 h-5 text-indigo-600" />
              </div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Set New Password</h1>
              <p className="text-xs text-gray-400 mt-1.5 max-w-xs leading-relaxed">
                Choose a strong password for your BizScope account.
              </p>
            </div>

            {/* Success state */}
            {done ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
                <p className="text-sm font-bold text-gray-800">Password updated successfully!</p>
                <p className="text-xs text-gray-400">Redirecting you to the dashboard…</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2 p-3.5 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-700 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                {/* New password */}
                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      disabled={loading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="block w-full pl-10 pr-10 py-3 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-gray-900 bg-white disabled:opacity-60"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      disabled={loading}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="block w-full pl-10 pr-10 py-3 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-gray-900 bg-white disabled:opacity-60"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-xs font-black uppercase text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {loading ? 'Saving…' : 'Save New Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
