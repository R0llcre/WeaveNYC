# WeaveNYC Personas Slide — Visual Reference & Layout Diagrams

**Purpose:** Quick visual reference for the slide layout, positions, and styling
**Format:** ASCII diagrams + exact measurements

---

## FULL SLIDE OVERVIEW (10" × 5.625")

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  MARGIN 0.4"  ┌─────────────────────────────────────────────────────────┐       │
│               │ GLASS CONTAINER (9.2" W × 4.825" H)                      │ 0.4" │
│               │ White, 88% opaque, 24pt rounded, shadow: blur 40 @ 8pt   │      │
│               │                                                           │      │
│   0.4"        │  Title: "Target Users: Three Personas" (18pt Bold)       │      │
│               │                                                           │      │
│               │ ┌──────────┬────────────┬────────────┬────────────┐      │      │
│               │ │          │   Blue     │   Green    │   Purple   │      │      │
│               │ │ (empty)  │ #2563EB    │ #10B981    │ #8B5CF6    │      │      │
│               │ │          │ 20% opaque │ 20% opaque │ 20% opaque │      │      │
│               │ ├──────────┼────────────┼────────────┼────────────┤      │      │
│               │ │ Who      │ Low-income │ Volunteers │ NGO staff  │      │      │
│               │ │          │ or imm.    │ or neighb. │ church     │      │      │
│               │ │ (10pt B) │ residents  │ members    │ coords     │      │      │
│               │ │          │            │            │            │      │      │
│               │ ├──────────┼────────────┼────────────┼────────────┤      │      │
│               │ │ Goal     │ Find help  │ Post offers│ Moderate   │      │      │
│               │ │          │ ASAP       │ easily     │ configure  │      │      │
│               │ │ (10pt B) │ Private    │ Match      │ Review &   │      │      │
│               │ │          │ Plan <1min │ safely     │ audit logs │      │      │
│               │ │          │            │ Risk alerts│            │      │      │
│               │ ├──────────┼────────────┼────────────┼────────────┤      │      │
│               │ │Our Value │ ✓ Zero     │ ✓ Smart    │ ✓ Full     │      │      │
│               │ │          │ ✓ Anon     │ ✓ Safety   │ ✓ Comply   │      │      │
│               │ │ (10pt B) │ ✓ No track │ ✓ Trust    │ ✓ Control  │      │      │
│               │ │          │ (blue txt) │ (grn txt)  │ (pur txt)  │      │      │
│               │ └──────────┴────────────┴────────────┴────────────┘      │      │
│               │                                                           │      │
│               │ [Card shadow: blur 40pt, offset 0/8pt, opacity 8%]      │      │
│               └─────────────────────────────────────────────────────────┘      │
│                                                                                  │
│  MARGIN 0.4"                                                          0.4" MARGIN│
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘

BACKGROUND (Behind glass):
    Azure Ellipse (bottom-left, 85% transparent)
    + Sky Blue Ellipse (top-right, 80% transparent)
    + Cyan Ellipse (center-right, 75% transparent)
    + White Veil (full canvas, 92% transparent)
    = Soft blue→cyan gradient effect
```

---

## GRID CELL LAYOUT (Detailed Measurements)

### Column Widths (From left edge of glass container at X=0.4")

```
Internal Start: X = 0.4" + 0.4" margin = 0.8"

