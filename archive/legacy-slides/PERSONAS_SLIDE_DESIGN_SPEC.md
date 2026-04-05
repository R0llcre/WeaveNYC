# WeaveNYC: Target Users - Three Personas Slide
## Design Specification (PptxGenJS)

### Overview
A fresh "Three Personas" slide design featuring **three equal-width glass-style cards** with a **visual flow connector strip** at the top. The layout differs significantly from previous iterations (asymmetric left/right, center image + radial, 3+2 grid) by presenting personas as equal, comparable units with transparent glass aesthetics and a unifying relationship visualization.

---

## Slide Specifications

### Canvas
- **Dimensions:** 10" × 5.625" (widescreen 16:9)
- **Background:** Light (#F8F9FA) — soft off-white for glass effect prominence
- **Tool:** PptxGenJS (Node.js library)

---

## Layout Zones

| Zone | Y Position | Height | Purpose |
|------|-----------|--------|---------|
| Title | 0.35" | 0.55" | Main heading "Target Users: Three Personas" |
| Flow Strip | 1.05" | 0.48" | Visual connector showing relationship/flow |
| Cards | 1.70" | 3.00" | Three persona cards (bottom at 4.70") |
| Footer | 5.35" | 0.22" | "WeaveNYC · Midterm Proposal" + slide number |

---

## Element Details

### 1. TITLE
**Text:** "Target Users: Three Personas"
- **Position:** X=0.5", Y=0.35", W=9", H=0.55"
- **Font:** Georgia, 36pt, Bold
- **Color:** #2A3F5F (dark slate)
- **Alignment:** Left, Top

---

### 2. FLOW STRIP (Glass Effect Container)
**Purpose:** Shows how the three personas relate to each other

#### Background Shape
- **Type:** Rounded rectangle (radius 0.08")
- **Position:** X=0.5", Y=1.05", W=9", H=0.48"
- **Fill:** #FFFFFF with 15% transparency (glass effect)
- **Border:** 1pt solid #E0E0E0
- **Layer:** Behind text

#### Flow Text
- **Text:** "Seeker → requests help → Helper → governed by → Anchor Admin"
- **Position:** X=0.5", Y=1.11", W=9", H=0.36"
- **Font:** Calibri, 13pt, Italic
- **Color:** #5A6C7D (muted blue-gray)
- **Alignment:** Center, Middle
- **Purpose:** Illustrates the system relationships and dependencies

---

### 3. PERSONA CARDS (×3)

#### Card Positioning & Dimensions
| Persona | X Position | Y Position | Width | Height |
|---------|-----------|-----------|-------|--------|
| Need Seeker | 0.8" | 1.70" | 2.8" | 3.0" |
| Helper | 4.4" | 1.70" | 2.8" | 3.0" |
| Anchor Admin | 8.0" | 1.70" | 2.8" | 3.0" |

**Spacing:** 0.8" left margin, 0.8" between cards (equal spacing)

#### Card Structure (All Cards Identical Except Colors)

##### Card Background (Glass Effect)
- **Type:** Rounded rectangle (radius 0.12")
- **Fill:** #FFFFFF with 5% transparency
- **Border:** 1.5pt solid #D8D8E8
- **Shadow:** None (clean glass look)

##### Colored Accent Bar (Top Edge)
- **Type:** Solid rectangle, NO border
- **Position:** Top-left corner of card
- **Dimensions:** Full card width × 0.15" height
- **Colors by Persona:**
  - **Need Seeker:** #3A7BD5 (Blue)
  - **Helper:** #3CB371 (Green)
  - **Anchor Admin:** #7C5CFC (Purple)

##### Persona Name (Title)
- **Position:** X +0.15", Y +0.25" from card origin
- **Dimensions:** (Card Width - 0.30") × 0.35"
- **Font:** Georgia, 16pt, Bold
- **Color:** #2A3F5F
- **Alignment:** Left, Top

##### Three Content Rows (Who / Goal / Value)

Each row follows this pattern:

| Element | Offset Y | Height | Font Size | Color |
|---------|----------|--------|-----------|-------|
| **Label** (Who/Goal/Value) | See below | 0.18" | 10pt Bold | #7A8FA3 |
| **Content Text** | See below | 0.60" | 9pt Regular | #3A4A5A |

**Row 1 - WHO**
- Label Y: +0.68" from card origin
- Content Y: +0.88"
- X Offset: +0.15" (left margin)
- Width: Card Width - 0.30"

**Row 2 - GOAL**
- Label Y: +1.52"
- Content Y: +1.72"
- X Offset: +0.15"
- Width: Card Width - 0.30"

**Row 3 - VALUE**
- Label Y: +2.36"
- Content Y: +2.56"
- X Offset: +0.15"
- Width: Card Width - 0.30"

---

## Persona Content

### Persona 1: Need Seeker
- **Accent Color:** #3A7BD5 (Blue)
- **Who:** Low-income, immigrant, elderly, single parent, temporarily unemployed
- **Goal:** Find food, childcare, translation, transportation help ASAP
- **Value:** Actionable plan in <1 min; anonymous by default; minimal data exposure

### Persona 2: Helper
- **Accent Color:** #3CB371 (Green)
- **Who:** Volunteer, neighbor, student, church/community group member
- **Goal:** Post offers, screen suitable matches, complete delivery safely
- **Value:** Smart matching; risk alerts; witness mechanism builds trust

### Persona 3: Anchor Admin
- **Accent Color:** #7C5CFC (Purple)
- **Who:** NGO staff, church coordinator, pantry operator, mutual aid organizer
- **Goal:** Configure rules, moderate content, post announcements, handle reports
- **Value:** Visual review queue + audit log; community governance toolkit

---

## Footer

### Footer Text (Left)
- **Text:** "WeaveNYC  ·  Midterm Proposal"
- **Position:** X=0.5", Y=5.35", W=5", H=0.22"
- **Font:** Calibri, 9pt
- **Color:** #999999 (light gray)
- **Alignment:** Left

### Slide Number (Right)
- **Text:** "5"
- **Position:** X=9.0", Y=5.35", W=0.5", H=0.22"
- **Font:** Calibri, 9pt
- **Color:** #999999
- **Alignment:** Right

---

## Design Principles

### Glass Aesthetic
1. **Transparency:** Cards at 5% opacity, flow strip at 15% — creates layered glass effect
2. **Subtle Borders:** Light borders (#D8D8E8, #E0E0E0) suggest glass edges
3. **Light Background:** Off-white (#F8F9FA) provides contrast for glass elements

### Comparison & Structure
1. **Equal Columns:** All three personas at identical width (2.8") and height (3.0")
2. **Consistent Sections:** Who / Goal / Value appears in every card for easy scanning
3. **Color-Coded Accents:** Top bar identifies each persona type at a glance

### Visual Flow
1. **Relationship Strip:** Flow text shows how personas interact and depend on each other
2. **Hierarchical Reading:** Title → Flow (system context) → Cards (detailed roles)
3. **Bottom Anchoring:** All cards align at baseline for visual stability

---

## Font Stack

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Title | Georgia | 36pt | Bold | #2A3F5F |
| Flow Text | Calibri | 13pt | Italic | #5A6C7D |
| Persona Name | Georgia | 16pt | Bold | #2A3F5F |
| Row Labels | Calibri | 10pt | Bold | #7A8FA3 |
| Row Content | Calibri | 9pt | Regular | #3A4A5A |
| Footer | Calibri | 9pt | Regular | #999999 |

---

## Color Palette

| Use | Hex | RGB | Name |
|-----|-----|-----|------|
| Primary Background | #F8F9FA | 248, 249, 250 | Off-White |
| Card Background | #FFFFFF | 255, 255, 255 | White |
| Accent 1 (Seeker) | #3A7BD5 | 58, 123, 213 | Blue |
| Accent 2 (Helper) | #3CB371 | 60, 179, 113 | Green |
| Accent 3 (Admin) | #7C5CFC | 124, 92, 252 | Purple |
| Dark Text | #2A3F5F | 42, 63, 95 | Dark Slate |
| Label Text | #7A8FA3 | 122, 143, 163 | Muted Slate |
| Body Text | #3A4A5A | 58, 74, 90 | Medium Slate |
| Flow Text | #5A6C7D | 90, 108, 125 | Slate Blue |
| Borders | #D8D8E8 | 216, 216, 232 | Light Purple |
| | #E0E0E0 | 224, 224, 224 | Light Gray |
| Light Text | #999999 | 153, 153, 153 | Gray |

---

## Key Differences from Previous Slides

| Aspect | Previous (P1/P2/P3) | New Design |
|--------|-------------------|-----------|
| Layout | Asymmetric, radial, 3+2 grid | 3 equal columns |
| Structure | Mixed arrangements | Uniform card structure |
| Relationships | Implicit/scattered | Explicit flow strip |
| Glass Effect | Solid colors | Transparent 5-15% |
| Spacing | Variable | Uniform (0.8" margins) |
| Persona Comparison | Difficult | Effortless side-by-side |

---

## Implementation (PptxGenJS)

**File:** `personas_slide.js`

### Key Functions
1. **defineLayout()** — Sets 10" × 5.625" canvas
2. **addSlide()** — Creates slide with light background
3. **addText()** — Places all typography (title, flow, labels, content)
4. **addShape()** — Draws rounded rectangles for cards and flow strip

### Color Transparency
- PptxGenJS `transparency` parameter: 0-100 scale
  - 5% = `transparency: 5` (cards)
  - 15% = `transparency: 15` (flow strip)

### Export
```bash
node personas_slide.js
→ personas_slide_new.pptx (67 KB)
```

---

## Specifications Summary

| Metric | Value |
|--------|-------|
| Slide Size | 10" × 5.625" |
| Number of Cards | 3 (equal width × height) |
| Card Dimensions | 2.8" W × 3.0" H |
| Accent Bar Height | 0.15" |
| Content Rows Per Card | 3 (Who, Goal, Value) |
| Total Shapes | 33 (background, 3 cards × 11 shapes) |
| Font Families | 2 (Georgia, Calibri) |
| Unique Colors | 12 |
| Transparency Layers | 2 (5%, 15%) |

---

## Testing Checklist

- [ ] Slide renders at 10" × 5.625" in PowerPoint
- [ ] Glass transparency visible on light background
- [ ] All text is readable (no color contrast issues)
- [ ] Three cards align perfectly at baseline
- [ ] Colored accent bars appear at top of each card
- [ ] Flow strip text centers correctly
- [ ] Footer aligns to slide edges
- [ ] File size appropriate (<100 KB)
- [ ] Print preview shows correct transparency
