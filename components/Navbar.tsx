import React, { useState, useEffect, useRef } from 'react';
import { isDemoMode } from '../src/config/appConfig';
import { Sparkles, Menu, X, CreditCard, ChevronDown, LogOut, User } from 'lucide-react';
import { SubscriptionPlan } from '../src/utils/planUtils';
import { UserProfile } from '../services/authService';

interface NavbarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
  currentPlan: SubscriptionPlan;
  user: UserProfile | null;
  onSignOut: () => void;
  authLoading?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, currentPage, currentPlan, user, onSignOut, authLoading = false }) => {
  const [demoActive, setDemoActive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  // Drive nav visibility via React state as well as Tailwind classes — belt-and-suspenders
  // against Tailwind Play CDN timing issues on auth re-renders.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1280);

  useEffect(() => {
    setDemoActive(isDemoMode);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1280);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMenuOpen]);

  const navLinks = [
    { page: 'home', label: 'Home' },
    { page: 'opportunities', label: 'Market Gaps' },
    { page: 'pricing', label: 'Pricing' },
    { page: 'dashboard', label: 'Dashboard' },
    ...(user ? [{ page: 'billing', label: 'Billing' }] : []),
    ...(user ? [{ page: 'settings', label: 'Settings' }] : []),
    { page: 'about', label: 'About' },
    { page: 'contact', label: 'Contact' },
  ];

  const getLinkClass = (page: string) => {
    const base = 'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap';
    return currentPage === page
      ? `${base} border-indigo-600 text-indigo-700`
      : `${base} border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300`;
  };

  const getMobileLinkClass = (page: string) => {
    const base = 'flex items-center pl-4 pr-5 py-3 border-l-4 text-sm font-medium transition-colors cursor-pointer rounded-r-xl';
    return currentPage === page
      ? `${base} border-indigo-600 bg-indigo-50 text-indigo-700`
      : `${base} border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900`;
  };

  const planBadgeClass = () => {
    switch (currentPlan) {
      case 'Pro': return 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100';
      case 'Pro+': return 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100';
      case 'Enterprise': return 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100';
    }
  };

  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-sm sticky top-0 z-40 overflow-x-hidden" ref={mobileMenuRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-1.5 hover:opacity-85 transition-opacity cursor-pointer"
            >
              <img src="/logo.svg" alt="BizScope" className="h-7 w-7 shrink-0" />
              <span className="text-xl font-black text-slate-900 tracking-tight">BizScope</span>
              <span className="text-[11px] font-semibold text-slate-400 tracking-wide">AI</span>
            </button>
            {import.meta.env.DEV && demoActive && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-full border border-slate-200">
                <Sparkles className="w-2.5 h-2.5" /> Sandbox
              </span>
            )}
          </div>

          {/* Desktop nav — hidden on mobile via Tailwind + React isMobile state */}
          <div
            className="hidden xl:flex flex-1 min-w-0 items-center gap-2 h-full ml-6 overflow-x-hidden"
            style={isMobile ? { display: 'none' } : {}}
          >
            {navLinks.map(({ page, label }) => (
              <a key={page} onClick={() => onNavigate(page)} className={getLinkClass(page)}>
                {label}
              </a>
            ))}
          </div>

          {/* Desktop right side — hidden on mobile via Tailwind + React isMobile state */}
          <div
            className="hidden xl:flex items-center gap-2.5 shrink-0 ml-4"
            style={isMobile ? { display: 'none' } : {}}
          >
            {authLoading ? (
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-24 rounded-lg bg-slate-100 animate-pulse" />
                <div className="h-7 w-20 rounded-xl bg-slate-100 animate-pulse" />
              </div>
            ) : (
              <>
                <button
                  onClick={() => onNavigate('pricing')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${planBadgeClass()}`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  {currentPlan}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>

                {user ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onNavigate('settings')}
                      className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <img
                        src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
                        alt="avatar"
                        referrerPolicy="no-referrer"
                        className="w-5 h-5 rounded-full object-cover border border-gray-100"
                      />
                      <span className="truncate max-w-[72px]">{user.fullName || 'Member'}</span>
                    </button>
                    <button
                      onClick={onSignOut}
                      title="Sign out"
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onNavigate('settings')}
                    className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold tracking-wide text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                )}
              </>
            )}
          </div>

          {/* Mobile hamburger — visible on mobile via Tailwind + React isMobile state */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            style={isMobile ? {} : { display: 'none' }}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      <div
        className={`xl:hidden overflow-hidden transition-all duration-300 ease-in-out bg-white border-t border-gray-100 ${
          mobileMenuOpen ? 'max-h-[600px] shadow-xl' : 'max-h-0'
        }`}
        style={isMobile ? {} : { display: 'none' }}
      >
        <div className="pt-2 pb-3 space-y-0.5 px-2">
          {navLinks.map(({ page, label }) => (
            <a
              key={page}
              onClick={() => { onNavigate(page); setMobileMenuOpen(false); }}
              className={getMobileLinkClass(page)}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="px-4 pb-5 pt-3 border-t border-gray-100 space-y-3">
          <button
            onClick={() => { onNavigate('pricing'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer ${planBadgeClass()}`}
          >
            <CreditCard className="w-4 h-4" />
            {demoActive ? 'Sandbox Plan' : 'Plan'}: {currentPlan}
          </button>

          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl">
                <img
                  src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
                  alt="avatar"
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full border border-gray-200 object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{user.fullName || 'Member'}</p>
                  <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => { onSignOut(); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => { onNavigate('settings'); setMobileMenuOpen(false); }}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-bold tracking-wide transition-colors cursor-pointer shadow-sm"
            >
              <User className="w-4 h-4" /> Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
