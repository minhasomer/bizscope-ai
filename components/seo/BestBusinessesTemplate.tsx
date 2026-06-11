import React from 'react';
import { useSEO } from '../../hooks/useSEO';
import { FAQSection, FAQItem } from './FAQSection';
import { getBestBusinessesMeta, slugToCity, FEATURED_CITIES, FEATURED_BUSINESSES } from '../../src/utils/seoUtils';
import { TrendingUp, MapPin, ArrowRight, Star } from 'lucide-react';

interface BestBusinessesTemplateProps {
  citySlug: string;
  onNavigate: (page: string) => void;
}

const BUSINESS_HIGHLIGHTS = [
  { name: 'Coffee Shop', icon: '☕', score: 82, startup: '$45K–$85K', competition: 'Moderate' },
  { name: 'Cleaning Service', icon: '🧹', score: 91, startup: '$5K–$15K', competition: 'Low' },
  { name: 'Pet Grooming', icon: '🐾', score: 88, startup: '$20K–$50K', competition: 'Low' },
  { name: 'Tutoring Center', icon: '📚', score: 85, startup: '$15K–$35K', competition: 'Low' },
  { name: 'Auto Repair Shop', icon: '🔧', score: 79, startup: '$75K–$150K', competition: 'Moderate' },
];

export const BestBusinessesTemplate: React.FC<BestBusinessesTemplateProps> = ({ citySlug, onNavigate }) => {
  const meta = getBestBusinessesMeta(citySlug);
  const city = slugToCity(citySlug);
  useSEO(meta);

  const faqs: FAQItem[] = [
    {
      question: `What is the best business to start in ${city}?`,
      answer: `The best business to start in ${city} depends on local demand, competition density, and your startup capital. Based on demographic and economic data, service businesses like cleaning services, tutoring centers, and pet grooming consistently rank as high-opportunity, low-competition options in most markets.`,
    },
    {
      question: `How much does it cost to start a business in ${city}?`,
      answer: `Startup costs in ${city} vary significantly by business type. Service-based businesses can start as low as $5,000–$15,000, while brick-and-mortar retail or food service typically requires $50,000–$200,000+ including equipment, permits, and initial inventory.`,
    },
    {
      question: `How does BizScope analyze business opportunities in ${city}?`,
      answer: `BizScope combines US Census Bureau demographic data, geo-mapped competitor density, economic indicators, and consumer spending patterns specific to ${city} to generate an opportunity assessment for each business type. Higher ratings indicate stronger market demand relative to existing competition.`,
    },
    {
      question: `Which ZIP codes in ${city} have the best business opportunities?`,
      answer: `Opportunity density varies by neighborhood. BizScope's ZIP-level analysis identifies underserved areas where consumer demand exceeds current business supply — often in transitional neighborhoods with rising household income. Run a full viability report to see ZIP-level breakdowns.`,
    },
    {
      question: `Is now a good time to start a business in ${city}?`,
      answer: `Market timing depends on current economic conditions, local population trends, and industry cycles. BizScope uses real-time economic indicators alongside demographic trends to flag whether a given business type is gaining or losing momentum in ${city}.`,
    },
  ];

  return (
    <article className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border border-white/20">
            <MapPin className="w-3 h-3" /> {city}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-5 leading-tight">
            Best Businesses to Start<br className="hidden sm:block" /> in {city}
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-8 leading-relaxed">
            AI-powered market analysis reveals the highest-potential business ideas in {city} based on local demographics, competition density, and economic data.
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-black rounded-2xl hover:bg-blue-50 transition-colors shadow-xl text-sm uppercase tracking-wide"
          >
            Run Full Analysis <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Top opportunities overview */}
      <section className="py-16 bg-gray-50" aria-labelledby="top-opportunities-heading">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 id="top-opportunities-heading" className="text-2xl font-black text-gray-900 mb-3 tracking-tight text-center">
            Top Business Opportunities in {city}
          </h2>
          <p className="text-gray-500 text-center text-sm mb-10 max-w-xl mx-auto">
            Ranked by opportunity assessment — a composite of market demand, competition level, and startup feasibility.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUSINESS_HIGHLIGHTS.map((biz, i) => (
              <div key={biz.name} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{biz.icon}</span>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                    i === 0 ? 'bg-yellow-100 text-yellow-800' :
                    i === 1 ? 'bg-gray-100 text-gray-700' :
                    'bg-orange-100 text-orange-800'
                  }`}>#{i + 1}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1 text-sm">{biz.name}</h3>
                <div className="space-y-1 mb-4">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Startup cost</span><span className="font-semibold text-gray-700">{biz.startup}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Competition</span><span className="font-semibold text-gray-700">{biz.competition}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${biz.score}%` }} />
                  </div>
                  <span className="text-xs font-black text-blue-600">{biz.score}</span>
                </div>
              </div>
            ))}
            {/* Locked card CTA */}
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-5 flex flex-col items-center justify-center text-center gap-3">
              <Star className="w-6 h-6 text-gray-300" />
              <p className="text-sm text-gray-400 font-medium">Get personalized rankings<br />for {city}</p>
              <button
                onClick={() => onNavigate('home')}
                className="text-xs font-black text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wide"
              >
                Analyze {city} →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Why this city section */}
      <section className="py-16" aria-labelledby="market-overview-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 id="market-overview-heading" className="text-2xl font-black text-gray-900 mb-8 tracking-tight text-center">
            {city} Market Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Population', value: 'Metro area', desc: 'Dense consumer base with diverse spending capacity' },
              { label: 'Median Income', value: 'Above avg.', desc: 'Household income supports premium service spending' },
              { label: 'Business Climate', value: 'Active', desc: 'Strong entrepreneurial activity with growing demand' },
            ].map(stat => (
              <div key={stat.label} className="text-center p-6 bg-gray-50 rounded-2xl">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{stat.label}</p>
                <p className="text-xl font-black text-gray-900 mb-2">{stat.value}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal links — other cities */}
      <section className="py-12 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 text-center">
            Explore Other Cities
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {FEATURED_CITIES.filter(c => c.slug !== citySlug).map(c => (
              <a
                key={c.slug}
                href={`/best-businesses/${c.slug}`}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
              >
                {c.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Internal links — business types */}
      <section className="py-12 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 text-center">
            Analyze Specific Business Types in {city}
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {FEATURED_BUSINESSES.map(biz => (
              <a
                key={biz.slug}
                href={`/viability/${biz.slug}/${citySlug}`}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
              >
                {biz.name} in {city}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <TrendingUp className="w-10 h-10 mx-auto mb-4 text-blue-200" />
          <h2 className="text-2xl font-black mb-3 tracking-tight">Get Your Personalized {city} Analysis</h2>
          <p className="text-blue-100 text-sm mb-7 leading-relaxed">
            Enter your specific business idea and get a full AI-powered viability report with startup costs, ZIP-level opportunity maps, and revenue projections.
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-black rounded-2xl hover:bg-blue-50 transition-colors shadow-xl text-sm uppercase tracking-wide"
          >
            Start Free Analysis <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <FAQSection faqs={faqs} title={`FAQ: Starting a Business in ${city}`} />
    </article>
  );
};
