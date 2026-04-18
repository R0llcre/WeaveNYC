// Loaded by every vitest run. jest-dom only registers custom matchers that are
// meaningful in a DOM environment; it's a no-op under the "node" environment but
// loading it unconditionally keeps the setup simple and matches the alias in
// vitest.config.ts (which points to apps/pwa/node_modules).
import '@testing-library/jest-dom/vitest';
