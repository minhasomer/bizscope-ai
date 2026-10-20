import React from 'react';
import { Quote } from 'lucide-react';
import { publishedTestimonials } from '../src/data/testimonials';

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');

/** Homepage social proof. Renders nothing until at least one testimonial has approved text. */
export const Testimonials: React.FC = () => {
  const items = publishedTestimonials();
  if (items.length === 0) return null;

  return (
    <section className="bg-slate-50 py-12 sm:py-14 border-t border-slate-200">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8">
          What founders are saying
        </h2>
        <div className="flex flex-wrap justify-center gap-6">
          {items.map((t) => (
            <figure
              key={t.name}
              className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-md flex flex-col p-6 rounded-2xl bg-white border border-slate-200 shadow-sm"
            >
              <Quote className="w-7 h-7 text-indigo-300 mb-3" aria-hidden="true" />
              <blockquote className="flex-1 text-slate-700 text-[15px] leading-relaxed">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                {t.photo ? (
                  <img src={t.photo} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center"
                  >
                    {initials(t.name)}
                  </span>
                )}
                <span className="text-left">
                  <span className="block text-sm font-bold text-slate-900">{t.name}</span>
                  {t.title && <span className="block text-sm text-slate-500">{t.title}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};
