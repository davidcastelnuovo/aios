import assert from "node:assert/strict";
import test from "node:test";
import { buildStyleContinuityLock, isTypePlate, missingCopyBlocks, usesIntegratedType } from "./styleContinuity.ts";

test("missingCopyBlocks skips the approved card and existing live keys", () => {
  const blocks = [
    { key: "1", index: 1, label: "וריאציה 1", text: "א", parts: {} },
    { key: "2", index: 2, label: "וריאציה 2", text: "ב", parts: {} },
    { key: "3", index: 3, label: "וריאציה 3", text: "ג", parts: {} },
  ];
  const missing = missingCopyBlocks(blocks, [
    { id: "a", name: "1", imageUrl: "", format: "1:1", layers: [], comments: [], createdAt: "", copyKey: "1" },
    { id: "b", name: "2", imageUrl: "", format: "1:1", layers: [], comments: [], createdAt: "", copyKey: "2", rejected: true },
  ], { id: "a", copyKey: "1" });
  assert.deepEqual(missing.map((block) => block.key), ["2", "3"]);
});

test("integrated type means no caption plate under the lockup", () => {
  assert.equal(isTypePlate({ id: "1", type: "shape", x: 0, y: 0, width: 100, height: 22, fill: "#fff" }), true);
  assert.equal(isTypePlate({ id: "2", type: "shape", x: 70, y: 40, width: 16, height: 1.1, fill: "#f00" }), false);
  assert.equal(usesIntegratedType({
    compositionId: "flush",
    layers: [{ id: "1", type: "text", x: 6, y: 8, width: 80, height: 20, text: "הלקוח מחפש המלצה" }],
  }), true);
  assert.equal(usesIntegratedType({
    compositionId: "rail",
    layers: [{ id: "1", type: "shape", x: 68, y: 0, width: 32, height: 100, fill: "#111" }],
  }), false);
});

test("style continuity lock keeps the campaign look and changes the copy beat", () => {
  const lock = buildStyleContinuityLock({
    sourceLabel: "וריאציה 3 · מגולל לצ'אט",
    sourceIdea: "עדיין מגלגל בטיקטוק?",
  });
  assert.match(lock, /CAMPAIGN STYLE LOCK/i);
  assert.match(lock, /מגולל לצ'אט/);
  assert.match(lock, /approved still/i);
  assert.match(lock, /No caption plates/i);
  assert.match(lock, /new copy idea/i);
});
