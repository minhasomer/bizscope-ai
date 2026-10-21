/**
 * Customer testimonials shown on the homepage.
 *
 * Only quotes the named person wrote or approved may be published: set
 * `approved: true` once they have confirmed the wording. Unapproved entries
 * (e.g. drafts sent to them for sign-off) are never rendered.
 * `photo` is a path under /public (e.g. '/testimonials/nisa.jpg'); without it
 * the card shows the person's initials.
 */
export interface Testimonial {
  name: string;
  /** e.g. "Founder, Storygirl Media". Leave empty if not provided. */
  title: string;
  quote: string;
  approved: boolean;
  photo?: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Nisa Bardien',
    title: 'Founder, Storygirl Media',
    quote:
      "I dropped business ideas I was clinging to after running them through BizScope. Saved me so much time and money chasing ideas that weren't going anywhere. Now I test every idea first. The numbers tell me straight if it's worth it.",
    approved: true,
    photo: '/testimonials/nisa.webp',
  },
  // Approved by the owner on 2026-10-20 (on behalf of both); titles/photos to follow.
  {
    name: 'Fiam Khan',
    title: '',
    quote:
      "Before BizScope I'd spend weeks asking around about whether an idea made sense. Now I get the competition, costs and local demand in one report, and I know where I stand in minutes.",
    approved: true,
  },
  {
    name: 'Rasul Taghiev',
    title: '',
    quote:
      "BizScope showed me how crowded my local market really was before I committed any money. It turned a gut feeling into a clear yes-or-no decision.",
    approved: true,
  },
];

export const publishedTestimonials = (): Testimonial[] =>
  TESTIMONIALS.filter((t) => t.approved && t.quote.trim().length > 0);
