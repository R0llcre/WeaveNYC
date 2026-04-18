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
  }
];
