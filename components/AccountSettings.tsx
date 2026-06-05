import React, { useState } from 'react';
import { UserProfile, AuthService } from '../services/authService';
import {
  User,
  Mail,
  Settings,
  CreditCard,
  LogOut,
  KeyRound,
  RefreshCw,
  Award,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { UsageTrackerService } from '../services/usageTrackerService';

interface AccountSettingsProps {
  user: UserProfile;
  onUpdateProfile: (newName: string) => Promise<void>;
  onSignOut: () => void;
  onNavigate: (page: string) => void;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  user,
  onUpdateProfile,
  onSignOut,
  onNavigate
}) => {
  const [fullName, setFullName] = useState(user.fullName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const usage = UsageTrackerService.getDetails(user.plan);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setIsUpdating(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await onUpdateProfile(fullName.trim());
      setSuccessMsg('Profile updated successfully.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update profile name.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordResetRequest = async () => {
    setIsUpdating(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await AuthService.resetPassword(user.email);
      setResetSent(true);
      setSuccessMsg('A password reset email has been sent to your inbox.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to send password reset email. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 print:hidden animate-fade-in" id="account-settings-page">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Left Side: Fast Action Summary Panel */}
        <div className="w-full md:w-1/3 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-150 shadow-sm text-center relative overflow-hidden">
            
            {/* Top banner accent based on subscription level */}
            <div className={`absolute top-0 left-0 right-0 h-2 ${
              user.plan === 'Enterprise' ? 'bg-indigo-600' :
              user.plan === 'Pro+' ? 'bg-purple-605' :
              user.plan === 'Pro' ? 'bg-blue-600' : 'bg-gray-300'
            }`}></div>

            <div className="mt-4 mb-4 relative inline-block">
              <img
                src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
                referrerPolicy="no-referrer"
                alt="Avatar"
                className="w-20 h-20 rounded-full mx-auto border-2 border-gray-100 shadow-sm object-cover"
              />
              <span className="absolute bottom-0 right-0 block h-4 w-4 rounded-full ring-2 ring-white bg-green-400" title="Session active"></span>
            </div>

            <h3 className="text-base font-black text-gray-900 tracking-tight leading-short truncate">
              {user.fullName || 'Active Venture Member'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">{user.email}</p>

            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider">
              <Award className="w-3.5 h-3.5" />
              <span>{user.plan} Account</span>
            </div>

            <div className="mt-8 border-t border-gray-100 pt-5 space-y-2">
              <button
                onClick={() => onNavigate('billing')}
                className="w-full inline-flex justify-center items-center gap-1.5 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 rounded-xl transition-all cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" /> Manage Billing
              </button>
              
              <button
                onClick={onSignOut}
                className="w-full inline-flex justify-center items-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 rounded-xl transition-all cursor-pointer"
                id="signout-button"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>

        </div>

        {/* Right Side: Account Settings configuration form */}
        <div className="flex-1 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-150 shadow-sm">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
              <Settings className="w-5 h-5 text-gray-500" />
              <h3 className="text-lg font-black text-gray-900 tracking-tight uppercase">Profile Settings</h3>
            </div>

            {successMsg && (
              <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-2xl text-xs flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-100 rounded-2xl text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateName} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider mb-1.5">Registered Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    disabled
                    className="block w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-xs text-gray-400 bg-gray-50 cursor-not-allowed outline-none"
                    value={user.email}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                  Your registered login identifier cannot be edited directly. Contact support to request credential migrations.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider mb-1.5">Display / Business Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    id="update-name-input"
                    disabled={isUpdating}
                    className="block w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-gray-900 bg-white"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="E.g. Omer Minhas"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdating || fullName.trim() === user.fullName}
                  className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl text-xs font-black uppercase text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isUpdating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>

          {/* Security Protocols (Forgot Code Simulation/Supabase Trigger) */}
          <div className="bg-white p-8 rounded-3xl border border-gray-150 shadow-sm">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
              <KeyRound className="w-5 h-5 text-gray-500" />
              <h3 className="text-lg font-black text-gray-900 tracking-tight uppercase">Security</h3>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="text-xs font-bold text-gray-850">Change Password</h4>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  We'll send a password reset link to <strong>{user.email}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePasswordResetRequest}
                disabled={isUpdating || resetSent}
                className="shrink-0 inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-xs font-bold text-gray-700 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                id="reset-pwd-settings-btn"
              >
                <span>{resetSent ? 'Sent' : 'Send Reset Link'}</span>
              </button>
            </div>
          </div>

          {/* Active Quota Monitor */}
          <div className="bg-white p-8 rounded-3xl border border-gray-150 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
              <h3 className="text-sm font-black text-gray-900 tracking-tight uppercase">Plan Meter & Usage Details</h3>
              <button 
                onClick={() => onNavigate('pricing')} 
                className="text-[10px] text-blue-600 hover:text-blue-800 font-extrabold uppercase tracking-wide cursor-pointer"
              >
                Change Plans ↗
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/50">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Standard Quota Balance</span>
                <span className="text-lg font-black text-gray-900 mt-1 block">
                  {usage.standardLimit === null ? 'Unlimited' : `${usage.standardUsed} / ${usage.standardLimit}`}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5 block">{usage.standardLimitDescription}</span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/50">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Regional Intelligence Quota</span>
                <span className="text-lg font-black text-gray-900 mt-1 block">
                  {usage.regionalLimit === 0 ? 'Locked' : usage.regionalLimit === null ? 'Unlimited' : `${usage.regionalUsed} / ${usage.regionalLimit}`}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  {usage.regionalLimit === 0 ? 'Pro+ feature' : 'Regional analyses used'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
