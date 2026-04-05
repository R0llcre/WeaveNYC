/**
 * WeaveNYC Target Users: Three Personas Slide - PptxGenJS Implementation
 * Premium Liquid Glass Aesthetic with Comparison Table Layout
 *
 * This file renders a clean, scannable comparison table showing three user personas.
 * Format: 10" × 5.625" (16:9)
 * Layout: One large glass card with 4×4 grid (3 personas + row headers)
 */

const PptxGenJS = require('pptxgenjs');

function createWeaveNYCPersonasSlide() {
  const prs = new PptxGenJS();

  // Canvas setup: 16:9 aspect ratio
  prs.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
  const slide = prs.addSlide('LAYOUT_16x9');

  // ─────────────────────────────────────────────────────────────
  // COLOR PALETTE (Consistent with cover slide)
  // ─────────────────────────────────────────────────────────────
  const colors = {
    // Background & glass
    white: '#FFFFFF',
    black: '#000000',

    // Persona colors (unique to this slide, matching requirements)
    needSeekerBlue: '#2563EB',      // Blue for "Need Seeker"
    helperGreen: '#10B981',         // Green for "Helper"
    anchorAdminPurple: '#8B5CF6',   // Purple for "Anchor Admin"

    // Accent colors (from palette)
    azureDeep: '#2563EB',
    skyBlue: '#0EA5E9',
    cyan: '#06B6D4',

    // Text colors
    textPrimary: '#1F2937',         // Dark gray
    textSecondary: '#4B5563',       // Medium gray
    textLight: '#9CA3AF',           // Light gray
  };

  // ─────────────────────────────────────────────────────────────
  // SECTION 1: BACKGROUND GRADIENT SIMULATION (Same as cover)
  // ─────────────────────────────────────────────────────────────

  // Layer 1: Deep Azure Base (Bottom-Left)
  slide.addShape(prs.ShapeType.ellipse, {
    x: -1,
    y: 3,
    w: 8,
    h: 8,
    fill: { color: colors.azureDeep, transparency: 85 },
    line: { type: 'none' }
  });

  // Layer 2: Sky Blue Accent (Top-Right)
  slide.addShape(prs.ShapeType.ellipse, {
    x: 6,
    y: -1.5,
    w: 7,
    h: 7,
    fill: { color: colors.skyBlue, transparency: 80 },
    line: { type: 'none' }
  });

  // Layer 3: Cyan Secondary (Center-Right)
  slide.addShape(prs.ShapeType.ellipse, {
    x: 7.5,
    y: 1.5,
    w: 5,
    h: 5,
    fill: { color: colors.cyan, transparency: 75 },
    line: { type: 'none' }
  });

  // Layer 4: Subtle White Veil (Full Canvas)
  slide.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: colors.white, transparency: 92 },
    line: { type: 'none' }
  });

  // ─────────────────────────────────────────────────────────────
  // SECTION 2: LARGE GLASS CONTAINER FOR COMPARISON TABLE
  // ─────────────────────────────────────────────────────────────

  // Main glass card container
  slide.addShape(prs.ShapeType.roundRect, {
    x: 0.4,
    y: 0.4,
    w: 9.2,
    h: 4.825,
    fill: { color: colors.white, transparency: 12 }, // 88% opaque
    line: { type: 'none' },
    rectRadius: 0.2,
    shadow: {
      type: 'outer',
      blur: 40,
      offset: { x: 0, y: 8 },
      angle: 90,
      color: colors.black,
      opacity: 0.08
    }
  });

  // Optional glass container border
  slide.addShape(prs.ShapeType.roundRect, {
    x: 0.4,
    y: 0.4,
    w: 9.2,
    h: 4.825,
    fill: { type: 'none' },
    line: {
      color: colors.skyBlue,
      width: 1,
      transparency: 70
    },
    rectRadius: 0.2
  });

  // ─────────────────────────────────────────────────────────────
  // SECTION 3: COMPARISON TABLE GRID LAYOUT
  // ─────────────────────────────────────────────────────────────

  /**
   * GRID STRUCTURE:
   * 4 columns: ROW_LABELS | NEED_SEEKER | HELPER | ANCHOR_ADMIN
   * 4 rows: HEADER | WHO | GOAL | VALUE
   *
   * Dimensions:
   * - Total usable area inside card: ~8.4" W × 4.225" H (accounting for margins)
   * - Internal margins: 0.4" top/bottom, 0.4" left/right
   * - Actual content area: ~8.4" W × 4.225" H
   *
   * Column widths (distribute 8.4" across 4 columns):
   * - Col 0 (Row Headers): 1.8" (labels like "Who", "Goal", "Value")
   * - Col 1 (Need Seeker): 2.2"
   * - Col 2 (Helper): 2.2"
   * - Col 3 (Anchor Admin): 2.2"
   * Total: 1.8 + 2.2 + 2.2 + 2.2 = 8.4"
   *
   * Row heights (distribute 4.225" across 4 rows):
   * - Row 0 (Header): 0.6" (persona names)
   * - Row 1 (Who): 0.95"
   * - Row 2 (Goal): 1.0"
   * - Row 3 (Value): 0.85"
   * Total: 0.6 + 0.95 + 1.0 + 0.85 = 3.4" (leaves some breathing room)
   */

  // Card internal margins
  const cardX = 0.4;
  const cardY = 0.4;
  const cardW = 9.2;
  const cardH = 4.825;
  const marginLeft = 0.4;
  const marginTop = 0.35;

  // Grid parameters
  const col0W = 1.75;  // Row labels
  const col123W = 2.45; // Each persona column
  const row0H = 0.65;  // Header row (persona names)
  const row123H = 1.0; // Content rows
  const gutter = 0.02; // Space between cells

  // Starting position (inside the glass card)
  const startX = cardX + marginLeft;
  const startY = cardY + marginTop;

  // ─────────────────────────────────────────────────────────────
  // HELPER: Draw grid cell with borders
  // ─────────────────────────────────────────────────────────────
  function drawGridCell(x, y, w, h, bgColor, textContent, fontSize, fontWeight, textColor, isHeader = false) {
    // Cell background (optional colored header)
    if (bgColor) {
      slide.addShape(prs.ShapeType.rect, {
        x: x,
        y: y,
        w: w,
        h: h,
        fill: { color: bgColor, transparency: isHeader ? 20 : 100 }, // 20% opacity for headers, transparent for content
        line: { type: 'none' }
      });
    }

    // Cell border (light gray, subtle)
    slide.addShape(prs.ShapeType.rect, {
      x: x,
      y: y,
      w: w,
      h: h,
      fill: { type: 'none' },
      line: {
        color: colors.textLight,
        width: 1,
        transparency: 85 // 15% opaque
      }
    });

    // Cell text
    if (textContent) {
      slide.addText(textContent, {
        x: x + 0.08,
        y: y + 0.08,
        w: w - 0.16,
        h: h - 0.16,
        fontSize: fontSize,
        fontFace: 'Calibri',
        bold: fontWeight === 'bold',
        color: textColor,
        align: 'left',
        valign: 'top',
        wordWrap: true,
        lineSpacing: 13
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ROW 0: HEADER ROW (Persona Names with Colored Backgrounds)
  // ─────────────────────────────────────────────────────────────

  // Empty cell (top-left corner, row labels)
  drawGridCell(startX, startY, col0W, row0H, null, '', 9, 'normal', colors.textPrimary);

  // Header 1: Need Seeker (Blue)
  drawGridCell(
    startX + col0W + gutter, startY, col123W, row0H,
    colors.needSeekerBlue,
    'Need Seeker',
    11,
    'bold',
    colors.white,
    true
  );

  // Header 2: Helper (Green)
  drawGridCell(
    startX + col0W + col123W + 2*gutter, startY, col123W, row0H,
    colors.helperGreen,
    'Helper',
    11,
    'bold',
    colors.white,
    true
  );

  // Header 3: Anchor Admin (Purple)
  drawGridCell(
    startX + col0W + 2*col123W + 3*gutter, startY, col123W, row0H,
    colors.anchorAdminPurple,
    'Anchor Admin',
    11,
    'bold',
    colors.white,
    true
  );

  // ─────────────────────────────────────────────────────────────
  // ROW 1: WHO (User Profile)
  // ─────────────────────────────────────────────────────────────
  const row1Y = startY + row0H + gutter;

  // Row label: "Who"
  drawGridCell(startX, row1Y, col0W, row123H, null, 'Who', 10, 'bold', colors.textPrimary);

  // Need Seeker: Who
  drawGridCell(
    startX + col0W + gutter, row1Y, col123W, row123H,
    null,
    'Low-income or immigrant residents',
    9,
    'normal',
    colors.textSecondary
  );

  // Helper: Who
  drawGridCell(
    startX + col0W + col123W + 2*gutter, row1Y, col123W, row123H,
    null,
    'Volunteers, neighbors, community members',
    9,
    'normal',
    colors.textSecondary
  );

  // Anchor Admin: Who
  drawGridCell(
    startX + col0W + 2*col123W + 3*gutter, row1Y, col123W, row123H,
    null,
    'NGO staff, church coordinators, administrators',
    9,
    'normal',
    colors.textSecondary
  );

  // ─────────────────────────────────────────────────────────────
  // ROW 2: GOAL (What they need)
  // ─────────────────────────────────────────────────────────────
  const row2Y = row1Y + row123H + gutter;

  // Row label: "Goal"
  drawGridCell(startX, row2Y, col0W, row123H, null, 'Goal', 10, 'bold', colors.textPrimary);

  // Need Seeker: Goal
  drawGridCell(
    startX + col0W + gutter, row2Y, col123W, row123H,
    null,
    'Find help ASAP. Private. Plan in under 1 minute.',
    9,
    'normal',
    colors.textSecondary
  );

  // Helper: Goal
  drawGridCell(
    startX + col0W + col123W + 2*gutter, row2Y, col123W, row123H,
    null,
    'Post offers easily. Match with people safely. Get alerts on risk.',
    9,
    'normal',
    colors.textSecondary
  );

  // Anchor Admin: Goal
  drawGridCell(
    startX + col0W + 2*col123W + 3*gutter, row2Y, col123W, row123H,
    null,
    'Moderate, configure rules. Review requests & audit logs.',
    9,
    'normal',
    colors.textSecondary
  );

  // ─────────────────────────────────────────────────────────────
  // ROW 3: VALUE (What WeaveNYC gives them)
  // ─────────────────────────────────────────────────────────────
  const row3Y = row2Y + row123H + gutter;

  // Row label: "Our Value"
  drawGridCell(startX, row3Y, col0W, row123H, null, 'Our Value', 10, 'bold', colors.textPrimary);

  // Need Seeker: Value
  drawGridCell(
    startX + col0W + gutter, row3Y, col123W, row123H,
    null,
    '✓ Zero friction\n✓ Anonymous\n✓ No data tracking',
    9,
    'normal',
    colors.needSeekerBlue
  );

  // Helper: Value
  drawGridCell(
    startX + col0W + col123W + 2*gutter, row3Y, col123W, row123H,
    null,
    '✓ Smart matching\n✓ Safety first\n✓ Trust signals',
    9,
    'normal',
    colors.helperGreen
  );

  // Anchor Admin: Value
  drawGridCell(
    startX + col0W + 2*col123W + 3*gutter, row3Y, col123W, row123H,
    null,
    '✓ Full visibility\n✓ Compliance tools\n✓ Community control',
    9,
    'normal',
    colors.anchorAdminPurple
  );

  // ─────────────────────────────────────────────────────────────
  // SECTION 4: SLIDE TITLE (Above the table, inside glass card)
  // ─────────────────────────────────────────────────────────────

  slide.addText('Target Users: Three Personas', {
    x: startX,
    y: cardY + 0.12,
    w: 6,
    h: 0.25,
    fontSize: 18,
    fontFace: 'Calibri',
    bold: true,
    color: colors.textPrimary,
    align: 'left',
    valign: 'top'
  });

  // ─────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────
  prs.save({ fileName: 'WeaveNYC_Personas_Slide.pptx' });
  console.log('✓ Personas slide generated: WeaveNYC_Personas_Slide.pptx');
}

// Execute
createWeaveNYCPersonasSlide();

/**
 * ─────────────────────────────────────────────────────────────
 * KEY DESIGN DECISIONS
 * ─────────────────────────────────────────────────────────────
 *
 * 1. LAYOUT APPROACH (Comparison Table):
 *    - 4×4 grid: 3 columns for personas + 1 for row labels
 *    - 4 rows: Header + 3 content rows (Who, Goal, Value)
 *    - Fits compactly inside single large glass card
 *    - Highly scannable and information-dense
 *    - DIFFERENT from previous card/pyramid layouts
 *
 * 2. GLASS CONTAINER:
 *    - One large card (9.2" W × 4.825" H)
 *    - 88% opaque (same transparency as cover slide)
 *    - Rounded corners: 24pt (consistent with brand)
 *    - Soft shadow: blur 40pt, offset 8pt Y, opacity 8%
 *    - Fills ~92% of slide (0.4" margins all sides)
 *
 * 3. COLOR STRATEGY (Persona Differentiation):
 *    - Need Seeker: #2563EB (Deep Blue) — stable, trust
 *    - Helper: #10B981 (Emerald Green) — growth, helping
 *    - Anchor Admin: #8B5CF6 (Purple) — authority, leadership
 *    - Header cells: 20% opacity of persona color, white text
 *    - Value cells: Text colored to persona color (no background)
 *    - Creates strong visual differentiation without clutter
 *
 * 4. GRID CELLS:
 *    - Borders: Light gray, 1pt, 15% opaque (subtle)
 *    - Backgrounds: Only headers colored (transparent fill)
 *    - Content rows: White/transparent (clean)
 *    - Text: 9-10pt Calibri, consistent with cover slide
 *    - Line spacing: 13pt for readability within cells
 *
 * 5. ROW STRUCTURE:
 *    - "Who": User profile/demographics (e.g., "Low-income residents")
 *    - "Goal": What they want to accomplish (e.g., "Find help ASAP")
 *    - "Our Value": What WeaveNYC provides (checkmarks + benefits)
 *    - Row labels: Left column, bold, dark gray
 *
 * 6. FONT CONSISTENCY:
 *    - Calibri sans-serif throughout (matches cover slide)
 *    - Headers: 11pt Bold, white on colored background
 *    - Row labels: 10pt Bold, dark gray
 *    - Cell content: 9pt Regular, medium gray
 *    - Value checkmarks: Colored text (persona color)
 *
 * 7. SPACING:
 *    - Margins inside card: 0.4" left, 0.35" top
 *    - Gutter between cells: 0.02" (minimal visual separation)
 *    - Row heights: Variable (0.65" header, 1.0" content)
 *    - Column widths: 1.75" labels + 2.45" each persona
 *
 * 8. DIFFERENTIATION FROM PREVIOUS SLIDES:
 *    - P1 (Asymmetric Cards): NOT scattered cards, ONE glass container
 *    - P2 (Center Image + Labels): NOT image-based, TABLE-based
 *    - P3 (Pyramid Grid): NOT triangular, RECTANGULAR grid
 *    - This slide: Comparison table (clean, scannable, structured)
 *
 * ─────────────────────────────────────────────────────────────
 */
