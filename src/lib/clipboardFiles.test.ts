import assert from "node:assert/strict";
import test from "node:test";
import {
  claimClipboardPaste,
  filesFromClipboardData,
  isClipboardTypingTarget,
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
