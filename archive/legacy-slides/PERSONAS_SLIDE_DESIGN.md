# WeaveNYC Target Users: Three Personas Slide
## Comparison Table Design Specification

**Date:** March 5, 2026
**Format:** PptxGenJS (10" × 5.625")
**Theme:** Premium Liquid Glass Aesthetic (consistent with cover slide)
**Target:** Clean, scannable comparison of three user personas

---

## DESIGN PHILOSOPHY: COMPARISON TABLE APPROACH

Rather than scattered cards or visual pyramids, this slide uses a **structured comparison table** to present three personas side-by-side. Benefits:

- **Scannable:** Eyes move left-to-right, top-to-bottom naturally
- **Information-Dense:** Fits all content without clutter
- **Professional:** Evokes data-driven, structured thinking
- **Differentiated:** Distinctly different from previous asymmetric/pyramid layouts
- **Glass Container:** Still maintains premium liquid glass aesthetic

---

## LAYOUT OVERVIEW

### Canvas Dimensions
- **Size:** 10" W × 5.625" H (16:9 aspect ratio)
- **Main Container:** Single large glass card
  - **Position:** (0.4", 0.4")
  - **Size:** 9.2" W × 4.825" H
  - **Coverage:** ~92% of slide area
  - **Fill:** White, 88% opaque (glass effect)
  - **Corners:** 24pt rounded
  - **Shadow:** Blur 40pt, offset 0/8pt, opacity 8%

### Grid Structure

```
┌─────────────────────────────────────────────────────────┐
│ Title: "Target Users: Three Personas"                   │
├──────────────┬──────────────┬──────────────┬────────────┤
│ (empty)      │ Need Seeker  │ Helper       │ Anchor     │
│              │ (Blue)       │ (Green)      │ Admin      │
│              │              │              │ (Purple)   │
├──────────────┼──────────────┼──────────────┼────────────┤
│ Who          │ Low-income   │ Volunteers,  │ NGO staff, │
│              │ or immigrant │ neighbors,   │ church     │
│              │ residents    │ community    │ coordinators│
├──────────────┼──────────────┼──────────────┼────────────┤
│ Goal         │ Find help    │ Post offers  │ Moderate,  │
│              │ ASAP. Private│ easily. Match│ configure  │
│              │ Plan <1 min  │ safely. Risk │ rules.     │
│              │              │ alerts.      │ Review +   │
│              │              │              │ audit logs │
├──────────────┼──────────────┼──────────────┼────────────┤
│ Our Value    │ ✓ Zero friction  │ ✓ Smart matching  │ ✓ Full visibility  │
│              │ ✓ Anonymous      │ ✓ Safety first    │ ✓ Compliance tools │
│              │ ✓ No tracking    │ ✓ Trust signals   │ ✓ Community control│
└──────────────┴──────────────┴──────────────┴────────────┘
```

---

## DETAILED SPECIFICATIONS

### SECTION 1: Background (Liquid Glass Gradient)

Identical to cover slide: 4-layer overlay system.

| Layer | Shape | Position | Size | Color | Transparency |
|-------|-------|----------|------|-------|--------------|
| 1 | Ellipse | (-1", 3") | 8"×8" | #2563EB (Azure) | 85% |
| 2 | Ellipse | (6", -1.5") | 7"×7" | #0EA5E9 (Sky Blue) | 80% |
| 3 | Ellipse | (7.5", 1.5") | 5"×5" | #06B6D4 (Cyan) | 75% |
| 4 | Rectangle | (0", 0") | 10"×5.625" | #FFFFFF (White) | 92% |

---

### SECTION 2: Slide Title (Above Grid)

- **Position:** X: 0.8", Y: 0.52"
- **Size:** 6" W × 0.25" H
- **Content:** "Target Users: Three Personas"
- **Font:** Calibri
- **Size:** 18pt
- **Weight:** Bold (700)
- **Color:** #1F2937 (Dark Gray)
- **Align:** Left
- **Purpose:** Clear section header, visible above table

---

### SECTION 3: Comparison Table (Main Content)

#### Grid Layout Dimensions

