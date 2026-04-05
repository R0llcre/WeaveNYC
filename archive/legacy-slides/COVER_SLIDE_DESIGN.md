# WeaveNYC Cover Slide Design Specification
## Premium Liquid Glass Aesthetic

**Date:** March 5, 2026
**Format:** PptxGenJS (10" × 5.625")
**Theme:** Apple Keynote / iOS Liquid Glass Glassmorphism
**Target:** Elegant simplicity, spacious layout, premium feel

---

## DESIGN PHILOSOPHY

The liquid glass aesthetic is achieved through:
1. **Layered Translucency** — Multiple shapes at varying opacity create depth
2. **Soft Color Interplay** — Warm accent colors visible through transparent layers
3. **Strategic Whitespace** — Generous breathing room around elements
4. **Subtle Blur Effect** — Simulated through soft shadows and layer blending
5. **Clean Typography** — Hierarchy through size and weight, not decoration

This design prioritizes **visual clarity** and **sophistication** — every element serves purpose.

---

## COLOR PALETTE

| Element | Hex Color | Purpose |
|---------|-----------|---------|
| Primary Accent | #2563EB | Deep Azure (trust, tech) |
| Secondary Accent | #0EA5E9 | Bright Sky Blue (openness, community) |
| Tertiary Accent | #06B6D4 | Cyan (innovation) |
| Warm Accent | #F59E0B | Amber (warmth, care) |
| Text Primary | #1F2937 | Dark Gray (primary text) |
| Text Secondary | #4B5563 | Medium Gray (secondary text) |
| Glass Base | #FFFFFF | White (base for glass effect) |
| Shadow Dark | #000000 | Black (shadows) |

---

## CANVAS DIMENSIONS & ZONES

**Canvas:** 10" × 5.625" (standard 16:9)

