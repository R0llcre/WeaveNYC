/**
 * WeaveNYC - Target Users: Three Personas Slide
 * PptxGenJS Implementation
 *
 * DESIGN CONCEPT:
 * - Horizontal layout with 3 full-width persona cards stacked vertically
 * - Each card: 9" wide × 1.4" tall (with gaps)
 * - Far-left: Large colored circle with persona initial (0.8" diameter)
 * - Card body: Title + Profile (top row), Task + Value (bottom row)
 * - Modern app-style profile cards, scannable and clean
 *
 * CANVAS: 10" × 5.625" (16:9)
 * BACKGROUND: Light with liquid glass aesthetic (consistent with cover slide)
 */

const PptxGenJS = require('pptxgenjs');

function createTargetUsersPersonasSlide() {
  const prs = new PptxGenJS();

  // ─────────────────────────────────────────────────────────────
  // CANVAS SETUP
  // ─────────────────────────────────────────────────────────────
  prs.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
  const slide = prs.addSlide('LAYOUT_16x9');

  // ─────────────────────────────────────────────────────────────
  // COLOR PALETTE (consistent with cover slide)
  // ─────────────────────────────────────────────────────────────
  const colors = {
    azureDeep: '#2563EB',      // Primary accent (trust, tech)
    skyBlue: '#0EA5E9',        // Secondary (openness)
    cyan: '#06B6D4',           // Tertiary (innovation)
    amber: '#F59E0B',          // Warmth accent
    textPrimary: '#1F2937',    // Dark gray
    textSecondary: '#4B5563',  // Medium gray
    textLight: '#9CA3AF',      // Light gray
    white: '#FFFFFF',          // White base
    black: '#000000',          // Black shadows

    // Persona colors
    needSeekerBlue: '#3B82F6',   // Bright blue for Need Seeker
    helperGreen: '#10B981',       // Fresh green for Helper
    anchorPurple: '#8B5CF6'       // Purple for Anchor Admin
  };

  // ─────────────────────────────────────────────────────────────
  // SECTION 1: BACKGROUND (Light liquid glass aesthetic)
  // ─────────────────────────────────────────────────────────────

  // Base white fill
  slide.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: colors.white },
    line: { type: 'none' }
  });

  // Layer 1: Subtle Azure Glow (Top-Left)
  slide.addShape(prs.ShapeType.ellipse, {
    x: -1.5,
    y: -1,
    w: 6,
    h: 6,
    fill: { color: colors.azureDeep, transparency: 90 }, // 10% opaque
    line: { type: 'none' }
  });

  // Layer 2: Subtle Cyan Glow (Bottom-Right)
  slide.addShape(prs.ShapeType.ellipse, {
    x: 8,
    y: 3.5,
    w: 5,
    h: 5,
    fill: { color: colors.cyan, transparency: 92 }, // 8% opaque
    line: { type: 'none' }
  });

  // ─────────────────────────────────────────────────────────────
  // SECTION 2: SLIDE TITLE
  // ─────────────────────────────────────────────────────────────
  slide.addText('Target Users: Three Personas', {
    x: 0.5,
    y: 0.25,
    w: 9,
    h: 0.35,
    fontSize: 28,
    fontFace: 'Calibri',
    bold: true,
    color: colors.textPrimary,
    align: 'left',
    valign: 'top'
  });

  // Divider line under title
  slide.addShape(prs.ShapeType.rect, {
    x: 0.5,
    y: 0.65,
    w: 1,
    h: 0.05,
    fill: { color: colors.skyBlue, transparency: 40 }, // 60% opaque
    line: { type: 'none' }
  });

  // ─────────────────────────────────────────────────────────────
  // PERSONA DATA STRUCTURE
  // ─────────────────────────────────────────────────────────────
  const personas = [
    {
      initial: 'S',
      color: colors.needSeekerBlue,
      title: 'Need Seeker',
      profile: 'Low-income, immigrant, elderly',
      task: 'Find food/help ASAP',
      value: 'Plan in <1 min, anonymous',
      yPos: 0.85
    },
    {
      initial: 'H',
      color: colors.helperGreen,
      title: 'Helper',
      profile: 'Volunteer, neighbor, student',
      task: 'Post offers, match, deliver safely',
      value: 'Smart matching, risk alerts',
      yPos: 2.35
    },
    {
      initial: 'A',
      color: colors.anchorPurple,
      title: 'Anchor Admin',
      profile: 'NGO staff, church coordinator',
      task: 'Configure rules, moderate',
      value: 'Review queue + audit log',
      yPos: 3.85
    }
  ];

  // ─────────────────────────────────────────────────────────────
  // SECTION 3: RENDER PERSONA CARDS
  // ─────────────────────────────────────────────────────────────

  personas.forEach((persona) => {
    // ───────────────────────────────────────────────────────────
    // CARD BACKGROUND (Glass container)
    // ───────────────────────────────────────────────────────────
    slide.addShape(prs.ShapeType.roundRect, {
      x: 0.5,
      y: persona.yPos,
      w: 9,
      h: 1.4,
      fill: { color: colors.white, transparency: 18 }, // 82% opaque - glass effect
      line: {
        color: persona.color,
        width: 1,
        transparency: 60 // 40% opaque border
      },
      rectRadius: 0.15, // 18pt rounded corners
      shadow: {
        type: 'outer',
        blur: 20,
        offset: { x: 0, y: 4 },
        angle: 90,
        color: colors.black,
        opacity: 0.06
      }
    });

    // ───────────────────────────────────────────────────────────
    // LEFT CIRCLE WITH PERSONA INITIAL
    // ───────────────────────────────────────────────────────────
    slide.addShape(prs.ShapeType.ellipse, {
      x: 0.65,
      y: persona.yPos + 0.3,
      w: 0.8,
      h: 0.8,
      fill: { color: persona.color, transparency: 0 }, // 100% opaque
      line: { type: 'none' },
      shadow: {
        type: 'outer',
        blur: 12,
        offset: { x: 0, y: 2 },
        angle: 90,
        color: persona.color,
        opacity: 0.15
      }
    });

    // Persona initial (white text, centered in circle)
    slide.addText(persona.initial, {
      x: 0.65,
      y: persona.yPos + 0.3,
      w: 0.8,
      h: 0.8,
      fontSize: 32,
      fontFace: 'Calibri',
      bold: true,
      color: colors.white,
      align: 'center',
      valign: 'middle'
    });

    // ───────────────────────────────────────────────────────────
    // TOP ROW: TITLE + PROFILE
    // ───────────────────────────────────────────────────────────

    // Title (bold, larger)
    slide.addText(persona.title, {
      x: 1.7,
      y: persona.yPos + 0.16,
      w: 2,
      h: 0.28,
      fontSize: 14,
      fontFace: 'Calibri',
      bold: true,
      color: colors.textPrimary,
      align: 'left',
      valign: 'middle'
    });

    // Profile (secondary, italic)
    slide.addText(persona.profile, {
      x: 3.8,
      y: persona.yPos + 0.16,
      w: 4.5,
      h: 0.28,
      fontSize: 11,
      fontFace: 'Calibri',
      italic: true,
      color: colors.textSecondary,
      align: 'left',
      valign: 'middle'
    });

    // ───────────────────────────────────────────────────────────
    // BOTTOM ROW: TASK + VALUE
    // ───────────────────────────────────────────────────────────

    // Task label (small, uppercase, color-coded)
    slide.addText('TASK:', {
      x: 1.7,
      y: persona.yPos + 0.62,
      w: 0.5,
      h: 0.18,
      fontSize: 9,
      fontFace: 'Calibri',
      bold: true,
      color: persona.color,
      align: 'left',
      valign: 'middle',
      charSpacing: 0.5
    });

    // Task description
    slide.addText(persona.task, {
      x: 2.25,
      y: persona.yPos + 0.62,
      w: 3.2,
      h: 0.18,
      fontSize: 10,
      fontFace: 'Calibri',
      color: colors.textPrimary,
      align: 'left',
      valign: 'middle'
    });

    // Value label (small, uppercase, color-coded)
    slide.addText('VALUE:', {
      x: 5.6,
      y: persona.yPos + 0.62,
      w: 0.5,
      h: 0.18,
      fontSize: 9,
      fontFace: 'Calibri',
      bold: true,
      color: persona.color,
      align: 'left',
      valign: 'middle',
      charSpacing: 0.5
    });

    // Value description
    slide.addText(persona.value, {
      x: 6.15,
      y: persona.yPos + 0.62,
      w: 3,
      h: 0.18,
      fontSize: 10,
      fontFace: 'Calibri',
      color: colors.textPrimary,
      align: 'left',
      valign: 'middle'
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SECTION 4: FOOTER & METADATA
  // ─────────────────────────────────────────────────────────────

  // Subtle footer line
  slide.addShape(prs.ShapeType.rect, {
    x: 0.5,
    y: 5.45,
    w: 9,
    h: 0.04,
    fill: { color: colors.skyBlue, transparency: 75 }, // 25% opaque
    line: { type: 'none' }
  });

  // Footer text
  slide.addText('WeaveNYC | Privacy-First Mutual Aid Platform', {
    x: 0.5,
    y: 5.5,
    w: 9,
    h: 0.1,
    fontSize: 8,
    fontFace: 'Calibri',
    color: colors.textLight,
    align: 'right',
    valign: 'top'
  });

  // ─────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────
  prs.save({ fileName: 'WeaveNYC_Target_Users_Personas.pptx' });
  console.log('✓ Target Users: Three Personas slide generated');
  console.log('  File: WeaveNYC_Target_Users_Personas.pptx');
  console.log('  Layout: 10" × 5.625" (16:9)');
  console.log('  Theme: Liquid glass with persona colors');
}

// Execute
createTargetUsersPersonasSlide();

/**
 * ─────────────────────────────────────────────────────────────
 * DESIGN SPECIFICATION SUMMARY
 * ─────────────────────────────────────────────────────────────
 *
 * CANVAS: 10" × 5.625"
 * BACKGROUND: Light white base + subtle gradients (liquid glass)
 *
 * LAYOUT STRUCTURE:
 * - Title section: 0.65" tall (title + divider)
 * - Persona cards: 3 cards × 1.4" tall each = 4.2" total
 * - Footer: 0.1" tall
 * - Vertical spacing: 0.1" between cards
 * - Total vertical coverage: 0.65 + 4.2 + 0.1 = 4.95" (fits in 5.625")
 *
 * PERSONA CARD LAYOUT (9" × 1.4" each):
 * - Left margin: 0.5"
 * - Left circle: 0.65" → 1.45" (0.8" dia, centered at 1.05")
 * - Card body starts: 1.7" (0.25" gutter from circle edge)
 * - Card width: 7.3" (from 1.7" to 9")
 *
 * TOP ROW (0.28" tall):
 * - Title: 1.7" → 3.7" (2" wide), 14pt bold
 * - Profile: 3.8" → 8.3" (4.5" wide), 11pt italic secondary
 *
 * BOTTOM ROW (0.18" tall, Y offset +0.46" from top):
 * - Task label: 1.7" → 2.2" (0.5" wide), 9pt bold uppercase
 * - Task text: 2.25" → 5.45" (3.2" wide), 10pt
 * - Value label: 5.6" → 6.1" (0.5" wide), 9pt bold uppercase
 * - Value text: 6.15" → 9.15" (3" wide), 10pt
 *
 * COLORS:
 * - Need Seeker: #3B82F6 (bright blue)
 * - Helper: #10B981 (fresh green)
 * - Anchor Admin: #8B5CF6 (purple)
 *
 * TYPOGRAPHY:
 * - Slide title: Calibri, 28pt bold
 * - Card title: Calibri, 14pt bold
 * - Card profile: Calibri, 11pt italic
 * - Labels: Calibri, 9pt bold uppercase
 * - Body text: Calibri, 10pt regular
 * - Footer: Calibri, 8pt
 *
 * VISUAL EFFECTS:
 * - Card background: 82% opaque white (glass effect)
 * - Card borders: Persona color, 40% opaque, 1pt
 * - Circles: 100% opaque, shadow blur 12pt
 * - Card shadow: Blur 20pt, offset 4pt, opacity 0.06
 *
 * SPACING & MEASUREMENTS:
 * - Card Y positions: 0.85", 2.35", 3.85"
 * - Card gaps: 0.1"
 * - Horizontal margins: 0.5" left, 0.5" right
 * - Rounded corners: 0.15" (18pt)
 *
 * ─────────────────────────────────────────────────────────────
 */