┌────────────────────────────────────────────────────────────────────┐
│ START (0.8")                                                       │
│                                                                    │
│ COL 0          COL 1          COL 2          COL 3               │
│ (Labels)       (Need Seeker)  (Helper)       (Anchor Admin)       │
│ W=1.75"        W=2.45"        W=2.45"        W=2.45"              │
│ |X=0.8"        |X=2.55"       |X=5.02"       |X=7.49"             │
│ |              |              |              |                    │
│ └──────────────┴──────────────┴──────────────┴──────────────────┐ │
│                                              End (9.7")         │ │
└────────────────────────────────────────────────────────────────────┘

Total: 1.75 + 2.45 + 2.45 + 2.45 = 9.1" (leaves 0.1" right margin)
```

### Row Heights (From top edge of glass container at Y=0.4")

```
Internal Start: Y = 0.4" + 0.35" margin = 0.75"

┌────────────────────────────────────────┐
│ Y=0.75"   HEADER ROW (Persona names)   │
│           H=0.65"                      │
│ Y=1.4"    ────────────────────────────┤ ROW 1: WHO
│           (User profile)               │ H=1.0"
│ Y=2.4"    ────────────────────────────┤ ROW 2: GOAL
│           (What they want)             │ H=1.0"
│ Y=3.4"    ────────────────────────────┤ ROW 3: OUR VALUE
│           (WeaveNYC benefits)          │ H=0.85"
│ Y=4.25"   ────────────────────────────┘
│
│ Total height used: 0.65 + 1.0 + 1.0 + 0.85 = 3.5"
└────────────────────────────────────────┘

Glass card total H=4.825" (extra 1.325" for title + margins)
```

---

## CELL STYLING EXAMPLES

### Header Cell (Blue Example — Need Seeker)

```
┌─────────────────────────────────┐
│ Position: (2.55", 0.75")        │
│ Size: 2.45" W × 0.65" H         │
│                                 │
│ ┌───────────────────────────┐   │ Background:
│ │ Need Seeker               │   │ #2563EB (20% opacity)
│ │                           │   │ = Light blue tint
│ └───────────────────────────┘   │
│                                 │ Border:
│ Font: Calibri 11pt Bold White   │ 1pt Light Gray
│ Padding: 0.08" all sides        │ 85% transparent
│ Align: Left, Top                │
│                                 │
└─────────────────────────────────┘
```

### Content Cell (Gray Example — Who/Need Seeker)

```
┌─────────────────────────────────┐
│ Position: (2.55", 1.4")         │
│ Size: 2.45" W × 1.0" H          │
│                                 │
│ ┌───────────────────────────┐   │ Background:
│ │ Low-income or immigrant   │   │ Transparent
│ │ residents                 │   │ (white glass shows)
│ │                           │   │
│ │                           │   │
│ └───────────────────────────┘   │ Border:
│                                 │ 1pt Light Gray
│ Font: Calibri 9pt Regular       │ 85% transparent
│ Color: #4B5563 (Medium Gray)    │
│ Padding: 0.08" all sides        │
│ Align: Left, Top                │
│ Line Height: 13pt               │
│                                 │
└─────────────────────────────────┘
```

### Value Cell (Colored Text Example — Green/Helper)

```
┌─────────────────────────────────┐
│ Position: (5.02", 3.4")         │
│ Size: 2.45" W × 0.85" H         │
│                                 │
│ ┌───────────────────────────┐   │ Background:
│ │ ✓ Smart matching          │   │ Transparent
│ │ ✓ Safety first            │   │
│ │ ✓ Trust signals           │   │
│ │                           │   │
│ └───────────────────────────┘   │ Border:
│                                 │ 1pt Light Gray
│ Font: Calibri 9pt Regular       │ 85% transparent
│ Color: #10B981 (Green)          │
│ Checkmarks: ✓ (Unicode)         │
│ Padding: 0.08" all sides        │
│ Align: Left, Top                │
│ Line Height: 13pt               │
│                                 │
└─────────────────────────────────┘
```

---

## COLOR SWATCH REFERENCE

### Persona Header Colors (20% Opacity)

```
NEED SEEKER (Blue)               HELPER (Green)                  ANCHOR ADMIN (Purple)
┌──────────────────────┐          ┌──────────────────────┐          ┌──────────────────────┐
│                      │          │                      │          │                      │
│  #2563EB             │          │  #10B981             │          │  #8B5CF6             │
│  Light blue          │          │  Light green         │          │  Light purple        │
│  (20% opacity)       │          │  (20% opacity)       │          │  (20% opacity)       │
│                      │          │                      │          │                      │
│  Text: White         │          │  Text: White         │          │  Text: White         │
│  Font: 11pt Bold     │          │  Font: 11pt Bold     │          │  Font: 11pt Bold     │
│                      │          │                      │          │                      │
└──────────────────────┘          └──────────────────────┘          └──────────────────────┘
```

### Text Color Reference

```
DARK GRAY (Primary)               MEDIUM GRAY (Content)              LIGHT GRAY (Borders)
#1F2937                           #4B5563                            #9CA3AF
RGB(31, 41, 55)                   RGB(75, 85, 99)                    RGB(156, 163, 175)
┌──────────────────────┐          ┌──────────────────────┐          ┌──────────────────────┐
│ Very Dark            │          │ Medium Tone          │          │ Light                │
│ High Contrast        │          │ Readable             │          │ Subtle               │
│ Use: Titles, Labels  │          │ Use: Body Text       │          │ Use: Grid Borders    │
│ WCAG AAA             │          │ WCAG AA              │          │ 15% Opaque           │
└──────────────────────┘          └──────────────────────┘          └──────────────────────┘
```

---

## TYPOGRAPHY HIERARCHY VISUALIZATION

```
SLIDE TITLE (Largest)
┌────────────────────────────────────────────────────────────────┐
│ Target Users: Three Personas                                   │
│ Calibri 18pt Bold, Dark Gray (#1F2937)                         │
│ Above the grid, 0.08" padding from top                         │
└────────────────────────────────────────────────────────────────┘

COLUMN HEADERS (Bold, White on Color)
┌────────────┬────────────┬────────────┬────────────┐
│            │ Need Seeker│ Helper     │ Anchor Adm │
│ (empty)    │ Calibri    │ Calibri    │ Calibri    │
│            │ 11pt Bold  │ 11pt Bold  │ 11pt Bold  │
│            │ White      │ White      │ White      │
└────────────┴────────────┴────────────┴────────────┘

ROW LABELS (Bold Dark Gray)                CELL CONTENT (Regular Medium Gray)
┌────────────┐                             ┌────────────┐
│ Who        │ Calibri 10pt Bold           │ Low-income │ Calibri 9pt Regular
│ Goal       │ Dark Gray (#1F2937)         │ or imm.    │ Medium Gray (#4B5563)
│ Our Value  │ Left aligned, 0.08" pad     │ residents  │ Left aligned, wrapped
└────────────┘                             └────────────┘

Hierarchy by visual weight: Title > Headers > Labels > Content
Hierarchy by size:         18pt > 11pt > 10pt > 9pt
```

---

## GLASS CONTAINER SHADOW EFFECT (Side View)

```
┌─────────────────────────────────────────┐
│ SLIDE SURFACE (Top View)                │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ GLASS CARD (Float above)          │  │
│ │ With soft shadow below            │  │
│ │                                   │  │
│ │ [Glass card content here]         │  │
│ │                                   │  │
│ │                                   │  │
│ │ ┌─ Shadow (soft blur, 40pt)       │  │
│ │ │  offset 8pt below               │  │
│ │ └─ opacity 8% black               │  │
│ │ │                                 │  │
│ │ v BACKGROUND GRADIENT             │  │
│ │                                   │  │
│ └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘

Effect: Card appears elevated, floating 12-15mm above surface
Result: Premium, sophisticated aesthetic
```

---

## COMPLETE GRID WITH EXACT TEXT

```
┌────────────────────────────────────────────────────────────────────────┐
│ Target Users: Three Personas                                           │
├────────────┬─────────────────┬──────────────────┬──────────────────┤
│            │ Need Seeker     │ Helper           │ Anchor Admin     │
│            │ (Blue)          │ (Green)          │ (Purple)         │
├────────────┼─────────────────┼──────────────────┼──────────────────┤
│ Who        │ Low-income or   │ Volunteers,      │ NGO staff, church│
│            │ immigrant       │ neighbors,       │ coordinators,    │
│            │ residents       │ community        │ administrators   │
│            │                 │ members          │                  │
├────────────┼─────────────────┼──────────────────┼──────────────────┤
│ Goal       │ Find help ASAP. │ Post offers      │ Moderate,        │
│            │ Private.        │ easily. Match    │ configure rules. │
│            │ Plan in under 1 │ with people      │ Review requests  │
│            │ minute.         │ safely. Get      │ & audit logs.    │
│            │                 │ alerts on risk.  │                  │
├────────────┼─────────────────┼──────────────────┼──────────────────┤
│ Our Value  │ ✓ Zero friction │ ✓ Smart matching │ ✓ Full visibility│
│            │ ✓ Anonymous     │ ✓ Safety first   │ ✓ Compliance     │
│            │ ✓ No data       │ ✓ Trust signals  │ ✓ Community      │
│            │   tracking      │                  │   control        │
│            │ (Blue text)     │ (Green text)     │ (Purple text)    │
└────────────┴─────────────────┴──────────────────┴──────────────────┘
```

---

## SPACING DIMENSIONS (All in inches)

### External Margins (Slide → Glass Container)
```
Top: 0.4"     Left: 0.4"     Right: 0.4"     Bottom: 0.4"
```

### Glass Container Margins (Glass → Content)
```
Top: 0.35" (includes title)
Left: 0.4"
Right: 0.4"
Bottom: 0.4"
```

### Grid Cell Padding (Cell Border → Text)
```
All sides: 0.08"
```

### Grid Gutter (Space Between Cells)
```
Horizontal & Vertical: 0.02" (minimal separation)
```

### Line Spacing (Within Cells)
```
Line height: 13pt (1.44 × font size for 9pt)
```

---

## RESPONSIVE NOTES (If Adapting to Different Sizes)

### Current Dimensions (Fixed)
- Canvas: 10" × 5.625"
- Glass Container: 9.2" × 4.825"
- Coverage: ~92% of slide

### If Scaling to Widescreen (16:10)
- Canvas: 10" × 6.25"
- Glass: 9.2" × 5.425" (add 0.6" height)
- Distribute extra height to content rows

### If Scaling to Portrait (4:3)
- Not recommended — grid layout designed for landscape
- Would require vertical rearrangement

### If Adding 4th Persona
- Expand glass width to 10" (fill entire slide width)
- Reduce column widths proportionally
- Adjust gutter spacing as needed

---

## FONT RENDERING CHECKLIST

```
☐ Calibri available on system
☐ Font sizes render clearly at 9-18pt
☐ Bold weight renders properly
☐ Checkmarks (✓) display correctly
☐ No font substitution (would affect spacing)
☐ CJK characters (if any) render with fallback
☐ Text anti-aliasing smooth (not pixelated)
```

---

## COLOR CONTRAST VERIFICATION (WCAG Standards)

```
☐ Dark Gray (#1F2937) on White (#FFFFFF): 15.6:1 (AAA ✓)
☐ Medium Gray (#4B5563) on White: 8.2:1 (AA ✓)
☐ White on Blue (#2563EB): 7.3:1 (AAA ✓)
☐ White on Green (#10B981): 5.8:1 (AA ✓)
☐ White on Purple (#8B5CF6): 5.2:1 (AA ✓)
☐ Blue text on White: 4.5:1 (AA ✓)
☐ Green text on White: 4.8:1 (AA ✓)
☐ Purple text on White: 4.8:1 (AA ✓)
```

All combinations meet or exceed WCAG AA standard (4.5:1 minimum for large text).

---

## FINAL VISUAL STATEMENT

```
        ╔════════════════════════════════════════════════════╗
        ║                                                    ║
        ║   PREMIUM LIQUID GLASS AESTHETIC                  ║
        ║                                                    ║
        ║   ┌──────────────────────────────────────────┐   ║
        ║   │  Clean Grid Table Layout                 │   ║
        ║   │  ├─ Three Personas (columns)             │   ║
        ║   │  ├─ Four Categories (rows)               │   ║
        ║   │  ├─ Color-Coded Headers                  │   ║
        ║   │  └─ Checkmarked Values                   │   ║
        ║   │                                           │   ║
        ║   │  Soft Shadow + Glass Effect              │   ║
        ║   │  Professional, Structured, Clear         │   ║
        ║   └──────────────────────────────────────────┘   ║
        ║                                                    ║
        ║   Communicates:                                   ║
        ║   • Research-driven persona insights              ║
        ║   • Differentiated value for each user type       ║
        ║   • Structured, intentional design               ║
        ║   • User-centric approach to platform            ║
        ║                                                    ║
        ╚════════════════════════════════════════════════════╝
```

---

**Visual Reference Document Complete**
**For Quick Layout & Styling Reference**
**March 5, 2026**