```
┌─────────────────────────────────────────────────────────────┐
│ MARGIN: 0.5" all sides                                      │
│                                                              │
│  ZONE 1: Background Gradient Simulation (Full Canvas)       │
│  ZONE 2: Primary Content Container (Left 60%)               │
│  ZONE 3: Stats Column (Right 35%)                           │
│  ZONE 4: Footer Meta (Bottom 10%)                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## SECTION 1: BACKGROUND GRADIENT SIMULATION

**Strategy:** 4 large overlapping ellipses with high transparency to create smooth color transition from blue → cyan → sky blue across the canvas.

### Layer 1: Deep Azure Base (Bottom-Left)
- **Shape:** Ellipse
- **Position:** X: -1", Y: 3" (off-canvas, intentional)
- **Size:** 8" W × 8" H
- **Fill Color:** #2563EB (Deep Azure)
- **Transparency:** 15% (85% opaque)
- **Shadow:** None
- **Purpose:** Anchors warm, trustworthy tone at bottom-left

### Layer 2: Sky Blue Accent (Top-Right)
- **Shape:** Ellipse
- **Position:** X: 6", Y: -1.5" (off-canvas)
- **Size:** 7" W × 7" H
- **Fill Color:** #0EA5E9 (Bright Sky Blue)
- **Transparency:** 20% (80% opaque)
- **Shadow:** None
- **Purpose:** Brightens top-right, creates openness

### Layer 3: Cyan Secondary (Center-Right)
- **Shape:** Ellipse
- **Position:** X: 7.5", Y: 1.5"
- **Size:** 5" W × 5" H
- **Fill Color:** #06B6D4 (Cyan)
- **Transparency:** 25% (75% opaque)
- **Shadow:** None
- **Purpose:** Adds innovation/tech feel in periphery

### Layer 4: Subtle White Veil (Full Canvas)
- **Shape:** Rectangle
- **Position:** X: 0", Y: 0"
- **Size:** 10" W × 5.625" H
- **Fill Color:** #FFFFFF (White)
- **Transparency:** 8% (92% opaque)
- **Shadow:** None
- **Purpose:** Softens the color intensity, adds luminosity

**Result:** Soft gradient from deep blue (bottom-left) → cyan → sky blue (top-right), with all edges blurred into white. Overall effect: bright, clean, premium.

---

## SECTION 2: PRIMARY CONTENT CONTAINER (Glass Card)

This is the main content area with liquid glass aesthetic.

### Container Background
- **Shape:** Rectangle with rounded corners
- **Position:** X: 0.5", Y: 0.5"
- **Size:** 5.8" W × 4.625" H
- **Fill Color:** #FFFFFF (White)
- **Transparency:** 12% (88% opaque) — KEY: This creates the "frosted glass" effect
- **Border:** None (no outline)
- **Rounded Corners:** 24 pt
- **Shadow:**
  - **Blur Radius:** 40 pt
  - **Spread:** 0 pt
  - **Offset X:** 0 pt
  - **Offset Y:** 8 pt
  - **Color:** #000000
  - **Transparency:** 8% (subtle, not harsh)
- **Effect:** Deep, floating appearance with soft luminosity

### Glass Container Border (Optional Accent)
- **Shape:** Rectangle with rounded corners (outline only)
- **Position:** X: 0.5", Y: 0.5"
- **Size:** 5.8" W × 4.625" H
- **Fill:** None
- **Line Width:** 1 pt
- **Line Color:** #0EA5E9 (Bright Sky Blue)
- **Transparency:** 30% (70% opaque) — Optional: Creates subtle rim-light effect
- **Rounded Corners:** 24 pt
- **Purpose:** Subtle hint of accent color, enhances glass aesthetic

---

## SECTION 3: TYPOGRAPHY & CONTENT LAYOUT (Inside Glass Container)

**Internal Margins:** 0.35" from edges of glass container

### 3.1 Logo / Brand Mark
- **Position:** X: 0.85", Y: 0.75"
- **Content:** "◆" (Unicode diamond: U+25C6)
- **Font:** Georgia (serif)
- **Size:** 28 pt
- **Weight:** Regular
- **Color:** #2563EB (Deep Azure)
- **Purpose:** Visual anchor, distinctly premium
- **Note:** Use Unicode symbol instead of image for pure vector aesthetic

### 3.2 Main Title: "WeaveNYC"
- **Position:** X: 0.85", Y: 1.1"
- **Font:** Calibri (sans-serif)
- **Size:** 44 pt
- **Weight:** Bold (700)
- **Color:** #1F2937 (Dark Gray)
- **Letter Spacing:** 0.5 pt (tight, premium)
- **Line Spacing:** 1.0
- **Purpose:** Primary branding element

### 3.3 Subtitle: "织邻纽约" (Chinese)
- **Position:** X: 0.85", Y: 1.6"
- **Font:** Georgia (serif) — gives Chinese characters elegant weight
- **Size:** 18 pt
- **Weight:** Regular
- **Color:** #0EA5E9 (Bright Sky Blue)
- **Purpose:** Cultural resonance, adds visual rhythm
- **Note:** Chinese serif fonts (like SimSun or HKSans) work beautifully; Calibri's CJK fallback acceptable

### 3.4 Tagline
- **Position:** X: 0.85", Y: 1.95"
- **Font:** Calibri (sans-serif)
- **Size:** 12 pt
- **Weight:** Regular (400)
- **Color:** #4B5563 (Medium Gray)
- **Line Height:** 1.4
- **Max Width:** 4.8" (wraps)
- **Content:** "Privacy-First Mutual Aid for NYC's Underserved Communities"
- **Purpose:** Context and differentiation
- **Note:** Two lines, carefully balanced

### 3.5 Divider Line (Accent)
- **Shape:** Rectangle (thin line)
- **Position:** X: 0.85", Y: 2.35"
- **Size:** 1.2" W × 1 pt H
- **Fill Color:** #0EA5E9 (Bright Sky Blue)
- **Transparency:** 40% (60% opaque)
- **Purpose:** Subtle visual break, guides eye downward

### 3.6 Metadata (Attribution)
- **Position:** X: 0.85", Y: 2.55"
- **Font:** Calibri (sans-serif)
- **Size:** 9 pt
- **Weight:** Regular (400)
- **Color:** #9CA3AF (Light Gray — lighter than secondary text)
- **Content:** "Kairan Shen · Software Engineering · Spring 2026"
- **Purpose:** Subtle, premium credit line

---

## SECTION 4: STATS COLUMN (Right Side)

This is a **secondary glass card** showing key metrics. Positioned to the right of main container.

### Stats Container Background
- **Shape:** Rectangle with rounded corners
- **Position:** X: 6.5", Y: 0.5"
- **Size:** 3" W × 4.625" H
- **Fill Color:** #FFFFFF (White)
- **Transparency:** 10% (90% opaque) — Slightly more opaque than main card
- **Rounded Corners:** 20 pt
- **Shadow:**
  - **Blur Radius:** 30 pt
  - **Offset Y:** 6 pt
  - **Color:** #000000
  - **Transparency:** 10%
- **Purpose:** Secondary, supporting information, slightly bolder than main card

### Stats Title
- **Position:** X: 6.8", Y: 0.8"
- **Font:** Calibri (sans-serif)
- **Size:** 11 pt
- **Weight:** Bold (700)
- **Color:** #1F2937 (Dark Gray)
- **Text Transform:** UPPERCASE
- **Letter Spacing:** 1 pt
- **Content:** "BY THE NUMBERS"
- **Purpose:** Section header, premium feel

### Stat 1: Personas
- **Position:** X: 6.8", Y: 1.3"
- **Value:** "3"
- **Font:** Calibri (sans-serif)
- **Size:** 32 pt
- **Weight:** Bold (700)
- **Color:** #2563EB (Deep Azure)
- **Label Below:** "Personas" (9 pt, Regular, #4B5563)

### Stat 2: Use Cases
- **Position:** X: 7.5", Y: 1.3"
- **Value:** "5"
- **Font:** Calibri (sans-serif)
- **Size:** 32 pt
- **Weight:** Bold (700)
- **Color:** #0EA5E9 (Bright Sky Blue)
- **Label Below:** "Use Cases" (9 pt, Regular, #4B5563)

### Stat 3: User Stories
- **Position:** X: 8.2", Y: 1.3"
- **Value:** "57"
- **Font:** Calibri (sans-serif)
- **Size:** 32 pt
- **Weight:** Bold (700)
- **Color:** #06B6D4 (Cyan)
- **Label Below:** "Stories" (9 pt, Regular, #4B5563)

### Divider Line in Stats
- **Shape:** Rectangle (thin line)
- **Position:** X: 6.8", Y: 2.15"
- **Size:** 2.4" W × 1 pt H
- **Fill Color:** #0EA5E9 (Bright Sky Blue)
- **Transparency:** 40% (60% opaque)

### Differentiators Section
- **Position:** X: 6.8", Y: 2.4"
- **Font:** Calibri (sans-serif)
- **Size:** 9 pt
- **Weight:** Regular (400)
- **Color:** #4B5563 (Medium Gray)
- **Line Height:** 1.5
- **Content (4 lines):**
  - "✓ Local-First Design"
  - "✓ P2P Data Sync"
  - "✓ Progressive Auth"
  - "✓ Multi-Cloud Ready"
- **Checkmark Style:** #0EA5E9 (Bright Sky Blue), Unicode ✓

### Story Points Badge (Bottom-Right Corner of Stats Card)
- **Position:** X: 8.0", Y: 4.05"
- **Shape:** Rounded rectangle badge
- **Size:** 0.9" W × 0.35" H
- **Fill Color:** #F59E0B (Amber)
- **Rounded Corners:** 12 pt
- **Transparency:** 20% (80% opaque)
- **Text:** "161 Points" (8 pt, Bold, #1F2937)
- **Purpose:** Emphasis on completion/scope

---

## SECTION 5: FOOTER & BOTTOM ACCENT

### Bottom Accent Bar
- **Shape:** Rectangle
- **Position:** X: 0.5", Y: 5.125"
- **Size:** 9" W × 0.4" H
- **Fill Color:** Linear color transition (simulated with 2 rects)
  - **Left Rect:** #2563EB (Deep Azure), 25% transparency
  - **Right Rect:** #0EA5E9 (Sky Blue), 25% transparency
- **Purpose:** Footer accent, ties design together

---

## Z-ORDER (LAYERING)

1. **Background Ellipses** (Layers 1-4) — Bottom layer
2. **White Veil Ellipse** — Softens everything
3. **Main Glass Container** (Primary card) — Middle layer
4. **Secondary Glass Container** (Stats card) — Middle layer
5. **All Text Elements** — Top layer
6. **Bottom Accent Bar** — Top layer (optional: place below text for subtlety)

---

## RENDERING CHECKLIST

- [ ] All ellipses are positioned slightly off-canvas for natural blending
- [ ] Transparency values create soft, not harsh, color transitions
- [ ] Both glass containers have matching 24pt rounded corners
- [ ] Shadow blur radius is significant (40pt + 30pt) for floating effect
- [ ] Typography hierarchy is clear: Title (44pt) → Subtitle (18pt) → Tagline (12pt)
- [ ] Stats column uses bold color accents (Azure, Sky Blue, Cyan) for visual interest
- [ ] All text has adequate contrast against white background
- [ ] Divider lines are subtle (40% transparency)
- [ ] Chinese characters render correctly at 18pt Georgia
- [ ] Overall composition feels spacious, not cramped

---

## VISUAL HIERARCHY SUMMARY

| Level | Element | Size | Weight | Color |
|-------|---------|------|--------|-------|
| 1 (Highest) | WeaveNYC Title | 44 pt | Bold | Dark Gray |
| 2 | Tagline | 12 pt | Regular | Medium Gray |
| 3 | Subtitle (Chinese) | 18 pt | Regular | Sky Blue |
| 4 | Stats Values | 32 pt | Bold | Accent Colors |
| 5 | Metadata | 9 pt | Regular | Light Gray |

---

## PREMIUM DETAILS (Why This Feels "Apple")

1. **Generous Whitespace** — Content occupies <50% of canvas, rest is breathing room
2. **Limited Color Palette** — 4 accent colors, used strategically
3. **Subtle Shadows** — Deep blur (40pt+) for floating effect, not harsh borders
4. **Transparent Layering** — No opaque overlays; glass effect through transparency
5. **Perfect Alignment** — All elements snap to 0.05" grid
6. **Typography Restraint** — Only 2 fonts (Georgia + Calibri), sized precisely
7. **Accent Color Purpose** — Each color (Azure, Sky, Cyan, Amber) serves function
8. **No Gradients, No Gloss** — Pure, clean, mathematical approach
9. **Floating Effect** — Cards appear to hover above background
10. **Cultural Balance** — Both English and Chinese equally prominent

---

## IMPLEMENTATION NOTES FOR PPTXGENJS

### Shadow Implementation
```javascript
shadow: {
  type: 'outer',
  blur: 40,
  offset: { x: 0, y: 8 },
  angle: 90,
  color: '#000000',
  opacity: 0.08
}
```

### Transparency (Fill)
```javascript
fill: { color: '#FFFFFF', transparency: 12 } // 88% opaque
```

### Rounded Corners
```javascript
rectRadius: { pt: 24 } // PptxGenJS accepts pt values
```

### Text Centering
- **Vertical Centering:** Use `valign: 'middle'` option
- **Horizontal Centering:** Use `align: 'center'` (or 'left' for left-aligned text with specific X)

---

## ANIMATION & TRANSITION (Optional)

For presentation context:
- **Entrance:** Fade in (0.3s) — lets audience appreciate the design
- **Exit:** Fade out (0.2s)
- No motion graphics; let the static design speak

---

## COLOR ACCESSIBILITY CHECK

- ✓ Dark Gray (#1F2937) on White — WCAG AAA compliant
- ✓ Sky Blue (#0EA5E9) on White — WCAG AA compliant
- ✓ Azure (#2563EB) large text on White — WCAG AA compliant
- ✓ Amber (#F59E0B) on White — WCAG AA compliant

---

## FINAL DESIGN SUMMARY

**This is a** premium cover slide that communicates:
- **Trust** — Through deep azure foundation
- **Innovation** — Through cyan and sky blue accents
- **Openness** — Through generous whitespace and transparency
- **Precision** — Through careful typography and alignment
- **Cultural Pride** — Through bilingual, equal-weight title
- **Professionalism** — Through liquid glass aesthetic and subtle shadows

The design would be **equally at home on a MacBook screen or presented in a dark auditorium**. It prioritizes **clarity and elegance** over visual noise.

---

**Design Credit:** Premium Liquid Glass Aesthetic v1.0
**Created:** March 5, 2026
**Format:** PptxGenJS 10" × 5.625"
