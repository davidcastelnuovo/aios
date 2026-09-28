#!/usr/bin/env bash
# Run locally (David's machine or any gh login with repo create scope).
set -euo pipefail

REPO="${1:-woodhill-web}"
OWNER="${2:-davidcastelnuovo}"

if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

if gh repo view "${OWNER}/${REPO}" >/dev/null 2>&1; then
  echo "Repo ${OWNER}/${REPO} already exists."
else
  gh repo create "${OWNER}/${REPO}" --private --description "Clean JS rebuild of woodhill.co.il"
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${OWNER}/${REPO}.git"
git push -u origin HEAD:main

echo ""
echo "Done: https://github.com/${OWNER}/${REPO}"
echo "Vercel: New Project → Import → ${OWNER}/${REPO} (Vite, output dist)"
