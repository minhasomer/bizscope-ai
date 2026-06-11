
import React, { useState, useRef, useEffect } from 'react';
import { searchBusinessTypes, DEFAULT_SUGGESTIONS, BusinessSuggestion } from '../src/data/businessSuggestionsData';
import { filterLocationSuggestions, defaultLocationSuggestions, getGeolocationSuggestions, fetchLocationAutocomplete } from '../src/data/locationSuggestionsData';
import { resolveLocationDisplay } from '../src/utils/locationUtils';
import { checkBlockedCategory, blockedCategoryMessage } from '../src/utils/blockedCategories';

interface HeroProps {
  onSubmit: (businessType: string, location: string) => void;
  onNavigate?: (page: string) => void;
  isLoading: boolean;
  hasResults: boolean;
  /** Resolved effective plan from App.tsx — handles Admin, BetaTester, preview roles, and auth. */
  currentPlan: string;
}

// Location suggestions now live in src/data/locationSuggestionsData.ts (shared with OpportunityExplorer)

export const Hero: React.FC<HeroProps> = ({ onSubmit, onNavigate, isLoading, hasResults, currentPlan }) => {
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [blockedError, setBlockedError] = useState<string | null>(null);
  const [showBusinessSuggestions, setShowBusinessSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  // Tap-vs-scroll tracking for suggestion dropdowns on touch devices.
  // Selecting on touchstart breaks scrolling — the moment a finger lands on an
  // item to scroll, it selects instead. Record Y on touchstart, flag the gesture
  // as a scroll once it moves > 10px, and select only on touchend for taps.
  // preventDefault on touchend (not passive) suppresses synthetic mouse events.
  const bizTouchRef = useRef<{ y: number; moved: boolean } | null>(null);
  const handleBizTouchStart = (e: React.TouchEvent) => {
    bizTouchRef.current = { y: e.touches[0].clientY, moved: false };
  };
  const handleBizTouchMove = (e: React.TouchEvent) => {
    const t = bizTouchRef.current;
    if (t && Math.abs(e.touches[0].clientY - t.y) > 10) t.moved = true;
  };
  const isBizTouchTap = (e: React.TouchEvent): boolean => {
    const t = bizTouchRef.current;
    bizTouchRef.current = null;
    if (t && !t.moved) { e.preventDefault(); return true; }
    return false;
  };

  const locTouchRef = useRef<{ y: number; moved: boolean } | null>(null);
  const handleLocTouchStart = (e: React.TouchEvent) => {
    locTouchRef.current = { y: e.touches[0].clientY, moved: false };
  };
  const handleLocTouchMove = (e: React.TouchEvent) => {
    const t = locTouchRef.current;
    if (t && Math.abs(e.touches[0].clientY - t.y) > 10) t.moved = true;
  };
  const isLocTouchTap = (e: React.TouchEvent): boolean => {
    const t = locTouchRef.current;
    locTouchRef.current = null;
    if (t && !t.moved) { e.preventDefault(); return true; }
    return false;
  };

  // Plan-aware label shown next to the submit button.
  // Reads the resolved effective plan passed down from App.tsx — this already
  // reflects Admin, BetaTester, DevAdminPanel preview roles, and Supabase auth.
  // Previously Hero read its own stale localStorage copy which never updated on
  // plan switches or auth events, so it always showed Explorer's "3 reports/month".
  const getPlanAccessLabel = (plan: string): string => {
    switch (plan) {
      case 'Pro':        return '20 reports/month';
      case 'Pro+':       return '50 standard + 10 regional/month';
      case 'Enterprise': return 'Custom access';
      default:           return '3 reports/month'; // Explorer
    }
  };

  // Geolocation-based location defaults (populated on mount if permission granted)
  const [geoLocationDefaults, setGeoLocationDefaults] = useState<string[]>([]);

  useEffect(() => {
    getGeolocationSuggestions().then(results => {
      if (results.length > 0) setGeoLocationDefaults(results);
    });
  }, []);

  // Custom states for smart business autocomplete matching
  const [activeBizIndex, setActiveBizIndex] = useState<number>(-1);
  const [currentBizSuggestions, setCurrentBizSuggestions] = useState<BusinessSuggestion[]>([]);
  const [activeLocationIndex, setActiveLocationIndex] = useState<number>(-1);

  // Refs to handle clicking outside
  const businessRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (businessRef.current && !businessRef.current.contains(event.target as Node)) {
        setShowBusinessSuggestions(false);
      }
      if (locationRef.current && !locationRef.current.contains(event.target as Node)) {
        setShowLocationSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLocationSuggestions = (input: string): string[] => {
    if (!input.trim()) {
      // Prepend geolocation results (if available) before national defaults
      const geo = geoLocationDefaults.slice(0, 4);
      const national = defaultLocationSuggestions.filter(d => !geo.includes(d)).slice(0, 8 - geo.length);
      return [...geo, ...national];
    }
    return filterLocationSuggestions(input);
  };

  const handleBusinessChange = (value: string) => {
    setBusinessType(value);
    const s = value ? searchBusinessTypes(value) : DEFAULT_SUGGESTIONS;
    setCurrentBizSuggestions(s);
    setActiveBizIndex(-1);
    setShowBusinessSuggestions(true);
  };

  const handleBusinessFocus = () => {
    const s = businessType ? searchBusinessTypes(businessType) : DEFAULT_SUGGESTIONS;
    setCurrentBizSuggestions(s);
    setActiveBizIndex(-1);
    setShowBusinessSuggestions(true);
  };

  const handleBusinessKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showBusinessSuggestions || currentBizSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveBizIndex(prev => (prev + 1) % currentBizSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveBizIndex(prev => (prev - 1 + currentBizSuggestions.length) % currentBizSuggestions.length);
    } else if (e.key === 'Enter') {
      if (activeBizIndex >= 0 && activeBizIndex < currentBizSuggestions.length) {
        e.preventDefault();
        const selected = currentBizSuggestions[activeBizIndex];
        setBusinessType(selected.name);
        setShowBusinessSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowBusinessSuggestions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockedError(null);
    if (businessType && location) {
      const check = checkBlockedCategory(businessType);
      if (check.matched) {
        setBlockedError(blockedCategoryMessage(check.category));
        return;
      }
      const displayLocation = await resolveLocationDisplay(location);
      onSubmit(businessType, displayLocation);
    }
  };

  // Async location autocomplete state.
  // Shows static matches instantly (no blank flash), then upgrades to Photon
  // results after a 300 ms debounce. Falls back to static on any network error.
  const [locationDropdownItems, setLocationDropdownItems] = useState<string[]>(() =>
    defaultLocationSuggestions.slice(0, 8),
  );
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh defaults when geolocation results arrive and the field is still empty.
  useEffect(() => {
    if (!location.trim()) setLocationDropdownItems(getLocationSuggestions(''));
  }, [geoLocationDefaults]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced async fetch — static results shown immediately, Photon upgrades them.
  useEffect(() => {
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    if (!location.trim()) {
      setLocationDropdownItems(getLocationSuggestions(''));
      return;
    }
    setLocationDropdownItems(filterLocationSuggestions(location));
    locationDebounceRef.current = setTimeout(async () => {
      const results = await fetchLocationAutocomplete(location);
      setLocationDropdownItems(results);
    }, 300);
    return () => { if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current); };
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLocationChange = (value: string) => {
    setLocation(value);
    setActiveLocationIndex(-1);
    setShowLocationSuggestions(true);
  };

  const handleLocationFocus = () => {
    setActiveLocationIndex(-1);
    setShowLocationSuggestions(true);
  };

  const handleLocationSelect = (value: string) => {
    setLocation(value);
    setShowLocationSuggestions(false);
    setActiveLocationIndex(-1);
  };

  const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showLocationSuggestions || locationDropdownItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveLocationIndex(prev => (prev + 1) % locationDropdownItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveLocationIndex(prev => (prev - 1 + locationDropdownItems.length) % locationDropdownItems.length);
    } else if (e.key === 'Enter') {
      if (activeLocationIndex >= 0 && activeLocationIndex < locationDropdownItems.length) {
        e.preventDefault();
        handleLocationSelect(locationDropdownItems[activeLocationIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowLocationSuggestions(false);
    }
  };

  const heightClass = hasResults ? "py-16 sm:py-20" : "min-h-[calc(100vh-64px)]";

  return (
    <div className={`relative ${heightClass} bg-gradient-to-br from-[#0a0f1e] via-[#1e1b4b] to-[#0a0f1e] flex items-center justify-center`}>
        {/* Background Graphics - Absolute positioning */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Ambient glow blobs */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-blue-700/15 rounded-full blur-3xl"></div>
            {/* Subtle geometric accents */}
            <div className="absolute inset-0 opacity-[0.04]">
                <div className="absolute top-20 right-20 w-32 h-32 bg-white rounded-full"></div>
                <div className="absolute top-40 right-40 w-16 h-16 bg-white rounded-lg transform rotate-45"></div>
                <div className="absolute top-60 right-60 w-24 h-24 bg-white rounded-full"></div>
                <div className="absolute bottom-40 right-20 w-20 h-20 bg-white rounded-lg"></div>
                <div className="absolute bottom-20 right-40 w-12 h-12 bg-white rounded-full"></div>
                <div className="absolute top-32 left-20 w-16 h-16 bg-white rounded-lg transform rotate-12"></div>
                <div className="absolute top-52 left-40 w-20 h-20 bg-white rounded-full"></div>
                <div className="absolute bottom-32 left-20 w-24 h-24 bg-white rounded-lg transform -rotate-12"></div>
            </div>
        </div>

        <div className="relative z-10 w-full px-4">
            <div className="max-w-4xl mx-auto text-center">
                {/* Main Headline */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-4 leading-tight tracking-tight">
                    Validate Business Ideas Before You Invest Time or Money
                    <br />
                    <span className="text-indigo-300 font-bold">For Startups, Franchises & Local Markets</span>
                </h1>

                <p className="text-base md:text-lg text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                    Enter any business idea or franchise name, choose your target location, and get a complete viability report — competitor landscape, demographic fit, startup cost range, market opportunity assessment, and AI-driven go/no-go analysis.
                </p>

                {/* Input Form */}
                <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-8 relative">
                    <div className="bg-white/[0.07] backdrop-blur-md rounded-2xl p-5 md:p-7 border border-white/[0.1] shadow-2xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                            {/* Business Type Input */}
                            <div className="relative" ref={businessRef}>
                                <label className="block text-white text-sm font-semibold mb-2 text-left">
                                    Business or franchise idea
                                </label>
                                <input
                                    type="text"
                                    value={businessType}
                                    onChange={(e) => handleBusinessChange(e.target.value)}
                                    onFocus={handleBusinessFocus}
                                    onKeyDown={handleBusinessKeyDown}
                                    placeholder="e.g., Chick-fil-A, Coffee Shop, HVAC Company"
                                    className="w-full px-4 py-3.5 rounded-xl bg-white/95 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:bg-white transition-all shadow-sm text-sm"
                                    autoComplete="off"
                                    required
                                />
                                {showBusinessSuggestions && (currentBizSuggestions.length > 0 || businessType.trim().length > 0) && (
                                  <div className="absolute z-50 w-full bg-white rounded-xl shadow-2xl mt-1 max-h-80 overflow-y-auto text-left border border-gray-100 divide-y divide-gray-50">
                                    {currentBizSuggestions.length > 0 ? (
                                        currentBizSuggestions.map((s, i) => {
                                            const isSelected = i === activeBizIndex;
                                            // Badge style per business type
                                            const badgeStyles: Record<string, string> = {
                                              franchise:   'text-purple-700 bg-purple-50 border-purple-100',
                                              startup:     'text-blue-700 bg-blue-50 border-blue-100',
                                              independent: 'text-emerald-700 bg-emerald-50 border-emerald-100',
                                            };
                                            const badgeLabels: Record<string, string> = {
                                              franchise:   'Franchise',
                                              startup:     'Startup',
                                              independent: 'Independent',
                                            };
                                            const badgeBg    = badgeStyles[s.type]  ?? badgeStyles.independent;
                                            const badgeLabel = badgeLabels[s.type]  ?? 'Independent';

                                            return (
                                                <div
                                                    key={i}
                                                    className={`px-4 py-2.5 cursor-pointer border-l-4 transition-all duration-150 flex items-center justify-between gap-2 ${
                                                        isSelected
                                                          ? 'bg-blue-50/70 border-blue-500 pl-3 font-semibold text-blue-900'
                                                          : 'border-transparent pl-4 hover:bg-blue-50/30 hover:pl-3 hover:border-blue-400 text-gray-800'
                                                    }`}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setBusinessType(s.name);
                                                        setShowBusinessSuggestions(false);
                                                    }}
                                                    onTouchStart={handleBizTouchStart}
                                                    onTouchMove={handleBizTouchMove}
                                                    onTouchEnd={(e) => {
                                                        if (isBizTouchTap(e)) {
                                                            setBusinessType(s.name);
                                                            setShowBusinessSuggestions(false);
                                                        }
                                                    }}
                                                    onMouseEnter={() => setActiveBizIndex(i)}
                                                >
                                                    <div className="flex flex-col text-left min-w-0">
                                                        <span className="text-sm font-medium text-gray-900 truncate">{s.name}</span>
                                                        <span className="text-[10px] text-gray-400 mt-0.5 truncate">{s.category}</span>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeBg} tracking-wide shrink-0`}>
                                                        {badgeLabel}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div
                                            className="px-4 py-3.5 cursor-pointer flex items-center gap-3 hover:bg-indigo-50 transition-colors"
                                            onMouseDown={async (e) => {
                                                e.preventDefault();
                                                setShowBusinessSuggestions(false);
                                                if (businessType.trim() && location.trim()) {
                                                  const displayLocation = await resolveLocationDisplay(location.trim());
                                                  onSubmit(businessType.trim(), displayLocation);
                                                }
                                            }}
                                            onTouchStart={handleBizTouchStart}
                                            onTouchMove={handleBizTouchMove}
                                            onTouchEnd={async (e) => {
                                                if (!isBizTouchTap(e)) return;
                                                setShowBusinessSuggestions(false);
                                                if (businessType.trim() && location.trim()) {
                                                  const displayLocation = await resolveLocationDisplay(location.trim());
                                                  onSubmit(businessType.trim(), displayLocation);
                                                }
                                            }}
                                        >
                                            <span className="text-indigo-500 text-base">↵</span>
                                            <span className="text-sm text-gray-700">Press <strong>Enter</strong> to analyze <span className="text-indigo-600 font-semibold">"{businessType}"</span></span>
                                        </div>
                                    )}
                                  </div>
                                )}
                            </div>

                            {/* Location Input */}
                            <div className="relative" ref={locationRef}>
                                <label className="block text-white text-sm font-semibold mb-2 text-left">
                                    Target location
                                </label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => handleLocationChange(e.target.value)}
                                    onFocus={handleLocationFocus}
                                    onKeyDown={handleLocationKeyDown}
                                    placeholder="City, State, ZIP, or County"
                                    className="w-full px-4 py-3.5 rounded-xl bg-white/95 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:bg-white transition-all shadow-sm text-sm"
                                    autoComplete="off"
                                    required
                                />
                                {showLocationSuggestions && (locationDropdownItems.length > 0 || location.trim().length > 0) && (
                                  <div className="absolute z-50 w-full bg-white rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto text-left border border-gray-100">
                                    {locationDropdownItems.length > 0 ? (
                                      locationDropdownItems.map((s, i) => {
                                        const isActive = i === activeLocationIndex;
                                        return (
                                          <div
                                              key={i}
                                              className={`px-4 py-3 cursor-pointer text-gray-800 border-b border-gray-50 last:border-0 transition-colors ${
                                                isActive ? 'bg-blue-50 font-semibold text-blue-900' : 'hover:bg-blue-50'
                                              }`}
                                              onMouseDown={(e) => { e.preventDefault(); handleLocationSelect(s); }}
                                              onTouchStart={handleLocTouchStart}
                                              onTouchMove={handleLocTouchMove}
                                              onTouchEnd={(e) => { if (isLocTouchTap(e)) handleLocationSelect(s); }}
                                              onMouseEnter={() => setActiveLocationIndex(i)}
                                          >
                                              {s}
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div
                                          className="px-4 py-3.5 cursor-pointer flex items-center gap-3 hover:bg-indigo-50 transition-colors"
                                          onMouseDown={(e) => { e.preventDefault(); handleLocationSelect(location.trim()); }}
                                          onTouchStart={handleLocTouchStart}
                                          onTouchMove={handleLocTouchMove}
                                          onTouchEnd={(e) => { if (isLocTouchTap(e)) handleLocationSelect(location.trim()); }}
                                      >
                                          <span className="text-indigo-500 text-base">📍</span>
                                          <span className="text-sm text-gray-700">Use <span className="text-indigo-600 font-semibold">"{location}"</span> as location</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                            </div>
                        </div>

                        {/* Quick-start examples */}
                        <div className="mb-4">
                            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-2 text-left">Try an example</p>
                            <div className="flex flex-wrap gap-1.5">
                                {['Coffee Shop', 'Auto Detailing Business', 'HVAC Company', 'Daycare Center', 'House Cleaning Service', 'SaaS Startup', 'AI Consulting Firm', 'Pet Grooming Business', 'Roofing Company', 'Physical Therapy Clinic'].map((ex) => (
                                    <button
                                        key={ex}
                                        type="button"
                                        onClick={() => { setBusinessType(ex); setShowBusinessSuggestions(false); }}
                                        className="px-2.5 py-1 bg-white/[0.1] hover:bg-white/[0.18] border border-white/25 hover:border-white/40 text-white text-[11px] font-medium rounded-full transition-all cursor-pointer"
                                    >
                                        {ex}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* CTA Button */}
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full sm:w-auto flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 text-sm font-bold uppercase tracking-wide bg-white text-slate-900 hover:bg-indigo-50 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-wait shadow-xl ring-1 ring-white/30 hover:ring-white/50 hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {isLoading ? (
                                  <>
                                    <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Generating Report...
                                  </>
                                ) : (
                                  <>
                                    Run Viability Analysis
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                  </>
                                )}
                            </button>
                            <span className="text-slate-400 text-xs font-medium shrink-0">
                                {getPlanAccessLabel(currentPlan)}
                            </span>
                        </div>
                    </div>
                </form>

                {/* Blocked category error */}
                {blockedError && (
                  <div className="max-w-2xl mx-auto mt-3 px-4 py-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-300 leading-relaxed flex items-start gap-2.5">
                    <span className="text-red-400 text-sm shrink-0 mt-0.5">⚠️</span>
                    <span>{blockedError}</span>
                  </div>
                )}

                {/* Use-case trust chips */}
                <div className="flex flex-wrap justify-center gap-2 mb-5">
                    {[
                        { icon: '🚀', text: 'Startup validation' },
                        { icon: '🏪', text: 'Franchise evaluation' },
                        { icon: '📍', text: 'Expansion planning' },
                        { icon: '🔍', text: 'Opportunity discovery' },
                    ].map(({ icon, text }) => (
                        <span key={text} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.07] border border-white/[0.12] text-slate-300 text-xs rounded-full">
                            {icon} {text}
                        </span>
                    ))}
                </div>

                {onNavigate && (
                    <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                        <button
                            onClick={() => onNavigate('pricing')}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 hover:border-white/35 text-slate-200 font-semibold rounded-xl transition-all cursor-pointer"
                        >
                            View Pricing →
                        </button>
                        <span className="text-slate-700">·</span>
                        <button
                            onClick={() => onNavigate('opportunities')}
                            className="text-indigo-300 hover:text-white font-semibold underline underline-offset-4 decoration-indigo-400/50 hover:decoration-white/60 transition-all cursor-pointer"
                        >
                            Discover underserved markets →
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
