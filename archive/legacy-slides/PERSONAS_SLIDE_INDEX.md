# WeaveNYC: Three Personas Slide - Complete Documentation Index

**Date:** March 5, 2026
**Status:** Complete & Ready for Use
**Slide Version:** 1.0

---

## Quick Start

1. **Use the slide:** Open `personas_slide_new.pptx` in PowerPoint, Google Slides, or LibreOffice
2. **View quick reference:** See `PERSONAS_SLIDE_QUICK_REFERENCE.txt` for colors and positions
3. **Understand the design:** Read `PERSONAS_SLIDE_DESIGN_SPEC.md` for complete specifications

---

## Documentation Files

### Primary Deliverable

**`personas_slide_new.pptx`** (67 KB)
- The generated presentation slide file
- Ready to use in PowerPoint, Google Slides, LibreOffice Impress
- Slide 1 contains the "Target Users: Three Personas" design
- All formatting, colors, and typography are finalized

### Reference Documents

#### 1. `PERSONAS_SLIDE_QUICK_REFERENCE.txt`
**Best for:** Quick lookups, copying hex codes, finding exact measurements

**Contents:**
- Color palette with hex codes and RGB values
- Typography at a glance
- Layout zones (Y-axis positions)
- Card positioning (X-axis positions)
- Copy-paste friendly measurements
- Persona accent colors visualization
- All key measurements in one place

**Use when:** You need a specific color code, font size, or position quickly

---

#### 2. `PERSONAS_SLIDE_DESIGN_SPEC.md`
**Best for:** Comprehensive design understanding, implementation details

**Contents:**
- Complete slide specifications (canvas, zones, elements)
- Detailed positioning for every element
- Full color palette with purpose breakdown
- Typography system matrix
- Design principles and rationale
- Persona content details
- Implementation notes for PptxGenJS
- Code structure and build instructions
- Testing checklist
- Differences from previous slides
- Appendix with quick reference

**Use when:** You need to understand the full design, make modifications, or explain to stakeholders

---

#### 3. `PERSONAS_SLIDE_MEASUREMENTS.txt`
**Best for:** Precise measurements, layout debugging, exact positioning

**Contents:**
- Detailed ASCII layout grid with visual representation
- Canvas dimensions and background colors
- Layout grid with Y-positions and heights
- Title element specifications
- Flow strip detailed breakdown
- Card grid layout with all three card positions
- Individual card structure (glass effect, accent bar, content rows)
- Footer element specifications
- Complete typography matrix with all fonts
- Transparency specifications
- Shape count summary
- File specifications and compatibility
- Design rationale explanation

**Use when:** You need to modify positioning, debug layout issues, or verify exact measurements

---

#### 4. `PERSONAS_SLIDE_IMPLEMENTATION_SUMMARY.md`
**Best for:** Implementation overview, status tracking, integration planning

**Contents:**
- Project status (Complete ✓)
- Deliverables list with file details
- Slide specifications at a glance
- Design concept explanation (flow strip, cards, glass effect)
- Detailed persona content
- Layout measurements summary
- Color palette by function
- Typography system
- Key design features unique to this slide
- Code implementation details
- Verification checklist (all items checked)
- Differences from previous slides
- Usage instructions for opening/editing/integrating
- Technical notes (transparency, shape rendering, font substitution)
- File manifest
- Quality assurance summary

**Use when:** You need an executive overview, status update, or integration guidelines

---

#### 5. `personas_slide.js`
**Best for:** Source code, customization, regeneration

**Contents:**
- PptxGenJS source code for complete slide generation
- Modular design with clear sections
- All constants and positioning parameters
- Shape creation (rounded rectangles, solids)
- Text element creation with precise positioning
- Color definitions inline with usage
- Export/save functionality

**Use when:** You need to customize the slide, regenerate with changes, or understand the implementation

---

## File Structure at a Glance

```
personas_slide/
├── personas_slide_new.pptx              [DELIVERABLE - 67 KB PPTX file]
├── personas_slide.js                    [SOURCE CODE - PptxGenJS]
├── PERSONAS_SLIDE_QUICK_REFERENCE.txt   [QUICK LOOKUP]
├── PERSONAS_SLIDE_DESIGN_SPEC.md        [COMPREHENSIVE SPEC]
├── PERSONAS_SLIDE_MEASUREMENTS.txt      [DETAILED LAYOUT]
├── PERSONAS_SLIDE_IMPLEMENTATION_SUMMARY.md  [STATUS & OVERVIEW]
└── PERSONAS_SLIDE_INDEX.md              [THIS FILE]
```

---

