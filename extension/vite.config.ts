import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  // Don't inherit the repo-root postcss.config.js (tailwind) — plain CSS here.
  css: { postcss: {} },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome110",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        recorder: resolve(__dirname, "recorder.html"),
      },
    },
  },
});
