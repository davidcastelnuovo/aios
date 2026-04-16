

## Plan: Shorter Share Tokens

### What
Change `generateReadableToken` to produce very short tokens — just the first word of the table name (transliterated), plus a 4-char random suffix. Example: `rave-x7k2` instead of `rvvh-kvlynryh-nvzly-mnbrdbmw`.

### Changes
**File: `src/components/dynamic-tables/ShareTableDialog.tsx`**
- Update `generateReadableToken` to:
  1. Take only the **first word** of the table name
  2. Transliterate Hebrew → English
  3. Truncate to max 8 chars
  4. Append a short 4-char random ID
  - Result: `rave-x7k2`

### Note
Existing old links stay as-is. Only new share links will use the shorter format.

### Question
The second part of your message came through garbled (keyboard layout issue). Can you retype what you meant after "טוב כמהר"?

