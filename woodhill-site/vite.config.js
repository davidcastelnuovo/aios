import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.WOODHILL_BASE || "/",
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
