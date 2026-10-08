#!/bin/bash

# Generate Supabase TypeScript types for the app.
# Pass --local to generate from the local database (supabase start).
# Pass --linked to generate from the project the Supabase CLI is linked to
# (e.g. staging, after `supabase link`). CI uses --linked against staging.

set -euo pipefail

APP_TYPES="src/integrations/supabase/types.ts"

case "${1:-}" in
  --local)  supabase gen types typescript --local > "$APP_TYPES" ;;
  --linked) supabase gen types typescript --linked > "$APP_TYPES" ;;
  *) echo "Usage: $0 --local|--linked" >&2; exit 1 ;;
esac
