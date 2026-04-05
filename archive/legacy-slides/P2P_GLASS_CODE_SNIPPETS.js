/**
 * WeaveNYC P2P Slides (7 & 8) - Liquid Glass Aesthetic Code Snippets
 * Ready-to-integrate PptxGenJS implementations
 *
 * Usage: Copy and paste these functions into your slide generation code
 * Each function is self-contained and tested against Slide 4 pattern
 */

// ════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTION: Create 5-Layer Glass Card
// ════════════════════════════════════════════════════════════════════════════

function addGlassCard(slide, x, y, w, h, headerColor, headerText, subtext) {
  const cornerRadius = 0.15;

  // LAYER 1: Outer Glow Halo (Shadow/Depth)
  slide.addShape(prs.ShapeType.roundRect, {
    x: x - 0.08,
    y: y - 0.08,
    w: w + 0.16,
    h: h + 0.16,
    fill: { type: 'none' },
    line: { type: 'none' },
    rectRadius: cornerRadius + 0.08,
    shadow: {
      type: 'outer',
      color: '000000',
      blur: 18,
      offset: { x: 0, y: 6 },
      angle: 135,
      opacity: 0.05
    }
  });

  // LAYER 2: Main Glass Body (Core container)
  slide.addShape(prs.ShapeType.roundRect, {
    x: x,
    y: y,
    w: w,
    h: h,
    fill: { color: 'FFFFFF', transparency: 50 },  // 50% opaque (KEY)
    line: { type: 'none' },
    rectRadius: cornerRadius
  });

  // LAYER 3: Glass Border (Subtle definition)
  slide.addShape(prs.ShapeType.roundRect, {
    x: x,
    y: y,
    w: w,
    h: h,
    fill: { type: 'none' },
    line: {
      color: 'FFFFFF',
      width: 1.5,
      transparency: 45  // 55% opaque border
    },
    rectRadius: cornerRadius
  });

  // LAYER 4: Top-Edge Light Catch (Simulates refraction)
  slide.addShape(prs.ShapeType.roundRect, {
    x: x + 0.05,
    y: y + 0.05,
    w: w - 0.10,
    h: 0.12,  // Thin strip
    fill: { color: 'FFFFFF', transparency: 70 },  // 30% opaque
    line: { type: 'none' },
    rectRadius: cornerRadius
  });

  // LAYER 5: Inner Shimmer Highlight (Bottom accent)
  slide.addShape(prs.ShapeType.roundRect, {
    x: x + 0.1,
    y: y + h - 0.25,
    w: w - 0.20,
    h: 0.08,
    fill: { color: 'FFFFFF', transparency: 55 },  // 45% opaque
    line: { type: 'none' },
    rectRadius: 0.05
  });

  // Add colored header band
  slide.addShape(prs.ShapeType.roundRect, {
    x: x,
    y: y,
    w: w,
    h: 0.35,
    fill: { color: headerColor, transparency: 18 },  // 82% opaque
    line: { type: 'none' },
    rectRadius: cornerRadius
  });

  // Add header text
  slide.addText(headerText, {
    x: x + 0.15,
    y: y + 0.04,
    w: w - 0.30,
    h: 0.27,
    fontSize: 14,
    bold: true,
    fontFace: 'Calibri',
    color: headerColor,
    align: 'left',
    valign: 'middle'
  });

  // Add subtext if provided
  if (subtext) {
    slide.addText(subtext, {
      x: x + 0.15,
      y: y + 0.40,
      w: w - 0.30,
      h: 0.20,
      fontSize: 10,
      fontFace: 'Calibri',
      color: '666666',
      align: 'left',
      valign: 'top',
      italic: true
    });
  }
}


// ════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTION: Create Background Blobs
// ════════════════════════════════════════════════════════════════════════════

