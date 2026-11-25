/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  // Preact's automatic JSX runtime: same component model as React at a
  // fraction of the bundle size.
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  // CI derives this from the repository name so forks deploy under the
  // correct GitHub Pages project path. Keep the canonical path as the local
  // default so development and previews behave like production.
  base: process.env.BASE_PATH ?? "/ajazz-ak820-config/",
  // WebHID (Chromium 89) and WebCodecs ImageDecoder (Chromium 94) already
  // limit the app to Chromium 94+, so don't ship syntax for older browsers.
  // Presets stay separate files so they only load when Display is opened.
  build: { target: "chrome94", cssTarget: "chrome94", assetsInlineLimit: 0 },
  // @ts-expect-error -- Vitest 3 bundles its own vite@7, causing a type mismatch
  // with vite@8 in the project. The `test` key is valid at runtime.
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.*", "src/main.tsx", "src/test-setup.ts"],
      reporter: ["text", "html", "json-summary"],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
  },
});
