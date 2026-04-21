/**
 * WeaveNYC chat safety blocklist — hate speech and harassment patterns.
 *
 * Coverage: English, Spanish, and Simplified Chinese (NYC tri-lingual pilot).
 * The lists are intentionally conservative for M7 pilot rollout — false
 * negatives are acceptable, false positives against ordinary neighborly
 * language are not. All patterns are word-boundary anchored where the
 * target script supports boundaries (English, Spanish) and
 * character-sequence anchored for Simplified Chinese (which has no
 * whitespace word boundaries).
 *
 * Not a moderation silver bullet: the purpose here is to fail send() on
 * the common slur / abuse case so a verified neighbor cannot trivially
 * push hate speech through 1:1 chat. Longer-tail moderation still flows
 * through the existing report queue.
 *
 * Keep the list in-tree (no remote fetch) for pilot simplicity. Any
 * additions should ship as a reviewable code change, not a runtime
 * config change — this file is the audit trail.
 *
 * All English/Spanish regex expressions are case-insensitive with `\b`
 * boundaries so substrings like "classic" don't trip an "ass" match.
 *
 * The actual slur tokens below are written as character classes with
 * obvious obfuscation letters (e.g., `[a@]`) so the regex catches the
 * typical leetspeak bypasses without requiring an opaque normalization
 * step on every message.
 */

/**
 * Hate-speech patterns: slurs + organized-hate terminology across EN / ES / ZH.
 * Roughly 10 terms per language. Block on match.
 */
export const HATE_PATTERNS: RegExp[] = [
  // English slurs (racial, ethnic, religious, homophobic, transphobic,
  // ableist). Using letter classes so trivial leet substitutions
  // still match.
  /\bn[i1!][gq]{2}[e3]rs?\b/i,
  /\bn[i1!][gq]{2}a[hz]?\b/i,
  /\bf[a@]gg?[o0]ts?\b/i,
  /\bf[a@]gs?\b/i,
  /\btr[a@]nn(?:y|ies)\b/i,
  /\bch[i1]nks?\b/i,
  /\bsp[i1]cs?\b/i,
  /\bk[i1]kes?\b/i,
  /\bw[e3]tb[a@]cks?\b/i,
  /\br[e3]t[a@]rds?\b/i,
  /\bwh[i1]te\s*p[o0]w[e3]r\b/i,
  /\bheil\s*hitler\b/i,

  // Spanish slurs (anti-Black, anti-indigenous, homophobic,
  // transphobic, xenophobic, ableist). All common NYC-Latino-community
  // terms that would flag in a neighborly context.
  /\bm[a@]r[i1]c[o0]n(?:es|as)?\b/i,
  /\bm[a@]r[i1]c[o0]na?s?\b/i,
  /\bp[a@]t[o0]s?\b/i, // homophobic slur in Caribbean Spanish
  /\bjot[o0]s?\b/i, // homophobic slur in Mexican Spanish
  /\bn[e3]gr[a@]ta?s?\b/i,
  /\bs[u3]dac[a@]s?\b/i,
  /\bind[i1][o0]\s*de\s*m[i1]erda\b/i,
  /\bch[o0]l[o0]\s*de\s*m[i1]erda\b/i,
  /\bmuert[e3]\s*a\s*los\s*(?:jud[i1]os|negros|gays|maricones)\b/i,
  /\bretr[a@]sad[o0]s?\b/i,
  /\bmong[o0]l[i1]c[o0]s?\b/i, // ableist slur

  // Simplified Chinese slurs (anti-Black, anti-Japanese,
  // anti-Uyghur/Muslim, homophobic, ableist, regionalist). No word
  // boundaries in CJK script — match the literal sequences. These are
  // the canonical offensive terms rather than every creative variant.
  /黑鬼/,
  /黑猩猩/,
  /小日本/,
  /日本鬼子/,
  /支那(?:人|猪)?/,
  /回回猪/,
  /死基佬/,
  /娘炮/,
  /人妖/,
  /白痴/,
  /智障/,
  /乡巴佬/,
];

/**
 * Harassment patterns: threats, doxxing invitations, slurs-adjacent
 * targeted abuse that is not strictly a protected-class slur but still
 * must hard-block in a 1:1 pilot chat. Roughly 6 terms per language.
 */
export const HARASSMENT_PATTERNS: RegExp[] = [
  // English threats / targeted abuse.
  /\b(?:i\s*(?:will|ll|'ll|am\s*going\s*to|'m\s*gonna|m\s*gonna|gonna))\s*(?:kill|murder|rape|hurt|beat)\s*(?:you|u|ur|your|yr)\b/i,
  /\bkill\s*yoursel(?:f|ves)\b/i,
  /\bk\s*y\s*s\b/i, // the "kys" abbreviation
  /\b(?:go\s*)?(?:die|rot)\s*in\s*(?:hell|a\s*ditch|a\s*fire)\b/i,
  /\bi\s*(?:hope|wish)\s*you\s*(?:die|get\s*raped|rot)\b/i,
  /\bshut\s*the\s*fuck\s*up\s*(?:you|u)\b/i,
  /\bfuck\s*(?:you|u)\s*(?:and\s*your|n\s*ur)\s*(?:family|mother|kids)\b/i,
  /\bi\s*(?:know|have)\s*your\s*(?:address|home|kids|family)\b/i,

  // Spanish threats / targeted abuse.
  /\bte\s*voy\s*a\s*(?:matar|violar|golpear|cortar|quemar)\b/i,
  /\bm[a@]tate\b/i,
  /\bojal[a@]\s*te\s*(?:mueras|violen|maten)\b/i,
  /\bvete\s*a\s*la\s*(?:mierda|chingada|verga)\b/i,
  /\bhij[o0]\s*de\s*(?:puta|perra|mil\s*putas)\b/i,
  /\bs[e3]\s*d[o0]nd[e3]\s*v[i1]v[e3]s\b/i, // "I know where you live"

  // Simplified Chinese threats / targeted abuse.
  /我要(?:杀|打死|弄死|捅死)你/,
  /去死吧/,
  /滚去死/,
  /操你(?:妈|全家|祖宗)/,
  /你全家(?:去死|死光)/,
  /我知道你(?:住|家)在哪/,
];
