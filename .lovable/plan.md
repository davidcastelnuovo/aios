

# Plan: Fix Lead Pull Query in Flow Trigger

## Problem
The "Pull Leads" button shows "No leads found" even though leads exist in the database with matching `Facebook Form: {formId}` in their notes. The issue is likely with the Supabase `.or()` filter syntax — the `%` wildcard characters inside `.or()` raw PostgREST filter strings may not be handled correctly.

## Evidence
- DB has 3 leads with `Facebook Form: 1952043998852618` in notes for the correct tenant
- Direct SQL query finds them fine
- The `.or()` method in Supabase JS uses raw PostgREST syntax where `%` handling can be inconsistent

## Fix

### File: `src/components/automations/StepConfigPanel.tsx`

Replace the `.or()` filter with `.ilike()` on the notes column using a single broader pattern that covers both formats:

```typescript
// Before (line 1424):
.or(`notes.ilike.%Form ID: ${formId}%,notes.ilike.%Facebook Form: ${formId}%`)

// After:
.ilike("notes", `%${formId}%`)
```

This simpler approach just searches for the form ID anywhere in notes, which is sufficient since form IDs are unique numeric identifiers that won't produce false matches. This avoids any `.or()` PostgREST syntax issues entirely.

Also add a console.log for debugging if zero results, so future issues are traceable.

