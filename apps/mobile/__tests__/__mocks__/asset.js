// Generic stub for asset imports (fonts, images) under jest. Metro's
// asset pipeline (which turns `require('./foo.ttf')` into a module with
// a resolved URI) isn't present in the Node test runner; we just return
// a numeric handle that matches the shape RN emits.
module.exports = 1;
