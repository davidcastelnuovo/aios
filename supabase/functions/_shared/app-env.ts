export type AppEnv = "development" | "preview" | "staging" | "production";

export function resolveAppEnv(raw: string | undefined | null): AppEnv {
  const v = (raw || "").trim().toLowerCase();
  if (v === "development" || v === "preview" || v === "staging" || v === "production") {
    return v;
  }
  return "production";
}
