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
  const status = [label, meta, "לא Production"].filter(Boolean).join(" — ");

  return (
    <div
      data-staging-frame
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] border-2 border-amber-400/45 shadow-[inset_0_0_24px_rgba(251,191,36,0.12),0_0_32px_rgba(251,191,36,0.08)]"
    >
      <span className="sr-only">{status}</span>
    </div>
  );
}
