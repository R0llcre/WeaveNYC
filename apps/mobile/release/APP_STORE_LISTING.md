# App Store Connect Listing — Pre-submit Copy & Metadata

All copy below is **draft**. The founding team + a Spanish and Chinese native
speaker must review every string before go-live. Mark any unresolved line with
`⚠ REVIEW` and leave a note.

**Char budgets are hard limits** enforced by App Store Connect:

| Field | Limit | Visible where |
|---|---|---|
| App name | 30 chars | Home screen under icon + search |
| Subtitle | 30 chars | App Store listing under the name |
| Promotional text | 170 chars | Top of the listing, updatable any time (no re-review) |
| Description | 4,000 chars | Full listing body |
| Keywords | 100 chars total | Search index (not visible to users) |
| Support URL | required | "Support" link on listing |
| Marketing URL | optional | Additional info link |
| Privacy URL | required | Must resolve to a privacy policy |

---

## 1. Core metadata

| Field | Value |
|---|---|
| Platform | iOS |
| App name | `WeaveNYC` |
| Bundle ID | `org.weavenyc.app` |
| SKU | `weavenyc-ios-01` |
| Primary language | English (U.S.) |
| Additional languages | Spanish (Mexico), Chinese (Simplified) |
| Primary category | **Lifestyle** *(primary; covers city-life utilities)* |
| Secondary category | **Reference** *(secondary; reflects directory nature)* |
| Age rating | **4+** (no objectionable content; all listed resources are vetted public services) |
| Pricing | **Free** |
| Availability | United States (add regions post-pilot if expanding) |

### Category rationale

The alternative "Utilities" or "Social Networking" both invite confusion:

- **Utilities** implies functional tools (calculators, password managers).
  Reviewers may flag us as miscategorized when they see social / chat features.
- **Social Networking** triggers heavier content-moderation scrutiny and the
  4.3 "copycat of existing social app" guideline.

