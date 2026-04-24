# Universal Links & Associated Domains — WeaveNYC

Universal Links let a tap on `https://weavenyc.org/posts/abc123` open the native
iOS app instead of Mobile Safari — when the app is installed. When not
installed, the link falls through to the PWA (which already handles the same
URL). Zero-friction, no custom scheme. This is **required** for the App Store
reviewer flow (see `REVIEWER_NOTES.md` §5).

**Status of the AASA file**: checked in at
`apps/pwa/public/.well-known/apple-app-site-association` with `P42VU73CW3`
placeholder. Fill the placeholder in the same commit that bumps the app to
version `1.0.0` for submission (week 9).

---

## 1. How Universal Links work (the 30-second model)

1. App declares `associatedDomains: ["applinks:weavenyc.org", "webcredentials:weavenyc.org"]`
   in `app.config.ts` (week 9 deliverable).
2. On app install, iOS fetches `https://weavenyc.org/.well-known/apple-app-site-association`
   over HTTPS.
3. Apple's CDN caches the AASA per-device for ~24h.
4. When the user taps an HTTPS link to `weavenyc.org`, iOS checks the cached
   AASA. If the path matches a declared component and the `appIDs` entry
   includes our `P42VU73CW3.org.weavenyc.app`, the app opens directly.
5. If the app isn't installed: Safari opens the URL. The PWA already renders
   that path, so the user lands in the right place either way.

---

## 2. Hosting the AASA file via Cloudflare Pages

The PWA ships via Cloudflare Pages (static export from Next.js). Three things
have to be true for the AASA to work:

### 2a. The file must exist at the exact path

```
https://weavenyc.org/.well-known/apple-app-site-association
```

Not `/.well-known/apple-app-site-association.json` — **no extension**. Apple
rejects both `.json` suffix *and* HTTP redirects (so any attempt to serve it
from a rewrite rule will fail).

**Implementation**: it's a static file at
`apps/pwa/public/.well-known/apple-app-site-association`. Next.js's static
export passes `public/` through untouched — the file lands at
`apps/pwa/out/.well-known/apple-app-site-association`, which Cloudflare Pages
serves from the site root.

### 2b. Content-Type must be `application/json`

Cloudflare Pages infers Content-Type from file extension. With **no**
extension, CF falls back to `application/octet-stream`, which Apple rejects.

We pin it via `apps/pwa/public/_headers`. Append this block:

```
/.well-known/apple-app-site-association
  Content-Type: application/json
  Cache-Control: public, max-age=3600
```

One hour cache lets us push AASA fixes without a 24h wait, but isn't so short
that we thrash Apple's fetch logic on app install.

**Verify before announcing the app**:

```bash
curl -sI https://weavenyc.org/.well-known/apple-app-site-association \
  | grep -i content-type
# expected: Content-Type: application/json
```

### 2c. No `.html` rewrite must catch it

Next.js trailing-slash logic + our `_redirects` rules match patterns like
`/posts/*` and `/resources/*`. The `.well-known` path is *not* under any of
those prefixes, so no collision — but if anyone ever adds a broader catch-all
rule, add this to `_redirects` as a guard:

```
/.well-known/apple-app-site-association /.well-known/apple-app-site-association 200!
```

The `!` forces priority over later rules.

---

## 3. The AASA JSON

Check in at `apps/pwa/public/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["P42VU73CW3.org.weavenyc.app"],
        "components": [
          { "/": "/posts/*",       "comment": "Deep link to a specific post" },
          { "/": "/resources/*",   "comment": "Deep link to a provider" },
          { "/": "/communities/*", "comment": "Community feed / join code" },
          { "/": "/verify/*",      "comment": "Magic-link OTP callback" },
          { "/": "/open/*",        "comment": "Generic fallback" }
        ]
      }
    ]
  },
  "webcredentials": {
    "apps": ["P42VU73CW3.org.weavenyc.app"]
  },
  "activitycontinuation": {
    "apps": ["P42VU73CW3.org.weavenyc.app"]
  }
}
```

### Path choices — rationale

