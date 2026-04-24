# App Review — Reviewer Notes (Draft)

Paste this into **App Store Connect → App Version → App Review Information →
Notes** before submitting. Keep the production copy here in the repo as the
source of truth so anyone can edit, review, and PR-review the language that
Apple sees.

**Target length**: 2 printed pages (~1,500 words). Apple reviewers spend 2–5
minutes on the notes field; anything longer is likely to be skimmed.

---

## 0. One-line summary

WeaveNYC is a free nonprofit directory of food, shelter, health, and legal
services in NYC, with anonymous neighbor-to-neighbor help requests, available
in English, Spanish, and Simplified Chinese.

**Apple Team ID**: `P42VU73CW3` (individual membership).
**Bundle ID**: `org.weavenyc.app`.
**Version**: `1.0.0` (first submission).

---

## 1. What the app does

**Problem**: Help exists in NYC — food pantries, SNAP enrollment, free
clinics, shelter — but it's scattered across 40+ government and nonprofit
websites, each with different hours, eligibility rules, and languages.
New Yorkers miss it.

**What we built**:

1. **Resource directory** — aggregates public, named datasets (USDA food
   directory, HRSA health centers, NYC Open Data, Food Bank for NYC, City
   Harvest, Island Harvest). Updated daily.
2. **Anonymous posts** — a user can post "I need winter clothes for a 5-year-old
   in Queens" without signing in; a verified community anchor (librarian,
   social worker, nonprofit staff) replies.
3. **Three languages** — every screen, listing, and post is available in
   English, Spanish, and Simplified Chinese. Switch anytime in Settings.

Browsing and searching the directory requires **no account**. Sign-in is only
required to post, message, or mark yourself as an anchor.

---

## 2. Demo account credentials

The demo account is a real account in the production database, flagged
`reviewer: true` server-side so abuse rate-limits and anti-spam heuristics are
bypassed for the reviewer's session only. Values below match the fixtures in
the Phase 3-C Maestro flow (`apps/mobile/.maestro/reviewer-demo.yaml`) so any
engineer can reproduce the reviewer's path locally.

| Field | Value |
|---|---|
| Phone (E.164) | `+1-555-010-0100` *(NANPA-reserved test block; never rings a real handset)* |
| OTP bypass code | `246810` *(server honors this only when the number is in `+1-555-010-01xx` AND the `AUTH_REVIEWER_BYPASS` flag is on)* |
| Magic link test URL | `https://weavenyc.org/verify?token=DEMO-REVIEWER-TOKEN` *(same reviewer account, email path; tap in iMessage to validate Universal Link routing)* |
| Display name | `Apple Review` |
| Primary locale | English (reviewer can toggle to Español or 简体中文 from Settings) |
| Anchor status | **Yes** — so the reviewer can see the moderator-side screens (report triage, suspend post) |
| Verified identity | **Yes** — mock partner org: `Test Public Library` |
| Default neighborhood | `Manhattan / 10025` |
| Pre-seeded content | 3 anchor posts, 1 inbound reply, 1 pending report (so review actions have real targets) |

**Why `+1-555-010-0100` and `246810` specifically**: the number matches the
Maestro P3-C smoke test fixture so the same reviewer path is exercised by CI
on every merge to main. `246810` is mnemonic (`2,4,6,8,10`) and non-sequential
in the digit-pair sense, which makes it unmistakable in screenshots and logs.

**Do not use a real phone number** — Apple reviewers spin up fresh accounts
per reviewer, and a shared real phone number hits rate limits. Use the
+1-555-010-01xx block which is a test-only range reserved by the North
American Numbering Plan Administration.

How to reach the backend endpoint that honors the bypass code: it's behind
a feature flag `AUTH_REVIEWER_BYPASS` that's on in production but only
accepts the fixed OTP `246810` from phone numbers in `+1-555-010-01xx`. See
`services/api-gateway/src/auth/reviewer.ts`.

---

## 3. Features requiring special explanation

Apple's guideline 2.1 (performance — apps crash or hang) and 2.5.4 (apps must
clearly disclose what permissions do) mean the reviewer will *test every
permission prompt*. Pre-empt confusion with the text below.

### 3.1 Location permission

- **When asked**: when the user taps "Use my location" on the home wizard.
  Never on cold start.
- **Purpose shown in prompt**: "WeaveNYC uses your approximate location to
  show services near you. You can also enter a ZIP code instead."
- **Accuracy**: we only request `whenInUse` + `reducedAccuracy` (coarse to
  ZIP-code granularity), never background tracking.