```
Internal Margins (from glass card edge):
- Top: 0.35"
- Left/Right: 0.4"
- Bottom: 0.4"

Available Space: 8.4" W × 4.225" H

Column Distribution:
┌──────────┬──────────┬──────────┬──────────┐
│ Col 0    │ Col 1    │ Col 2    │ Col 3    │
│ (Labels) │ (NS)     │ (Helper) │ (Admin)  │
│ 1.75"    │ 2.45"    │ 2.45"    │ 2.45"    │
└──────────┴──────────┴──────────┴──────────┘

Row Distribution:
┌─────────────────────────────────────┐
│ Row 0: Header              (0.65")  │
├─────────────────────────────────────┤
│ Row 1: Who                 (1.0")   │
├─────────────────────────────────────┤
│ Row 2: Goal                (1.0")   │
├─────────────────────────────────────┤
│ Row 3: Our Value           (0.85")  │
└─────────────────────────────────────┘
```

#### Grid Cells: Styling

**Cell Borders:**
- Style: Rectangle outline
- Width: 1pt
- Color: #9CA3AF (Light Gray)
- Transparency: 85% (15% opaque — very subtle)
- Gutter between cells: 0.02"

**Header Cells (Row 0):**
- Background: Persona color, 20% opacity
- Text: White, bold, 11pt Calibri
- Padding: 0.08" inside cell
- Examples:
  - Need Seeker: Blue background
  - Helper: Green background
  - Anchor Admin: Purple background

