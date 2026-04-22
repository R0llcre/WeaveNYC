# Apple Developer Program — Enrollment Checklist

**Owner**: WeaveNYC founding team (admin Apple ID holder).
**Timeline**: 3–10 business days from submission to approval. Start no later than **week 7** so the account is live before TestFlight upload in week 9.
**Cost**: $99 USD / year (auto-renews; Apple emails 30 days before renewal).

This document is the canonical pre-flight for registering the WeaveNYC iOS app
with Apple. The implementation docs (`CERTIFICATES.md`, `APP_STORE_LISTING.md`,
`REVIEWER_NOTES.md`) all assume enrollment is complete and the **Team ID** has
been captured in our secret store.

---

## 1. Which account type — organization (preferred) or personal?

| Account type | Pros | Cons | Recommended? |
|---|---|---|---|
| **Organization** | App Store listing shows `WeaveNYC` (trust signal), App Store Connect supports multi-seat (admin / developer / marketing separation), survives founder turnover. | Requires D-U-N-S, 3–10 day wait, legal entity must exist. | Yes — this is what we ship with. |
| **Personal** | Faster (often 24–48h), no D-U-N-S. | Listing shows founder's legal name (weird for a nonprofit). Cannot transfer app to an org account without a manual Apple transfer (costs 1 app review cycle). | Only as a stop-gap if org enrollment stalls past week 8. |
| **Anthropic enterprise** | Free seat if offered. | Likely *not* available — Apple Developer Enterprise Program is for internal-distribution apps only, not public App Store submissions. | No. |

**Decision**: Enroll as an **organization** under the legal entity sponsoring
WeaveNYC (expected: a 501(c)(3) fiscal sponsor — confirm with counsel before
submitting).

---

## 2. Prerequisites before you click "Enroll"

Collect these **before** starting the enrollment form — Apple's form times out
and loses input.

- [ ] **Legal entity name** exactly as it appears on IRS / state filings.
      Example: `WeaveNYC Inc.` or `Friends of WeaveNYC, a project of <fiscal sponsor>`.
- [ ] **D-U-N-S Number** for the legal entity.
  - Lookup: <https://developer.apple.com/enroll/duns-lookup/>
  - If not found: request one (free, ~5 business days) via the Apple-branded
    D&B form reachable from the same lookup page. **Do not use the paid D&B
    expedited route** — Apple only accepts the free number.
- [ ] **Website** that matches the legal entity (email domain must resolve).
      Use `weavenyc.org` once the domain is registered (M8 pilot prerequisite).
- [ ] **Work email** on the `weavenyc.org` domain — e.g. `apple-admin@weavenyc.org`.
      Apple will *not* accept a personal Gmail.
- [ ] **Phone number** reachable during US business hours for verification call
      (Apple calls a human at the org to confirm authority).
- [ ] **Admin Apple ID** — the individual who will sign legal agreements.
      Must have 2FA enabled (Apple requires this as of 2020).
- [ ] **Legal authority to bind the entity.** The person filling out the form
      must be an officer (founder / ED / CTO), *not* a contractor.

---

## 3. Step-by-step enrollment flow

1. Sign in at <https://developer.apple.com/programs/enroll/> with the admin
   Apple ID.
2. Choose **Enroll as an organization**.
3. Fill in legal entity info:
   - Legal entity name (must match D-U-N-S record exactly — including
     "Inc.", "LLC", etc.)
   - D-U-N-S number
   - Headquarters address (must match D-U-N-S)
   - Website
4. Fill in organization contact info (org email + phone).
5. Fill in admin personal info (authority to sign legal agreements).
6. Accept the Apple Developer Program License Agreement.
7. Submit. You'll receive an email: *"We're reviewing your enrollment"*.
8. **Wait 3–10 business days.** Apple may call to verify authority — keep the
   org phone staffed. If you miss the call, enrollment stalls until callback.
9. On approval, you'll get a link to pay the $99 fee. Pay it.
10. You now have access to <https://developer.apple.com/account/> and
    <https://appstoreconnect.apple.com/>.

---

## 4. Capture the Team ID on Day 1 of access

