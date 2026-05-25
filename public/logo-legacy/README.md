# BizScope Legacy Logo — Revert Guide

## Original logo state (before SVG install)

The original logo was **text-only** — no image assets. To revert, remove the `<img>` tags and restore the text below.

---

### Navbar.tsx (original logo block, lines ~76–87)

```tsx
<button
  onClick={() => onNavigate('home')}
  className="text-xl font-black text-slate-900 tracking-tight hover:opacity-80 transition-opacity cursor-pointer"
>
  BizScope <span className="text-indigo-600">AI</span>
</button>
```

### Footer.tsx (original brand column heading, line ~116)

```tsx
<h3 className="text-base font-bold text-white mb-2 tracking-tight">
  BizScope <span className="text-indigo-400">AI</span>
</h3>
```

### index.html (original favicon, line 5)

```html
<link rel="icon" type="image/svg+xml" href="/vite.svg" />
```

Note: `/vite.svg` was already a 404 (no `public/` directory existed), so the revert restores the original broken state.

---

## New logo asset

- **File:** `/public/logo.svg`
- **Design:** circular magnifying glass scope ring (330° arc), 3 ascending bar charts, diagonal trend arrow, 4-point sparkle, floating particle dots
- **Colors:** violet (#7c3aed) → blue (#3b82f6) → cyan (#06b6d4) gradient, lower-left to upper-right
- **ViewBox:** 48×48

## To revert completely

1. Remove `/public/logo.svg` (or keep it, it won't be referenced)
2. Restore the text blocks above in `Navbar.tsx` and `Footer.tsx`
3. Restore the favicon `href` in `index.html`
