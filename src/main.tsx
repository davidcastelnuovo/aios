import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { isChunkLoadError } from "./lib/chunkErrors.ts";

/** One-shot guard — unguarded reload() here caused infinite "jumping" after deploys. */
const MAIN_CHUNK_RELOAD_KEY = "aios-main-chunk-reload";

function reloadOnceForStaleChunk() {
  try {
    if (sessionStorage.getItem(MAIN_CHUNK_RELOAD_KEY) === "1") return;
    sessionStorage.setItem(MAIN_CHUNK_RELOAD_KEY, "1");
  } catch {
    // If storage is blocked, still attempt a single reload best-effort.
  }
  window.location.reload();
}

const reportFrontendError = (errorMessage: string, errorStack?: string) => {
  fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-error`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "frontend",
      error_message: errorMessage,
      error_stack: errorStack,
      url: window.location.href,
    }),
  }).catch(() => {});
};

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reportFrontendError(`Vite preload error: ${event.payload?.message || "unknown"}`, event.payload?.stack);
  reloadOnceForStaleChunk();
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason?.message || String(event.reason);
  reportFrontendError(`Unhandled Promise: ${msg}`, event.reason?.stack);

  if (isChunkLoadError(event.reason)) {
    reloadOnceForStaleChunk();
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
