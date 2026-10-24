export type AppEnv = "development" | "preview" | "staging" | "production";

export function resolveAppEnv(raw: string | undefined | null): AppEnv {
  const v = (raw || "").trim().toLowerCase();
  if (
    v === "development" ||
    v === "preview" ||
    v === "staging" ||
    v === "production"
  ) {
    return v;
  }
  return "production";
}

/** True only when APP_ENV is set to a non-production value; unset is Production. */
export function isNonProductionAppEnv(raw: string | undefined | null): boolean {
  return resolveAppEnv(raw) !== "production";
}
