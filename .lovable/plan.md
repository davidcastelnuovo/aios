

## Analysis

The error is: **"Whisper API timed out after 120s"** on a 21.8MB file.

The file is under 25MB, so the code tries to send it directly to Whisper in one shot (line 455-463 in `transcribeBlob`). But 21.8MB of audio is too long for Whisper to process in 120 seconds -- the edge function times out.

There are **two bugs** to fix:

### Bug 1: Direct transcription attempted on files that should be chunked
The threshold for "direct transcription vs chunking" is 25MB, but Whisper's practical limit is ~20MB before it times out. The 21.8MB file falls just under 25MB but is too large for direct transcription within the 120s timeout. The solution: lower the direct transcription threshold, or better yet, **always use download+chunking for files above ~15MB**.

### Bug 2: `recordingType` variable out of scope
Line 448 references `recordingType` inside `transcribeBlob()`, but that variable is only defined in the main handler scope. This would cause a runtime error in download mode.

## Plan

### 1. Fix `transcribe-recording/index.ts`
- **Pass `recordingType` as a parameter** to `transcribeBlob()` (fix the scoping bug on line 448)
- **Lower the direct-transcription threshold** from 25MB to 15MB. Files between 15-25MB will return `file_too_large` to trigger client-side chunking, which is more reliable than trying to send a 20MB+ file to Whisper in one call
- This means the 21.8MB file will now follow the chunking path instead of timing out

### 2. Fix `SummarizeRecordingDialog.tsx` error handling
- Line 305: when the edge function returns a 500 with `{"error":"Whisper API timed out after 120s"}`, `supabase.functions.invoke` treats non-2xx as an error, so `data` may be null and `error` is set. The current code checks `error.message` for timeout keywords but the actual message is `"Edge Function returned a non-2xx status code"` -- need to also catch this pattern and fall back to chunking mode instead of showing a generic error
- Add logic: if the error mentions "non-2xx" or the data contains a timeout error, attempt download+chunking automatically

### Files to change
1. `supabase/functions/transcribe-recording/index.ts` -- fix `recordingType` scope, lower threshold to 15MB
2. `src/components/SummarizeRecordingDialog.tsx` -- improve error handling to auto-retry via chunking on timeout errors

