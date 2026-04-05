# WeaveNYC Cover Slide Design - Rationale & Visual Guide

**March 5, 2026**

---

## DESIGN PHILOSOPHY: "Liquid Glass"

The "liquid glass" or "glassmorphism" aesthetic is Apple's signature design language (seen in iOS 14+ Control Center, macOS Big Sur, and recent keynote presentations). It's achieved through:

1. **Layered Translucency** — Multiple transparent surfaces at different depths create a sense of floating layers
2. **Diffused Color** — Colors bleed through transparent layers, creating soft gradations
3. **Subtle Blur** — Achieved via shadows with high blur radius, not CSS blur filter (not available in PPTX)
4. **Rim Light Effect** — Optional thin colored border creates illusion of edge lighting
5. **Generous Whitespace** — Content breathes; elements don't crowd the canvas

---

## VISUAL BREAKDOWN BY SECTION

### Background Gradient Simulation (4-Layer System)

**Why overlapping ellipses instead of true gradients?**
- PptxGenJS has no native gradient support
- Overlapping shapes with transparency simulate gradients perfectly
- More control over color placement and blending
- Mathematical, predictable results

**The 4 layers:**

```
LAYER 4 (White Veil)
  ├─ Full canvas coverage
  ├─ 92% transparency (8% opaque)
  └─ Softens all colors below

LAYER 3 (Cyan - Center-Right)
  ├─ Accent innovation/tech
  ├─ Position (7.5", 1.5")
  └─ 75% transparency

LAYER 2 (Sky Blue - Top-Right)
  ├─ Represents openness/community
  ├─ Position (6", -1.5") [off-canvas]
  └─ 80% transparency

LAYER 1 (Azure - Bottom-Left)
  ├─ Foundation trust/stability
  ├─ Position (-1", 3") [off-canvas]
  └─ 85% transparency
```

**Visual Result:**
- Top-left: Soft blue (Azure + white = light blue tint)
- Top-right: Bright sky (Sky Blue + Cyan blend = aqua)
- Bottom-left: Deep blue (Azure dominates)
- Bottom-right: Fade to white
- **Effect:** Directional flow from cool blues (left/bottom) to bright cyan (right)

---

### Primary Content Container (Glass Card Effect)

**Transparency is the key:**
- Background: 88% opaque white (12% transparent)
- This reveals the colored background ellipses THROUGH the card
- Creates illusion of frosted glass with color underneath
- Not a solid white container; it's translucent

**Shadow implementation:**
- Blur radius: 40pt (very soft, spreads far)
- Y-offset: 8pt (shadow falls slightly below)
- Opacity: 8% (extremely subtle)
- Effect: Card appears to float 12-15mm above background

**Border accent (optional):**
- 1pt line, Sky Blue, 70% opaque
- Creates "rim light" effect
- Suggests light reflecting off glass edge
- Can be removed if too much visual noise

**Rounded corners: 24pt**
- Apple standard for large UI containers
- Not too aggressive (not 48pt); still feels contemporary
- Creates soft, approachable aesthetic

---

### Stats Column (Secondary Glass Card)

**Slightly different treatment:**
- 90% opaque (vs. 88% on main card) — slightly less transparent
- Shadow blur: 30pt (slightly tighter than main card)
- Creates visual hierarchy: main card is more prominent
- Same 20pt rounded corners, but slightly smaller radius