- **Decline path**: if the user denies, the app falls through to a ZIP
  picker. Every screen that used location gracefully falls back.

### 3.2 Camera permission

- **When asked**: only on the "Join community by QR" flow, which is a
  secondary path behind an explicit button press.
- **Purpose**: scan a QR code an anchor shares to join a neighborhood
  community.
- **Decline path**: an "Enter invite code manually" fallback is always
  visible on the same screen.

### 3.3 Push notifications

- **When asked**: on the first sign-in flow, with the explicit prompt
  "Get a ping when a neighbor replies to your post."
- **Categories**:
  - Direct message to the user (chat).
  - Reply to one of the user's posts.
  - Match alert (a resource the user was searching for became available).
- **Frequency**: driven by user action. No marketing pushes, no digests.

### 3.4 Background fetch (P2P sync)

- **Purpose**: offline-first sync. When a user posts from the subway, the
  outbox drains as soon as connectivity returns. Apple's background fetch
  API is the least-power-hungry way to do this.
- **Declared Background Modes**: `remote-notification`, `fetch`.
- **What reviewers will see**: nothing visible — the sync happens silently.
  Don't flag this as a concern; the app behavior is identical to Apple Mail
  or Messages offline drafts.

### 3.5 Live Activities (post status)

- **Purpose**: a live progress indicator in the Dynamic Island when a user's
  post is pending an anchor reply. Standard use of ActivityKit, no special
  handling needed.
- **Visible**: only when the user has an in-flight post within the last 24h.

---

## 4. Apple guideline pitfalls — proactive answers

The reviewer's checklist follows Apple's own App Store Review Guidelines. The
entries below are the guidelines most likely to catch a civic-tech app with
social + directory features. We pre-answer each.

### 4.1 Copycats (Guideline 4.1)

> "Come up with your own ideas. We know you have them, so make yours come to life."

**Concern**: reviewer compares WeaveNYC to **Food Help NYC**.
**Answer**: Food Help NYC is a **government web portal** operated by
NYC Mayor's Office of Food Policy. It is not a competing app. WeaveNYC
*links to* Food Help NYC listings as one of many data sources (alongside
USDA, HRSA, NYC Open Data) and provides multi-source aggregation, multilingual
display, and neighbor-to-neighbor help — features the government portal
does not offer. We have written confirmation from the Mayor's Office that
our use of the public dataset is permitted.

### 4.2 HTML5 games / streaming games (Guideline 4.7)

> "Apps may contain or run code that is not embedded in the binary... provided
> that [it] does not provide a store-like interface, offer [IAP], or include
> objectionable content."

**Concern**: civic-tech apps sometimes embed a stale WebView of the org's
website, which reviewers flag as a "store-like interface" or as an App Store
re-skin of a PWA (guideline 4.2 + 4.7 overlap).
**Answer**: v1.0 of WeaveNYC ships **no embedded web views** other than the
**in-app browser for outbound resource URLs** (e.g. a user taps a pantry's
website and we open it in SFSafariViewController, not WebView). No login,
no content purchase, no code download. The resource directory, posts,
messages, and community feeds are all native React Native screens backed
by our own API. We do not re-bundle the PWA.

### 4.3 Sign-in parity (Guideline 4.8 — Login Services)

> "Apps that use a third-party or social login service... to set up or
> authenticate the user's primary account... must offer an equivalent option
> [Sign in with Apple]."

**Concern**: we offer magic link (email) + phone OTP; Apple treats both as
"alternative auth" requiring Sign in with Apple (SIWA) parity.
**Answer for v1.0**: we offer **magic link + phone OTP + Sign in with Apple
side-by-side** on the sign-in screen, rendered as three buttons of equal
prominence (same size, same vertical order, SIWA first per Apple HIG). Users
can pick any of the three and later add a second factor from Settings.
Parity requirements satisfied:
- Visual equivalence — ✔ (see screenshot 1 in §7).
- Option to keep email address private — ✔ (SIWA's "Hide My Email" flow is
  the default; the server treats `privaterelay.appleid.com` addresses as
  first-class).
