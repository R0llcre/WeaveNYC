import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/.next/**",
      "**/out/**",
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "apps/**/public/**",
      "apps/mobile/ios/**",
      "apps/mobile/android/**",
      "apps/mobile/.expo/**",
      "apps/mobile/expo-env.d.ts",
      "**/migrations/*.sql",
      "archive/**",
      "diagrams/rendered/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,cjs,mjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        React: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    // Mobile's Metro/Babel/Jest config files MUST be CJS (Expo contract),
    // and jest tests legitimately require() modules so a single failed
    // import surfaces as a per-test failure rather than taking down the
    // whole file at ES import resolution time. Scoping the override to
    // just these paths keeps the rule enforced everywhere else. The
    // nested `src/**/__tests__` glob covers co-located jest specs like
    // `src/lib/__tests__/imports.test.ts` (M2) which follows the same
    // require-per-module pattern as the top-level smoke suite. Atom
    // test files (e.g. SandboxBanner.test.ts) also use `require()` to
    // isolate module-evaluation between cases.
    files: [
      "apps/mobile/babel.config.js",
      "apps/mobile/metro.config.js",
      "apps/mobile/jest.config.js",
      "apps/mobile/__tests__/**/*.{js,ts}",
      "apps/mobile/src/**/__tests__/**/*.{js,ts}",
      "apps/mobile/src/**/*.test.{js,ts,tsx}"
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  },
  {
    // Jest-land — mocks and atom unit tests reference `jest.fn()` etc.
    // without a module import. Without the `jest` global the linter flags
    // every spy call as `no-undef`. Scoped to the mocks + atom tests so
    // everywhere else still catches real undefined refs.
    files: [
      "apps/mobile/__tests__/__mocks__/**/*.{js,ts}",
      "apps/mobile/src/**/*.test.{js,ts,tsx}",
      "apps/mobile/src/**/__tests__/**/*.{js,ts,tsx}"
    ],
    languageOptions: {
      globals: {
        ...globals.jest
      }
    }
  },
  {
    // Expo's font loader has to `require(...ttf)` so Metro's static asset
    // resolver wires the binary — there's no ES-module equivalent and
    // switching to `import` here would break the loader at runtime. Allow
    // require() only in this one module. ResourceCard.tsx uses dynamic
    // `require()` for optional runtime references (porting PWA behaviour
    // verbatim) — allow there until the port is refactored to ES imports.
    files: [
      "apps/mobile/src/theme/fonts.ts",
      "apps/mobile/src/components/ui/ResourceCard.tsx"
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  }
];
