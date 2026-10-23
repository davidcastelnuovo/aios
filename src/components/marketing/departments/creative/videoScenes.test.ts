import assert from "node:assert/strict";
import test from "node:test";
import {
  framesToScenes,
  removedSceneIds,
  scenesToFrames,
  stillsToAttach,
  type VideoSceneRecord,
} from "./videoScenes.ts";

const defaultX = (order: number) => (1 - order) * 300;

const row = (overrides: Partial<VideoSceneRecord>): VideoSceneRecord => ({
  id: "a",
  item_id: "item",
  position: 1,
  title: "סצנה",
  shot: "Medium shot",
  visual_prompt: "",
  overlay_text: "",
  voiceover_text: "",
  duration_s: 3,
  still_asset_id: null,
  meta: {},
  ...overrides,
});

test("scenes become frames ordered by position, with the current still and its cost", () => {
  const frames = scenesToFrames(
    [
      row({
        id: "b",
        position: "2.5",
        title: "B",
        duration_s: "4.00",
        still_asset_id: "s1",
        meta: { canvas: { x: -300, y: 120 } },
      }),
      row({
        id: "a",
        position: 1,
        title: "A",
        visual_prompt: "p",
        overlay_text: "o",
        voiceover_text: "v",
      }),
    ],
    new Map([
      [
        "s1",
        {
          id: "s1",
          url: "https://x/b.png",
          meta: { generation_cost: { costUsd: 0.05 } },
        },
      ],
    ]),
    defaultX,
  );
  assert.deepEqual(
    frames.map((frame) => [frame.id, frame.order, frame.x, frame.y]),
    [
      ["a", 1, 0, 100],
      ["b", 2, -300, 120],
    ],
  );
  assert.equal(frames[0].visualPrompt, "p");
  assert.equal(frames[0].overlayText, "o");
  assert.equal(frames[0].voiceover, "v");
  assert.equal(frames[0].imageUrl, undefined);
  assert.equal(frames[1].duration, 4);
  assert.equal(frames[1].imageUrl, "https://x/b.png");
  assert.equal(frames[1].generationCost?.costUsd, 0.05);
});

test("a continuous narration keeps each scene's own spoken line", () => {
  const [frame] = scenesToFrames(
    [row({ id: "a", voiceover_text: "אחת", voice_asset_id: "voice" })],
    new Map([
      [
        "voice",
        {
          id: "voice",
          url: "narration.mp3",
          meta: { text: "אחת שתיים", lines: { a: "אחת" } },
        },
      ],
    ]),
    defaultX,
  );
  assert.equal(frame.voiceText, "אחת");
});

test("a missing still row leaves the frame without a picture", () => {
  const [frame] = scenesToFrames(
    [row({ still_asset_id: "gone" })],
    new Map(),
    defaultX,
  );
  assert.equal(frame.imageUrl, undefined);
  assert.equal("imageUrl" in frame, false);
});

test("frames save in frame order with 1-based positions and canvas", () => {
  const scenes = framesToScenes([
    {
      id: "b",
      order: 2,
      title: "B",
      shot: "POV",
      visualPrompt: "vb",
      overlayText: "",
      voiceover: "",
      duration: 5,
      x: -300,
      y: 100,
    },
    {
      id: "a",
      order: 1,
      title: "A",
      shot: "Close-up",
      visualPrompt: "va",
      overlayText: "t",
      voiceover: "w",
      duration: 3,
      x: 0,
      y: 100,
      imageUrl: "u",
    },
  ]);
  assert.deepEqual(scenes, [
    {
      id: "a",
      position: 1,
      title: "A",
      shot: "Close-up",
      visual_prompt: "va",
      overlay_text: "t",
      voiceover_text: "w",
      motion_prompt: "",
      duration_s: 3,
      canvas: { x: 0, y: 100 },
      locked: false,
      has_character: true,
    },
    {
      id: "b",
      position: 2,
      title: "B",
      shot: "POV",
      visual_prompt: "vb",
      overlay_text: "",
      voiceover_text: "",
      motion_prompt: "",
      duration_s: 5,
      canvas: { x: -300, y: 100 },
      locked: false,
      has_character: true,
    },
  ]);
});

test("only loaded scenes missing from the draft are removed", () => {
  const frames = [{ id: "a" }, { id: "new" }] as Parameters<
    typeof removedSceneIds
  >[1];
  assert.deepEqual(removedSceneIds(["a", "b", "b"], frames), ["b"]);
  assert.deepEqual(removedSceneIds([], frames), []);
});

test("stills attach for new pictures and duplicates, not for unchanged ones", () => {
  const persisted = new Map<string, string | undefined>([
    ["a", "https://x/a.png"],
    ["b", undefined],
  ]);
  const frames = [
    { id: "a", imageUrl: "https://x/a.png" },
    {
      id: "b",
      imageUrl: "https://x/b-new.png",
      generationCost: { costUsd: 0.04 },
    },
    { id: "copy-of-a", imageUrl: "https://x/a.png" },
    { id: "c" },
  ] as Parameters<typeof stillsToAttach>[1];
  assert.deepEqual(
    stillsToAttach(persisted, frames).map((still) => [
      still.sceneId,
      still.imageUrl,
      still.cost?.costUsd,
    ]),
    [
      ["b", "https://x/b-new.png", 0.04],
      ["copy-of-a", "https://x/a.png", undefined],
    ],
  );
});
