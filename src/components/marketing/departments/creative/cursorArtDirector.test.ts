import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCursorArtDirectorLock,
  collectStaticReferencePlan,
  labelStaticRef,
  wantsTalentLock,
  STATIC_CAST_LOCK,
  LOGO_PLACEMENT_LOCK,
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
    projectRefUrls: ["https://talent"],
    techniqueUrl: "https://technique",
    instructions: "תשתמש בדמות מהרפרנס",
  });
  assert.deepEqual(plan.urls, ["https://talent", "https://technique"]);
  assert.equal(plan.role, "talent");
  assert.equal(plan.refs[0].kind, "talent");
  assert.equal(plan.refs[1].kind, "technique");
});

test("without a talent instruction, project refs are style not faces", () => {
  const plan = collectStaticReferencePlan({
    projectRefUrls: ["https://style"],
    techniqueUrl: "https://technique",
    instructions: "",
  });
  assert.deepEqual(plan.urls, ["https://style", "https://technique"]);
  assert.equal(plan.role, "technique");
  assert.equal(plan.refs[0].kind, "style");
  assert.equal(plan.refs[1].kind, "technique");
});

test("revision target is first, then talent, then technique up to three refs", () => {
  const plan = collectStaticReferencePlan({
    projectRefUrls: ["https://talent"],
    techniqueUrl: "https://technique",
    instructions: "תשתמש בדמות מהרפרנס",
    editTargetUrl: "https://ad.png",
  });
  assert.deepEqual(plan.urls, ["https://ad.png", "https://talent", "https://technique"]);
  assert.equal(plan.role, "revision");
});

test("reject director references sit next to the edit target", () => {
  const plan = collectStaticReferencePlan({
    projectRefUrls: ["https://style"],
    directorUrls: ["https://want-this.png"],
    instructions: "",
    editTargetUrl: "https://ad.png",
  });
  assert.deepEqual(plan.urls, ["https://ad.png", "https://want-this.png", "https://style"]);
  assert.equal(plan.role, "revision");
});

test("logo is always attached even when three other refs already fill the slot", () => {
  const plan = collectStaticReferencePlan({
    projectRefUrls: ["https://style"],
    directorUrls: ["https://want-this.png"],
    editTargetUrl: "https://ad.png",
    logoUrl: "https://logo.png",
  });
  assert.equal(plan.refs.some((item) => item.kind === "logo" && item.url === "https://logo.png"), true);
  assert.equal(plan.urls.includes("https://logo.png"), true);
  const labeled = labelStaticRef({ url: "https://logo.png", kind: "logo" }, 0);
  assert.match(labeled, /LOGO 1/);
  assert.match(labeled, /will NOT overlay/i);
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
  assert.match(lock, /LOGO PLACEMENT/i);
  assert.doesNotMatch(lock, /do not paint any letters/i);
  assert.doesNotMatch(lock, /CONCEPT FIRST/);
  assert.doesNotMatch(lock, /STATIC STILL/);
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
  assert.match(lock, /STATIC STILL/);
  assert.doesNotMatch(lock, /SUBJECT FIRST/);
  assert.doesNotMatch(lock, /TALENT LOCK/);
});

test("project style refs are labeled as style, not talent", () => {
  const style = labelStaticRef({ url: "https://example.com/style.jpg", kind: "style" }, 0);
  assert.match(style, /STYLE REFERENCE 1 from project settings/);
  assert.match(style, /palette dominance/);
  assert.doesNotMatch(style, /keep this face/i);
  const talent = labelStaticRef({ url: "https://example.com/face.jpg", kind: "talent" }, 0);
  assert.match(talent, /Talent \/ spokesman 1/);
  assert.match(STATIC_CAST_LOCK, /not a storyboard beat/);
  assert.match(LOGO_PLACEMENT_LOCK, /does NOT overlay/i);
  assert.match(LOGO_PLACEMENT_LOCK, /bottom-corner/i);
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
  assert.match(lock, /LOGO PLACEMENT/);
  assert.match(lock, /paint the real brand logo/i);
});
