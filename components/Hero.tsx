
import React, { useState, useRef, useEffect } from 'react';
import { searchBusinessTypes, businessSuggestionsList, BusinessSuggestion } from '../src/data/businessSuggestionsData';

interface HeroProps {
  onSubmit: (businessType: string, location: string) => void;
  onNavigate?: (page: string) => void;
  isLoading: boolean;
  hasResults: boolean;
  /** Resolved effective plan from App.tsx — handles Admin, BetaTester, preview roles, and auth. */
  currentPlan: string;
}

// Comprehensive list of major US cities, suburbs, counties, and zip codes
const locationSuggestions = [
    // Top US Cities
    'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA',
    'Austin, TX', 'Jacksonville, FL', 'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC', 'San Francisco, CA', 'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Washington, DC',
    'Boston, MA', 'El Paso, TX', 'Nashville, TN', 'Detroit, MI', 'Oklahoma City, OK', 'Portland, OR', 'Las Vegas, NV', 'Memphis, TN', 'Louisville, KY', 'Baltimore, MD',
    'Milwaukee, WI', 'Albuquerque, NM', 'Tucson, AZ', 'Fresno, CA', 'Sacramento, CA', 'Mesa, AZ', 'Kansas City, MO', 'Atlanta, GA', 'Long Beach, CA', 'Colorado Springs, CO',
    'Raleigh, NC', 'Miami, FL', 'Virginia Beach, VA', 'Omaha, NE', 'Oakland, CA', 'Minneapolis, MN', 'Tulsa, OK', 'Arlington, TX', 'Tampa, FL', 'New Orleans, LA',
    'Wichita, KS', 'Cleveland, OH', 'Bakersfield, CA', 'Aurora, CO', 'Anaheim, CA', 'Honolulu, HI', 'Santa Ana, CA', 'Corpus Christi, TX', 'Riverside, CA', 'Lexington, KY', 'Stockton, CA',
    
    // Major Suburbs & Regions (Expanded)
    'Gurnee, IL', 'Libertyville, IL', 'Vernon Hills, IL', 'Naperville, IL', 'Evanston, IL', 'Schaumburg, IL', 'Aurora, IL', 'Joliet, IL', 'Elgin, IL', 'Waukegan, IL', 'Cicero, IL', 'Arlington Heights, IL',
    'Bolingbrook, IL', 'Skokie, IL', 'Des Plaines, IL', 'Orland Park, IL', 'Tinley Park, IL', 'Oak Park, IL', 'Downers Grove, IL', 'Mount Prospect, IL', 'Wheaton, IL',
    'Scottsdale, AZ', 'Plano, TX', 'Irvine, CA', 'Newark, NJ', 'Jersey City, NJ', 'St. Petersburg, FL', 'Chula Vista, CA', 'Orlando, FL', 'Chandler, AZ', 'Laredo, TX',
    'Madison, WI', 'Durham, NC', 'Lubbock, TX', 'Garland, TX', 'Glendale, AZ', 'Hialeah, FL', 'Reno, NV', 'Baton Rouge, LA', 'Chesapeake, VA', 'Gilbert, AZ',
    'Santa Monica, CA', 'Pasadena, CA', 'Burbank, CA', 'Compton, CA', 'Inglewood, CA', 'Torrance, CA',
    'The Woodlands, TX', 'Sugar Land, TX', 'Katy, TX', 'Pearland, TX',
    'Marietta, GA', 'Alpharetta, GA', 'Sandy Springs, GA',
    'Cambridge, MA', 'Somerville, MA', 'Quincy, MA',
    'Bellevue, WA', 'Tacoma, WA', 'Redmond, WA',
    
    // Counties
    'Cook County, IL', 'Lake County, IL', 'DuPage County, IL', 'Will County, IL',
    'Los Angeles County, CA', 'Harris County, TX', 'Maricopa County, AZ', 'San Diego County, CA', 'Orange County, CA', 'Miami-Dade County, FL', 'Dallas County, TX',
    'King County, WA', 'Queens County, NY', 'Clark County, NV', 'Tarrant County, TX', 'Bexar County, TX', 'Broward County, FL', 'Wayne County, MI', 'Santa Clara County, CA',
    'Riverside County, CA', 'San Bernardino County, CA', 'Middlesex County, MA',
    
    // Zip Codes
    '60031', '60048', '60064', '60085', '60087', '60046', '60030', // Lake County, IL
    '10001', '10002', '10003', '10004', '10005', // NYC
    '90210', '90001', '90002', '90028', '90069', // LA
    '60601', '60602', '60611', '60614', '60647', // Chicago Loop/North Side
    '77001', '77002', '77005', '77019', // Houston
    '85001', '85002', '85003', // Phoenix
    '33101', '33139', '33131', // Miami
    '94102', '94103', '94110'  // SF
];

