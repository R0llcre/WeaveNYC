// `src/theme/fonts.ts` stub — R4 atoms extension.
//
// The real module does `require(...ttf)` calls through expo-font's
// `useFonts`. The .ttf binaries aren't vendored in the worktree yet and
// expo-font needs the full jest-expo preset to evaluate. For atom tests
// we don't render anything that probes the font registry at runtime —
// only `fontFamily` strings bubble through to style props — so a stub
// matching the public surface is enough to let `@/theme` resolve.
module.exports = {
  loadAppFonts: () => Promise.resolve(),
  listAppFontKeys: () => [],
};
