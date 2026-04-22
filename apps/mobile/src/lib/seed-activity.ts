/**
 * V2-C — front-end-only seeded neighbor activity for the Home ticker and
 * the anonymous community preview. No backend persistence; this file is
 * the sole source of truth for the rows the ticker rotates through and
 * for the 3 rows the anonymous `/community` tab previews.
 *
 * Why it's static data
 * --------------------
 * Before V2-C, 4 of 5 tabs read as socially dead to a first-time user —
 * `/community` was gated behind an invite code, `/post` opened a cold
 * composer, `/inbox` was empty. The social layer (community anchor +
 * neighbor vouching) is the product's core differentiator, and a brand
 * new user could not see a single neighbor interaction without signing
 * up first. This payload is the minimum viable "the neighborhood is
 * alive" signal that a demo / pilot user can see the moment they land
 * on Home. It is intentionally NOT wired to an API because:
 *
 *   1. The backend has no public "activity feed" endpoint yet. Shipping
 *      one only to unblock a visual ticker would bloat the critical
 *      path. A future V2-D can replace this with a real GET /v1/feed
 *      call once the backend lands.
 *   2. A real feed would need moderation + safety filtering. Seeded
 *      demo personas carry zero risk (no PII, no real request text).
 *   3. For pilot demos we want the ticker to be deterministic — same
 *      15 rows, same order, every session — so anchors can rehearse
 *      the script knowing what the ticker will show.
 *
 * Localization
 * ------------
 * Each row's display copy is an i18n key (`copyKey`) rather than a
 * pre-translated English string. The `ActivityTicker` component passes
 * the key through `t()` so the same row renders "Marisol offered extra
 * rice in Corona" in EN, "Marisol 在 Corona 分享多出来的米" in ZH,
 * etc. See `apps/pwa/src/lib/i18n.ts` for the tickerX keys.
 *
 * Neighborhood mix
 * ----------------
 * The 15 rows cover 5 NYC neighborhoods spanning 3 boroughs, biased
 * toward immigrant-heavy areas (Corona / Flushing / Jackson Heights /
 * Washington Heights / Sunset Park) plus a Long Island pilot row
 * (Farmingdale) that matches the fixture ZIP in the E2E resource smoke
 * test. This mirrors the WeaveNYC pilot geography without singling out
 * any one community.
 */

export type SeedActivityAction =
  | 'offered'
  | 'requested'
  | 'verified'
  | 'welcomed'
  | 'completed';

export type SeedActivityCategory =
  | 'food'
  | 'goods'
  | 'childcare'
  | 'transport'
  | 'translation'
  | 'pantry';

export type SeedActivityRow = {
  /** Stable identifier — used as the React key + testid suffix. */
  id: string;
  /** Display name. First + last-initial format ("Marisol Q."). */
  name: string;
  /** Pre-computed 2-letter monogram so the Avatar atom can skip parsing. */
  initials: string;
  /** Human-readable neighborhood, shown in the ticker card. */
  community: string;
  /**
   * Community ID used for the "click-through to join with hint" deep link.
   * Matches the shape the community-join screen resolves against — see
   * `community-join-screen.tsx` `?hint=` param handler.
   */
  communityId: string;
  action: SeedActivityAction;
  category: SeedActivityCategory;
  /**
   * i18n key for the ticker copy line. The `ActivityTicker` looks it up
   * via `useTranslations()` so each row localizes cleanly into EN/ES/ZH.
   */
  copyKey: string;
  /**
   * Decorative glyph/emoji reserved for future visual design. Kept as a
   * string for future-proofing but not currently rendered — the current
   * ticker relies on the Avatar monogram for identity, and we don't want
   * emoji leakage into the copy guidelines ("no emoji").
   */
  icon: string;
  /**
   * Minutes since the action happened, rendered via
   * `Intl.RelativeTimeFormat` in the ticker. Deterministic so the rows
   * stay stable across sessions.
   */
  minutesAgo: number;
  /**
   * Optional deep-link target. When omitted the ticker falls back to
   * `/community/join?hint={communityId}` so clicking any row funnels the
   * anonymous user toward the right community.
   */
  href?: string;
};

