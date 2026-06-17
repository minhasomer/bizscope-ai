import React, { useState } from 'react';
import { AuthService, UserProfile, EmailConfirmationRequiredError, AmbiguousSignupStateError } from '../services/authService';
import { isDemoMode } from '../src/config/appConfig';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Sparkles,
  ArrowLeft,
  Eye,
  EyeOff
} from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (user: UserProfile) => void;
  onClose?: () => void;
  initialMode?: 'login' | 'signup';
  onNavigate?: (page: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, onClose, initialMode = 'login', onNavigate }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);

  // Input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Set to the email when Supabase returns an ambiguous anti-enumeration response
  // (user: null, session: null) — could be duplicate, pending confirmation, or
  // reservation state. UX must NOT assert "account already exists."
  const [ambiguousSignupEmail, setAmbiguousSignupEmail] = useState<string | null>(null);
  // Set to the email address when email confirmation is required after signup
  const [signupPendingEmail, setSignupPendingEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const cleanStates = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleModeChange = (newMode: 'login' | 'signup' | 'forgot') => {
    setMode(newMode);
    cleanStates();
    setPassword('');
  };

  // One-click demo session — uses signInAsDemo() which never touches Supabase
  // and stores the session in sessionStorage only (cleared on tab/window close).
  const handleInstantDemoLogin = (plan: 'Explorer' | 'Pro' | 'Pro+' | 'Enterprise') => {
    cleanStates();
    try {
      const demoUser = AuthService.signInAsDemo(plan);
      onAuthSuccess(demoUser);
    } catch (err: any) {
      setError(err?.message || 'Failed to start demo session.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    cleanStates();

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) {
          throw new Error('Please enter your full name.');
        }
        if (!tosAccepted) {
          throw new Error('You must accept the Terms of Service and Privacy Policy to create an account.');
        }
        const user = await AuthService.signUp(email, password, fullName.trim(), 'Explorer', new Date().toISOString());
        // signUp() only resolves (rather than throwing EmailConfirmationRequiredError)
        // when Supabase returned an active session, i.e. confirmation isn't pending.
        setSuccessMessage('Account created! Signing you in...');
        setTimeout(() => {
          onAuthSuccess(user);
        }, 1000);
      } else if (mode === 'login') {
        const user = await AuthService.signIn(email, password);
        onAuthSuccess(user);
      } else if (mode === 'forgot') {
        await AuthService.resetPassword(email);
        setSuccessMessage(`Password reset email sent to ${email}. Check your inbox!`);
        setEmail('');
      }
    } catch (err: any) {
      if (err instanceof AmbiguousSignupStateError) {
        setAmbiguousSignupEmail(email);
      } else if (err instanceof EmailConfirmationRequiredError) {
        setSignupPendingEmail(email);
      } else {
        setError(err?.message || 'Something went wrong. Please check your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    cleanStates();
    try {
      const result = await AuthService.signInWithGoogle();
      window.location.href = result.url;
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!signupPendingEmail) return;
    setResendStatus('sending');
    try {
      await AuthService.resendConfirmationEmail(signupPendingEmail);
      setResendStatus('sent');
    } catch {
      setResendStatus('error');
    }
  };

  // ── Ambiguous signup state screen ──────────────────────────────────────────
  // Supabase returned {user:null, session:null, error:null} — anti-enumeration.
  // We cannot know whether this email is a genuine duplicate, a pending
  // confirmation, or in Supabase's internal reservation state. Show a neutral
  // "check your inbox" screen with Sign In and Forgot Password as escape hatches.
  if (ambiguousSignupEmail) {
    return (
      <div className="w-full max-w-md mx-auto bg-white p-8 rounded-3xl border border-gray-150 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full pointer-events-none -mr-4 -mt-4 opacity-50" />
        <div className="text-center mb-8 relative z-10">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src="/logo.svg" alt="BizScope" className="h-9 w-9 shrink-0" />
            <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
              BizScope<span className="text-[11px] font-semibold text-slate-400 ml-1 normal-case tracking-wide">AI</span>
            </h2>
          </div>
        </div>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
            <Mail className="w-7 h-7 text-blue-500" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 tracking-tight">Check your inbox</h3>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-xs">
              If you just signed up, check your email for a confirmation link. If you already have an account, sign in or reset your password below.
            </p>
            <p className="text-[11px] text-gray-400 mt-1 font-mono">{ambiguousSignupEmail}</p>
          </div>

          <div className="w-full space-y-2 mt-2">
            <button
              type="button"
              onClick={() => { setAmbiguousSignupEmail(null); handleModeChange('login'); }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-xs font-black uppercase text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md tracking-wider cursor-pointer"
            >
              Sign In <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => { setAmbiguousSignupEmail(null); handleModeChange('forgot'); }}
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-extrabold text-gray-500 hover:text-gray-800 transition-colors py-2 cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Verification-pending screen (replaces form after signup when email confirmation is required) ──
  if (signupPendingEmail) {
    return (
      <div className="w-full max-w-md mx-auto bg-white p-8 rounded-3xl border border-gray-150 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full pointer-events-none -mr-4 -mt-4 opacity-50" />
        <div className="text-center mb-8 relative z-10">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src="/logo.svg" alt="BizScope" className="h-9 w-9 shrink-0" />
            <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
              BizScope<span className="text-[11px] font-semibold text-slate-400 ml-1 normal-case tracking-wide">AI</span>
            </h2>
          </div>
        </div>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 tracking-tight">Check your email</h3>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-xs">
              Account created. Please check your email to verify your account before signing in.
            </p>
            <p className="text-[11px] text-gray-400 mt-1 font-mono">{signupPendingEmail}</p>
          </div>

          <div className="w-full space-y-2 mt-2">
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendStatus === 'sending' || resendStatus === 'sent'}
              className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-xs font-black uppercase text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md disabled:opacity-55 disabled:cursor-not-allowed tracking-wider"
            >
              {resendStatus === 'sending' && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {resendStatus === 'sent' ? '✓ Verification email resent' : 'Resend verification email'}
            </button>

            {resendStatus === 'error' && (
              <p className="text-[11px] text-red-600 font-medium">Failed to resend. Please try again shortly.</p>
            )}

            <button
              type="button"
              onClick={() => { setSignupPendingEmail(null); setResendStatus('idle'); handleModeChange('login'); }}
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-extrabold text-gray-500 hover:text-gray-800 transition-colors py-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white p-8 rounded-3xl border border-gray-150 shadow-xl overflow-hidden relative">
      
      {/* Environment mode indicators — development builds only */}
      {import.meta.env.DEV && isDemoMode && (
        <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[10px] font-bold text-amber-800">
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-600" />
          <span>Demo Mode Active — AI calls disabled</span>
          {AuthService.isSupabaseActive() ? (
            <span className="ml-auto shrink-0 text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide">
              Real Auth
            </span>
          ) : (
            <span className="ml-auto shrink-0 text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide">
              Demo Auth
            </span>
          )}
        </div>
      )}
      {import.meta.env.DEV && !isDemoMode && AuthService.isSupabaseActive() && (
        <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] font-bold text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          Using real Supabase authentication
        </div>
      )}

      {/* Decorative branding background flare */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full pointer-events-none -mr-4 -mt-4 opacity-50"></div>
      
      {/* Brand Header */}
      <div className="text-center mb-8 relative z-10">
        <div className="flex items-center justify-center gap-2 mb-1">
          <img src="/logo.svg" alt="BizScope" className="h-9 w-9 shrink-0" />
          <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
            BizScope<span className="text-[11px] font-semibold text-slate-400 ml-1 normal-case tracking-wide">AI</span>
          </h2>
        </div>
        <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-widest">
          {mode === 'forgot' ? 'Password Recovery' : mode === 'signup' ? 'Create Your Account' : 'Sign In to BizScope'}
        </p>
      </div>

      {/* Mode Switches */}
      {mode !== 'forgot' && (
        <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-200/60 mb-6 font-semibold">
          <button
            type="button"
            onClick={() => handleModeChange('login')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
              mode === 'login'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-450 hover:text-gray-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('signup')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
              mode === 'signup'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-450 hover:text-gray-900'
            }`}
          >
            Create Account
          </button>
        </div>
      )}

      {/* Interactive Title Message */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-black text-gray-950 tracking-tight">
          {mode === 'login' && 'Welcome Back'}
          {mode === 'signup' && 'Get Started Free'}
          {mode === 'forgot' && 'Reset Password'}
        </h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          {mode === 'login' && 'Sign in to access your persistent ventures, saved reports & regional intelligence.'}
          {mode === 'signup' && 'Discover underserved business opportunities and validate your idea before you invest.'}
          {mode === 'forgot' && "Enter your email address and we'll send you a link to reset your password."}
        </p>
      </div>

      {/* Message Notifications */}
      {error && (
        <div className="mb-5 p-3.5 bg-red-50 text-red-700 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs leading-normal animate-fade-in" id="auth-error">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="font-medium shrink">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="mb-5 p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs leading-normal animate-fade-in" id="auth-success">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="font-semibold shrink">{successMessage}</div>
        </div>
      )}

      {/* Core Auth Action Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider">Your Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
              <input
                id="fullName"
                type="text"
                required
                disabled={loading}
                className="block w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-gray-900 bg-white"
                placeholder="e.g., Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
            <input
              id="email"
              type="email"
              required
              disabled={loading}
              className="block w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-gray-900 bg-white"
              placeholder="e.g., you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {mode !== 'forgot' && (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider">Password</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => handleModeChange('forgot')}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-extrabold uppercase tracking-wide cursor-pointer"
                >
                  Forgot?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading}
                minLength={6}
                className="block w-full pl-10 pr-10 py-3 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-gray-900 bg-white"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* ToS acceptance checkbox — signup only */}
        {mode === 'signup' && (
          <div className="flex items-start gap-2.5 py-1">
            <input
              id="tos-checkbox"
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              disabled={loading}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
            <label htmlFor="tos-checkbox" className="text-[11px] text-gray-500 leading-relaxed cursor-pointer select-none">
              I agree to the{' '}
              <button
                type="button"
                onClick={() => window.open(`${window.location.origin}?view=terms`, '_blank')}
                className="text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
              >
                Terms of Service
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={() => window.open(`${window.location.origin}?view=privacy`, '_blank')}
                className="text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
              >
                Privacy Policy
              </button>
              . I understand that BizScope reports are estimates for research purposes only and do not constitute financial or legal advice.
            </label>
          </div>
        )}

        <button
          id="auth-submit-btn"
          type="submit"
          disabled={loading || (mode === 'signup' && !tosAccepted)}
          className="w-full inline-flex items-center justify-center gap-1 px-5 py-3.5 rounded-xl text-xs font-black uppercase text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md disabled:opacity-55 disabled:cursor-wait tracking-wider cursor-pointer mt-2"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {mode === 'signup' ? 'Creating your account...' : mode === 'forgot' ? 'Sending reset email...' : 'Signing you in...'}
            </span>
          ) : (
            <>
              <span>
                {mode === 'login' && 'Sign In to Continue'}
                {mode === 'signup' && 'Create Free Account'}
                {mode === 'forgot' && 'Send Reset Email'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Mode navigation for forgot screen */}
      {mode === 'forgot' && (
        <button
          type="button"
          onClick={() => handleModeChange('login')}
          className="w-full mt-4 inline-flex items-center justify-center gap-1.5 text-xs font-extrabold text-gray-500 hover:text-gray-800 transition-colors py-2 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </button>
      )}

      {/* Alternative Social Logins - OAuth Ready */}
      {mode !== 'forgot' && (
        <div className="relative z-10">
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-150"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-wider">
              <span className="bg-white px-3 text-gray-400">Or Continue With</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-250 hover:bg-gray-50 rounded-xl text-xs font-extrabold text-gray-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {/* Standard Vector Google Badge Icon */}
            <svg className="h-4 w-4 text-[#4285F4]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Google Account</span>
          </button>
        </div>
      )}

      {/* Demo login — development only, never shown in production builds */}
      {import.meta.env.DEV && !AuthService.isSupabaseActive() && <div className="mt-8 pt-5 border-t border-dashed border-gray-200 bg-gray-50/50 -mx-8 -mb-8 px-8 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-1.5 justify-center mb-4">
          <Sparkles className="w-4 h-4 text-gray-500" />
          <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
            Local Dev Login
          </span>
        </div>
        <p className="text-[10px] text-gray-500 text-center leading-relaxed mb-3">
          Auth not configured locally. Select a plan to preview plan-gated views.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => handleInstantDemoLogin('Explorer')}
            className="px-2.5 py-1.5 bg-white border border-gray-205 hover:bg-gray-150 rounded-lg text-[9px] font-bold text-gray-600 transition-all cursor-pointer text-center"
          >
            🌱 Explorer
          </button>
          <button
            type="button"
            onClick={() => handleInstantDemoLogin('Pro')}
            className="px-2.5 py-1.5 bg-white border border-blue-150 hover:bg-blue-50 rounded-lg text-[9px] font-bold text-blue-700 transition-all cursor-pointer text-center"
          >
            ⚡ Pro
          </button>
          <button
            type="button"
            onClick={() => handleInstantDemoLogin('Pro+')}
            className="px-2.5 py-1.5 bg-white border border-purple-150 hover:bg-purple-50 rounded-lg text-[9px] font-bold text-purple-700 transition-all cursor-pointer text-center"
          >
            🔮 Pro+
          </button>
          <button
            type="button"
            onClick={() => handleInstantDemoLogin('Enterprise')}
            className="px-2.5 py-1.5 bg-white border border-indigo-150 hover:bg-indigo-50 rounded-lg text-[9px] font-bold text-indigo-700 transition-all cursor-pointer text-center"
          >
            👑 Enterprise
          </button>
        </div>
      </div>}
    </div>
  );
};