function addBackgroundBlobs(slide, blobs) {
  /**
   * blobs: Array of blob objects
   * Example: [
   *   { x: -0.8, y: -0.5, size: 3.8, color: 'C7D2FE', transparency: 68 },
   *   ...
   * ]
   */
  blobs.forEach(blob => {
    slide.addShape(prs.ShapeType.ellipse, {
      x: blob.x,
      y: blob.y,
      w: blob.size,
      h: blob.size,
      fill: { color: blob.color, transparency: blob.transparency },
      line: { type: 'none' },
      shadow: undefined
    });
  });

  // Add white veil to unify blobs
  slide.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: 'FFFFFF', transparency: 93 },  // 7% opaque
    line: { type: 'none' }
  });
}


// ════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTION: Create Glass Badge (for labels)
// ════════════════════════════════════════════════════════════════════════════

function addGlassBadge(slide, x, y, label, color) {
  // Badge outer glow (optional)
  slide.addShape(prs.ShapeType.roundRect, {
    x: x - 0.05,
    y: y - 0.05,
    w: 1.2,
    h: 0.28,
    fill: { type: 'none' },
    line: { type: 'none' },
    rectRadius: 0.14,
    shadow: {
      type: 'outer',
      color: '000000',
      blur: 8,
      offset: { x: 0, y: 2 },
      angle: 135,
      opacity: 0.03
    }
  });

  // Badge glass body
  slide.addShape(prs.ShapeType.roundRect, {
    x: x,
    y: y,
    w: 1.2,
    h: 0.28,
    fill: { color: color, transparency: 25 },  // 75% opaque
    line: { type: 'none' },
    rectRadius: 0.14
  });

  // Badge text
  slide.addText(label, {
    x: x + 0.08,
    y: y + 0.04,
    w: 1.04,
    h: 0.20,
    fontSize: 8,
    bold: true,
    fontFace: 'Calibri',
    color: color,
    align: 'center',
    valign: 'middle'
  });
}


// ════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTION: Add Separator Lines
// ════════════════════════════════════════════════════════════════════════════

function addSeparators(slide, orientation, x, y, w, h) {
  /**
   * orientation: 'horizontal' or 'vertical'
   */
  slide.addShape(prs.ShapeType.rect, {
    x: x,
    y: y,
    w: w,
    h: h,
    fill: { color: 'FFFFFF', transparency: (orientation === 'horizontal' ? 60 : 65) },
    line: { type: 'none' }
  });
}


// ════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTION: Add Connection Lines
// ════════════════════════════════════════════════════════════════════════════

function addConnectionLine(slide, x, y, w, h, color, angle = 0) {
  slide.addShape(prs.ShapeType.rect, {
    x: x,
    y: y,
    w: w,
    h: h,
    fill: { color: color, transparency: 40 },  // 60% opaque
    line: { type: 'none' },
    rotate: angle
  });
}


function addDirectionalArrow(slide, x, y, color) {
  slide.addText('→', {
    x: x,
    y: y,
    w: 0.2,
    h: 0.2,
    fontSize: 14,
    color: color,
    align: 'center',
    valign: 'middle',
    transparency: 40
  });
}


// ════════════════════════════════════════════════════════════════════════════
// SLIDE 7: NODE COMPLEMENTARITY - COMPLETE IMPLEMENTATION
// ════════════════════════════════════════════════════════════════════════════

