import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  faqs: FAQItem[];
  title?: string;
}

export const FAQSection: React.FC<FAQSectionProps> = ({ faqs, title = 'Frequently Asked Questions' }) => {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    };

    const existing = document.getElementById('faq-schema');
    const el = existing ?? document.createElement('script');
    el.id = 'faq-schema';
    el.setAttribute('type', 'application/ld+json');
    el.textContent = JSON.stringify(schema);
    if (!existing) document.head.appendChild(el);

    return () => {
      document.getElementById('faq-schema')?.remove();
    };
  }, [faqs]);

  return (
    <section className="py-16 bg-white" aria-labelledby="faq-heading">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h2 id="faq-heading" className="text-2xl font-black text-gray-900 mb-8 text-center tracking-tight">
          {title}
        </h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
                aria-expanded={open === i}
              >
                <span className="text-sm font-bold text-gray-900">{faq.question}</span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              <div className={`overflow-hidden transition-all duration-200 ${open === i ? 'max-h-96' : 'max-h-0'}`}>
                <p className="px-6 pb-5 text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
