

# Plan: Support Transcription of Large Zoom Recordings (Up to 2 Hours)

## Problem
Currently, recordings larger than 25MB are rejected with "הקובץ גדול מדי לתמלול אוטומטי" when no smaller audio-only alternative exists. A 2-hour Zoom meeting can easily produce files of 45MB+.

## Current Architecture
1. `transcribe-recording` edge function downloads the file, but rejects files >25MB (`MAX_EDGE_FILE_SIZE`)
2. If a smaller `audio_only` alternative exists in the same meeting, it falls back to that
3. A `mode: 'download'` path exists that uploads to Storage and returns a signed URL for client-side chunking
4. Client-side `transcribeChunked()` in `SummarizeRecordingDialog.tsx` decodes audio with Web Audio API, splits into 8-minute WAV chunks, and sends each to `transcribe-voice` (Whisper)

## Root Cause
When `file_size > MAX_EDGE_FILE_SIZE` and no alternative exists, the function returns `file_too_large` with `no_alternative: true` — it never attempts the `download` mode path. The client sees this as a hard failure.

## Solution

### 1. Backend: Remove hard block for large files in `transcribe-recording`
- When file is too large and no alternative exists, instead of returning an error, switch to `mode: 'download'` flow automatically
- Stream-download the Zoom file directly to Storage (without loading into memory) to handle files up to ~100MB
- Return the signed URL so the client can chunk it

**Key change in `transcribe-recording/index.ts`:**
- When `knownSize > MAX_EDGE_FILE_SIZE` and no smaller alternative: instead of returning error, use streaming upload to Storage, then return signed URL (same as `mode: 'download'` response)
- Same for post-download size check: stream to Storage instead of failing

### 2. Client: Auto-trigger chunked transcription on `file_too_large`
- In `SummarizeRecordingDialog.tsx`, when receiving `file_too_large` (even with `no_alternative`), call `attemptDownloadAndChunk()` with a re-request using `mode: 'download'`
- This is mostly already wired but the `no_alternative` case short-circuits before trying

### 3. Streaming upload to Storage (edge function)
- Use Zoom's download response as a `ReadableStream` and pipe it to Supabase Storage via the Storage API
- This avoids loading the entire file into edge function memory
- Alternative simpler approach: increase the edge function memory tolerance by using chunked fetch (read in 5MB chunks, append to a temporary file)

## Technical Details

**Edge function change** (`transcribe-recording/index.ts`):
- Lines 160-189: Replace the hard `no_alternative` error with streaming-to-Storage logic
- Lines 203-231: Same for post-download size check
- Add a helper `streamToStorage()` that downloads from Zoom URL and uploads to Storage using the Supabase Storage API's `upload` with the stream body

**Client change** (`SummarizeRecordingDialog.tsx`):
- Lines 381-389: Change the `no_alternative` handler to call `attemptDownloadAndChunk` instead of showing a hard error

## Limitations
- Edge function has ~150MB memory and 150s execution time — streaming avoids memory issues but very large files (>100MB) may still timeout during download
- 2-hour meetings typically produce 30-60MB audio files, well within range
- The client-side chunking (Web Audio API decode) may be slow for very large files but works reliably