**Lifestyle + Reference** aligns with how users describe the app ("tool for
finding help in NYC"), has low scrutiny overhead, and other civic-tech apps
(e.g. NYC311, BuildRez) use the same pairing.

### Age rating detail (answers to ASC questionnaire)

All questions on the questionnaire should be answered **None / No** *except*:

- Unrestricted Web Access — **No** (we only link to vetted `.gov` / provider
  sites from the directory).
- Contests / Gambling — **No**.
- User-generated content — **Yes, infrequent / mild**, because the post
  composer allows free text. Apple's definition of "mild" fits: profanity
  filtered, anchors moderate, no sexual/violent content expected.
- Medical info — **No**. We list healthcare providers but don't give medical
  advice. Careful wording matters here; see Guideline 1.4 in
  `REVIEWER_NOTES.md`.

---

## 2. English (U.S.) — default locale

### App name (30)
```
WeaveNYC
```

### Subtitle (30)
```
Find food, help, neighbors
```

### Promotional text (170)
```
Free, anonymous access to food pantries, shelter, SNAP help, and neighbors nearby. Updated daily from city, state, and nonprofit data. No sign-in to browse.
```

### Description (≤ 4000, currently 1,890)
```
WeaveNYC helps New Yorkers find help nearby — food pantries, soup kitchens,
SNAP enrollment, shelter beds, free clinics, legal aid, and trusted neighbors
— all in one place, in English, Spanish, and Simplified Chinese.

WHY IT EXISTS
Every day, thousands of New Yorkers miss help that already exists because
it's scattered across dozens of city, state, and nonprofit websites, each
with their own forms, hours, and eligibility rules. Food Help NYC, SNAP,
211-NYC, and dozens of local pantry lists all hold different pieces of the
picture. WeaveNYC pulls them together and lets you ask a neighbor when the
data falls short.

WHAT YOU CAN DO
• Search by what you need — food, shelter, clothing, cash help, healthcare
  — and your neighborhood, ZIP code, or current location.
• See open-now status, walking directions, eligibility requirements, and
  phone / online intake options for each resource.
• Post anonymously if you can't find what you need. A verified neighbor
  (we call them "anchors") will reply.
• Browse community feeds for your neighborhood to see what neighbors are
  sharing right now — free fridges stocked, pop-up clothing drives, library
  warming centers.
• Share a resource with a friend in one tap.

PRIVATE BY DEFAULT
• No sign-in required to browse.
• Phone or email verification only when you want to post or message.
• Location is optional and approximate — never shared with other users.
• Data stored on your device first; everything is end-to-end private when
  it can be.

BUILT ON OPEN DATA
Every resource you see comes from a named, public source: USDA food
directory, HRSA health centers, NYC Open Data, Food Bank for NYC, City
Harvest, and vetted nonprofit partners. Data refreshes daily. Every card
shows you where the info came from and when it was last updated.

THREE LANGUAGES, ONE CITY
The app, the listings, and the posts are all available in English,
Spanish (Español), and Simplified Chinese (简体中文). Switch anytime from
Settings.

FREE, ALWAYS
WeaveNYC is a nonprofit project. It's free to use and will stay that way.
No ads, no paywalls, no data sales.

SUPPORT & FEEDBACK
Tap "Help" inside the app or email hello@weavenyc.org. We reply within
48 hours.

Made in New York.
```

### Keywords (≤ 100 chars — every char counts; no spaces after commas)
```
food,pantry,shelter,SNAP,help,NYC,soup kitchen,free clinic,WIC,legal aid,211,food bank,despensa
```
**Current length: 108** — need to trim. Cut `legal aid` (save 10). Final 98:
```
food,pantry,shelter,SNAP,help,NYC,soup kitchen,free clinic,WIC,211,food bank,despensa
```

### What's New (release notes, ≤ 4000)
Version 1.0.0:
```
First public release.

• Find food pantries, shelter, SNAP help, free clinics, and neighborhood
  resources across all five boroughs.
• Ask a verified neighbor when the data falls short.
• English, Español, 简体中文.
• Anonymous browsing — sign-in only when you want to post or message.

Thank you to everyone who helped test the pilot. File feedback from
Settings → Help.
```

### Support / Marketing / Privacy URLs
| Field | URL | Status |
|---|---|---|
| Support | `https://weavenyc.org/help` | ⚠ REVIEW — page must exist + have contact |
| Marketing | `https://weavenyc.org` | live (pilot home page) |
| Privacy | `https://weavenyc.org/privacy` | live (exists as `apps/pwa/src/app/privacy/page.tsx`) |

---

## 3. Spanish (es-MX) — draft, needs native review

### App name (30)
```
WeaveNYC
```
*(Keep product name unlocalized.)*

### Subtitle (30)
```
Despensas, ayuda, vecinos
```

### Promotional text (170)
```
Encuentra despensas, refugio, ayuda con SNAP y vecinos cercanos — gratis y anónimo. Actualizado a diario desde datos públicos. No necesitas cuenta para explorar.
```

### Description (draft — 1,400 chars; send to translator for final)
```
WeaveNYC ayuda a los neoyorquinos a encontrar ayuda cerca: despensas,
comedores comunitarios, inscripción a SNAP, refugios, clínicas gratuitas,
asistencia legal y vecinos de confianza. Todo en un solo lugar, en inglés,
español y chino simplificado.

POR QUÉ EXISTE
Cada día miles de neoyorquinos pierden ayuda que ya existe porque está
dispersa en docenas de sitios del gobierno y de organizaciones sin fines
de lucro. WeaveNYC la reúne y te permite preguntarle a un vecino cuando
los datos no son suficientes.

LO QUE PUEDES HACER
• Busca por lo que necesitas — comida, refugio, ropa, ayuda económica,
  salud — y por tu vecindario o código postal.
• Consulta horarios abiertos, instrucciones para llegar, requisitos y
  opciones de contacto.
• Publica de forma anónima si no encuentras lo que necesitas. Un vecino
  verificado te responderá.
• Mira qué está pasando en tu vecindario ahora mismo.

PRIVADO POR DEFECTO
• No necesitas cuenta para explorar.
• Verificación por teléfono o correo solo cuando quieras publicar.
• La ubicación es opcional y aproximada.

GRATIS, SIEMPRE
WeaveNYC es un proyecto sin fines de lucro. Es gratis y seguirá siéndolo.
Sin anuncios, sin suscripciones, sin venta de datos.

Hecho en Nueva York.
```

### Keywords (es-MX, ≤ 100)
```
despensa,comida,refugio,SNAP,ayuda,NYC,clínica,gratis,vecindario,ayuda legal,comedor,WIC
```

---

## 4. Simplified Chinese (zh-Hans) — draft, needs native review

### App name (30)
```
WeaveNYC 编织纽约
```

### Subtitle (30)
```
免费食物、庇护、邻里互助
```

### Promotional text (170)
```
免费、匿名查询纽约市食品救济、庇护所、SNAP 食物券、免费诊所和附近邻居的互助信息。每日从政府和公益组织数据源更新。浏览无需注册。
```

### Description (draft — 800 chars; send to translator for final)
```
WeaveNYC（编织纽约）帮助纽约居民就近找到援助资源 —— 食品救济、施粥所、
SNAP 食物券申请、庇护所床位、免费诊所、法律援助，以及可信的邻里。全部
集中在一个 App 里，支持英文、西班牙文和简体中文。

主要功能
• 按需求（食物、住所、衣物、现金、医疗）和区域/邮编/当前位置搜索援助资源。
• 查看当前是否营业、步行路线、资格要求和联系方式。
• 找不到所需资源？匿名发帖，由已认证的"邻里大使"回复你。
• 浏览社区动态,看看邻居现在有什么可以分享的互助信息。

默认隐私
• 无需注册即可浏览。
• 发帖或对话时才需要手机/邮箱验证。
• 位置信息可选,只使用大致范围。

永远免费
WeaveNYC 是一个非营利项目,免费使用,无广告,不出售数据。

纽约制作。
```

### Keywords (zh-Hans, ≤ 100)
```
纽约,免费食物,食品券,庇护所,SNAP,邻里,诊所,法律援助,免费,互助,救济
```

---

## 5. Privacy nutrition labels

App Store Connect → App Privacy → build the declaration below. **All five**
data types we collect must be disclosed; omitting any is cause for rejection.

### Data types collected

| Data type | Collected? | Linked to user? | Used for tracking? | Purposes |
|---|---|---|---|---|
| **Precise Location** | No | — | — | — |
| **Coarse Location** (approximate) | Yes | No (anonymous browse) / Yes (post with ZIP) | No | App Functionality — search by proximity |
| **Phone Number** | Yes | Yes | No | App Functionality — OTP verification, anchor contact |
| **Email Address** | Yes | Yes | No | App Functionality — magic link sign-in, support |
| **Name** | Yes (optional display name) | Yes | No | App Functionality — post attribution |
| **Photos** | No *(v1)* | — | — | — |
| **Contacts** | No | — | — | — |
| **User Content — Posts** | Yes | Yes | No | App Functionality — the core post feature |
| **User Content — Messages** | Yes | Yes | No | App Functionality — neighbor chat |
| **Identifiers — Device ID** | Yes | Yes (after sign-in) / No (anon) | No | App Functionality — session, push token binding |
| **Diagnostics — Crash Data** | Yes | No | No | App Functionality — Sentry reports, no PII |
| **Diagnostics — Performance Data** | Yes | No | No | App Functionality |
| **Usage Data — Product Interaction** | Yes | No | No | Analytics — aggregated, no individual tracking |

### Critical answer: **"Do you use data to track users?"** → **NO**

Apple defines "tracking" as linking data with data from other companies'
apps/websites for advertising or sharing with data brokers. We do neither.
This keeps us out of the App Tracking Transparency prompt requirement.

### "Users can decline to share" — toggle for location

On the Location row, mark **Yes** for "Users can opt in or out" — the
location permission dialog is the opt-in; declining still lets the app
work via ZIP entry.

---

## 6. Sign-in requirements — Apple Guideline 4.8

If we offer **any** third-party sign-in (magic link + OTP qualify as
"alternative auth" in Apple's eyes), we **must** offer Sign in with Apple
(SIWA) as well. Otherwise: automatic rejection.

**Mitigation**:
- Add SIWA as a sign-in option alongside magic link + OTP. Implementation
  goes into the M1 agent's foundation PR (week 8).
- The SIWA button must be visually equivalent to the other options (not
  smaller, not after, not in a collapsed menu).
- Supported: `expo-apple-authentication`.

See `REVIEWER_NOTES.md` §4 for the explanation we give reviewers.

---

## 7. Screenshots

**Three mandatory display sizes** per Apple's current spec:

| Display | Resolution | Devices |
|---|---|---|
| 6.7" | 1290 × 2796 | iPhone 15 Pro Max, 14 Pro Max |
| 6.5" | 1284 × 2778 | iPhone 14 Plus (fallback for non-Pro Max) |
| 5.5" | 1242 × 2208 | iPhone 8 Plus (legacy; still required as of 2026) |

Each size needs **3–10** screenshots. We'll ship **5** per size × 3 locales =
45 assets. Use the design team's Figma master + `expo-screenshot-cli` or
`fastlane frameit` to generate at submit time.

### Screens to capture (in order, each locale)

1. **Home — crisis-first wizard**: "What do you need?" 4-card intent picker.
   Hero text overlay (localized): *"Find help nearby, in your language."*
2. **Resource detail**: a specific pantry page with open-now chip, address,
   walk/transit directions. Overlay: *"Updated daily from city and nonprofit
   data."*
3. **Anonymous post composer**: "Ask a neighbor" screen with 3 templates.
   Overlay: *"No sign-in to ask. No sign-in to see answers."*
4. **Community feed**: neighborhood page showing 3 recent anchor posts
   (fridge stocked, clothing drive, library warming center).
   Overlay: *"See what's happening on your block right now."*
5. **Settings / language switcher**: three language pills highlighted.
   Overlay: *"Everything in English, Español, and 简体中文."*

### Alt text

Apple doesn't accept per-screenshot alt text, but provide it in the
**App Previews** metadata field for the video (see §8).

### Production workflow

1. Design team delivers mocked frames in Figma (owner: design team lead).
2. Engineer runs the app in three locales on a simulator matching each
   display size.
3. `xcrun simctl io booted screenshot` per frame.
4. Place PNG in `apps/mobile/assets/store/<locale>/<size>/` (to be created in
   wave B).
5. Upload via ASC web UI or `fastlane deliver`.

---

## 8. App preview video

Recommended: one 30-second English video; Spanish + Chinese are optional
for v1.0 (add in 1.1 to avoid translation blocking launch).

| Spec | Value |
|---|---|
| Length | 15–30 sec (30 recommended) |
| Resolution | match largest screenshot (6.7", 1290 × 2796) |
| Format | `.mov` H.264 |
| Audio | optional; many civic apps ship muted with captions |
| Narrative | 3 beats: (1) "A New Yorker needs food." (2) "She opens WeaveNYC." (3) "She finds a pantry that's open now." |

Record with `xcrun simctl io booted recordVideo` on a 6.7" simulator, overlay
captions in Keynote or After Effects.

---

## 9. Pre-submit checklist

Open this doc alongside App Store Connect when filling out the listing:

- [ ] App name matches (§1)
- [ ] Bundle ID reserved (`CERTIFICATES.md` step 1)
- [ ] Primary + secondary category set (§1)
- [ ] Age rating questionnaire complete (§1)
- [ ] EN / ES / ZH copy filled (§§2–4); native speaker review signed off on ES + ZH
- [ ] Keywords under 100 chars per locale (§2)
- [ ] Privacy URL resolves to privacy page (§2)
- [ ] Support URL resolves to a help page (§2)
- [ ] Privacy nutrition labels match §5
- [ ] SIWA wired in the build (§6)
- [ ] 15 screenshots (5 × 3 sizes) for EN; 15 for ES; 15 for ZH (§7)
- [ ] 1 English preview video (§8)
- [ ] Build uploaded via `eas submit` (see `CERTIFICATES.md`)
- [ ] Reviewer notes pasted into "App Review Information" (see `REVIEWER_NOTES.md`)
- [ ] Submit for review