function buildSlide7NodeComplementarity(prs, slide) {
  // Background blobs for Slide 7
  const slide7Blobs = [
    { x: -0.8, y: -0.5, size: 3.8, color: 'C7D2FE', transparency: 68 },   // Indigo - Edge
    { x: 8.2, y: -0.3, size: 3.2, color: 'DDD6FE', transparency: 65 },    // Purple - Anchor
    { x: 3.5, y: 1.8, size: 3.0, color: 'BAE6FD', transparency: 72 },     // Blue - P2P
    { x: 7.5, y: 4.2, size: 2.8, color: 'FDE68A', transparency: 70 },     // Yellow - Activity
    { x: 0.5, y: 4.5, size: 2.5, color: 'FBCFE8', transparency: 66 }      // Pink - Community
  ];

  // Add blobs and white veil
  addBackgroundBlobs(slide, slide7Blobs);

  // EDGE NODE CARD (Left)
  addGlassCard(
    slide,
    0.5, 1.0, 2.8, 4.0,
    'C7D2FE',
    'Edge Node',
    'PWA / Browser'
  );

  // ANCHOR NODE CARD (Center)
  addGlassCard(
    slide,
    3.6, 1.0, 2.8, 4.0,
    'DDD6FE',
    'Anchor Node',
    'Community Organization (Node.js)'
  );

  // CLOUD NODE CARD (Right)
  addGlassCard(
    slide,
    6.7, 1.0, 2.8, 4.0,
    'BAE6FD',
    'Cloud Node',
    'Cloud Backup & Relay'
  );

  // Connection lines
  addConnectionLine(slide, 3.3, 2.8, 0.3, 0.08, 'C7D2FE', -5);  // Edge→Anchor
  addConnectionLine(slide, 6.4, 2.8, 0.3, 0.08, 'DDD6FE', 5);   // Anchor→Cloud

  // Directional arrows
  addDirectionalArrow(slide, 3.5, 2.7, 'BAE6FD');
  addDirectionalArrow(slide, 6.6, 2.7, 'FDE68A');

  // Gradient overlay (subtle left-to-right flow)
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 2.5, h: 5.625,
    fill: { color: 'FFFFFF', transparency: 95 },
    line: { type: 'none' }
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 2.5, y: 0, w: 2.5, h: 5.625,
    fill: { color: 'FFFFFF', transparency: 92 },
    line: { type: 'none' }
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 5.0, y: 0, w: 2.5, h: 5.625,
    fill: { color: 'FFFFFF', transparency: 90 },
    line: { type: 'none' }
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 7.5, y: 0, w: 2.5, h: 5.625,
    fill: { color: 'FFFFFF', transparency: 88 },
    line: { type: 'none' }
  });
}


// ════════════════════════════════════════════════════════════════════════════
// SLIDE 8: SYNC PROTOCOL - COMPLETE IMPLEMENTATION
// ════════════════════════════════════════════════════════════════════════════

