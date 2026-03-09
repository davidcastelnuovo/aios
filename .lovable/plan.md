

# Plan: Add Media URL (YouTube/File Link) to WhatsApp Automation Messages

## Overview
Add an optional field in the Green API WhatsApp step configuration to attach a URL (YouTube link, image URL, file URL) that will be sent alongside the message. Green API supports `sendFileByUrl` endpoint for this purpose.

## Changes

### 1. Frontend: `src/components/automations/StepConfigPanel.tsx`
Add a new optional "קישור מדיה" (Media URL) input field in the `GreenAPIActionConfig` component, below the message template section (after line ~718):

- Input field for `media_url` with placeholder "https://youtube.com/... או קישור לקובץ"
- Optional caption field `media_caption` (uses the message template as caption if empty)
- Radio toggle for media type: "קישור" (URL) / "ללא" (none) - default "none"
- Support `{{variables}}` in the media_url field too (e.g., dynamic links)

### 2. Backend: `supabase/functions/trigger-automation/index.ts`
Update `executeGreenApiMessage` function (line ~1884-2060):

- After sending the text message, check if `config.media_url` is set
- If set, replace template variables in the URL
- Call Green API's `sendFileByUrl` endpoint:
  ```
  POST /waInstance{id}/sendFileByUrl/{token}
  { chatId, urlFile, fileName, caption }
  ```
- This sends the YouTube link as a rich preview or the file as an attachment

### 3. Technical Details

**Green API `sendFileByUrl` endpoint:**
```json
{
  "chatId": "972501234567@c.us",
  "urlFile": "https://www.youtube.com/watch?v=...",
  "fileName": "video.mp4",
  "caption": "Optional caption text"
}
```

For YouTube links specifically: WhatsApp itself generates the preview when a URL is included in the message text. So we have two approaches:
- **Simple**: Just append the URL to the message text — WhatsApp generates a link preview automatically
- **File**: Use `sendFileByUrl` for actual file URLs (images, PDFs, etc.)

The UI will offer both options via the media type toggle.

### Files to edit:
- `src/components/automations/StepConfigPanel.tsx` — add media URL input in GreenAPIActionConfig
- `supabase/functions/trigger-automation/index.ts` — handle media_url in executeGreenApiMessage

