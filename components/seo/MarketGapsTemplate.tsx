import React from 'react';
import { useSEO } from '../../hooks/useSEO';
import { FAQSection, FAQItem } from './FAQSection';
import { getMarketGapsMeta, slugToCity, FEATURED_CITIES, FEATURED_BUSINESSES } from '../../src/utils/seoUtils';
import { ArrowRight, Search, Zap, Target } from 'lucide-react';

interface MarketGapsTemplateProps {
  citySlug: string;
  onNavigate: (page: string) => void;
}

const GAP_CATEGORIES = [
  { name: 'Underserved Niches', icon: '🎯', desc: 'Business types with strong demand but fewer than expected competitors for the population size' },
  { name: 'Emerging Trends', icon: '🚀', desc: 'Categories growing faster than local supply — first-mover advantage available' },
  { name: 'ZIP Code Voids', icon: '🗺️', desc: 'Neighborhoods where residents must travel far for common services' },
  { name: 'Income-Demand Gaps', icon: '💡', desc: 'Areas where household income supports premium services that don\'t yet exist locally' },
];

export const MarketGapsTemplate: React.FC<MarketGapsTemplateProps> = ({ citySlug, onNavigate }) => {
  const meta = getMarketGapsMeta(citySlug);
  const city = slugToCity(citySlug);
  useSEO(meta);

  const faqs: FAQItem[] = [
    {
      question: `What are the biggest market gaps in ${city}?`,
      answer: `Market gaps in ${city} exist where consumer demand exceeds local supply. BizScope scans 50+ business categories against population density, income levels, and competitor counts across all ZIP codes in ${city} to identify the widest supply-demand gaps.`,
    },
    {
      question: `How does BizScope identify underserved business niches in ${city}?`,
      answer: `BizScope compares the expected number of businesses per capita (based on national averages and local demographics) against the actual count of operating businesses in each ${city} ZIP code. Categories where actual counts fall below expected counts — especially in high-income or high-density areas — are flagged as market gaps.`,
    },
    {
      question: `Which neighborhoods in ${city} have the most unmet business demand?`,
      answer: `Neighborhoods with the most unmet demand tend to be growing areas with newer housing stock, rising household incomes, or recent demographic shifts. BizScope's ZIP-level analysis identifies these pockets and ranks them by opportunity density across multiple business categories.`,
    },
    {
      question: `How reliable is the market gap analysis for ${city}?`,
      answer: `BizScope's analysis is based on US Census Bureau data, business registry counts, and economic indicators — the same sources professional site selectors use. While no analysis can guarantee success, identifying quantifiable gaps significantly improves your odds versus entering a saturated market.`,
    },
    {
      question: `Can I use BizScope's market gap data to pitch investors?`,
      answer: `Yes. BizScope reports include sourced data points, market size estimates, and competitive density metrics that can support an investor pitch or business plan. For investment presentations, we recommend pairing the AI analysis with primary research like customer surveys and site visits.`,
    },
  ];

  return (
    <article className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 text-white py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border border-white/20">
            <Search className="w-3 h-3" /> Market Intelligence
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-5 leading-tight">
            Market Gaps &amp; Underserved<br className="hidden sm:block" /> Niches in {city}
          </h1>
          <p className="text-lg text-purple-100 max-w-2xl mx-auto mb-8 leading-relaxed">
            Discover where demand exceeds supply in {city}. AI analysis of local demand vs. supply across 50+ business categories reveals hidden opportunities.
          </p>
          <button
            onClick={() => onNavigate('opportunities')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-700 font-black rounded-2xl hover:bg-purple-50 transition-colors shadow-xl text-sm uppercase tracking-wide"
          >
            View Opportunity Explorer <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* How it works */}
      <section className="py-16 bg-gray-50" aria-labelledby="how-it-works-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 id="how-it-works-heading" className="text-2xl font-black text-gray-900 mb-10 tracking-tight text-center">
            How BizScope Finds Market Gaps in {city}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', Icon: Search, title: 'Map the Supply', desc: `Count every business by category across all ${city} ZIP codes using business registry and location data` },
              { step: '02', Icon: Target, title: 'Model the Demand', desc: `Calculate expected business density using ${city} population, income, and demographic benchmarks` },
              { step: '03', Icon: Zap, title: 'Surface the Gap', desc: 'Rank categories and ZIP codes where demand exceeds supply — your highest-opportunity targets' },
            ].map(({ step, Icon, title, desc }) => (
              <div key={step} className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-2">Step {step}</p>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gap categories */}
      <section className="py-16" aria-labelledby="gap-types-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 id="gap-types-heading" className="text-2xl font-black text-gray-900 mb-8 tracking-tight text-center">
            Types of Market Gaps in {city}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {GAP_CATEGORIES.map(cat => (
              <div key={cat.name} className="bg-gray-50 rounded-2xl p-5 hover:bg-white hover:shadow-md hover:border hover:border-gray-100 transition-all">
                <div className="text-2xl mb-3">{cat.icon}</div>
                <h3 className="font-bold text-gray-900 text-sm mb-2">{cat.name}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business type cross-links */}
      <section className="py-12 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 text-center">
            Analyze Specific Business Gaps in {city}
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {FEATURED_BUSINESSES.map(biz => (
              <a
                key={biz.slug}
                href={`/viability/${biz.slug}/${citySlug}`}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:text-purple-600 hover:border-purple-200 transition-colors"
              >
                {biz.name} gap in {city}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Other cities */}
      <section className="py-12 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 text-center">
            Market Gaps in Other Cities
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {FEATURED_CITIES.filter(c => c.slug !== citySlug).map(c => (
              <a
                key={c.slug}
                href={`/market-gaps/${c.slug}`}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:text-purple-600 hover:border-purple-200 transition-colors"
              >
                {c.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-black mb-3 tracking-tight">Find Market Gaps in {city} — Personalized</h2>
          <p className="text-purple-100 text-sm mb-7 leading-relaxed">
            Enter your business idea and target area to get a custom gap analysis showing exactly where demand outpaces supply in {city}.
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-700 font-black rounded-2xl hover:bg-purple-50 transition-colors shadow-xl text-sm uppercase tracking-wide"
          >
            Find Your Market Gap <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <FAQSection faqs={faqs} title={`FAQ: Market Gaps in ${city}`} />
    </article>
  );
};
