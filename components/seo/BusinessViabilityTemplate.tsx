import React from 'react';
import { useSEO } from '../../hooks/useSEO';
import { FAQSection, FAQItem } from './FAQSection';
import { getBusinessViabilityMeta, slugToCity, slugToBusiness, FEATURED_CITIES, FEATURED_BUSINESSES } from '../../src/utils/seoUtils';
import { CheckCircle, XCircle, ArrowRight, BarChart2 } from 'lucide-react';

interface BusinessViabilityTemplateProps {
  businessSlug: string;
  citySlug: string;
  onNavigate: (page: string) => void;
}

export const BusinessViabilityTemplate: React.FC<BusinessViabilityTemplateProps> = ({ businessSlug, citySlug, onNavigate }) => {
  const meta = getBusinessViabilityMeta(businessSlug, citySlug);
  const city = slugToCity(citySlug);
  const business = slugToBusiness(businessSlug);
  useSEO(meta);

  const pros = [
    `Strong consumer demand for ${business} services in ${city}`,
    'Established supply chains and vendor networks in the metro area',
    'Diverse customer base with varied income levels and spending patterns',
    'Access to experienced local workforce and training resources',
  ];

  const cons = [
    `Existing ${business} operators may have entrenched market share`,
    `High commercial real estate costs in prime ${city} neighborhoods`,
    'Local regulatory requirements may add startup timeline and cost',
    'Seasonal demand fluctuations common in this business category',
  ];

  const faqs: FAQItem[] = [
    {
      question: `Is a ${business} viable in ${city}?`,
      answer: `A ${business} can be viable in ${city} depending on location, capital, and competitive positioning. BizScope analyzes local demographics, competitor density by ZIP code, and economic indicators to give you a viability score and specific recommendations before you invest.`,
    },
    {
      question: `How much does it cost to start a ${business} in ${city}?`,
      answer: `Startup costs for a ${business} in ${city} vary based on size, location, and buildout requirements. BizScope provides a detailed cost breakdown including equipment, permits, real estate, staffing, and working capital based on current ${city} market data.`,
    },
    {
      question: `Who are the customers for a ${business} in ${city}?`,
      answer: `${city} has a diverse consumer base. BizScope identifies the specific demographic and psychographic profile most likely to patronize a ${business} in your target area, including age ranges, income levels, and spending behavior patterns.`,
    },
    {
      question: `How long until a ${business} in ${city} becomes profitable?`,
      answer: `Typical time-to-profitability for a ${business} ranges from 18–36 months depending on startup capital, location quality, and competitive pressure. BizScope models revenue ramp scenarios based on comparable businesses in ${city}.`,
    },
    {
      question: `What permits do I need to open a ${business} in ${city}?`,
      answer: `Permit requirements for a ${business} in ${city} typically include a general business license, any industry-specific health or safety permits, zoning approval, and possibly a state-level professional license. Requirements vary by municipality — consult ${city}'s city clerk or a local business attorney for the complete list.`,
    },
  ];

  return (
    <article className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-900 text-white py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border border-white/20">
            <BarChart2 className="w-3 h-3" /> Viability Report
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-5 leading-tight">
            {business} Viability<br className="hidden sm:block" /> in {city}
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-8 leading-relaxed">
            Is a {business} a good investment in {city}? AI-powered analysis of startup costs, local competition, demographics, and revenue potential.
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-black rounded-2xl hover:bg-blue-50 transition-colors shadow-xl text-sm uppercase tracking-wide"
          >
            Run Full Viability Report <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Pros & Cons */}
      <section className="py-16 bg-gray-50" aria-labelledby="analysis-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 id="analysis-heading" className="text-2xl font-black text-gray-900 mb-10 tracking-tight text-center">
            {business} in {city}: Key Factors
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-green-100 p-6">
              <h3 className="text-sm font-black text-green-700 uppercase tracking-widest mb-5 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Market Strengths
              </h3>
              <ul className="space-y-3">
                {pros.map((pro, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-red-100 p-6">
              <h3 className="text-sm font-black text-red-700 uppercase tracking-widest mb-5 flex items-center gap-2">
                <XCircle className="w-4 h-4" /> Challenges to Consider
              </h3>
              <ul className="space-y-3">
                {cons.map((con, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Key metrics preview */}
      <section className="py-16" aria-labelledby="metrics-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 id="metrics-heading" className="text-2xl font-black text-gray-900 mb-8 tracking-tight text-center">
            What You'll Get in a Full Report
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Opportunity Score', icon: '📊', desc: '0–100 composite rating' },
              { label: 'Startup Cost Range', icon: '💰', desc: 'Min–max with breakdown' },
              { label: 'ZIP-Level Map', icon: '🗺️', desc: 'Best neighborhoods to open' },
              { label: 'Revenue Projection', icon: '📈', desc: 'Year 1–3 estimates' },
            ].map(metric => (
              <div key={metric.label} className="bg-gray-50 rounded-2xl p-5 text-center">
                <div className="text-2xl mb-2">{metric.icon}</div>
                <p className="text-xs font-black text-gray-700 mb-1">{metric.label}</p>
                <p className="text-[11px] text-gray-400">{metric.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related cities */}
      <section className="py-12 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 text-center">
            {business} Viability in Other Cities
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {FEATURED_CITIES.filter(c => c.slug !== citySlug).map(c => (
              <a
                key={c.slug}
                href={`/viability/${businessSlug}/${c.slug}`}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
              >
                {business} in {c.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Related business types */}
      <section className="py-12 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 text-center">
            Other Business Types in {city}
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {FEATURED_BUSINESSES.filter(b => b.slug !== businessSlug).map(biz => (
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
      <section className="py-16 bg-gradient-to-br from-gray-900 to-blue-950 text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-black mb-3 tracking-tight">Get the Full {business} Report for {city}</h2>
          <p className="text-gray-300 text-sm mb-7 leading-relaxed">
            Detailed AI analysis including competitor mapping, demographic profiles, and ZIP-level opportunity scores — before you sign a lease or write a check.
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 font-black rounded-2xl hover:bg-gray-100 transition-colors shadow-xl text-sm uppercase tracking-wide"
          >
            Analyze {business} in {city} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <FAQSection faqs={faqs} title={`FAQ: ${business} in ${city}`} />
    </article>
  );
};
