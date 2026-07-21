/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // CI derives this from the repository name so forks deploy under the
  // correct GitHub Pages project path. Keep the canonical path as the local
  // default so development and previews behave like production.
  base: process.env.BASE_PATH ?? "/ajazz-ak820-config/",
  // @ts-expect-error -- Vitest 3 bundles its own vite@7, causing a type mismatch
  // with vite@8 in the project. The `test` key is valid at runtime.
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: false,
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
  },
});
