import React from 'react';
import { useSEO } from '../../hooks/useSEO';
import { FAQSection, FAQItem } from './FAQSection';
import { getFranchiseOpportunitiesMeta, slugToCity, FEATURED_CITIES } from '../../src/utils/seoUtils';
import { ArrowRight, Shield, DollarSign, TrendingUp, Users } from 'lucide-react';

interface FranchiseOpportunitiesTemplateProps {
  citySlug: string;
  onNavigate: (page: string) => void;
}

const FRANCHISE_CATEGORIES = [
  { name: 'Food & Beverage', icon: '🍔', examples: 'Fast casual, coffee, smoothie bars', investment: '$150K–$500K' },
  { name: 'Health & Fitness', icon: '💪', examples: 'Gyms, yoga studios, physical therapy', investment: '$100K–$350K' },
  { name: 'Home Services', icon: '🏠', examples: 'Cleaning, painting, landscaping', investment: '$30K–$120K' },
  { name: 'Education', icon: '📚', examples: 'Tutoring, early childhood, STEM', investment: '$50K–$200K' },
  { name: 'Auto Services', icon: '🚗', examples: 'Oil change, detailing, repair', investment: '$75K–$250K' },
  { name: 'Senior Care', icon: '❤️', examples: 'In-home care, assisted living support', investment: '$80K–$200K' },
];

export const FranchiseOpportunitiesTemplate: React.FC<FranchiseOpportunitiesTemplateProps> = ({ citySlug, onNavigate }) => {
  const meta = getFranchiseOpportunitiesMeta(citySlug);
  const city = slugToCity(citySlug);
  useSEO(meta);

  const faqs: FAQItem[] = [
    {
      question: `What are the best franchise opportunities in ${city}?`,
      answer: `The best franchises in ${city} are those with high local demand and limited territory saturation. Home services, health & fitness, and education franchises consistently rank high in most urban markets. BizScope analyzes territory availability and local demographics to surface the best fit for your investment level.`,
    },
    {
      question: `How much do I need to invest in a franchise in ${city}?`,
      answer: `Franchise investments in ${city} typically range from $30,000 for simple home-service franchises to $500,000+ for full restaurant builds. This includes the franchise fee (typically $20K–$50K), equipment, leasehold improvements, working capital, and initial royalty periods.`,
    },
    {
      question: `Is ${city} oversaturated with franchises?`,
      answer: `Saturation varies significantly by category and neighborhood. Some franchise categories in ${city} are fully penetrated in certain ZIP codes but underserved in others. BizScope's geo-density mapping identifies neighborhoods with the highest unmet demand for each franchise type.`,
    },
    {
      question: `What is an FDD and why do I need it before buying a franchise in ${city}?`,
      answer: `A Franchise Disclosure Document (FDD) is a legally required document that franchisors must provide at least 14 days before you sign any agreement or pay any money. It covers fees, obligations, litigation history, financial performance, and the franchisor's audited financials. Always review the FDD with a franchise attorney before investing.`,
    },
    {
      question: `How do I evaluate franchise territory availability in ${city}?`,
      answer: `Territory availability is disclosed in Item 12 of the FDD. BizScope complements this by showing you how many existing locations of similar concepts are already operating in ${city} and which neighborhoods have the lowest competitor density — so you can negotiate protected territories from a position of knowledge.`,
    },
  ];

  return (
    <article className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 text-white py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border border-white/20">
            <Shield className="w-3 h-3" /> Franchise Intelligence
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-5 leading-tight">
            Best Franchise Opportunities<br className="hidden sm:block" /> in {city}
          </h1>
          <p className="text-lg text-emerald-100 max-w-2xl mx-auto mb-8 leading-relaxed">
            Compare franchise investment requirements, territory availability, and market fit using real demographic and economic data for {city}.
          </p>
          <button
            onClick={() => onNavigate('opportunities')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-emerald-700 font-black rounded-2xl hover:bg-emerald-50 transition-colors shadow-xl text-sm uppercase tracking-wide"
          >
            Explore Market Opportunities <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Why franchise */}
      <section className="py-16 bg-gray-50" aria-labelledby="why-franchise-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 id="why-franchise-heading" className="text-2xl font-black text-gray-900 mb-10 tracking-tight text-center">
            Why Buy a Franchise in {city}?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { Icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50', title: 'Proven System', desc: 'Established brand, training, and operations — lower learning curve than starting from scratch' },
              { Icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50', title: 'Financing Access', desc: 'SBA loans are easier to secure for franchises with track records and FDD disclosures' },
              { Icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50', title: 'Brand Recognition', desc: `${city} consumers already know and trust established franchise brands` },
              { Icon: Users, color: 'text-orange-600', bg: 'bg-orange-50', title: 'Network Support', desc: 'Access to national marketing, bulk purchasing, and peer franchisee networks' },
            ].map(({ Icon, color, bg, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category grid */}
      <section className="py-16" aria-labelledby="categories-heading">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 id="categories-heading" className="text-2xl font-black text-gray-900 mb-3 tracking-tight text-center">
            Franchise Categories in {city}
          </h2>
          <p className="text-gray-500 text-center text-sm mb-10 max-w-xl mx-auto">
            Investment ranges vary widely. BizScope helps you find the best category fit for your capital and background.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FRANCHISE_CATEGORIES.map(cat => (
              <div key={cat.name} className="bg-gray-50 rounded-2xl p-5 hover:bg-white hover:shadow-md hover:border hover:border-gray-100 transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{cat.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{cat.examples}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Investment range</span>
                  <span className="text-xs font-bold text-gray-700">{cat.investment}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Other cities */}
      <section className="py-12 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 text-center">
            Franchise Opportunities in Other Cities
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {FEATURED_CITIES.filter(c => c.slug !== citySlug).map(c => (
              <a
                key={c.slug}
                href={`/franchise-opportunities/${c.slug}`}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
              >
                {c.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-black mb-3 tracking-tight">Find Your Franchise Fit in {city}</h2>
          <p className="text-emerald-100 text-sm mb-7 leading-relaxed">
            Use BizScope to compare market demand, territory saturation, and ROI potential for franchise categories in {city} before you commit.
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-emerald-700 font-black rounded-2xl hover:bg-emerald-50 transition-colors shadow-xl text-sm uppercase tracking-wide"
          >
            Run Market Analysis <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <FAQSection faqs={faqs} title={`FAQ: Franchising in ${city}`} />
    </article>
  );
};