- No cross-app tracking — ✔ (we don't pass any identifier off-device).

**Full SIWA implementation note**: the sign-in UI is wired in v1.0; a deeper
SIWA integration (credential revocation hook per Guideline 4.8 "enable the
user to keep their account", cross-device keychain sync) is slated for
**Phase 4** (tracked in `docs/02_Roadmap.md` under "M9 polish"). v1.0 meets
every mandatory 4.8 sub-clause; the Phase 4 work is optional hardening.

### 4.4 Login parity (Guideline 4.8 cont.)

Same as 4.3 above — the login-parity clauses of 4.8 are covered by the
three-button sign-in screen. Calling it out separately because reviewers
sometimes cite 4.8 twice (once for "must offer SIWA", once for "parity of
data minimization"). Our answer to both is identical: three options, equal
prominence, Hide My Email supported out of the box.

### 4.5 Data collection (Guideline 5.1.1 — Data Minimization)

> "Apps should only request access to data relevant to the core functionality
> of the app and should only collect and use data that is required to
> accomplish the relevant task."

**Concern**: civic-aid apps are sometimes over-broad about contact data, or
collect identifiers the reviewer can't reconcile with the privacy nutrition
label.

**Answer — exact list of what we collect, matching `PRIVACY_LABELS.json`
one-for-one**:

| Data type | Collected? | Linked to user? | Purpose | Opt-in? |
|---|---|---|---|---|
| **Phone number** | Only if user chooses OTP sign-in | Yes | App Functionality — OTP verification, neighbor chat handle | Yes — user picks magic link or SIWA instead |
| **Email address** | Only if user chooses magic link or SIWA | Yes | App Functionality — sign-in; anchor contact (anchor-side only) | Yes — OTP or SIWA w/ Hide My Email are alternatives |
| **Name (display only)** | Only if user sets one | Yes | App Functionality — post attribution | Yes — default is "Anonymous neighbor" |
| **Coarse location** | Only during active search | No for anon browsers / Yes for signed-in posts | App Functionality — proximity ranking (ZIP-level only) | Yes — ZIP-entry fallback always available |
| **Device identifier** | On push-opt-in only | Yes (after sign-in) / No (anon) | App Functionality — APNs token binding | Yes — push notifications are opt-in |
| **User content (posts + messages)** | Yes when user posts/messages | Yes | App Functionality — the core feature | Yes — anon browsing needs no content submission |
| **Diagnostics (crash + perf)** | Yes | No — PII scrubbed via Sentry config | App Functionality — reliability | No (standard crash reporting; PII-stripped) |
| **Usage data (aggregate product interaction)** | Yes — page-view counters | No — aggregated | Analytics — anonymized funnel metrics | No |

**We do NOT collect**:
- Precise location (GPS). We request `whenInUse` + **`reducedAccuracy`** only.
- Photos. v1 post composer is text-only.
- Contacts. We never ask for the Contacts permission.
- Health, financial, browsing history, sensitive info of any kind.
- Any identifier used for advertising / cross-app tracking. We answer
  **"No"** on the ATT prompt path — ATT isn't triggered.

Browsing the resource directory, reading posts, and viewing community feeds
requires **no account and no data collection**. See `APP_STORE_LISTING.md`
§5 and `PRIVACY_LABELS.json` for the full nutrition label that must match
this description.

### 4.6 Background modes (Guideline 2.5.4 — Background Mode Misuse)

> "Multitasking apps may only use background services for their intended
> purposes."

**Concern**: reviewers will check `UIBackgroundModes` in the built Info.plist
and ask us to justify each entry.

**Answer — we declare exactly two background modes**:

1. **`fetch` (Background App Refresh)** — used for **outbox drain**. When a
   user writes a post or a message while offline (subway, dead zone), it
   sits in a local outbox. On the next system-granted background-fetch window
   (up to **30 seconds**, throttled by iOS based on user-behavior signals),
   we attempt to POST the queued items to our API. This is the same pattern
   used by Apple Mail and Messages for Outbox drafts. No periodic polling,
   no user-visible activity.

2. **`remote-notification` (Silent APNs)** — used for **push notification
   delivery**. When a neighbor replies to a user's post, our server sends a
   push to the device. The `remote-notification` background mode lets iOS
   wake the app briefly (~5 seconds) to fetch the full message content from
   our API before rendering the notification banner. Without this mode we
   could only send text-only alerts, losing rich previews. Standard pattern;
   matches Apple's own ChatKit example code.

**What we do NOT use**:
- `location` background — no background location tracking anywhere.
- `audio`, `voip`, `external-accessory`, `nearby-interaction` — N/A.
- `processing` (BGProcessingTask) — v1 does all heavy work during foreground
  sessions. Revisit in v1.1 if bulk resource sync needs it.

### 4.7 Location (Guideline 5.1.1 — Location-Specific)

> "Apps must only collect the data needed to complete the relevant task."

- **When asked**: only when the user explicitly taps "Use my location" on
  the home wizard. Never on cold start, never in onboarding.
- **Accuracy requested**: `CLAccuracyAuthorization.reducedAccuracy` only —
  Apple's coarse-location API, ZIP-code-granularity (≥ 1 mile radius). We
  never request `fullAccuracy`.
- **Lifetime**: the coordinates are used **in-memory for the current
  search only**. We do not write them to disk, do not send them to our
  server, and do not retain them across app launches. When the user closes
  the search screen, the value is discarded.
- **No tracking**: we do not log location to analytics, do not cross-reference
  it with other identifiers, and do not share it with third parties (not
  even Sentry — `Sentry.addEventProcessor` scrubs `location.*` keys).
- **Decline path**: if the user denies or the system hasn't granted the
  permission, the app falls through to a ZIP picker on the same screen. Every
  location-aware feature has a ZIP fallback; nothing is gated on permission.
- **Purpose string shown in prompt** (en): "WeaveNYC uses your approximate
  location to show services near you. You can also enter a ZIP code instead."

### 4.4 Intellectual property (Guideline 5.2)

> "Make sure your app only includes content that you created or that you
> have a license to use."

**Concern**: a reviewer checks whether we have the right to redistribute
resource listings.
**Answer**: Every resource in the directory comes from a **public dataset**
with explicit redistribution rights:
- USDA National Directory of Food Banks (public, CC0).
- HRSA Health Center Data (public, US federal government work).
- NYC Open Data (public, NYC Open Data License).
- Food Bank for NYC (partner organization; MOU on file).
- City Harvest (partner; MOU).
- Island Harvest (partner; MOU).

Each resource card in the app displays its source and last-updated date
inline (see screenshots), satisfying attribution requirements.

### 4.5 Objectionable content (Guideline 1.1)

> "We will reject apps for any content or behavior that we believe is over
> the line."

**Concern**: user-generated posts could contain abusive content.
**Answer**: Every post is gated by:
1. Automated profanity and PII filter (pre-submit).
2. Anchor moderation (verified community members with a
   suspend/report pipeline).
3. A "Report this post" button visible on every post.
4. Rate limits: 3 posts/user/day unauthenticated, 10/day authenticated.

Standard UGC moderation stack. See the app's `/privacy` page for policy.

### 4.6 Medical claims (Guideline 1.4.1)

> "Apps that claim to take X-rays, measure blood pressure, etc. using only
> the sensors in the device are not permitted."

**Concern**: we list healthcare resources; reviewer may misread as medical-
advice app.
**Answer**: WeaveNYC does **not** provide medical advice. We list clinics,
community health centers, and urgent care locations as navigational data
(address, hours, phone, eligibility). No diagnosis, no symptom checker, no
health measurements. All medical interactions happen at the listed provider,
not in the app.

---

## 5. Universal Links test URL

After installing the app, send the reviewer's device this URL via iMessage
to themselves:

```
https://weavenyc.org/open/resources/aasa-reviewer-test-provider
```

Expected behavior: tap → native app opens on the **Resource Detail** screen
for the test provider, not Safari. This validates our Associated Domains
configuration end to end.

If the reviewer has trouble, the URL also works as a Safari fallback (the
PWA renders the same screen in-browser).

**AASA file**: hosted at
<https://weavenyc.org/.well-known/apple-app-site-association>,
`Content-Type: application/json`.

---

## 6. Contact

| Role | Name | Email | Phone |
|---|---|---|---|
| Technical contact | ⚠ REVIEW | `eng@weavenyc.org` | +1-XXX-XXX-XXXX |
| Business contact | ⚠ REVIEW | `hello@weavenyc.org` | +1-XXX-XXX-XXXX |

Available during US business hours (9am–6pm ET). Reply to review inquiries
within 4 business hours.

---

## 7. Changes since last submission

*First submission (v1.0.0).*

For future versions, list every behavior change a reviewer would care about,
e.g.:

- `1.0.1`: Added Sign in with Apple to parallel magic link / OTP flows.
- `1.0.2`: Added iPad support.
- `1.1.0`: Added Live Activity for pending post status.

---

## 8. Known open questions

- **Guideline 5.1.2 (sharing data with third parties)**: we ship Sentry.
  Sentry is configured to strip PII (set via `apps/mobile/sentry.config.ts`
  — week 9). The privacy nutrition label marks `Diagnostics` as "Not linked
  to user" per that config. If the reviewer flags this, point them to our
  Sentry-side scrubbing config.
- **Guideline 5.2.5 (apps built from a template)**: we are **not** a
  template app. We use Expo (React Native) but the code is entirely
  original. Apple has accepted Expo-based apps for years; no issue
  expected.