// Curated defaults shown when the location field is focused but empty
const defaultLocationSuggestions = [
  'Gurnee, IL', 'Libertyville, IL', 'Vernon Hills, IL', 'Lake County, IL',
  'Chicago, IL', 'Naperville, IL', 'Schaumburg, IL', 'Milwaukee, WI',
  'Dallas, TX', 'Houston, TX', 'Phoenix, AZ',
];

export const Hero: React.FC<HeroProps> = ({ onSubmit, onNavigate, isLoading, hasResults, currentPlan }) => {
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [showBusinessSuggestions, setShowBusinessSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

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
    if (!input.trim()) return defaultLocationSuggestions;
    return locationSuggestions.filter(item => item.toLowerCase().includes(input.toLowerCase())).slice(0, 10);
  };

  const handleBusinessChange = (value: string) => {
    setBusinessType(value);
    const s = value ? searchBusinessTypes(value) : businessSuggestionsList.slice(0, 6);
    setCurrentBizSuggestions(s);
    setActiveBizIndex(-1);
    setShowBusinessSuggestions(true);
  };

  const handleBusinessFocus = () => {
    const s = businessType ? searchBusinessTypes(businessType) : businessSuggestionsList.slice(0, 6);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (businessType && location) {
      onSubmit(businessType, location);
    }
  };

  // Derived list — computed once per render so all location handlers share the same snapshot
  const locationDropdownItems = getLocationSuggestions(location);

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
                    Enter any business idea or franchise name, choose your target location, and get a complete viability report — competitor landscape, demographic fit, startup cost range, market opportunity score, and AI-driven go/no-go analysis.
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
                                    placeholder="e.g., Urgent Care, Med Spa, Junk Removal"
                                    className="w-full px-4 py-3.5 rounded-xl bg-white/95 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:bg-white transition-all shadow-sm text-sm"
                                    autoComplete="off"
                                    required
                                />
                                {showBusinessSuggestions && (currentBizSuggestions.length > 0 || businessType.trim().length > 0) && (
                                  <div className="absolute z-50 w-full bg-white rounded-xl shadow-2xl mt-1 max-h-72 overflow-y-auto text-left border border-gray-100 divide-y divide-gray-100">
                                    {currentBizSuggestions.length > 0 ? (
                                        currentBizSuggestions.map((s, i) => {
                                            const isSelected = i === activeBizIndex;
                                            let badgeBg = "bg-blue-55 text-blue-700 bg-blue-50/70 border-blue-100/50";
                                            let badgeLabel = "Generic";
                                            if (s.type === 'franchise') {
                                                badgeBg = "bg-purple-55 text-purple-700 bg-purple-50/70 border-purple-100/50";
                                                badgeLabel = "Franchise";
                                            } else if (s.type === 'common') {
                                                badgeBg = "bg-emerald-55 text-emerald-700 bg-emerald-50/70 border-emerald-100/50";
                                                badgeLabel = "Common Brand";
                                            }

                                            return (
                                                <div
                                                    key={i}
                                                    className={`px-4 py-2.5 cursor-pointer border-l-4 transition-all duration-150 flex items-center justify-between ${
                                                        isSelected
                                                          ? 'bg-blue-50/70 border-blue-500 pl-3 font-semibold text-blue-900'
                                                          : 'border-transparent pl-4 hover:bg-blue-50/30 hover:pl-3 hover:border-blue-400 text-gray-800'
                                                    }`}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setBusinessType(s.name);
                                                        setShowBusinessSuggestions(false);
                                                    }}
                                                    onTouchStart={(e) => {
                                                        e.preventDefault();
                                                        setBusinessType(s.name);
                                                        setShowBusinessSuggestions(false);
                                                    }}
                                                    onMouseEnter={() => setActiveBizIndex(i)}
                                                >
                                                    <div className="flex flex-col text-left">
                                                        <span className="text-sm font-medium text-gray-900">{s.name}</span>
                                                        {s.keywords && s.keywords.length > 0 && (
                                                            <span className="text-[10px] text-gray-400 mt-0.5">
                                                                tags: {s.keywords.slice(0, 3).join(', ')}
                                                            </span>
                                                        )}
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
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                setShowBusinessSuggestions(false);
                                                if (businessType.trim() && location.trim()) onSubmit(businessType.trim(), location.trim());
                                            }}
                                            onTouchStart={(e) => {
                                                e.preventDefault();
                                                setShowBusinessSuggestions(false);
                                                if (businessType.trim() && location.trim()) onSubmit(businessType.trim(), location.trim());
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
                                              onTouchStart={(e) => { e.preventDefault(); handleLocationSelect(s); }}
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
                                          onTouchStart={(e) => { e.preventDefault(); handleLocationSelect(location.trim()); }}
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
                                {['Urgent Care', 'Junk Removal', 'Halal Restaurant', 'Med Spa', 'Brothers Gutters', 'Aircraft Detailing'].map((ex) => (
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
