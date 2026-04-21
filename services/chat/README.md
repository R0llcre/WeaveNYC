# Chat Service

M4 status: real chat domain library.

This package owns the chat-domain rules that sit underneath the future API and
realtime transport:

- conversation list/detail metadata
- paginated message history
- send message and close conversation semantics
- block/report helpers
- safety detection hooks before delivery

It does not boot a standalone HTTP or websocket runtime by itself.

---

## Safety phrase list

The chat service rejects outbound messages whose body matches a hate-speech
or harassment pattern from [`src/safety-phrases.ts`](./src/safety-phrases.ts).
Coverage is intentionally tri-lingual (English, Spanish, Simplified Chinese)
to match the NYC pilot communities; see [`../../docs/10_Security_Privacy_Threat_Model.md`](../../docs/10_Security_Privacy_Threat_Model.md) for the user-facing privacy + safety statement this list supports.

**Why it lives in-tree, not in runtime config.** A blocklist is an
audit-able policy surface. Keeping it in source means every change is a
reviewable diff in git history — a runtime config knob would let anyone
with ops access silently tighten or loosen moderation without a paper
trail.

### Adding a new language

1. Edit `src/safety-phrases.ts`:
   - Add regex entries to `HATE_PATTERNS` and, if harassment coverage is
     needed, `HARASSMENT_PATTERNS`. For scripts without whitespace word
     boundaries (CJK, Thai, etc.) match the literal sequences; for Latin
     scripts prefer `\b…\b` with letter-class leetspeak tolerance (see
     the English / Spanish sections for the house style).
   - Keep roughly 10 high-confidence terms per language for M7 pilot
     parity. Aim for conservative false-negative-friendly coverage —
     false positives against ordinary neighborly language are a worse
     failure mode than a missed slur.
2. Add unit-test fixtures covering (a) one matched slur per new pattern
   and (b) at least one near-miss substring that must NOT match.
3. Update this README section if the new language has language-specific
   review notes (e.g., dialects, script variants, polysemy traps).

### Review process

Additions must be a code change reviewed by **at least one team member**
other than the author. The reviewer should:

- run the chat unit tests (`pnpm --filter @weavenyc/chat test`) to
  confirm the new patterns block their intended inputs and do not trip
  the near-miss fixtures;
- sanity-check for false positives on common neighborly phrases in the
  target language;
- verify that the community-facing documentation in
  [`../../docs/10_Security_Privacy_Threat_Model.md`](../../docs/10_Security_Privacy_Threat_Model.md)
  is still accurate if scope expanded beyond "hate speech and
  harassment".

Never remove a pattern without a matched, dated justification in the
commit message — a removal is a policy rollback and must be as
reviewable as an addition.
