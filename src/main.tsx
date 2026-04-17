import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

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
  window.location.reload();
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason?.message || String(event.reason);
  reportFrontendError(`Unhandled Promise: ${msg}`, event.reason?.stack);

  const reasonText = [msg, event.reason?.name, event.reason?.stack]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    reasonText.includes("failed to fetch dynamically imported module") ||
    reasonText.includes("importing a module script failed") ||
    reasonText.includes("chunkloaderror")
  ) {
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