**Content Cells (Rows 1-3):**
- Background: Transparent (white shows through)
- Text: 9pt Calibri Regular, medium gray (#4B5563)
- Padding: 0.08" inside cell
- Value cells: Text colored to persona color (no bg color)

---

### SECTION 4: Persona Definitions & Content

#### Column 1: Need Seeker (Blue #2563EB)

**Header (Row 0):**
- Text: "Need Seeker"
- Background: Blue, 20% opacity
- Text color: White

**Who (Row 1):**
- Content: "Low-income or immigrant residents"
- Color: Medium gray

**Goal (Row 2):**
- Content: "Find help ASAP. Private. Plan in under 1 minute."
- Color: Medium gray

**Our Value (Row 3):**
```
✓ Zero friction
✓ Anonymous
✓ No data tracking
```
- Text color: Blue (#2563EB)
- Checkmarks: Blue
- Background: Transparent

---

#### Column 2: Helper (Green #10B981)

**Header (Row 0):**
- Text: "Helper"
- Background: Green, 20% opacity
- Text color: White

**Who (Row 1):**
- Content: "Volunteers, neighbors, community members"
- Color: Medium gray

**Goal (Row 2):**
- Content: "Post offers easily. Match with people safely. Get alerts on risk."
- Color: Medium gray

**Our Value (Row 3):**
```
✓ Smart matching
✓ Safety first
✓ Trust signals
```
- Text color: Green (#10B981)
- Checkmarks: Green
- Background: Transparent

---

#### Column 3: Anchor Admin (Purple #8B5CF6)

**Header (Row 0):**
- Text: "Anchor Admin"
- Background: Purple, 20% opacity
- Text color: White

**Who (Row 1):**
- Content: "NGO staff, church coordinators, administrators"
- Color: Medium gray

**Goal (Row 2):**
- Content: "Moderate, configure rules. Review requests & audit logs."
- Color: Medium gray

**Our Value (Row 3):**
```
✓ Full visibility
✓ Compliance tools
✓ Community control
```
- Text color: Purple (#8B5CF6)
- Checkmarks: Purple
- Background: Transparent

---

## COLOR PALETTE (Personas + Accents)

| Element | Hex | Purpose | Transparency |
|---------|-----|---------|--------------|
| **Need Seeker** | #2563EB | Deep Blue — trust, stability | Header: 20% (80% opaque) |
| **Helper** | #10B981 | Emerald Green — growth, helping | Header: 20% |
| **Anchor Admin** | #8B5CF6 | Purple — authority, leadership | Header: 20% |
| **Text Primary** | #1F2937 | Dark Gray — headings | 100% opaque |
| **Text Secondary** | #4B5563 | Medium Gray — cell content | 100% opaque |
| **Grid Borders** | #9CA3AF | Light Gray — cell outlines | 85% transparent (15% opaque) |
| **Glass Base** | #FFFFFF | White — container & cells | Varies |
| **Shadows** | #000000 | Black — card shadow | 8% opacity |

---

## TYPOGRAPHY

### Heading (Slide Title)
- **Font:** Calibri
- **Size:** 18pt
- **Weight:** Bold (700)
- **Color:** #1F2937 (Dark Gray)
- **Position:** Above grid, left-aligned

### Column Headers (Row 0)
- **Font:** Calibri
- **Size:** 11pt
- **Weight:** Bold (700)
- **Color:** #FFFFFF (White)
- **Background:** Persona color, 20% opacity
- **Align:** Left, vertical top

### Row Labels (Column 0)
- **Font:** Calibri
- **Size:** 10pt
- **Weight:** Bold (700)
- **Color:** #1F2937 (Dark Gray)
- **Content:** "Who", "Goal", "Our Value"

### Cell Content (Rows 1-3, Cols 1-3)
- **Font:** Calibri
- **Size:** 9pt
- **Weight:** Regular (400)
- **Color:** #4B5563 (Medium Gray) for descriptive text
- **Color:** Persona color for "Our Value" checkmarks
- **Line Height:** 13pt (tight for compactness)
- **Word Wrap:** Enabled (text breaks to fit cell width)

---

## SPACING & ALIGNMENT

| Element | Measurement | Notes |
|---------|-------------|-------|
| Card margins | 0.4" left/right, 0.35" top | Inside glass container |
| Column width (Labels) | 1.75" | Row labels (Who, Goal, Value) |
| Column width (Personas) | 2.45" each | Need Seeker, Helper, Anchor Admin |
| Row height (Header) | 0.65" | Persona names |
| Row height (Content) | 1.0" each | Who, Goal (variable based on content) |
| Row height (Value) | 0.85" | Checkmarks (compact) |
| Cell padding | 0.08" all sides | Inside each cell |
| Grid gutter | 0.02" | Between cells (minimal) |
| Card shadow offset | 0pt X, 8pt Y | Drops straight down |
| Card shadow blur | 40pt | Very soft, floating effect |

---

## VISUAL HIERARCHY

| Level | Element | Size | Weight | Color |
|-------|---------|------|--------|-------|
| 1 | Slide Title | 18pt | Bold | Dark Gray |
| 2 | Persona Headers | 11pt | Bold | White on color |
| 3 | Row Labels | 10pt | Bold | Dark Gray |
| 4 | Cell Content | 9pt | Regular | Medium Gray |
| 5 | Value Checkmarks | 9pt | Regular | Persona color |

---

## DESIGN DIFFERENTIATION FROM PREVIOUS SLIDES

### vs. P1: Asymmetric Cards
- **P1:** Scattered cards with asymmetric positioning
- **This slide:** Single large structured container (ONE glass card, not multiple)
- **Benefit:** Organized, scannable, hierarchical

### vs. P2: Center Image + Labels
- **P2:** Image-centric with surrounding labels
- **This slide:** Text-based comparison table (no images)
- **Benefit:** Information-focused, data-driven approach

### vs. P3: Pyramid Grid
- **P3:** Triangular hierarchy (visual pyramid)
- **This slide:** Rectangular grid (structured matrix)
- **Benefit:** Equal visual weight for personas, not hierarchical

---

## IMPLEMENTATION CHECKLIST

### Geometry
- [ ] Glass card: 9.2" W × 4.825" H @ (0.4", 0.4")
- [ ] Internal margins: 0.4" left, 0.35" top
- [ ] Column widths: 1.75" + 2.45" + 2.45" + 2.45" = 8.4"
- [ ] Row heights: 0.65" + 1.0" + 1.0" + 0.85" = 3.5"
- [ ] Cell borders: 1pt Light Gray, 85% transparent
- [ ] Grid gutter: 0.02" between cells

### Transparency & Fill
- [ ] Glass card: White, 12% transparency (88% opaque)
- [ ] Card border: Sky Blue, 70% opacity (optional)
- [ ] Header cells: Persona color, 20% opacity (80% opaque)
- [ ] Content cells: Transparent (white shows through)
- [ ] Grid borders: Light Gray, 85% transparency

### Shadows
- [ ] Card shadow: Blur 40pt, offset 0/8, opacity 8%
- [ ] No shadows on text or cells

### Typography
- [ ] Title: 18pt Calibri Bold, Dark Gray
- [ ] Headers: 11pt Calibri Bold, White on color
- [ ] Row labels: 10pt Calibri Bold, Dark Gray
- [ ] Cell content: 9pt Calibri Regular, Medium Gray
- [ ] Checkmarks: Persona color
- [ ] Line height: 13pt (compact)

### Colors
- [ ] Need Seeker: #2563EB (Blue)
- [ ] Helper: #10B981 (Green)
- [ ] Anchor Admin: #8B5CF6 (Purple)
- [ ] Text Primary: #1F2937 (Dark Gray)
- [ ] Text Secondary: #4B5563 (Medium Gray)
- [ ] Borders: #9CA3AF (Light Gray)

### Visual Check
- [ ] All text readable at 9-18pt on white/colored backgrounds
- [ ] Table appears well-organized, not cramped
- [ ] Persona colors clearly differentiate columns
- [ ] Checkmarks in "Our Value" row stand out with color
- [ ] Glass effect visible (blue/cyan background shows through)
- [ ] Grid borders subtle but visible
- [ ] No elements touch canvas edges (except background)

---

## COMPARISON TABLE BENEFITS

### Why This Approach?
1. **Scannable:** Rows and columns create natural reading paths
2. **Structured:** Clear organization suggests rigor and planning
3. **Comparative:** Side-by-side format makes personas easy to compare
4. **Dense:** Fits all content without visual chaos
5. **Professional:** Data-table aesthetic suggests expertise
6. **Differentiated:** Unique from previous card/pyramid layouts

### Information Hierarchy
- **Rows:** Categories (Who → Goal → Value)
- **Columns:** Personas (Need Seeker → Helper → Anchor Admin)
- **Reader Flow:** Title → Headers → Rows → Values

---

## PREMIUM AESTHETIC (Glass Container)

1. **Layered Translucency:** Background ellipses visible through white card
2. **Soft Blur:** 40pt shadow blur creates floating effect
3. **Subtle Borders:** Grid lines barely visible (85% transparent)
4. **Color Blending:** Persona colors blend softly (20% opacity headers)
5. **Whitespace:** 0.35-0.4" margins prevent cramping
6. **Precision:** 0.02" gutters, grid-aligned layout
7. **Typography:** Clean sans-serif (Calibri) throughout
8. **Consistency:** Matches cover slide aesthetic (same glass treatment)

---

## EXPORT & PRESENTATION

### File Output
- **Filename:** WeaveNYC_Personas_Slide.pptx
- **Format:** PowerPoint (.pptx)
- **Resolution:** 300 DPI recommended
- **Color Model:** RGB (not CMYK)

### Presentation Tips
- **Transition:** Fade in (0.3s) — lets audience appreciate table
- **Display Time:** 15-20 seconds to scan (longer than cover slide)
- **Font Rendering:** Calibri and Georgia embed automatically
- **Printing:** Ensure glass transparency is preserved (not flattened)

---

## TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| Grid borders invisible | Increase border opacity (85% → 70% transparency) |
| Headers too dark | Increase header background opacity (20% → 25%) |
| Text hard to read | Increase font size (9pt → 10pt) or use darker gray |
| Column widths uneven | Recalculate: Verify all 4 widths sum to 8.4" |
| Glass effect faint | Reduce white veil transparency (92% → 85%) |
| Shadow too harsh | Reduce blur radius (40pt → 35pt) or opacity (8% → 5%) |
| Chinese characters (future): Font fallback | Set fontFace to 'SimSun' or system CJK font |

---

## DESIGN RATIONALE

### Why a Comparison Table?
- **Previous slides used visual/card metaphors** (asymmetric, pyramid)
- **This slide uses structural/data metaphor** (grid, matrix)
- **Result:** Four distinct presentation approaches across the deck
- **Benefit:** Visual variety prevents monotony
- **Message:** Personas are structured, well-researched, data-driven

### Color Psychology (Personas)
- **Blue (Need Seeker):** Calm, trust, stability (they're vulnerable, need comfort)
- **Green (Helper):** Growth, health, helping (positive action)
- **Purple (Anchor Admin):** Authority, leadership, vision (organizational control)

### Checkmarks in "Our Value"
- **Visual Affordance:** Immediately reads as "benefits" or "guarantees"
- **Colored Text:** Persona color creates connection (blue checkmarks for Need Seeker, etc.)
- **Impact:** Strong visual call-out vs. plain text

---

## FINAL DESIGN STATEMENT

> This slide brings **structure and clarity** to persona differentiation through a clean, scannable comparison table housed in a premium glass container. It communicates that WeaveNYC understands its users deeply and has designed specific value propositions for each persona type. The tabular format suggests rigor, research, and intentional design—exactly the message a privacy-first platform should send.

---

**Design Document Complete**
**Ready for PptxGenJS Implementation**
**March 5, 2026**
