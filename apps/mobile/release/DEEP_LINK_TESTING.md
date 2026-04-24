# Deep Link Testing Checklist — Universal Links + Custom Scheme

Verify that `https://weavenyc.org/*` URLs open the **native app** when
installed (Universal Links) and that the `weavenyc://` custom scheme still
routes correctly (fallback / share-sheet behavior).

**Pre-requisites**:
- App installed on a **physical device via TestFlight** (simulators do not
  enforce AASA rules — they will open URLs but won't validate the Team ID
  binding, giving false positives).
- `https://weavenyc.org/.well-known/apple-app-site-association` is live and
  returns `application/json` with `P42VU73CW3.org.weavenyc.app` in `appIDs`.
  Verify first per `UNIVERSAL_LINKS.md` §5.
- Reviewer-demo account signed in OR no account (both cases are tested below).

---

## 1. Simulator smoke (dev-only sanity check)

Simulators don't fetch AASA, but they do honor `xcrun simctl openurl` for
testing the **app's deep-link handler**. Run this in dev to make sure the
in-app router wires each path to the right screen; then do the physical-device
run in §2 for the real Universal Link verification.

```bash
# Boot a sim with the app installed.
xcrun simctl boot "iPhone 15 Pro Max"
xcrun simctl launch booted org.weavenyc.app

# --- Universal-link-shaped URLs (HTTPS) ---

# Magic-link verification callback.
xcrun simctl openurl booted 'https://weavenyc.org/verify?token=DEMO-TOKEN'
# Expect: app opens to /verify screen, shows "Signing you in…" then lands on
# the reviewer-demo home if DEMO-TOKEN is valid, or "Link expired" copy if not.

# Individual post.
xcrun simctl openurl booted 'https://weavenyc.org/posts/abc-123'
# Expect: PostDetail screen for post abc-123 ("Need winter clothes for a
# 5yo in Queens"). Back button returns to community feed.

# Community feed + join code.
xcrun simctl openurl booted 'https://weavenyc.org/communities/corona-queens'
# Expect: CommunityDetail for Corona, Queens; if user is not a member, a
# "Join community" CTA is visible; if already member, announcements feed.

# Resource detail.
xcrun simctl openurl booted 'https://weavenyc.org/resources/la-jornada'
# Expect: ResourceDetail for La Jornada pantry; Call / Directions / Bookmark
# actions present; Open-now chip reflects current time.

# --- Custom-scheme URLs (weavenyc://) ---

# Custom scheme still works for share-sheet fallback and old QR codes.
xcrun simctl openurl booted 'weavenyc://posts/abc-123'
# Expect: Same as https://.../posts/abc-123 — same screen, same state.

xcrun simctl openurl booted 'weavenyc://resources/la-jornada'
# Expect: Same as https://.../resources/la-jornada.
```

**If any of those open Safari** (rather than the app) in the simulator, the
app's Info.plist is missing the URL scheme or the Expo Linking config doesn't
register `https://weavenyc.org`. Check `apps/mobile/app.config.ts` → `scheme`
and `ios.associatedDomains`.

---

## 2. Physical device — the real test

Simulators skip AASA validation; device tests confirm the end-to-end chain
(AASA fetch → Team ID match → Universal Link jump).

### 2a. Preflight on the device

1. Install the app fresh via TestFlight. (Re-installing forces iOS to re-fetch
   AASA; upgrades do not.)
2. Open Settings → General → VPN & Device Management → make sure no profile
   is overriding HTTPS.
3. Keep the device on Wi-Fi for the first run; Apple's CDN sometimes rate-
   limits AASA fetches on cellular.

### 2b. Send yourself each test URL in iMessage

From a Mac (or another device), iMessage these to the test device:

```
https://weavenyc.org/verify?token=DEMO-TOKEN
https://weavenyc.org/posts/abc-123
https://weavenyc.org/communities/corona-queens
https://weavenyc.org/resources/la-jornada
https://weavenyc.org/open/match/42
```

