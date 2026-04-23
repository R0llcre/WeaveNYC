// Stub @/theme/fonts for Node test env. The real module `require()`s
// TTF binaries via expo-font, which the M7 tokens PR intentionally
// deferred — font files aren't vendored into the repo yet. The loader's
// public contract (`loadAppFonts`, `listAppFontKeys`) is all the theme
// barrel needs to re-export, so the stub mirrors only that surface.
module.exports = {
  loadAppFonts: jest.fn(() => Promise.resolve()),
  listAppFontKeys: jest.fn(() => [
    'Fraunces',
    'Fraunces-Variable',
    'Inter',
    'Inter-Medium',
    'Inter-SemiBold',
    'Inter-Bold',
    'IBMPlexMono',
  ]),
};
