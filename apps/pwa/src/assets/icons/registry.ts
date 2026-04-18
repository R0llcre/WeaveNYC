/**
 * Icon registry (W1C deliverable).
 *
 * Each value is the raw SVG markup for a 24x24 category icon. Strokes use
 * `currentColor` so the consuming component controls color via CSS tokens
 * (e.g. brand green, community purple, urgent orange).
 *
 * Intended consumer: `<Icon name="food" />` atom (W1B).
 * Usage: `dangerouslySetInnerHTML={{ __html: icons[name] }}` inside a
 * span whose `color` is set by the parent.
 *
 * Note: `role`/`aria-hidden` are intentionally omitted on the inner <svg>
 * because the wrapping Icon atom owns the a11y semantics.
 */

export const icons = {
  food: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M10 13h4"/></svg>`,
  meal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h16M5 14c0 3 3 6 7 6s7-3 7-6"/><path d="M9 6c1 1-1 2 0 4M14 5c1 1-1 2 0 4"/></svg>`,
  fresh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21Q12 15 14 12"/><path d="M14 12C18 10 20 12 19 15C17.5 17.5 14.5 16.5 14 12Z" fill="var(--illustration-soft, rgba(14,118,110,0.08))"/><path d="M15 13Q16.5 14 17 15.5"/></svg>`,
  general: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M10 11h4"/><path d="M10 14h4"/><path d="M10 17h3"/></svg>`,
  chat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5-3.6 7.5-8 7.5c-1 0-2-.2-2.9-.5L5 20l1-3.5C4.7 15.2 4 13.4 4 11.5Z"/></svg>`,
  health: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M12 10v4"/><path d="M10 12h4"/></svg>`,
  housing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V9l7-4 7 4v12"/><path d="M10 21v-5h4v5"/><rect x="8" y="9" width="2" height="2"/><rect x="14" y="9" width="2" height="2"/><rect x="8" y="13" width="2" height="2"/><rect x="14" y="13" width="2" height="2"/></svg>`,
  clothing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 4.5 7.5 7 11l2-1.2V20a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V9.8L17 11l2.5-3.5L15 4"/><path d="M9 4c0 1.7 1.3 3 3 3s3-1.3 3-3"/></svg>`,
  education: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l8 3-8 3-8-3 8-3z"/><path d="M16 5.5v3"/><path d="M4 16c3-2 6-2 8-1 2-1 5-1 8 1"/><path d="M12 15v-4"/><path d="M5 17q4-1 7 0"/><path d="M12 17q4-1 7 0"/></svg>`,
  transport: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="10" rx="2"/><path d="M4 13h16"/><path d="M20 9h2v6h-2"/><circle cx="8" cy="19" r="1.2"/><circle cx="16" cy="19" r="1.2"/></svg>`,
  money: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="12" rx="2"/><path d="M4 11h16"/><rect x="14" y="13" width="5" height="3" rx="1"/></svg>`,
  crisis: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"/><path d="M12 9v4M12 16v.01"/></svg>`,
  // W3 review M4: row-terminator chevron. Used by the Me hub for "tap to
  // drill down" affordances on anchor-styled Card rows. Kept stroke-based
  // so it inherits from `currentColor` and honors the Icon atom's tone.
  'chevron-right': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
  // W4 R3 H2 — Resource Detail actions row. Stroke-based so the Icon atom
  // can recolor via `currentColor` (same treatment as every other glyph
  // in the registry). The filled variant is the "bookmarked" state; the
  // outline variant is the "save to favorites" CTA.
  bookmark: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z"/></svg>`,
  'bookmark-filled': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z" fill="currentColor"/></svg>`,
  share: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l4 4M12 3l-4 4M12 3v14M6 14v6h12v-6"/></svg>`,
} as const;

export type IconName = keyof typeof icons;

export const iconNames: readonly IconName[] = Object.keys(icons) as IconName[];
