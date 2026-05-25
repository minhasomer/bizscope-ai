import { useEffect } from 'react';
import { SEOMeta } from '../src/utils/seoUtils';

export function useSEO(meta: SEOMeta | null) {
  useEffect(() => {
    if (!meta) return;

    const prevTitle = document.title;
    document.title = meta.title;

    // Upsert a <meta> element. Returns the element and whether it was newly created.
    const upsertMeta = (
      attr: 'name' | 'property',
      attrValue: string,
      content: string,
    ): { el: HTMLMetaElement; fresh: boolean } => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${attrValue}"]`);
      const fresh = !el;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
      return { el, fresh };
    };

    // Collect elements created by this hook so we can remove them on cleanup.
    // Pre-existing elements (e.g. set in index.html) are left in the DOM on unmount.
    const created: Element[] = [];
    const track = ({ el, fresh }: { el: Element; fresh: boolean }) => {
      if (fresh) created.push(el);
    };

    track(upsertMeta('name', 'description', meta.description));
    track(upsertMeta('property', 'og:title', meta.ogTitle));
    track(upsertMeta('property', 'og:description', meta.ogDescription));
    track(upsertMeta('property', 'og:type', 'website'));
    track(upsertMeta('property', 'og:url', `https://bizscope.ai${meta.canonicalPath}`));

    // Canonical link
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const freshCanonical = !canonical;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `https://bizscope.ai${meta.canonicalPath}`);
    if (freshCanonical) created.push(canonical);

    return () => {
      document.title = prevTitle;
      // Remove elements we injected; leave pre-existing ones in place.
      created.forEach(el => el.remove());
    };
  }, [meta?.canonicalPath]);
}
