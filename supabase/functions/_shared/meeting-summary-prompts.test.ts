import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExtractionSystemPrompt,
  buildSummaryUserPrompt,
  LONG_TRANSCRIPT_THRESHOLD,
  MEETING_SUMMARY_SYSTEM_PROMPT,
  prepareDetailedSummarySource,
  splitTranscript,
  TRANSCRIPT_CHUNK_SIZE,
} from "./meeting-summary-prompts.ts";

test("long transcripts are split on speaker-line boundaries without losing content", () => {
  const lines = Array.from(
    { length: 900 },
    (_, index) => `[${String(index).padStart(4, "0")}] דובר: פרט אופרטיבי ${index}`,
  );
  const transcript = lines.join("\n");
  assert.ok(transcript.length > LONG_TRANSCRIPT_THRESHOLD);

  const chunks = splitTranscript(transcript);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= TRANSCRIPT_CHUNK_SIZE));
  assert.equal(chunks.join("\n"), transcript);
});

test("summary prompt requires exhaustive detail and forbids inferred deadlines", () => {
  assert.match(MEETING_SUMMARY_SYSTEM_PROMPT, /שמור כל פרט אופרטיבי מהותי/);
  assert.match(MEETING_SUMMARY_SYSTEM_PROMPT, /אל תהפוך תאריך פגישה.*לדדליין/);
  assert.match(MEETING_SUMMARY_SYSTEM_PROMPT, /שאלות פתוחות ונושאים להכרעה/);
  assert.match(MEETING_SUMMARY_SYSTEM_PROMPT, /לעולם אל תשלים אותם לפי ההיגיון/);
});

test("extraction and synthesis prompts preserve source context and user focus", () => {
  const extractionPrompt = buildExtractionSystemPrompt(2, 4);
  assert.match(extractionPrompt, /חלק 2 מתוך 4/);
  assert.match(extractionPrompt, /כל משימה או התחייבות/);
  assert.match(extractionPrompt, /אל תסיק דדליין מתאריך אחר/);

  const userPrompt = buildSummaryUserPrompt(
    "דוד: לבדוק את מקור הלידים",
    "נושא הפגישה: קמפיינים",
    "\nדגש: משימות",
  );
  assert.match(userPrompt, /נושא הפגישה: קמפיינים/);
  assert.match(userPrompt, /דוד: לבדוק את מקור הלידים/);
  assert.match(userPrompt, /דגש: משימות/);
});

test("long meetings run a complete extraction pass before final synthesis", async () => {
  const transcript = Array.from(
    { length: 900 },
    (_, index) => `[${index}] דובר: נושא ${index}`,
  ).join("\n");
  const calls: Array<{ system: string; user: string; maxTokens: number }> = [];

  const source = await prepareDetailedSummarySource(
    transcript,
    async (system, user, maxTokens) => {
      calls.push({ system, user, maxTokens });
      return `ממצאים ${calls.length}`;
    },
  );

  assert.ok(calls.length > 1);
  assert.ok(calls.every((call) => call.maxTokens === 4_000));
  assert.match(calls[0].system, /שלב חילוץ עובדות/);
  assert.match(calls.at(-1)!.user, new RegExp(`חלק ${calls.length} מתוך ${calls.length}`));
  assert.match(source, /### ממצאים מחלק 1\nממצאים 1/);
  assert.match(source, new RegExp(`### ממצאים מחלק ${calls.length}\\nממצאים ${calls.length}`));
});
