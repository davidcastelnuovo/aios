import assert from "node:assert/strict";
import test from "node:test";
import type { StoryboardFrame } from "./types.ts";
import {
  elevenLabsAspect,
  elevenLabsClipSeconds,
  getSceneEngine,
  getSoundEngine,
  musicEstimate,
  sceneClipSeconds,
  sceneEstimate,
  soundRunsSeparately,
  framesToVoice,
  voiceEstimate,
} from "./videoEngines.ts";

const frame = (overrides: Partial<StoryboardFrame> = {}): StoryboardFrame => ({
  id: "a",
  order: 1,
  title: "סצנה",
  shot: "Medium shot",
  visualPrompt: "",
  overlayText: "",
  voiceover: "",
  duration: 3,
  x: 0,
  y: 100,
  ...overrides,
});

test("an unset scene engine stays on the free preview", () => {
  assert.equal(getSceneEngine(null), "mock");
  assert.equal(getSceneEngine({ video: { scene_engine: "nope" } }), "mock");
  assert.equal(
    getSceneEngine({ video: { scene_engine: "higgsfield" } }),
    "higgsfield",
  );
  assert.equal(getSoundEngine({}), "elevenlabs");
});

test("each engine bills the clip length its API actually renders", () => {
  assert.equal(elevenLabsClipSeconds(3), 4);
  assert.equal(elevenLabsClipSeconds(5), 6);
  assert.equal(elevenLabsClipSeconds(8), 8);
  assert.equal(sceneClipSeconds("kling", 3), 5);
  assert.equal(sceneClipSeconds("kling", 8), 10);
  assert.equal(sceneClipSeconds("higgsfield", 3.2), 4);
  assert.equal(sceneClipSeconds("higgsfield", 40), 15);
  assert.equal(elevenLabsAspect("16:9"), "16:9");
  assert.equal(elevenLabsAspect("1:1"), "9:16");
});

test("the free preview estimates zero and paid engines follow their rate", () => {
  const frames = [frame({ duration: 3 }), frame({ duration: 8 })];
  assert.equal(sceneEstimate("mock", frames).usd, 0);
  assert.deepEqual(sceneEstimate("kling", frames), {
    count: 2,
    seconds: 15,
    usd: 2.55,
    credits: 15300,
    label: "Kling",
  });
  assert.equal(sceneEstimate("elevenlabs", frames).seconds, 12);
  assert.equal(sceneEstimate("elevenlabs", frames).usd, 1.8);
  assert.equal(sceneEstimate("higgsfield", frames).seconds, 11);
  assert.equal(sceneEstimate("higgsfield", frames).usd, 1.1);
});

test("voice bills the spoken characters and music bills the storyboard length", () => {
  const frames = [
    frame({ voiceover: "א".repeat(1000), duration: 4 }),
    frame({ voiceover: "   ", duration: 6 }),
  ];
  assert.equal(voiceEstimate(frames).count, 1);
  assert.deepEqual(
    framesToVoice([
      frame({
        id: "a",
        voiceover: "אחת",
        voiceAssetId: "v",
        voiceText: "אחת",
      }),
      frame({
        id: "b",
        voiceover: "שתיים",
        voiceAssetId: "v",
        voiceText: "ישנה",
      }),
    ]).map((item) => item.id),
    ["a", "b"],
  );
  assert.equal(voiceEstimate(frames).usd, 0.12);
  assert.equal(musicEstimate(frames).seconds, 10);
  assert.equal(musicEstimate(frames).usd, 0.08);
  assert.equal(soundRunsSeparately("elevenlabs"), true);
  assert.equal(soundRunsSeparately("higgsfield", "higgsfield"), false);
  // Higgsfield sound only exists inside Higgsfield clips: other engines still need voice.
  assert.equal(soundRunsSeparately("higgsfield", "kling"), true);
});
