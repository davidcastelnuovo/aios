import { isNonProduction, resolveFrontendAppEnv } from "@/lib/appEnv";

export function StagingBanner() {
  const env = resolveFrontendAppEnv();
  if (!isNonProduction(env)) return null;

  const label = env === "staging" ? "STAGING" : env === "preview" ? "PREVIEW" : "DEV";

  return (
    <div
      className="sticky top-0 z-[70] bg-amber-500 text-black px-4 py-1.5 text-center text-sm font-bold tracking-wide"
      role="status"
    >
      {label} — לא Production. אל תבצע פעולות מול לקוחות אמיתיים.
    </div>
  );
}
