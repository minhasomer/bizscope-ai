
import React from 'react';

interface FooterProps {
  onNavigate?: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const navigate = (page: string) => onNavigate?.(page);

  const dataCards = [
    {
      icon: (
        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      iconBg: 'bg-blue-900/40',
      title: 'Census Data',
      desc: 'Population demographics, income levels, and household data from the US Census Bureau.',
    },
    {
      icon: (
        <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      iconBg: 'bg-emerald-900/40',
      title: 'Geo Insights',
      desc: 'Location-based competitor mapping and market density analysis across ZIP codes.',
    },
    {
      icon: (
        <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      iconBg: 'bg-violet-900/40',
      title: 'Demographics',
      desc: 'Consumer profiles, spending patterns, and detailed demographic breakdowns by area.',
    },
    {
      icon: (
        <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      iconBg: 'bg-amber-900/40',
      title: 'Market Trends',
      desc: 'Economic indicators, employment data, and industry-level growth pattern analysis.',
    },
  ];

  // Links that navigate within the SPA
  const productLinks: { label: string; page?: string; soon?: boolean }[] = [
    { label: 'Overview',     page: 'home' },
    { label: 'Market Gaps',  page: 'opportunities' },
    { label: 'Pricing',      page: 'pricing' },
    { label: 'Dashboard',    page: 'dashboard' },
    { label: 'API',          soon: true },
    { label: 'Documentation', soon: true },
  ];

  const companyLinks: { label: string; page?: string; soon?: boolean }[] = [
    { label: 'About',   page: 'about' },
    { label: 'Contact', page: 'contact' },
    { label: 'Privacy', page: 'privacy' },
    { label: 'Terms',   page: 'terms' },
  ];

  const renderLink = (item: { label: string; page?: string; soon?: boolean }) => {
    if (item.soon) {
      return (
        <li key={item.label} className="flex items-center gap-2">
          <span className="text-sm text-slate-600 cursor-default">{item.label}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full">soon</span>
        </li>
      );
    }
    return (
      <li key={item.label}>
        <button
          onClick={() => item.page && navigate(item.page)}
          className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer text-left"
        >
          {item.label}
        </button>
      </li>
    );
  };

  return (
    <footer className="bg-[#0a0f1e] text-white pt-12 pb-6 print:hidden border-t border-slate-800/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Data sources */}
        <div className="mb-10">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest text-center mb-5">Data &amp; Intelligence Sources</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dataCards.map((card, i) => (
              <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 hover:-translate-y-0.5 transition-all duration-200">
                <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center mb-3`}>
                  {card.icon}
                </div>
                <h4 className="text-sm font-semibold text-white mb-1.5">{card.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Company info + links */}
        <div className="border-t border-slate-800 pt-8 grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src="/logo.svg" alt="BizScope" className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-white tracking-tight">BizScope</h3>
              <span className="text-[10px] font-semibold text-slate-500 tracking-wide">AI</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-2">
              AI-powered market intelligence for founders, franchise buyers, and local market researchers.
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Validate any business idea before you invest.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Product</h4>
            <ul className="space-y-2.5">
              {productLinks.map(renderLink)}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-2.5">
              {companyLinks.map(renderLink)}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-700">© 2026 BizScope. All rights reserved.</p>
          <p className="text-xs text-slate-700">Analytical estimates — not a guarantee of business performance.</p>
        </div>
      </div>
    </footer>
  );
};
