const PptxGenJS = require('pptxgenjs');

// Create presentation
const prs = new PptxGenJS();
prs.defineLayout({ name: 'CUSTOM', width: 10, height: 5.625 });
prs.addSlide('CUSTOM');

const slide = prs.slides[0];

// ============================================
// BACKGROUND & STYLING
// ============================================

// Light background (off-white)
slide.background = { color: 'F8F9FA' };

// ============================================
// DESIGN CONSTANTS
// ============================================

const TITLE_Y = 0.35;
const FLOW_STRIP_Y = 1.05;
const CARDS_Y = 1.70;

const CARD_WIDTH = 2.8;
const CARD_HEIGHT = 3.0;
const CARD_SPACING = (10 - 3 * CARD_WIDTH) / 4; // 0.8" spacing between cards

const CARD_X_POSITIONS = [
  CARD_SPACING,                    // Card 1: 0.8"
  CARD_SPACING + CARD_WIDTH + CARD_SPACING,     // Card 2: 4.4"
  CARD_SPACING + 2 * (CARD_WIDTH + CARD_SPACING) // Card 3: 8.0"
];

// Persona data
const PERSONAS = [
  {
    id: 'seeker',
    name: 'Need Seeker',
    accentColor: '#3A7BD5',    // Blue
    iconText: 'S',
    who: 'Low-income, immigrant, elderly, single parent, temporarily unemployed',
    goal: 'Find food, childcare, translation, transportation help ASAP',
    value: 'Actionable plan in <1 min; anonymous by default; minimal data exposure'
  },
  {
    id: 'helper',
    name: 'Helper',
    accentColor: '#3CB371',    // Green
    iconText: 'H',
    who: 'Volunteer, neighbor, student, church/community group member',
    goal: 'Post offers, screen suitable matches, complete delivery safely',
    value: 'Smart matching; risk alerts; witness mechanism builds trust'
  },
  {
    id: 'anchor',
    name: 'Anchor Admin',
    accentColor: '#7C5CFC',    // Purple
    iconText: 'A',
    who: 'NGO staff, church coordinator, pantry operator, mutual aid organizer',
    goal: 'Configure rules, moderate content, post announcements, handle reports',
    value: 'Visual review queue + audit log; community governance toolkit'
  }
];

// ============================================
// TITLE
// ============================================

slide.addText('Target Users: Three Personas', {
  x: 0.5,
  y: TITLE_Y,
  w: 9,
  h: 0.55,
  fontSize: 36,
  bold: true,
  fontFace: 'Georgia',
  color: '2A3F5F',
  align: 'left',
  valign: 'top'
});

// ============================================
// FLOW STRIP (Glass Effect)
// ============================================

// Background glass strip with slight transparency effect
slide.addShape(prs.ShapeType.roundRect, {
  x: 0.5,
  y: FLOW_STRIP_Y,
  w: 9,
  h: 0.48,
  fill: { color: 'FFFFFF', transparency: 15 },
  line: { color: 'E0E0E0', width: 1 },
  rectRadius: 0.08
});

// Flow text with arrows
const flowText = 'Seeker → requests help → Helper → governed by → Anchor Admin';
slide.addText(flowText, {
  x: 0.5,
  y: FLOW_STRIP_Y + 0.06,
  w: 9,
  h: 0.36,
  fontSize: 13,
  fontFace: 'Calibri',
  color: '5A6C7D',
  align: 'center',
  valign: 'middle',
  italic: true
});

// ============================================
// PERSONA CARDS
// ============================================

PERSONAS.forEach((persona, index) => {
  const cardX = CARD_X_POSITIONS[index];
  
  // Main card background (glass effect with light transparency)
  slide.addShape(prs.ShapeType.roundRect, {
    x: cardX,
    y: CARDS_Y,
    w: CARD_WIDTH,
    h: CARD_HEIGHT,
    fill: { color: 'FFFFFF', transparency: 5 },
    line: { color: 'D8D8E8', width: 1.5 },
    rectRadius: 0.12
  });
  
  // Colored accent bar at top (0.15" thick)
  slide.addShape(prs.ShapeType.rect, {
    x: cardX,
    y: CARDS_Y,
    w: CARD_WIDTH,
    h: 0.15,
    fill: { color: persona.accentColor },
    line: { type: 'none' }
  });
  
  // ---- PERSONA NAME (below accent bar) ----
  slide.addText(persona.name, {
    x: cardX + 0.15,
    y: CARDS_Y + 0.25,
    w: CARD_WIDTH - 0.30,
    h: 0.35,
    fontSize: 16,
    bold: true,
    fontFace: 'Georgia',
    color: '2A3F5F',
    align: 'left',
    valign: 'top'
  });
  
  // ---- ROW 1: WHO ----
  // Label
  slide.addText('Who', {
    x: cardX + 0.15,
    y: CARDS_Y + 0.68,
    w: CARD_WIDTH - 0.30,
    h: 0.18,
    fontSize: 10,
    bold: true,
    fontFace: 'Calibri',
    color: '7A8FA3',
    align: 'left',
    valign: 'top'
  });
  
  // Content
  slide.addText(persona.who, {
    x: cardX + 0.15,
    y: CARDS_Y + 0.88,
    w: CARD_WIDTH - 0.30,
    h: 0.60,
    fontSize: 9,
    fontFace: 'Calibri',
    color: '3A4A5A',
    align: 'left',
    valign: 'top'
  });
  
  // ---- ROW 2: GOAL ----
  // Label
  slide.addText('Goal', {
    x: cardX + 0.15,
    y: CARDS_Y + 1.52,
    w: CARD_WIDTH - 0.30,
    h: 0.18,
    fontSize: 10,
    bold: true,
    fontFace: 'Calibri',
    color: '7A8FA3',
    align: 'left',
    valign: 'top'
  });
  
  // Content
  slide.addText(persona.goal, {
    x: cardX + 0.15,
    y: CARDS_Y + 1.72,
    w: CARD_WIDTH - 0.30,
    h: 0.60,
    fontSize: 9,
    fontFace: 'Calibri',
    color: '3A4A5A',
    align: 'left',
    valign: 'top'
  });
  
  // ---- ROW 3: VALUE ----
  // Label
  slide.addText('Value', {
    x: cardX + 0.15,
    y: CARDS_Y + 2.36,
    w: CARD_WIDTH - 0.30,
    h: 0.18,
    fontSize: 10,
    bold: true,
    fontFace: 'Calibri',
    color: '7A8FA3',
    align: 'left',
    valign: 'top'
  });
  
  // Content
  slide.addText(persona.value, {
    x: cardX + 0.15,
    y: CARDS_Y + 2.56,
    w: CARD_WIDTH - 0.30,
    h: 0.60,
    fontSize: 9,
    fontFace: 'Calibri',
    color: '3A4A5A',
    align: 'left',
    valign: 'top'
  });
});

// ============================================
// FOOTER
// ============================================

slide.addText('WeaveNYC  ·  Midterm Proposal', {
  x: 0.5,
  y: 5.35,
  w: 5,
  h: 0.22,
  fontSize: 9,
  fontFace: 'Calibri',
  color: '999999',
  align: 'left'
});

slide.addText('5', {
  x: 9.0,
  y: 5.35,
  w: 0.5,
  h: 0.22,
  fontSize: 9,
  fontFace: 'Calibri',
  color: '999999',
  align: 'right'
});

// ============================================
// EXPORT
// ============================================

prs.writeFile('personas_slide_new.pptx');
console.log('✓ Personas slide created: personas_slide_new.pptx');

