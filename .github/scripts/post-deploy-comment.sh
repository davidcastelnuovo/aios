#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?required}"
: "${PR:?required}"
: "${REPO:?required}"
: "${RUN_URL:?required}"
: "${TARGET:?required}"
: "${MIGRATE_RESULT:?required}"
: "${FUNCTIONS_RESULT:?required}"
: "${TYPES_RESULT:?required}"
MIGRATIONS_CHANGED="${MIGRATIONS_CHANGED:-false}"
FUNCTIONS_CHANGED="${FUNCTIONS_CHANGED:-false}"
GATE_RESULT="${GATE_RESULT:-}"
LOCK_RESULT="${LOCK_RESULT:-}"
LOCK_IS_HOLDER="${LOCK_IS_HOLDER:-}"

MARKER="<!-- deploy-status -->"

# line <name> <result> <changed: true|false>
# `skipped` has three causes: nothing changed, the label/lock gate blocked the
# deploy, or an upstream job did not succeed.
line() {
  local name="$1" result="$2" changed="$3"
  case "$result" in
    success)    echo "- ✅ **$name** succeeded" ;;
    failure)    echo "- ❌ **$name** failed" ;;
    cancelled)  echo "- ⚪ **$name** cancelled" ;;
    skipped|"")
      if [[ "$changed" != "true" ]]; then
        echo "- ⏭️ **$name** skipped (no changes)"
      elif [[ "$GATE_RESULT" == "failure" ]]; then
        echo "- ⛔ **$name** not run (this PR needs the \`staging\` label)"
      elif [[ "$LOCK_RESULT" == "failure" || "$LOCK_IS_HOLDER" == "false" ]]; then
        echo "- ⛔ **$name** not run (another PR holds the staging lock)"
      else
        echo "- ⏭️ **$name** not run (an upstream job did not succeed)"
      fi ;;
    *)          echo "- ❔ **$name**: $result" ;;
  esac
}

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

{
  echo "$MARKER"
  echo "**Deploy → \`$TARGET\`** — [workflow run]($RUN_URL)"
  echo "_Last updated: ${TIMESTAMP}_"
  echo ""
  line "DB migrations" "$MIGRATE_RESULT" "$MIGRATIONS_CHANGED"
  line "Edge functions" "$FUNCTIONS_RESULT" "$FUNCTIONS_CHANGED"
  line "Types in sync with schema" "$TYPES_RESULT" "$MIGRATIONS_CHANGED"

  if [[ "$MIGRATE_RESULT" == "failure" && "$TARGET" == "staging" ]]; then
    echo ""
    echo "> ⚠️ **Migration failed on staging.** This often means migration history drift — another PR applied migrations that aren't in this branch. A maintainer can comment \`/db-fix\` to run the repair command printed in the failed log, or \`/db-force-push\` to push with \`--include-all\`, then re-run this workflow."
  fi

  if [[ "$TYPES_RESULT" == "failure" ]]; then
    echo ""
    echo "> ⚠️ **\`src/integrations/supabase/types.ts\` is out of sync with the staging schema.** Regenerate it with \`./scripts/gen-types.sh --local\` (or \`--linked\` after \`supabase link\` to staging) and commit the result."
  fi
} > body.md

EXISTING=$(gh api "repos/$REPO/issues/$PR/comments" --jq ".[] | select(.body | contains(\"$MARKER\")) | .id" | head -n1)

if [[ -n "$EXISTING" ]]; then
  gh api -X PATCH "repos/$REPO/issues/comments/$EXISTING" -F body=@body.md
else
  gh pr comment "$PR" --repo "$REPO" --body-file body.md
fi