**Long-press** each link. Expect the iOS action sheet to show
**"Open in WeaveNYC"** as the first option — that confirms AASA is working.

**Tap** the link. Expect the native app to open directly to the matching
screen, with **no Safari flash** in between. A Safari flash means the AASA
is reachable but rejected (Content-Type wrong, or Team ID mismatch). See
`UNIVERSAL_LINKS.md` §5 "Common failure modes".

### 2c. Expected screen per path

| URL | Expected app screen | Notes |
|---|---|---|
| `https://weavenyc.org/verify?token=<t>` | Verify screen → signed-in home | Magic-link OTP callback; reviewer-demo token `DEMO-REVIEWER-TOKEN` always valid in prod for `+1-555-010-01xx` accounts. |
| `https://weavenyc.org/posts/abc-123` | Post detail screen for `abc-123` | "Back" returns to the referring community feed if opened via in-app nav, or to Home if cold-launched from link. |
| `https://weavenyc.org/communities/corona-queens` | Community detail for Corona, Queens | Shows "Join community" CTA if not a member. |
| `https://weavenyc.org/resources/la-jornada` | Resource detail for La Jornada pantry | Call / Directions / Bookmark buttons visible; live open-now chip. |
| `https://weavenyc.org/open/match/42` | Generic `/open/*` fallback → match-detail screen | Escape hatch for future deep-link paths without re-deploying AASA. |

### 2d. Cold-launch vs. warm

Test each URL in **two app states**:

- **Warm**: app already open in background. Tap link → app comes to
  foreground on the target screen without re-running cold-start logic.
- **Cold**: force-quit the app first (swipe up in the app switcher). Tap
  link → app cold-launches, waits for the splash, then lands on the target
  screen. The initial URL must be read via `Linking.getInitialURL()` and
  routed *after* the auth gate so a `/verify?token` link still signs the
  user in on cold launch.

### 2e. Failure modes to specifically hunt for

- **App opens to Home instead of the target**: `Linking.getInitialURL()`
  was consumed before the router read it. Check the Expo Router root layout.
- **App opens but crashes with "URL scheme not declared"**: `scheme` missing
  in `app.config.ts`. Re-run `eas build` after adding.
- **Only `https://weavenyc.org` paths work, `weavenyc://` scheme doesn't**:
  `CFBundleURLTypes` not generated; check `app.config.ts` → `ios.scheme`.
- **Custom scheme works, Universal Links don't**: AASA not served correctly.
  Re-verify with `curl -sI https://weavenyc.org/.well-known/apple-app-site-association`.

---

## 3. Custom scheme — what it's still for

Universal Links cover every *sharable* URL. The `weavenyc://` scheme is kept
for three specific uses:

1. **Share-sheet fallback from the PWA** — when the PWA's Web Share API
   can't push an HTTPS URL (some third-party apps blacklist outbound links),
   the PWA offers a copy-button that writes `weavenyc://...` to the clipboard.
2. **QR-code community join** (M7) — QR codes encode `weavenyc://communities/<code>`
   to bypass the 24h AASA cache on freshly installed apps.
3. **Legacy short links** — the social-share card for v1 iMessages was
   generated with a `weavenyc://` URL; keeping the scheme live avoids
   breaking shares made during the TestFlight cycle.

---

## 4. CI smoke (future)

Once Maestro is configured for ad-hoc device smoke (P4 scope, not P3-D),
codify these tests:

```yaml
# apps/mobile/.maestro/deep-link-smoke.yaml  — not yet checked in
appId: org.weavenyc.app
name: "Universal link smoke"
---
- launchApp:
    clearState: true
- openLink: "https://weavenyc.org/resources/la-jornada"
- assertVisible:
    id: "resource-detail-screen"
- assertVisible:
    id: "resource-action-call"
- assertVisible:
    id: "resource-action-directions"
- assertVisible:
    id: "resource-action-bookmark"
```

Until then, §2 is manual and must be re-run before every TestFlight
submission.
