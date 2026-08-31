import { isNonProduction, resolveFrontendAppEnv } from "@/lib/appEnv";
import {
  resolveBuildCommitSha,
  resolveBuildGitBranch,
} from "@/lib/buildInfo";

export function StagingBanner() {
  const env = resolveFrontendAppEnv();
  if (!isNonProduction(env)) return null;

  const label =
    env === "staging" ? "STAGING" : env === "preview" ? "PREVIEW" : "DEV";
  const branch = resolveBuildGitBranch();
  const commit = resolveBuildCommitSha();
  const meta = [branch, commit].filter(Boolean).join(" @ ");

  return (
    <div
      data-staging-banner
      className="sticky top-0 z-[70] bg-amber-500 text-black px-4 py-1.5 text-center text-sm font-bold tracking-wide"
      role="status"
    >
      {label}
      {meta ? ` — ${meta}` : ""} — לא Production. אל תבצע פעולות מול לקוחות
      אמיתיים.
    </div>
  );
}