| Path | Why it's in AASA |
|---|---|
| `/posts/*` | Users share individual post URLs in iMessage / SMS; native render gives reply chip + live status. |
| `/resources/*` | Shared by anchors ("here's my pantry page"); native render shows live "open now" indicator. |
| `/communities/*` | Deep link from QR code (see M7 agent — QR community join). |
| `/verify/*` | Magic-link OTP emails include a clickable URL; native render avoids Safari→app bounce. |
| `/open/*` | Generic escape hatch — future shares (e.g. `/open/match/42`) don't require a new AASA deploy. |

### What's *not* in AASA

- `/inbox`, `/me`, `/settings` — user-specific, not shareable.
- `/dev/*`, `/privacy` — static pages; no reason to deep-link into them.
- `/conversations/*` — intentionally excluded in v1; conversation IDs are
  private tokens, deep-linking them would risk leaking thread access via
  shared URL bar. Revisit in v1.1 with signed link tokens.

### Why `webcredentials` + `activitycontinuation`

- `webcredentials`: enables iCloud Keychain password sync between the PWA
  origin and the native app (if we add SIWA fallback password auth).
- `activitycontinuation`: Handoff between Mac Safari and iPhone app. Free
  polish; minimal implementation cost.

---

## 4. Filling the `P42VU73CW3` placeholder

The `appIDs` entries currently read `P42VU73CW3.org.weavenyc.app`. The
placeholder must be replaced with the 10-char Team ID from
`APPLE_ENROLLMENT.md` step 4.

```bash
# From repo root, on the release branch:
sed -i '' "s/P42VU73CW3/ABCD123456/g" apps/pwa/public/.well-known/apple-app-site-association
# (replace ABCD123456 with the real Team ID)
```

Commit with message:
```
feat(pwa): bind AASA to WeaveNYC Team ID ABCD123456
```

The PWA deploy pipeline (`deploy-pwa.yml`) auto-deploys to Cloudflare Pages on
merge to main.

---

## 5. Validation checklist

Before submitting to TestFlight:

- [ ] Serve a fresh build of the PWA (or hit staging).
- [ ] `curl -sI https://weavenyc.org/.well-known/apple-app-site-association`
      returns 200 + `Content-Type: application/json`.
- [ ] `curl -s https://weavenyc.org/.well-known/apple-app-site-association | jq .`
      prints valid JSON with the real Team ID.
- [ ] Apple's tester: open <https://branch.io/resources/aasa-validator/> (third-party;
      Apple doesn't publish an official validator) and plug in `weavenyc.org`.
      Expect all `applinks` paths green.
- [ ] Install the app via TestFlight on a physical device.
- [ ] iMessage yourself `https://weavenyc.org/resources/test-provider-id` and
      long-press. Expect **Open in WeaveNYC** as an action sheet option.
- [ ] Tap the link. Expect the native Resource Detail screen, *not* Safari.

### Common failure modes

| Symptom | Fix |
|---|---|
| Link always opens Safari, never app | AASA Content-Type wrong. Re-check `_headers` rule. |
| App opens but to home screen, not detail | `components` path pattern typo. Validate JSON. |
| Works on Wi-Fi, not cellular | Apple's CDN cached an older AASA. Uninstall + reinstall to force refetch (users don't see this; it's a dev-only confusion). |
| Works on sim, not device | Sim doesn't enforce AASA. Always test on device before submission. |
| `appIDs` rejected by Apple build log | Team ID format wrong — must be `<TeamID>.<BundleID>` with a literal dot. |

---

## 6. Integration with the app side (week 9)

The native app must:

1. Declare the capability in `app.config.ts`:
   ```ts
   ios: {
     associatedDomains: [
       "applinks:weavenyc.org",
       "webcredentials:weavenyc.org"
     ]
   }
   ```
2. Register a deep link handler via `expo-linking`:
   ```ts
   import * as Linking from "expo-linking";
   const url = await Linking.getInitialURL();
   // parse url.pathname → route to the right screen
   ```
3. Route the 5 path patterns to native screens. See `app.config.ts` and the
   navigator setup (M1 agent's scope — not this PR).

This PR only lays the **PWA-side groundwork**. The app-side wiring is tracked
in the M1 (foundation) deliverables.
