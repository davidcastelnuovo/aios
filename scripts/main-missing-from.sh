#!/usr/bin/env bash
# Usage: main-missing-from.sh <ref>
# Lists `origin/main` commits with no patch-equivalent in <ref> (`git cherry` marks them "+").
# Exit 1 if any are missing. History is linear and SHAs differ after rebase-merges, so
# ancestry is the wrong test between main and develop.
# A squash-merged backport hides per-commit patches, so when `git cherry` reports gaps we
# also check content: if merging origin/main into <ref> (develop's side winning conflicts,
# e.g. formatting on top of a port) leaves <ref>'s tree unchanged, every main change is
# already in <ref>.
set -euo pipefail
ref=${1:?usage: main-missing-from.sh <ref>}
git fetch --no-tags origin main
missing=$(git cherry "$ref" origin/main | grep '^+' || true)
[ -z "$missing" ] && exit 0
merged=$(git merge-tree --write-tree -X ours "$ref" origin/main 2>/dev/null | head -1 || true)
if [ -n "$merged" ] && [ "$merged" = "$(git rev-parse "${ref}^{tree}")" ]; then
  echo "main commits have no patch-equivalent in ${ref}, but ${ref} already contains their content"
  exit 0
fi
echo "main has commits with no equivalent in ${ref}:"
echo "$missing" | while read -r _ sha; do git log -1 --format='  %h %s' "$sha"; done
exit 1