export const SEED_ACTIVITY: SeedActivityRow[] = [
  {
    id: 'marisol-rice',
    name: 'Marisol Q.',
    initials: 'MQ',
    community: 'Corona, Queens',
    communityId: 'community-11368',
    action: 'offered',
    category: 'food',
    copyKey: 'tickerMarisolRice',
    icon: 'food',
    minutesAgo: 2,
  },
  {
    id: 'dwayne-stroller',
    name: 'Dwayne O.',
    initials: 'DO',
    community: 'Corona, Queens',
    communityId: 'community-11368',
    action: 'requested',
    category: 'goods',
    copyKey: 'tickerDwayneStroller',
    icon: 'stroller',
    minutesAgo: 14,
  },
  {
    id: 'priya-welcome',
    name: 'Priya R.',
    initials: 'PR',
    community: 'Jackson Heights, Queens',
    communityId: 'community-11372',
    action: 'welcomed',
    category: 'translation',
    copyKey: 'tickerPriyaWelcome',
    icon: 'wave',
    minutesAgo: 22,
  },
  {
    id: 'jorge-transport',
    name: 'Jorge V.',
    initials: 'JV',
    community: 'Farmingdale, NY',
    communityId: 'community-11735',
    action: 'requested',
    category: 'transport',
    copyKey: 'tickerJorgeTransport',
    icon: 'car',
    minutesAgo: 38,
  },
  {
    id: 'jamal-pantry',
    name: 'Anchor Jamal',
    initials: 'AJ',
    community: 'Jackson Heights, Queens',
    communityId: 'community-11372',
    action: 'verified',
    category: 'pantry',
    copyKey: 'tickerJamalPantry',
    icon: 'shield',
    minutesAgo: 47,
  },
  {
    id: 'ling-translate',
    name: 'Ling C.',
    initials: 'LC',
    community: 'Flushing, Queens',
    communityId: 'community-11355',
    action: 'offered',
    category: 'translation',
    copyKey: 'tickerLingTranslate',
    icon: 'speech',
    minutesAgo: 58,
  },
  {
    id: 'ayesha-childcare',
    name: 'Ayesha S.',
    initials: 'AS',
    community: 'Flushing, Queens',
    communityId: 'community-11355',
    action: 'offered',
    category: 'childcare',
    copyKey: 'tickerAyeshaChildcare',
    icon: 'childcare',
    minutesAgo: 72,
  },
  {
    id: 'dev-bushwick-meal',
    name: 'Devon K.',
    initials: 'DK',
    community: 'Bushwick, Brooklyn',
    communityId: 'community-11221',
    action: 'completed',
    category: 'food',
    copyKey: 'tickerDevonMeal',
    icon: 'check',
    minutesAgo: 95,
  },
  {
    id: 'tasha-harlem-goods',
    name: 'Tasha W.',
    initials: 'TW',
    community: 'Harlem, Manhattan',
    communityId: 'community-10027',
    action: 'offered',
    category: 'goods',
    copyKey: 'tickerTashaCoats',
    icon: 'coat',
    minutesAgo: 108,
  },
  {
    id: 'anchor-mireya-verified',
    name: 'Anchor Mireya',
    initials: 'AM',
    community: 'Washington Heights, Manhattan',
    communityId: 'community-10032',
    action: 'verified',
    category: 'pantry',
    copyKey: 'tickerMireyaPantry',
    icon: 'shield',
    minutesAgo: 124,
  },
  {
    id: 'rafa-sunset-childcare',
    name: 'Rafa M.',
    initials: 'RM',
    community: 'Sunset Park, Brooklyn',
    communityId: 'community-11220',
    action: 'requested',
    category: 'childcare',
    copyKey: 'tickerRafaChildcare',
    icon: 'childcare',
    minutesAgo: 143,
  },
  {
    id: 'kira-washington-transport',
    name: 'Kira P.',
    initials: 'KP',
    community: 'Washington Heights, Manhattan',
    communityId: 'community-10032',
    action: 'offered',
    category: 'transport',
    copyKey: 'tickerKiraTransport',
    icon: 'car',
    minutesAgo: 168,
  },
  {
    id: 'omar-sunset-food',
    name: 'Omar F.',
    initials: 'OF',
    community: 'Sunset Park, Brooklyn',
    communityId: 'community-11220',
    action: 'offered',
    category: 'food',
    copyKey: 'tickerOmarBread',
    icon: 'bread',
    minutesAgo: 192,
  },
  {
    id: 'nadia-bushwick-welcome',
    name: 'Nadia H.',
    initials: 'NH',
    community: 'Bushwick, Brooklyn',
    communityId: 'community-11221',
    action: 'welcomed',
    category: 'translation',
    copyKey: 'tickerNadiaWelcome',
    icon: 'wave',
    minutesAgo: 220,
  },
  {
    id: 'carlos-harlem-completed',
    name: 'Carlos T.',
    initials: 'CT',
    community: 'Harlem, Manhattan',
    communityId: 'community-10027',
    action: 'completed',
    category: 'goods',
    copyKey: 'tickerCarlosBooks',
    icon: 'check',
    minutesAgo: 245,
  },
];

/**
 * A 3-row subset surfaced on the anonymous `/community` tab before a user
 * joins any community. Chosen to span 2 actions (offered / verified) +
 * 2 boroughs so the preview reads as "real community, multiple hands",
 * not just "one person posting". Referenced from `community-screen.tsx`.
 */
// M2 port note — mobile's tsconfig enables `noUncheckedIndexedAccess`
// which flags numeric array lookups as `T | undefined`. These three
// indices are hard-coded against the 15-row literal above; the `!`
// asserts what the compiler can't prove but a developer reading the
// file can trivially confirm by counting. If rows are ever reordered
// or removed, these three assertions are the first place to update.
export const SEED_PUBLIC_POSTS: SeedActivityRow[] = [
  SEED_ACTIVITY[0]!, // Marisol offered rice — Corona
  SEED_ACTIVITY[4]!, // Anchor Jamal verified pantry — Jackson Heights
  SEED_ACTIVITY[8]!, // Tasha offered coats — Harlem
];
