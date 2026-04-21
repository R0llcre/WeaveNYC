# Skeptic Q&A

Three hostile questions you are likely to get. Two-sentence answers. Every answer points to a merged PR so the skeptic can verify.

---

### Q1. "Do you have real users yet?"

**No.** The pilot is gated on partner MOU signatures for three communities (Farmingdale 11735, Queens Corona 11368, Bronx Hunts Point 10474), and until those sign, we do not open the front door. Every code path connects to real production backends — flipping go-live is one env var (`PILOT_INVITE_MODE=open`), not a code deploy. See [`29_M8_Pilot_Readiness.md §1`](../29_M8_Pilot_Readiness.md#1-gono-go-checklist) and [`known-gaps.md`](./known-gaps.md).

---

### Q2. "What about PII? You are a stranger-to-stranger mutual-aid app — how do you handle personally identifying information?"

**Three layers, all enforced server-side:**
1. **Pino log redaction + Sentry `beforeSend` scrub** (PR #64) — `password`, `access_token`, `refresh_token`, `authorization`, `req.body.email`, `req.body.phone` are replaced with `[Redacted]` before any line reaches CloudWatch or Sentry; `beforeSend` drops events whose message contains an E.164 phone or Luhn-valid bank number even if they leak into a stack trace.
2. **Chat-safety classifier** (PR #57) blocks messages containing E.164 phone numbers, Luhn-valid bank account numbers, and a hate/harassment blocklist — enforcement runs on the server inside `/v1/conversations/:id/messages`, not on the client, so curl cannot bypass it.
3. **Block-fanout scrub** (PR #62) strips the blocker's user ID from any event that fans out via the WebSocket after a block — so an abuser never sees that the victim has blocked them.

---

### Q3. "How do you handle an abusive user? What stops someone from spinning up accounts and harassing a whole community?"

**Three layers, from chat to socket:**
1. **Content blocklist at the chat-safety gate** (PR #57) — server-side reject, with a human-readable safety reason returned to the client for UI display (PR #63).
2. **WS Origin check + per-IP rate-limits on `/v1/community-access/resolve`** (PR #62) — blocks cross-origin socket connections and brute-force community-enumeration.
3. **Block-disconnect** (PR #58) — when a user blocks an abuser, the server immediately severs the abuser's open WebSocket in addition to future-fanout scrubbing, so the abuser cannot keep sending live messages on an already-authenticated connection. Plus: anchor admins have [a report queue](../../apps/anchor-admin) (reviewed per-community) to escalate to community-wide mute.
