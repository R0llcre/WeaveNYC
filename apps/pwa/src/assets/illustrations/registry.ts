/**
 * Illustration registry (W1C deliverable).
 *
 * Each value is the raw SVG markup for a 240x180 empty-state illustration
 * (plus the 320x240 weave-pattern hero). Strokes use `currentColor`; soft
 * fills use a `--illustration-soft` CSS custom property with a tinted RGBA
 * fallback so a page can tint them per category without shipping a variant.
 *
 * All five empty-state illustrations share a small 3-leaf sprout motif
 * anchored near (30, 160) — the "WeaveNYC green thing that keeps growing"
 * signature.
 *
 * Intended consumers:
 *   `<EmptyState illustration="inbox-empty" />`  (W1B atom)
 *   Home hero background (weave-hero)
 *
 * Note: `role`/`aria-hidden` are intentionally omitted on the inner <svg>
 * because the wrapping EmptyState atom owns the a11y semantics.
 */

export const illustrations = {
  'inbox-empty': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="58" y="88" width="124" height="72" rx="4" fill="var(--illustration-soft, rgba(14,118,110,0.08))"/><path d="M58 160l50-36"/><path d="M182 160l-50-36"/><path d="M58 92l30 20"/><path d="M182 92l-30 20"/><path d="M88 112l32 -22 32 22"/><path d="M120 68v22"/><path d="M108 90q4 -18 12 -22"/><path d="M132 90q-4 -18 -12 -22"/><path d="M120 68v-18"/><path d="M120 58c-6 -2 -10 -8 -10 -12 6 0 10 4 10 8" fill="var(--illustration-soft, rgba(14,118,110,0.12))"/><path d="M120 58c6 -2 10 -8 10 -12 -6 0 -10 4 -10 8" fill="var(--illustration-soft, rgba(14,118,110,0.12))"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M24 170 h12"/><path d="M30 170 v-8"/><path d="M30 166 q-3 -2 -5 -1"/><path d="M30 164 q3 -2 5 -1"/><path d="M30 162 q-2 -3 0 -5"/></g></svg>`,
  'posts-empty': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="78" y="40" width="72" height="108" rx="6" fill="var(--illustration-soft, rgba(109,78,170,0.08))"/><rect x="102" y="30" width="24" height="14" rx="3"/><path d="M92 72h44"/><path d="M92 88h44"/><path d="M92 104h32"/><path d="M160 110l22-22a4 4 0 0 1 6 6l-22 22-8 2 2-8Z"/><path d="M176 94l6 6"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M24 170 h12"/><path d="M30 170 v-8"/><path d="M30 166 q-3 -2 -5 -1"/><path d="M30 164 q3 -2 5 -1"/><path d="M30 162 q-2 -3 0 -5"/></g></svg>`,
  'matches-empty': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M60 60h36v22a8 8 0 0 1 0 16v22H60V98a8 8 0 0 0 0-16V60Z" fill="var(--illustration-soft, rgba(14,118,110,0.08))"/><path d="M180 60h-36v22a8 8 0 0 0 0 16v22h36V98a8 8 0 0 1 0-16V60Z" fill="var(--illustration-soft, rgba(109,78,170,0.08))"/><path d="M96 90h48" stroke-dasharray="2 4"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M24 170 h12"/><path d="M30 170 v-8"/><path d="M30 166 q-3 -2 -5 -1"/><path d="M30 164 q3 -2 5 -1"/><path d="M30 162 q-2 -3 0 -5"/></g></svg>`,
  'search-empty': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M56 44l30 6 34-8 34 8 30-6v84l-30 6-34-8-34 8-34-8-30 6z" transform="translate(0 10)" fill="var(--illustration-soft, rgba(14,118,110,0.08))"/><path d="M90 52v84"/><path d="M124 44v84"/><path d="M158 52v84"/><circle cx="148" cy="104" r="22"/><path d="M164 120l14 14"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M24 170 h12"/><path d="M30 170 v-8"/><path d="M30 166 q-3 -2 -5 -1"/><path d="M30 164 q3 -2 5 -1"/><path d="M30 162 q-2 -3 0 -5"/></g></svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="120" cy="100" r="50" fill="var(--illustration-soft, rgba(209,116,25,0.1))"/><path d="M88 82c14 -6 30 -4 44 6 14 10 22 22 18 36"/><path d="M78 104c20 -2 40 6 52 22"/><path d="M90 128c18 6 36 4 50 -8"/><path d="M102 74c6 10 12 20 22 26"/><path d="M162 100 q15 5 10 15 q-10 10 -5 0 q5 -8 0 -10"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M24 170 h12"/><path d="M30 170 v-8"/><path d="M30 166 q-3 -2 -5 -1"/><path d="M30 164 q3 -2 5 -1"/><path d="M30 162 q-2 -3 0 -5"/></g></svg>`,
  'weave-hero': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity="0.35" stroke-linecap="round"><path d="M0 12h10 M14 12h10 M28 12h10 M42 12h6"/><path d="M0 28h20 M24 28h20 M48 28"/><path d="M0 44h10 M14 44h10 M28 44h10 M42 44h6"/><path d="M12 0v10 M12 14v10 M12 28v20"/><path d="M26 0v20 M26 24v14 M26 42v6"/><path d="M40 0v10 M40 14v10 M40 28v20"/></svg>`,
} as const;

export type IllustrationName = keyof typeof illustrations;

export const illustrationNames: readonly IllustrationName[] =
  Object.keys(illustrations) as IllustrationName[];
