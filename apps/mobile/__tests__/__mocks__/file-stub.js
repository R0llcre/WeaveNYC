// Binary-asset stub for the jest node env. Metro normally routes
// `require('*.ttf')` / `require('*.svg')` through its asset pipeline,
// but jest has no such pipeline and otherwise tries to parse the
// binary as JavaScript. This stub returns an opaque placeholder so
// the surrounding TS compiles and ts-jest can finish loading the
// module that called it.
module.exports = 'test-file-stub';
