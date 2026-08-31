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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "vendor-supabase";
          if (
            id.includes("recharts") ||
            id.includes("d3-") ||
            id.includes("victory")
          ) {
            return "vendor-charts";
          }
          if (
            id.includes("xlsx") ||
            id.includes("jspdf") ||
            id.includes("html2canvas")
          ) {
            return "vendor-export";
          }
        },
      },
    },
  },
}));
