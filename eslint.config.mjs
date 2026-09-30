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
    // Vendored components pulled from external shadcn registries (e.g. reui.io)
    // via `shadcn add @registry/name`. Treated like src/components/ui/: generated,
    // never hand-edited, and not held to our own lint bar. See ai-context/conventions.md.
    "src/components/reui/**",
  ]),
]);

export default eslintConfig;
