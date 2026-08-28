export type AppEnv = "development" | "preview" | "staging" | "production";

export function resolveAppEnv(raw: string | undefined | null): AppEnv {
  const v = (raw || "").trim().toLowerCase();
  if (v === "development" || v === "preview" || v === "staging" || v === "production") {
    return v;
  }
  return "production";
}

/** Vite frontend: explicit VITE_APP_ENV wins; local `pnpm dev` is development. */
export function resolveFrontendAppEnv(): AppEnv {
  const explicit = import.meta.env.VITE_APP_ENV as string | undefined;
  if (explicit && String(explicit).trim()) return resolveAppEnv(explicit);
  if (import.meta.env.DEV) return "development";
  return "production";
}

export function isNonProduction(env: AppEnv): boolean {
  return env !== "production";
}
