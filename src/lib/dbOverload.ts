/** Detect Postgres / PostgREST connection exhaustion so the UI can degrade instead of spinning. */

const OVERLOAD_CODES = new Set(["PGRST002", "PGRST003", "PGRST000", "PGRST001", "544", "DatabaseTimeout"]);

export function isDbOverloadError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "string") {
    return /schema cache|too[_ ]many[_ ]connections|databasetimeout|could not query the database/i.test(error);
  }
  if (typeof error !== "object") return false;
  const err = error as {
    code?: string;
    status?: number;
    message?: string;
    details?: string;
    hint?: string;
    error?: string;
  };
  if (err.code && OVERLOAD_CODES.has(String(err.code))) return true;
  if (err.status === 503 || err.status === 544) return true;
  const text = [err.message, err.details, err.hint, err.error].filter(Boolean).join(" ");
  return /schema cache|too[_ ]many[_ ]connections|databasetimeout|could not query the database|PGRST002/i.test(text);
}

const listeners = new Set<() => void>();
let overloadUntil = 0;

export function noteDbError(error: unknown): boolean {
  if (!isDbOverloadError(error)) return false;
  overloadUntil = Date.now() + 60_000;
  listeners.forEach((fn) => fn());
  return true;
}

export function isDbOverloadActive(): boolean {
  return Date.now() < overloadUntil;
}

export function subscribeDbOverload(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearDbOverload(): void {
  overloadUntil = 0;
  listeners.forEach((fn) => fn());
}
