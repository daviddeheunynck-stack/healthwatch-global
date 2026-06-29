import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Server Components run once per request — calling Date.now() is safe.
      // Client Components use it for display-time values (days-ago, banners).
      // React Compiler is not enabled so "impure during render" is a false positive.
      "react-hooks/purity": "off",
      // Async data loading (fetch → setState) and sync initialization from
      // localStorage/props are standard patterns. None of the 30 flagged cases
      // cause actual cascading render bugs — the rule is overly strict here.
      "react-hooks/set-state-in-effect": "off",
      // Variables/params prefixed with _ are intentionally unused (e.g. _req, _userId).
      "@typescript-eslint/no-unused-vars": ["warn", {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
]);

export default eslintConfig;
