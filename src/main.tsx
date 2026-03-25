import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

// Global unhandled error reporter
window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason?.message || String(event.reason);
  fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-error`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "frontend", error_message: `Unhandled Promise: ${msg}`, error_stack: event.reason?.stack, url: window.location.href }),
  }).catch(() => {});
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
