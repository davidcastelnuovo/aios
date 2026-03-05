

## Analysis

The logs confirm the transcription **actually succeeded on the server** (line 3: "✅ Transcription done, length: 23138") but the client received "Failed to fetch" because the HTTP connection timed out after ~2.5 minutes. The Edge Function completed the work, but the result was lost because nothing persisted it.

## Plan: Background Transcription with DB Persistence

### 1. Database Migration — Add transcription columns to `zoom_recordings`
Add columns to persist transcription results:
- `transcription` (text, nullable) — the transcribed text
- `transcription_status` (text, nullable) — `pending`, `processing`, `completed`, `failed`
- `transcription_error` (text, nullable) — error message if failed

### 2. Update `transcribe-recording` Edge Function
- At the start, update `transcription_status = 'processing'` in the DB
- After successful transcription + GPT spelling fix, save the result to `transcription` column and set `transcription_status = 'completed'`
- On any error, set `transcription_status = 'failed'` with `transcription_error`
- Still return the result in the HTTP response (for when the connection survives)

### 3. Update `SummarizeRecordingDialog.tsx` — Polling + Background Support
- After invoking `transcribe-recording`, if the request fails with a network error (timeout), don't show an error toast — instead switch to **polling mode**
- Poll `zoom_recordings` every 5 seconds checking `transcription_status`
- When status becomes `completed`, load the `transcription` text into the textarea
- Show a progress indicator: "התמלול רץ ברקע... ניתן להמשיך לעבוד"
- If the dialog is closed during processing, show a toast "התמלול ממשיך ברקע"
- When re-opening the dialog for a recording with `transcription_status = 'completed'`, auto-populate the transcript

### 4. Recordings List — Show Transcription Status
- In the recordings page, show an indicator if a recording has been transcribed or is currently processing

### Files to Change
- **Migration**: Add columns to `zoom_recordings`
- `supabase/functions/transcribe-recording/index.ts`: Save results to DB
- `src/components/SummarizeRecordingDialog.tsx`: Add polling + background UX
- `src/pages/Recordings.tsx`: Show transcription status badge (minor)

