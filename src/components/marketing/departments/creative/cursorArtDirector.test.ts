import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCursorArtDirectorLock,
  collectStaticReferencePlan,
  wantsTalentLock,
} from "./cursorArtDirector.ts";

const kit = {
  logoUrl: "https://example.com/logo.png",
  styleReferences: [{ url: "https://example.com/person.jpg", name: "talent" }],
  brandBook: { name: "פרומו", colors: ["#c00000"], notes: "", source: "auto" as const },
};

test("talent lock fires on the Hebrew character instruction", () => {
  assert.equal(wantsTalentLock("תשתמש בדמות מהרפרנס"), true);
  assert.equal(wantsTalentLock("keep the same color grade"), false);
});

test("static refs attach the spokesman first when instructions ask for the character", () => {
  const plan = collectStaticReferencePlan({
    talentUrls: ["https://talent"],
    techniqueUrl: "https://technique",
    instructions: "תשתמש בדמות מהרפרנס",
  });
  assert.deepEqual(plan.urls, ["https://talent", "https://technique"]);
  assert.equal(plan.role, "talent");
});

test("without a talent instruction, only the technique still is sent", () => {
  const plan = collectStaticReferencePlan({
    talentUrls: ["https://talent"],
    techniqueUrl: "https://technique",
    instructions: "",
  });
  assert.deepEqual(plan.urls, ["https://technique"]);
  assert.equal(plan.role, "technique");
});

test("revision target is first, then talent, max two refs", () => {
  const plan = collectStaticReferencePlan({
    talentUrls: ["https://talent"],
    techniqueUrl: "https://technique",
    instructions: "תשתמש בדמות מהרפרנס",
    editTargetUrl: "https://ad.png",
  });
  assert.deepEqual(plan.urls, ["https://ad.png", "https://talent"]);
  assert.equal(plan.role, "revision");
});

test("art director lock paints Hebrew RTL unless live text is on", () => {
  const lock = buildCursorArtDirectorLock({
    format: "1:1",
    instructions: "תשתמש בדמות מהרפרנס",
    kit,
    hasTalentRef: true,
  });
  assert.match(lock, /CURSOR ART DIRECTOR/);
  assert.match(lock, /SUBJECT FIRST/);
  assert.match(lock, /TALENT LOCK/);
  assert.match(lock, /דמות מהרפרנס/);
  assert.match(lock, /paint the quoted Hebrew/i);
  assert.match(lock, /פרומו/);
  assert.doesNotMatch(lock, /do not paint any letters/i);
  assert.doesNotMatch(lock, /CONCEPT FIRST/);
});

test("approved-concept art director lock photographs the concept and types the copy", () => {
  const lock = buildCursorArtDirectorLock({
    format: "1:1",
    instructions: "",
    kit,
    hasApprovedConcept: true,
  });
  assert.match(lock, /CONCEPT FIRST/);
  assert.match(lock, /TYPE on the concept photograph/);
  assert.doesNotMatch(lock, /SUBJECT FIRST/);
});

test("live-text art director lock leaves type as composited RTL", () => {
  const lock = buildCursorArtDirectorLock({
    format: "1:1",
    instructions: "תשתמש בדמות מהרפרנס",
    kit,
    hasTalentRef: true,
    liveTextLayers: true,
  });
  assert.match(lock, /do not paint any letters/i);
  assert.match(lock, /dir=rtl/);
  assert.match(lock, /unicode-bidi:isolate/);
});
