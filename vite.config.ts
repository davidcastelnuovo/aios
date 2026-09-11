import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const buildCommitSha = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
const buildGitBranch = process.env.VERCEL_GIT_COMMIT_REF || "";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __BUILD_COMMIT_SHA__: JSON.stringify(buildCommitSha),
    __BUILD_GIT_BRANCH__: JSON.stringify(buildGitBranch),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    manifest: true,
    // Let Rollup split shared dependencies from the actual import graph.
    // Grouping CommonJS charts/PDF packages manually created entry-chunk cycles
    // and made export libraries load before the first page rendered.
  },
}));
