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

Provision these in week 9 — the demo account is a real account in the
production database, marked `reviewer: true` so abuse alerts don't trigger on
it.

| Field | Value |
|---|---|
| Phone (E.164) | `+1-555-0100` *(fake area code reserved by Apple for testing per their guidelines)* |
| OTP bypass code | `777777` *(server honors this only when `reviewer: true` flag is set)* |
| Display name | `Apple Review` |
| Primary locale | English |
| Anchor status | **Yes** — so the reviewer can see the moderator side too |
| Verified identity | **Yes** — mock partner org: `Test Public Library` |
| Default neighborhood | `Manhattan / 10025` |

**Do not use a real phone number** — Apple reviewers spin up fresh accounts
per reviewer, and a shared real phone number hits rate limits. Use the
+1-555-01xx block which is a test-only range reserved by North American
Numbering Plan Administration.

How to reach the backend endpoint that honors the bypass code: it's behind
a feature flag `AUTH_REVIEWER_BYPASS` that's on in production but only
accepts the fixed OTP `777777` from phone numbers in `+1-555-01xx`. See
`services/api-gateway/src/auth/reviewer.ts` (week 9 implementation).

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

### 4.2 Sign-in parity (Guideline 4.8)

> "Apps that use a third-party or social login service to set up or
> authenticate the user's primary account... must also offer [Sign in with Apple]."

**Concern**: we offer magic link (email) + OTP (phone); Apple treats these
as alternative auth requiring SIWA parity.
**Answer**: We offer **Sign in with Apple** as a first-class sign-in option
on the same screen as email magic link and phone OTP. SIWA is visually
equivalent in size, order, and emphasis. Users may pick any of the three.

### 4.3 Data collection (Guideline 5.1.1)

> "Apps should only request access to data relevant to the core functionality
> of the app and should only collect and use data that is required to
> accomplish the relevant task."

**Concern**: civic-aid apps are sometimes over-broad about contact data.
**Answer**: We collect only:
- Phone **or** email (one of the two) — for authenticated accounts, for
  OTP / magic link only. Never for marketing.
- Coarse location (ZIP-level) — only during active searches, with user
  permission.
- Device identifier — for push token binding.
- Crash + performance data — anonymized, via Sentry.

Browsing requires **no data collection** at all. See `APP_STORE_LISTING.md`
§5 for the privacy nutrition labels matching this description.

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
