

# Plan: Fix Zoom Transcription — Missing Scopes Workaround + Auto Re-fetch

## Root Cause
The error is: **"חיבור Zoom חסר הרשאות cloud recording לקריאת קבצי הקלטה"**

The stored Zoom download URLs (webhook URLs) expire after a few hours. When the self-healing code in `downloadZoomMedia` tries to fetch fresh URLs, it uses the **`meetings/{id}/recordings`** endpoint which requires the `cloud_recording:read:list_recording_files` scope — a scope your Zoom app doesn't have.

However, the **`users/me/recordings`** endpoint (used by `fetch-zoom-recordings`) **works fine** with your current scopes. So the fix is to use that same endpoint as the fallback.

## Changes

### 1. Fix self-healing in `transcribe-recording` edge function
**File:** `supabase/functions/transcribe-recording/index.ts`

In `downloadZoomMedia`, replace the failing `meetings/{id}/recordings` API call with the working `users/me/recordings` approach:
- Use `users/me/recordings` with a date range filter (±1 day around the recording's `start_time`)
- Match by `meeting_id` from the results
- Extract fresh `download_url` from matched recording files
- This uses the same scopes that `fetch-zoom-recordings` already uses successfully

### 2. Add "Re-fetch URLs" button + auto-retry in UI
**File:** `src/components/SummarizeRecordingDialog.tsx`

When transcription fails with the permissions/expired URL error:
- Show a clear error message with a "רענן קישורים ונסה שוב" button
- This button calls `fetch-zoom-recordings` to refresh all URLs in the DB, then retries transcription automatically

### 3. Update `Recordings.tsx` for better UX
**File:** `src/pages/Recordings.tsx`

- Add a small "רענן הקלטות" button that calls `fetch-zoom-recordings` to update stale URLs
- This lets users proactively refresh before attempting transcription

## Technical Detail

The key API change in the self-healing pass:
```text
BEFORE: GET /v2/meetings/{meeting_id}/recordings  (requires cloud_recording:read scope)
AFTER:  GET /v2/users/me/recordings?from=X&to=Y   (already authorized)
        → filter results by meeting_id locally
```

This avoids requiring any Zoom re-connection or scope changes.