The **Team ID** is a 10-character alphanumeric string (e.g. `ABCD123456`). It
identifies the org in all Apple systems and is required for:

- `apps/mobile/release/UNIVERSAL_LINKS.md` (AASA `appID` field)
- `apps/mobile/eas.json` (`submit.production.ios.appleTeamId`)
- `apps/mobile/app.config.ts` (not yet created — week 9 deliverable)
- Certificate signing requests

**Where to find it**:

1. <https://developer.apple.com/account/>
2. Top right → your account name → **Membership details**
3. Copy the **Team ID** field. (Not the "Team Agent" name.)

**Store it** in:

- `.env.example` (public placeholder; use `<TEAM_ID>` format, don't commit the real ID).
- 1Password vault `WeaveNYC / Apple` (source of truth).
- GitHub Actions secrets as `APPLE_TEAM_ID` (used by `mobile-build.yml`).

---

## 5. Roles to assign on Day 1

App Store Connect has a role system separate from developer.apple.com. Set it
up immediately so nobody ships as "Team Agent" by accident (the single
super-user role that can sign contracts).

| Role | Who | Why |
|---|---|---|
| **Team Agent** | 1 person only — founding ED or CTO. | Signs agreements. Non-delegable. |
| **Admin** | 1–2 backup officers. | Can invite users, manage app records. |
| **App Manager** | Release engineer(s). | Can create builds, submit for review, manage TestFlight. |
| **Developer** | Engineering team. | Can upload builds (via EAS). |
| **Marketing** | Whoever writes the listing copy (see `APP_STORE_LISTING.md`). | Edits listing text + screenshots without build access. |

---

## 6. Paid agreements — don't forget

Even though WeaveNYC is free, App Store Connect requires you to accept the
**Paid Apps Agreement** and fill **Banking & Tax** forms before *any* app can
be submitted. (Apple's enforcement logic checks presence of bank info even
for free-only apps; a known quirk.)

- [ ] Navigate to App Store Connect → **Agreements, Tax, and Banking**.
- [ ] Add a bank account for the legal entity (can be same as the org's
      operating account).
- [ ] Fill out W-9 (US nonprofit) or W-8BEN (if international).
- [ ] Accept Paid Apps Agreement.

If this is skipped, submission in week 9 will fail with a confusing
*"Agreement not in effect"* error. Do it the same day enrollment completes.

---

## 7. Fallback paths

### 7a. Org enrollment is blocked past week 8

1. Enroll a personal account under the admin's name *in parallel* (24–48h
   approval).
2. Ship TestFlight + first App Store submission under the personal account.
3. Once the org account is live, initiate an **App Transfer**
   (<https://developer.apple.com/app-store/app-transfer/>). This is a
   one-click transfer that preserves reviews, ranking, and user base — but
   requires one App Store review cycle.
4. Update `eas.json` and re-run the `mobile-build.yml` production job on the
   org's Team ID post-transfer.

### 7b. D-U-N-S request is stuck

Call D&B directly: +1-866-705-5711. Reference the Apple-branded D-U-N-S
request. Apple reviewers will manually trigger the D&B lookup if you open a
Developer Support ticket citing the request confirmation.

### 7c. Anthropic enterprise account

Not applicable — Apple Enterprise Program (ADEP) distributes internal-only
apps behind a private MDM. WeaveNYC ships to the public App Store, so the
standard Apple Developer Program is the right path.

---

## 8. User action items

What the **user** (founding team) must do, in order:

1. **Week 6**: Confirm legal entity + fiscal sponsor. File for D-U-N-S if not
   already on file. (owner: ED)
2. **Week 7 Monday**: Submit the developer.apple.com enrollment form. (owner: CTO)
3. **Week 7 ongoing**: Staff the org phone for Apple's verification call.
4. **Within 24h of approval**: Pay the $99, fill banking/tax agreements, capture
   Team ID into 1Password + GH Actions secrets. (owner: CTO)
5. **Same day**: Invite the engineering team under the right App Store Connect
   roles. Do *not* share the Team Agent password — each engineer logs in with
   their own Apple ID.

Once item 4 is done, unblock `CERTIFICATES.md` step 1 (bundle ID reservation)
and `eas.json` placeholder fill-in.