**Why stats on the right?**
- Balances composition: main content (left) + supporting info (right)
- Allows eyes to scan: left to right, top to bottom
- Secondary card is narrower (3" vs. 5.8"), suggests lesser importance
- Both cards share same top-left Y position (0.5") for alignment

---

### Typography Hierarchy

**The cascade:**

```
44pt Bold "WeaveNYC"
  └─ Primary: Identity, immediately recognizable
  └─ Calibri sans-serif: Modern, tech-forward
  └─ Dark gray: High contrast, readable

18pt Regular "织邻纽约"
  └─ Secondary: Cultural connection
  └─ Georgia serif: Elegant, cultural respect
  └─ Sky blue: Accent color, guides eye

12pt Regular Tagline
  └─ Tertiary: Context
  └─ Calibri: Consistency with title
  └─ Medium gray: Less emphasis than title
  └─ Wraps to 2 lines naturally

9pt Regular Metadata
  └─ Quaternary: Attribution
  └─ Light gray: Minimal emphasis
  └─ Preserves credit without visual weight
```

**Why Georgia for Chinese?**
- Georgia includes CJK character set
- Serif weight lends elegance to Chinese strokes
- Alternative: Use system font "SimSun" (Chinese) + "Georgia" fallback
- At 18pt, characters are large enough for serif detail

---

### Color Psychology

| Color | Hex | Opacity | Role | Psychology |
|-------|-----|---------|------|-------------|
| **Azure** | #2563EB | 85% bg | Foundation trust | Deep, tech-forward, stable |
| **Sky Blue** | #0EA5E9 | 80% bg | Community openness | Light, accessible, inclusive |
| **Cyan** | #06B6D4 | 75% bg | Innovation accent | Modern, forward-thinking |
| **Amber** | #F59E0B | 80% card | Warmth/care | Human-centered, caring |
| **Dark Gray** | #1F2937 | 100% text | Primary content | Professional, serious |
| **Medium Gray** | #4B5563 | 100% text | Secondary content | Subtle, supporting |
| **Light Gray** | #9CA3AF | 100% text | Tertiary content | Minimal, metadata |

**Why these 4 accent colors?**
- Azure + Sky Blue: Primary brand color range (cool, tech)
- Cyan: Digital/innovation accent, differs from Azure
- Amber: Warmth to humanize; contrast with cool palette
- Together: Diverse, inclusive without chaotic

---

## COMPOSITION & LAYOUT

**Canvas: 10" × 5.625" (16:9 aspect ratio)**

```
┌─────────────────────────────────────────────────────────────┐
│ 0.5" margin (all sides)                                     │
│                                                              │
│  PRIMARY CONTENT (Main Card)     │  STATS (Secondary Card)  │
│  ├─ Position: (0.5", 0.5")       │  ├─ Position: (6.5", 0.5"|
│  ├─ Size: 5.8" × 4.625"          │  ├─ Size: 3" × 4.625"    │
│  ├─ Margin inside: 0.35"         │  ├─ Margin inside: 0.3"  │
│  │  ├─ Logo: ◆                   │  │  ├─ Title: "BY…"      │
│  │  ├─ Title: 44pt               │  │  ├─ Stats: 3 cols      │
│  │  ├─ Subtitle: 18pt            │  │  ├─ Divider           │
│  │  ├─ Tagline: 12pt             │  │  ├─ Differentiators   │
│  │  ├─ Divider line              │  │  └─ Badge: 161 Points │
│  │  └─ Metadata: 9pt             │  │                        │
│  │                                 │                        │
│  └─────────────────────────────────┘  └─────────────────────│
│                                                              │
│ Bottom Accent Bar: 0.4" H @ Y: 5.125"                       │
└─────────────────────────────────────────────────────────────┘
```

**Spacing philosophy:**
- **0.5" margins:** Standard padding around canvas edge
- **0.35" internal margins:** Breathing room inside cards
- **0.15" gutters** between title and subtitle: Vertical rhythm
- **0.4" accent bar:** Just tall enough to notice, not overwhelming

---

## ACHIEVING THE "PREMIUM" FEEL

1. **Restraint**
   - Only 2 fonts (Calibri + Georgia)
   - Only 4 accent colors + 3 text colors
   - Only 2 cards (no scattered elements)
   - Negative space > filled space

2. **Precision**
   - Measurements snap to 0.05" grid (for alignment)
   - Shadows use mathematical blur radii
   - Typography sized to optical hierarchy
   - Margins are proportional (golden ratio-inspired)

3. **Layering**
   - Background ellipses create depth
   - Cards float above background (shadow effect)
   - Text floats above cards (highest layer)
   - Z-order tells a story of depth

4. **Subtlety**
   - Transparency > opacity (glass not plastic)
   - Soft shadows > harsh borders
   - Color blending > stark contrast
   - Accent bars > bold underlines

5. **Intentionality**
   - Every element has a purpose
   - No decoration; only structure
   - Visual hierarchy supports scanning
   - Bilingual design signals inclusion

---

## COMPARISON: WHY THIS BEATS ALTERNATIVES

### ❌ Bold gradient (harsh lines)
- Creates jarring color transitions
- Hard to read text over transitions
- Lacks sophistication

### ✓ Liquid glass (soft blending)
- Colors blend smoothly
- Text readable everywhere
- Premium, contemporary

### ❌ Flat white background
- No visual interest
- Wastes canvas potential
- Feels corporate/generic

### ✓ Colored background with glass cards
- Dynamic, engaging
- Cards feel elevated
- Premium presentation

### ❌ Multiple cards scattered (chaotic)
- Eyes don't know where to focus
- Cramped, amateurish
- Hard to read

### ✓ Two balanced cards
- Clear content hierarchy
- Spacious, breathable
- Professional scanning order

### ❌ Many accent colors (confusing)
- Rainbow aesthetic, lacks coherence
- Too many elements compete
- Feels cheap

### ✓ 4 accent colors (purposeful)
- Each color serves function
- Restrained palette feels premium
- Colors reinforce content meaning

---

## IMPLEMENTATION CHECKLIST

### Geometry
- [ ] Main card: 5.8" W × 4.625" H @ (0.5", 0.5")
- [ ] Stats card: 3" W × 4.625" H @ (6.5", 0.5")
- [ ] Bottom accent bar: 9" W × 0.4" H @ (0.5", 5.125")
- [ ] All rounded corners: 24pt (0.2") for main, 20pt (0.167") for secondary

### Transparency
- [ ] Background ellipses: 85%, 80%, 75%, 92% transparency (high!)
- [ ] Main card fill: 12% transparency (88% opaque)
- [ ] Stats card fill: 10% transparency (90% opaque)
- [ ] Card borders: 70% transparency (optional)
- [ ] Divider lines: 60% transparency (40% opaque)
- [ ] Accents (amber badge): 80% transparency (20% opaque)

### Shadows
- [ ] Main card: blur 40pt, offset 0/8, opacity 0.08
- [ ] Stats card: blur 30pt, offset 0/6, opacity 0.10
- [ ] No shadows on ellipses or text

### Typography
- [ ] Title: 44pt Calibri Bold, Dark Gray, Letter spacing 0.5pt
- [ ] Subtitle: 18pt Georgia Regular, Sky Blue
- [ ] Tagline: 12pt Calibri Regular, Medium Gray, 1.4 line spacing
- [ ] Metadata: 9pt Calibri Regular, Light Gray
- [ ] Stats numbers: 32pt Calibri Bold, accent colors
- [ ] Labels: 9pt Calibri Regular, Medium Gray

### Colors
- [ ] Verify hex codes match spec (no approximations)
- [ ] Test contrast: WCAG AA minimum for all text
- [ ] Ensure colors render correctly in export

### Visual Check
- [ ] No elements touching canvas edges (except background ellipses)
- [ ] Cards appear to float above background
- [ ] Text readable on glass cards
- [ ] Stats column feels supporting, not competing
- [ ] Overall composition feels spacious, not cramped
- [ ] Takes ~2-3 seconds to scan completely (not overwhelming)

---

## ANIMATION (OPTIONAL, FOR PRESENTATION)

If presenting this slide:

```javascript
// Entrance transition
entrance: {
  type: 'fade',
  duration: 0.3 // seconds
}

// Exit transition
exit: {
  type: 'fade',
  duration: 0.2
}
```

**Why fade?**
- Respects the design's elegance
- No motion distraction
- Lets audience appreciate static beauty
- Apple keynote standard

**Avoid:**
- Slide/wipe (jarring)
- Spin (gimmicky)
- Complex animations (undermine minimalism)

---

## EXPORT SETTINGS

When saving `.pptx`:
- **Resolution:** 300 DPI minimum
- **Compression:** None (preserve transparency gradations)
- **Color model:** RGB (not CMYK)
- **Font embedding:** Embed Calibri + Georgia (cross-platform)

---

## TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| Text appears blurry | Increase font size or use sans-serif (Calibri > Georgia for small text) |
| Glass card looks too opaque | Reduce transparency to 15-18% (higher number = more transparent) |
| Glass card looks too transparent | Increase opacity to 8-10% (lower transparency %) |
| Colors appear muted | Background ellipses might be too transparent; reduce transparency % |
| Shadows look harsh | Reduce blur radius (40 → 30) or lower opacity (0.08 → 0.05) |
| Bottom accent bar invisible | Increase opacity to 30-35% transparency (not 75%) |
| Chinese characters render wrong font | Explicitly set fontFace: 'SimSun' or system CJK font |
| Rounded corners appear pixelated | Export as vector PDF first, then convert (preserves curves) |

---

## DESIGN LINEAGE

This design draws inspiration from:
- **Apple iOS Control Center** (glassmorphism reference)
- **macOS Big Sur** (layered transparency approach)
- **2023-2025 Apple Keynotes** (premium typography, whitespace)
- **Figma Design System** (color palette philosophy)
- **Glassmorphism.com** (trend research)

---

## FINAL AESTHETIC STATEMENT

> This design is **elegant through restraint**. It communicates trust, innovation, and care through layered translucent surfaces and purposeful color. There are no decorative flourishes—every pixel serves the content. The result feels premium because it respects the viewer's intelligence and time.

**In other words:** It looks like something Apple could present on stage. ✨

---

**Design Document Complete**
**Ready for Implementation in PptxGenJS**