## Design Summary

### Layout Concept
Three equal-width glass-style cards with a visual flow connector showing how the three personas relate to each other within the WeaveNYC ecosystem.

### Visual Elements
- **Title:** "Target Users: Three Personas" (36pt Georgia Bold)
- **Flow Strip:** Horizontal glass bar showing "Seeker → requests help → Helper → governed by → Anchor Admin"
- **Three Cards:** Each 2.8" × 3.0", portrait orientation
  - Colored accent bar at top (0.15" thick)
  - Persona name (16pt Georgia Bold)
  - Three content rows: Who / Goal / Value
- **Footer:** Copyright and slide number

### Colors
- **Background:** #F8F9FA (light off-white)
- **Persona Accents:**
  - Seeker: #3A7BD5 (blue)
  - Helper: #3CB371 (green)
  - Admin: #7C5CFC (purple)
- **Text:** Dark slate blue headings (#2A3F5F), muted slate labels (#7A8FA3), medium slate body (#3A4A5A)

### Typography
- Georgia 36pt Bold (title)
- Calibri 13pt Italic (flow text)
- Georgia 16pt Bold (persona names)
- Calibri 10pt Bold (row labels)
- Calibri 9pt Regular (body text)

### Glass Effect
- Cards: 5% transparency (#FFFFFF fill)
- Flow strip: 15% transparency (#FFFFFF fill)
- Creates modern aesthetic over light background

---

## How to Use Each Document

### Scenario 1: "I need to use the slide right now"
→ Open `personas_slide_new.pptx`

### Scenario 2: "I need to know what color #3CB371 is"
→ Check `PERSONAS_SLIDE_QUICK_REFERENCE.txt` (has all hex codes)

### Scenario 3: "I need to understand the complete design"
→ Read `PERSONAS_SLIDE_DESIGN_SPEC.md` (comprehensive reference)

### Scenario 4: "I need exact measurements for the cards"
→ Check `PERSONAS_SLIDE_MEASUREMENTS.txt` (detailed grid and positions)

### Scenario 5: "I need to modify the slide"
→ Edit `personas_slide.js` and run: `node personas_slide.js`

### Scenario 6: "I need to present this to stakeholders"
→ Reference `PERSONAS_SLIDE_IMPLEMENTATION_SUMMARY.md` (executive overview)

### Scenario 7: "I need to verify everything is correct"
→ Review the verification checklist in `PERSONAS_SLIDE_IMPLEMENTATION_SUMMARY.md`

---

## Key Specifications Reference

| Metric | Value |
|--------|-------|
| **Dimensions** | 10" × 5.625" (16:9 widescreen) |
| **Cards** | 3 equal-width cards (2.8" W × 3.0" H each) |
| **Accent Bar Height** | 0.15" |
| **Background Color** | #F8F9FA |
| **Glass Transparency** | Cards: 5%, Strip: 15% |
| **Font Stack** | Georgia (headers), Calibri (body) |
| **Total Shapes** | 32 (7 geometric + 25 text) |
| **File Size** | 67 KB (compressed PPTX) |
| **Format** | Office Open XML (PPTX) |
| **Compatibility** | PowerPoint 2010+, Google Slides, LibreOffice |

---

## Design Differences from Previous Slides

### vs. P1 (Asymmetric Left/Right)
- **Previous:** Large overlapping shapes on left/right with text overlay
- **New:** Three equal-width cards in centered layout
- **Improvement:** Fair visual hierarchy, no asymmetry

### vs. P2 (Center Image + Radial Labels)
- **Previous:** Focal image in center with radiating text elements
- **New:** Linear flow strip + three parallel cards
- **Improvement:** Better for comparing personas side-by-side

### vs. P3 (3+2 Grid)
- **Previous:** Unequal grid (3 items top row, 2 items bottom row)
- **New:** Single row of 3 equal-width cards
- **Improvement:** Visual unity, equal emphasis on each persona

---

## Integration Instructions

### Option A: Use as Standalone Slide
1. Open `personas_slide_new.pptx` in PowerPoint
2. Present as-is or duplicate into your deck

### Option B: Insert into Existing Deck
```python
from pptx import Presentation

# Load existing presentation
prs_main = Presentation('WeaveNYC_Midterm_Proposal.pptx')

# Load new personas slide
prs_new = Presentation('personas_slide_new.pptx')

# Insert at desired position (e.g., position 4)
# Note: python-pptx doesn't directly support slide copying,
# so you may need to manually copy/paste or use other tools
```

### Option C: Convert to PDF
- Open `personas_slide_new.pptx` in PowerPoint/Google Slides
- Export as PDF
- Share for viewing/printing

---

## Customization Guide

### To Change Persona Colors
1. Edit `personas_slide.js`, find the `PERSONAS` array
2. Change `accentColor` values (e.g., `#3A7BD5` to `#FF0000`)
3. Save file
4. Run: `node personas_slide.js`

### To Change Text Content
1. Edit `personas_slide.js`, find the `PERSONAS` array
2. Update `who`, `goal`, `value` text
3. Save file
4. Run: `node personas_slide.js`

### To Change Layout Positions
1. Edit the positioning constants at top of `personas_slide.js`
2. Examples: `TITLE_Y`, `CARD_WIDTH`, `CARD_X_POSITIONS`
3. Save file
4. Run: `node personas_slide.js`

### To Change Typography
1. Edit font, size, color in relevant `addText()` calls in `personas_slide.js`
2. Save file
3. Run: `node personas_slide.js`

---

## Troubleshooting

### Issue: File doesn't open in PowerPoint
**Solution:** Ensure PowerPoint 2010 or newer. Try opening in Google Slides or LibreOffice as alternative.

### Issue: Glass transparency looks wrong
**Solution:** PowerPoint may not render transparency identically on all systems. Check on different displays. PDF export may show different results than screen.

### Issue: Fonts look different
**Solution:** Ensure Georgia and Calibri are installed. If missing, PowerPoint will substitute with fallbacks (Times New Roman, Arial).

### Issue: Colors don't match
**Solution:** Verify color settings in application (some systems have color management enabled). Check on different monitors—colors may appear different depending on display calibration.

### Issue: Can't regenerate the slide
**Solution:** Ensure Node.js and PptxGenJS are installed:
```bash
npm install pptxgenjs
node personas_slide.js
```

---

## Version Control

**Current Version:** 1.0 (2026-03-05)

### Change Log
- **v1.0:** Initial release
  - Three equal-width cards with glass effect
  - Visual flow connector showing persona relationships
  - Color-coded accent bars (blue/green/purple)
  - Structured content rows (Who/Goal/Value)
  - Complete documentation suite

### Future Enhancements
- Alternative color schemes (dark mode)
- Animated flow connector (for digital presentations)
- Data-driven personas (pull from external source)
- Variant layouts (2-column, single column)

---

## Contact & Support

For questions about:
- **Design decisions:** See `PERSONAS_SLIDE_DESIGN_SPEC.md`
- **Exact measurements:** See `PERSONAS_SLIDE_MEASUREMENTS.txt`
- **Color codes:** See `PERSONAS_SLIDE_QUICK_REFERENCE.txt`
- **Implementation:** See `personas_slide.js` comments or `PERSONAS_SLIDE_DESIGN_SPEC.md` → Implementation section

---

## Quick Reference Commands

### Generate the slide
```bash
cd /sessions/focused-clever-feynman/mnt/weavenyc-docs-v1
node personas_slide.js
```

### View quick color reference
```bash
cat PERSONAS_SLIDE_QUICK_REFERENCE.txt | head -50
```

### See complete measurements
```bash
less PERSONAS_SLIDE_MEASUREMENTS.txt
```

### Read full specification
```bash
less PERSONAS_SLIDE_DESIGN_SPEC.md
```

---

## Document Navigation

```
START HERE
    ↓
Are you looking for...?
    ├─ The actual slide file? → personas_slide_new.pptx
    ├─ Quick color/position lookup? → PERSONAS_SLIDE_QUICK_REFERENCE.txt
    ├─ Complete design details? → PERSONAS_SLIDE_DESIGN_SPEC.md
    ├─ Exact measurements? → PERSONAS_SLIDE_MEASUREMENTS.txt
    ├─ Status/overview? → PERSONAS_SLIDE_IMPLEMENTATION_SUMMARY.md
    ├─ Source code? → personas_slide.js
    └─ This document? → PERSONAS_SLIDE_INDEX.md
```

---

## Checklist for Integration

- [ ] Review slide at `personas_slide_new.pptx`
- [ ] Verify all three personas display correctly
- [ ] Check colors match design (blue/green/purple accent bars)
- [ ] Confirm glass effect is visible
- [ ] Test in intended presentation software
- [ ] Check print preview if printing needed
- [ ] Integrate into main deck if applicable
- [ ] Share with stakeholders for feedback
- [ ] Archive documentation for future reference

---

**All files located at:**
`/sessions/focused-clever-feynman/mnt/weavenyc-docs-v1/`

**Total Documentation:** ~4,000 lines across 6 files
**Status:** Complete, verified, and ready for use
