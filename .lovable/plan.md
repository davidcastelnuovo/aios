

## Plan: Change Meeting Summary Output from HTML to DOCX

### Problem
The `summarize-recording` edge function currently generates an HTML file for meeting summaries. You want it as a DOCX (Word document) instead.

### Solution
Modify the `summarize-recording` edge function to generate a DOCX file using the Office Open XML format (a ZIP of XML files). DOCX is essentially a ZIP archive containing XML — we can build it directly in Deno without external libraries.

### Changes

**File: `supabase/functions/summarize-recording/index.ts`**

1. Replace the HTML generation block (lines 149-176) with DOCX generation:
   - Convert the Markdown summary to Office Open XML paragraphs (headings, bold, lists, blockquotes)
   - Build the DOCX ZIP archive using Deno's built-in `JSZip`-compatible approach or raw ZIP construction
   - Use proper RTL and Hebrew font settings in the document

2. Update the upload section (lines 184-191):
   - Change file extension from `.html` to `.docx`
   - Change content type from `text/html` to `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

3. Update the attachment metadata (line 212):
   - Change display name from `.html` to `.docx`

### Technical Detail
A minimal DOCX file consists of:
- `[Content_Types].xml` — declares file types
- `_rels/.rels` — root relationships
- `word/_rels/document.xml.rels` — document relationships
- `word/document.xml` — the actual content with RTL paragraphs
- `word/styles.xml` — heading and list styles

We'll use the `fflate` library (available via esm.sh) to create the ZIP, as it's lightweight and works in Deno.

### Files to Edit
- `supabase/functions/summarize-recording/index.ts`

