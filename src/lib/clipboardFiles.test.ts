import assert from "node:assert/strict";
import test from "node:test";
import {
  claimClipboardPaste,
  filesFromClipboardData,
  isClipboardImage,
  isClipboardTypingTarget,
  isFilePasteField,
  shouldUploadClipboardPaste,
} from "./clipboardFiles.ts";

test("filesFromClipboardData reads screenshot blobs from items", () => {
  const blob = new File([new Uint8Array([1, 2, 3])], "", { type: "image/png" });
  const files = filesFromClipboardData({
    items: [{ kind: "file", getAsFile: () => blob }],
  });
  assert.equal(files.length, 1);
  assert.equal(files[0].type, "image/png");
  assert.equal(files[0].name, "screenshot.png");
});

test("filesFromClipboardData keeps a real filename and de-dupes files list", () => {
  const file = new File([new Uint8Array([9])], "brief.pdf", { type: "application/pdf", lastModified: 1 });
  const files = filesFromClipboardData({
    items: [{ kind: "file", getAsFile: () => file }],
    files: [file],
  });
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "brief.pdf");
});

test("claimClipboardPaste de-dupes the same tick", () => {
  assert.equal(claimClipboardPaste(), true);
  assert.equal(claimClipboardPaste(), false);
});

test("isClipboardTypingTarget skips inputs and textareas but not the files cube", () => {
  assert.equal(isClipboardTypingTarget({ tagName: "INPUT" } as EventTarget), true);
  assert.equal(isClipboardTypingTarget({ tagName: "TEXTAREA" } as EventTarget), true);
  assert.equal(isClipboardTypingTarget({ tagName: "DIV", isContentEditable: false } as EventTarget), false);
  assert.equal(isClipboardTypingTarget({ tagName: "BUTTON" } as EventTarget), false);
});

test("file paste field accepts Ctrl+V even though it is a textarea", () => {
  const field = {
    tagName: "TEXTAREA",
    dataset: { filePaste: "true" },
  } as unknown as EventTarget;
  assert.equal(isFilePasteField(field), true);
  assert.equal(isClipboardTypingTarget(field), false);
});

test("isClipboardImage treats screenshot names as images", () => {
  assert.equal(isClipboardImage(new File([new Uint8Array([1])], "screenshot.png", { type: "" })), true);
  assert.equal(isClipboardImage(new File([new Uint8Array([1])], "brief.pdf", { type: "application/pdf" })), false);
});

test("notes paste keeps text and pulls images into files", () => {
  const notes = { tagName: "TEXTAREA" } as EventTarget;
  const image = new File([new Uint8Array([1])], "screenshot.png", { type: "image/png" });
  const pdf = new File([new Uint8Array([1])], "brief.pdf", { type: "application/pdf" });
  assert.equal(shouldUploadClipboardPaste(notes, [image]), true);
  assert.equal(shouldUploadClipboardPaste(notes, [pdf]), false);
  assert.equal(shouldUploadClipboardPaste(notes, []), false);
});

test("filesFromClipboardData reads an image item that is not marked as a file", () => {
  const blob = new File([new Uint8Array([4])], "shot.png", { type: "image/png" });
  const files = filesFromClipboardData({
    items: [{ kind: "string", type: "image/png", getAsFile: () => blob }],
  });
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "shot.png");
});
