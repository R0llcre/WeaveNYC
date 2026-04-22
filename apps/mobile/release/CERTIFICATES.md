# Bundle ID, Certificates & Provisioning — WeaveNYC iOS

**Bundle ID**: `org.weavenyc.app`
**Team ID**: `<TEAM_ID>` (populated after `APPLE_ENROLLMENT.md` step 4).
**Credentials host**: EAS (Expo Application Services) managed credentials —
primary path. Manual Keychain-based flow documented as fallback.

---

## 1. Reserve the bundle ID — Day 1 after enrollment

Do this **before** any build attempt. Apple's namespace is first-come-first-served
and someone else reserving `org.weavenyc.app` would force a permanent rename.

1. <https://developer.apple.com/account/resources/identifiers/list>
2. Click **+** → select **App IDs** → **App**.
3. Description: `WeaveNYC iOS App`.
4. Bundle ID: **Explicit** → `org.weavenyc.app` (do *not* use wildcard).
5. Capabilities to enable now (we'll configure them further in week 9):
   - [x] **Associated Domains** (for Universal Links)
   - [x] **Push Notifications** (chat + match alerts)
   - [x] **Sign In with Apple** (guideline 4.8 compliance; see REVIEWER_NOTES)
   - [x] **Background Modes** (P2P background sync, remote notifications)
   - [ ] iCloud — **not** needed; we use our own sync.
   - [ ] HealthKit / HomeKit — N/A.
6. Confirm. The bundle ID is now reserved globally.

Mirror the reservation in **App Store Connect**:

1. <https://appstoreconnect.apple.com/apps>
2. **+ New App** → iOS platform, select `org.weavenyc.app` from the dropdown.
3. Name: `WeaveNYC` (30-char limit; the full listing copy goes in the subtitle —
   see `APP_STORE_LISTING.md`).
4. Primary language: English (U.S.). Add Spanish + Simplified Chinese after
   the record is created.
5. SKU: `weavenyc-ios-01` (internal; never shown to users).
6. User Access: Full Access (all Admins can see the record).

This creates an **ASC App ID** — a numeric string like `6447234567`. Capture it
as `<ASC_APP_ID>` for `eas.json` and GitHub Actions.

---

## 2. EAS managed credentials — primary flow

Expo Application Services (EAS) is our CI + credentials vault. It mints and
rotates the three Apple-side artifacts we'd otherwise have to juggle manually:

| Artifact | What it is | EAS behavior |
|---|---|---|
| **iOS Distribution Certificate** | `.p12` signed by Apple; identifies the developer account that produced the binary. | EAS creates one per Team ID, reuses it across builds, auto-rotates before expiry. |
| **Provisioning Profile** | Ties the cert + bundle ID + capabilities + devices (for ad hoc) into a single file the iOS build toolchain consumes. | EAS generates a production profile on first build; regenerates whenever capabilities change. |
| **APNs Auth Key** (`.p8`) | Token-based push authentication; replaces the legacy per-env APNs certs. | EAS creates + stores once per team; same key works for dev, TestFlight, prod. |

### First-run setup

```bash
cd apps/mobile
npx eas-cli@latest login                     # your Expo account
npx eas-cli@latest init                      # creates projectId, writes to app.config.ts
npx eas-cli@latest credentials                # interactive wizard
```

In the wizard:

1. Platform: **iOS**.
2. Profile: **production**.
3. Select **Let EAS manage credentials**. (If prompted: yes to creating a
   Distribution Certificate, yes to creating a Provisioning Profile.)
4. Sign in with the Apple ID that has App Manager role (see
   `APPLE_ENROLLMENT.md` §5). Use an **App-Specific Password** (generated at
   <https://appleid.apple.com/account/manage>), not your Apple ID password —
   2FA breaks interactive flows otherwise.
5. For APNs key: select **Set up Push Notifications** → let EAS generate.

EAS stores the credentials server-side. They live in `project settings →
Credentials` in the Expo dashboard. No secrets live in the repo.

### Verify

```bash
npx eas-cli@latest credentials -p ios
```

Expected output:

```
Distribution Certificate
  Serial Number: ...
  Expiration: 2027-...

Provisioning Profile
  Developer Portal ID: ...
  Bundle Identifier: org.weavenyc.app
  Status: active
```

### Day-2 ops: what triggers a re-mint

- **Certificate expiry** (3 years): EAS emails the owner 30 days prior; next
  `eas build` auto-renews.
- **Adding a new capability** (e.g. HealthKit later): EAS detects the diff on
  next build and regenerates the profile.
- **New Apple Team Agent**: the outgoing agent must transfer ownership *before*
  leaving or the cert orphans and requires manual revocation from the Apple
  account.

---

## 3. Manual fallback — Keychain → p12 → EAS upload

Only use this if EAS managed credentials is blocked (e.g. Apple API outage
on build day, or an org policy that forbids giving EAS Apple login access).

### Generate the distribution cert manually

1. **Keychain Access** (macOS) → menu → **Certificate Assistant** → *Request a
   Certificate from a Certificate Authority*.
2. Email: the org's App Manager email.
3. Common Name: `WeaveNYC Distribution`.
4. Request is: **Saved to disk**. Save as `weavenyc-dist.certSigningRequest`.
5. <https://developer.apple.com/account/resources/certificates/list> → **+** →
   **iOS Distribution (App Store and Ad Hoc)** → upload the CSR → download
   `ios_distribution.cer`.
6. Double-click the `.cer` to install in Keychain.
7. In Keychain: right-click the cert → **Export** → p12 format. Set a strong
   passphrase. Save as `weavenyc-dist.p12`.

### Generate the provisioning profile manually

1. <https://developer.apple.com/account/resources/profiles/list> → **+** →
   **App Store** → `org.weavenyc.app` → select the distribution cert above →
   name `WeaveNYC App Store` → download `weavenyc-appstore.mobileprovision`.

### Upload to EAS

```bash
npx eas-cli@latest credentials -p ios
# Select: Use existing Distribution Certificate → Upload your own
#   (provide path to weavenyc-dist.p12 and its passphrase)
# Select: Use existing Provisioning Profile → Upload your own
#   (provide path to weavenyc-appstore.mobileprovision)
```

Then **delete the local files** (`shred -u weavenyc-dist.p12` or secure-empty
trash). EAS now has the secrets; local copies are a leak surface.

### APNs auth key (manual path)

1. <https://developer.apple.com/account/resources/authkeys/list> → **+** →
   **Apple Push Notifications service (APNs)** → create.
2. **Download the `.p8` exactly once** — Apple will not let you re-download.
3. Note the **Key ID** (10-char string) and your **Team ID**.
4. Upload to EAS via credentials wizard → Push Notifications → Upload own key.
5. Shred the local `.p8`.

---

## 4. Lifecycle & ownership

| Credential | Owner (human) | Storage | Rotation | Revocation trigger |
|---|---|---|---|---|
| Distribution Certificate (`.p12`) | EAS managed | Expo servers | Auto, 30 days pre-expiry | Founder turnover → revoke old, EAS mints new on next build |
| Provisioning Profile | EAS managed | Expo servers | On capability change | Bundle ID or cap change |
| APNs Auth Key (`.p8`) | EAS managed | Expo servers | Manual; Apple doesn't expire them | If leaked, revoke in developer.apple.com and generate new |
| Apple Team Agent account | CTO | 1Password `WeaveNYC / Apple` vault | On role change | Offboarding |
| App-Specific Passwords (used for EAS login) | per-engineer | 1Password | 90 days (engineer self-rotates) | Engineer offboarding |
| EXPO_TOKEN (CI) | DevOps lead | GitHub Actions secret | 180 days | DevOps offboarding |

### Who can rotate what

- **Any App Manager** can trigger EAS to regenerate a provisioning profile by
  re-running `eas credentials`.
- **Only the Team Agent** can revoke the Distribution Certificate at the Apple
  portal (EAS re-mints on next build).
- **EXPO_TOKEN** rotation: DevOps lead generates new token at
  <https://expo.dev/accounts/.../settings/access-tokens>, updates GH secret,
  does not need to re-run any builds (tokens are stateless from EAS's side).

### Emergency revocation

If a `.p12` or `.p8` is leaked:

1. developer.apple.com → Certificates → **Revoke**.
2. App Store Connect → no action needed; in-flight TestFlight builds keep
   working (installed certs are cached on-device).
3. `npx eas-cli credentials -p ios` → prompts to generate a replacement on
   next build.
4. File an incident note in `docs/11_Ops_Runbook.md` (credential leak section).
5. Rotate any shared passphrases.

---

## 5. Placeholders to fill before first build

Until `APPLE_ENROLLMENT.md` is complete, all of these are `TBD`:

| Placeholder | Source | Used by |
|---|---|---|
| `<TEAM_ID>` | Membership details page | `eas.json`, AASA, app.config |
| `<ASC_APP_ID>` | App Store Connect app record URL | `eas.json` submit.production.ios |
| `<APPLE_ID>` | Team Agent's Apple ID email | `eas.json` submit.production.ios |
| `<APNS_KEY_ID>` | Keys section, developer.apple.com | `app.config.ts` (week 9) |

Keep these as literal `<>` placeholders in-tree; fill only at submit time via
`eas.json` env overrides or the interactive `eas submit` prompt.
