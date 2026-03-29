

## Fix: Remove orphaned code in `trigger-automation/index.ts`

Same pattern as the previous fixes in `signup-tenant` and `test-facebook-lead-webhook` — lines 1319-1324 contain orphaned object properties from a deleted `console.log` call, causing a parse error that blocks deployment.

### Plan

**Step 1: Remove orphaned lines 1319-1324** in `supabase/functions/trigger-automation/index.ts`
Delete the dangling object literal (lines 1319-1324: `tenantId, contactType, contactRecordId...`). These are leftover debug code without a wrapping statement.

**Step 2: Deploy `trigger-automation`**
Re-deploy the edge function after the fix.