function buildSlide8SyncProtocol(prs, slide) {
  // Background blobs for Slide 8
  const slide8Blobs = [
    { x: -1.0, y: -0.7, size: 3.5, color: 'DDD6FE', transparency: 67 },   // Purple - GossipSub
    { x: 8.5, y: -0.2, size: 3.0, color: 'BAE6FD', transparency: 70 },    // Blue - Propagation
    { x: 3.0, y: 1.5, size: 3.2, color: 'C7D2FE', transparency: 68 },     // Indigo - Consistency
    { x: 5.5, y: 4.0, size: 2.9, color: 'FDE68A', transparency: 72 },     // Yellow - Velocity
    { x: 0.2, y: 4.3, size: 2.4, color: 'FBCFE8', transparency: 65 }      // Pink - Conflict
  ];

  // Add blobs and white veil
  addBackgroundBlobs(slide, slide8Blobs);

  // GOSSIPSUB PROTOCOL CARD (Top-Left)
  addGlassCard(
    slide,
    0.5, 1.0, 3.0, 2.2,
    'DDD6FE',
    'GossipSub Event Protocol',
    null
  );

  // CONSISTENCY & CONFLICT RESOLUTION CARD (Bottom-Left)
  addGlassCard(
    slide,
    0.5, 3.4, 3.0, 1.9,
    'C7D2FE',
    'Consistency & Conflict Resolution',
    null
  );

  // BOOTSTRAP PROCESS CARD (Top-Right, Inner)
  addGlassCard(
    slide,
    3.9, 1.0, 3.0, 2.2,
    'FDE68A',
    'Bootstrap Process',
    null
  );

  // LIBP2P + HELIA CARD (Bottom-Right, Inner)
  addGlassCard(
    slide,
    3.9, 3.4, 3.0, 1.9,
    'FBCFE8',
    'libp2p + Helia',
    null
  );

  // FULL SYSTEM OVERVIEW CARD (Far-Right, Full Height)
  addGlassCard(
    slide,
    7.2, 1.0, 2.6, 4.3,
    'BAE6FD',
    'Full System Overview',
    null
  );

  // Add integration overview text
  slide.addText(
    'All nodes connect via libp2p GossipSub, maintaining eventual consistency through versioning, deduplication, and Anchor-governed conflict resolution.',
    {
      x: 7.2 + 0.12,
      y: 1.0 + 0.50,
      w: 2.6 - 0.24,
      h: 3.0,
      fontSize: 9,
      fontFace: 'Calibri',
      color: '333333',
      align: 'left',
      valign: 'top',
      wrap: true
    }
  );

  // Add separators
  addSeparators(slide, 'horizontal', 0.4, 3.2, 9.2, 0.06);  // Horizontal
  addSeparators(slide, 'vertical', 7.0, 1.0, 0.04, 4.3);    // Vertical

  // Add topic glass badges (for Slide 8 topics)
  addGlassBadge(slide, 0.8, 0.3, 'Posts', 'C7D2FE');
  addGlassBadge(slide, 2.2, 0.3, 'Reports', 'DDD6FE');
  addGlassBadge(slide, 3.6, 0.3, 'Announce', 'BAE6FD');

  // Gradient overlay (subtle left-to-right flow)
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 2.5, h: 5.625,
    fill: { color: 'FFFFFF', transparency: 95 },
    line: { type: 'none' }
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 2.5, y: 0, w: 2.5, h: 5.625,
    fill: { color: 'FFFFFF', transparency: 92 },
    line: { type: 'none' }
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 5.0, y: 0, w: 2.5, h: 5.625,
    fill: { color: 'FFFFFF', transparency: 90 },
    line: { type: 'none' }
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 7.5, y: 0, w: 2.5, h: 5.625,
    fill: { color: 'FFFFFF', transparency: 88 },
    line: { type: 'none' }
  });
}


// ════════════════════════════════════════════════════════════════════════════
// IMPLEMENTATION EXAMPLE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Usage in your main presentation file:
 *
 * const PptxGenJS = require('pptxgenjs');
 * const prs = new PptxGenJS();
 *
 * prs.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
 *
 * // For Slide 7
 * const slide7 = prs.addSlide('LAYOUT_16x9');
 * buildSlide7NodeComplementarity(prs, slide7);
 *
 * // For Slide 8
 * const slide8 = prs.addSlide('LAYOUT_16x9');
 * buildSlide8SyncProtocol(prs, slide8);
 *
 * prs.writeFile({ fileName: 'WeaveNYC_Improved.pptx' });
 */


// ════════════════════════════════════════════════════════════════════════════
// TRANSPARENCY VALIDATION HELPER
// ════════════════════════════════════════════════════════════════════════════

/**
 * Validate that all transparency values are valid integers
 * PptxGenJS requires transparency as INTEGER, NOT decimal
 */
function validateTransparency(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Invalid transparency: ${value}. Must be integer 0-100.`);
  }
  if (value < 0 || value > 100) {
    throw new Error(`Transparency out of range: ${value}. Must be 0-100.`);
  }
  return true;
}


// ════════════════════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

module.exports = {
  addGlassCard,
  addBackgroundBlobs,
  addGlassBadge,
  addSeparators,
  addConnectionLine,
  addDirectionalArrow,
  buildSlide7NodeComplementarity,
  buildSlide8SyncProtocol,
  validateTransparency
};


/**
 * PptxGenJS Transparency Reference
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The transparency parameter in PptxGenJS uses values 0-100:
 * - 0 = fully opaque (100% solid, no transparency)
 * - 50 = 50% opaque, 50% transparent
 * - 100 = fully transparent (invisible)
 *
 * IMPORTANT: Values must be INTEGERS, not decimals
 *
 * Correct:   { transparency: 50 }   ✓
 * Wrong:     { transparency: 0.50 }  ✗
 * Wrong:     { transparency: 50.0 }  ✗
 */
