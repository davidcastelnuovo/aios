declare const __BUILD_COMMIT_SHA__: string;
declare const __BUILD_GIT_BRANCH__: string;

export function resolveBuildCommitSha(): string | null {
  const sha = typeof __BUILD_COMMIT_SHA__ === "string" ? __BUILD_COMMIT_SHA__.trim() : "";
  return sha || null;
}

export function resolveBuildGitBranch(): string | null {
  const branch = typeof __BUILD_GIT_BRANCH__ === "string" ? __BUILD_GIT_BRANCH__.trim() : "";
  return branch || null;
}
