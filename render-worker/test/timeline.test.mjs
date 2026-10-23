import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { assembleFilm } from "../src/compose/assemble.mjs";
import { buildTimeline } from "../src/compose/timeline.mjs";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

test("buildTimeline keeps approved clips in storyboard order", () => {
  const timeline = buildTimeline(
    [
      {
        id: "b",
        position: 2,
        clipPath: "b.mp4",
        durationS: 2,
        overlayText: "  שלום  ",
      },
      { id: "skip", position: 0, durationS: 9 },
      {
        id: "a",
        position: 1,
        clipPath: "a.mp4",
        voicePath: "a.mp3",
        durationS: 0.1,
      },
    ],
    { aspect: "16:9", musicPath: "bed.mp3" },
  );
  assert.deepEqual(
    timeline.scenes.map((scene) => scene.id),
    ["a", "b"],
  );
  assert.equal(timeline.scenes[0].durationS, 0.5);
  assert.equal(timeline.scenes[0].voicePath, "a.mp3");
  assert.equal(timeline.scenes[1].overlayText, "שלום");
  assert.equal(timeline.totalS, 2.5);
  assert.deepEqual([timeline.width, timeline.height], [1280, 720]);
  assert.equal(timeline.musicPath, "bed.mp3");
  assert.equal(timeline.narrationPath, null);
  assert.equal(timeline.fps, 25);
  const narrated = buildTimeline(
    [
      {
        id: "a",
        position: 1,
        clipPath: "a.mp4",
        voicePath: "scene.mp3",
        durationS: 2,
      },
    ],
    { narrationPath: "narration.mp3" },
  );
  assert.equal(narrated.narrationPath, "narration.mp3");
  assert.equal(narrated.scenes[0].voicePath, null);
});

const media = (args) => {
  const result = spawnSync("ffmpeg", args, { stdio: "ignore" });
  if (result.status !== 0)
    throw new Error(`ffmpeg fixture failed: ${args.join(" ")}`);
};

test(
  "assembleFilm writes an mp4 from the shared timeline",
  { skip: !hasFfmpeg },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "timeline-"));
    try {
      const clip = join(dir, "clip.mp4");
      const music = join(dir, "music.wav");
      const output = join(dir, "film.mp4");
      media([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=320x240:d=1",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        clip,
      ]);
      media([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=1",
        music,
      ]);
      const timeline = buildTimeline(
        [
          {
            id: "a",
            position: 1,
            clipPath: clip,
            durationS: 0.6,
            overlayText: "כותרת",
          },
        ],
        { aspect: "9:16", musicPath: music },
      );
      await assembleFilm(timeline, output);
      const file = await stat(output);
      assert.equal(file.size > 1000, true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);

test(
  "assembleFilm plays one narration across the whole picture",
  { skip: !hasFfmpeg },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "narration-"));
    try {
      const clip = join(dir, "clip.mp4");
      const voice = join(dir, "voice.wav");
      const output = join(dir, "film.mp4");
      media([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=320x240:d=1",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        clip,
      ]);
      media([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=1",
        voice,
      ]);
      await assembleFilm(
        buildTimeline(
          [{ id: "a", position: 1, clipPath: clip, durationS: 0.8 }],
          { narrationPath: voice },
        ),
        output,
      );
      const detected = spawnSync(
        "ffmpeg",
        ["-i", output, "-af", "volumedetect", "-f", "null", "-"],
        { encoding: "utf8" },
      );
      const mean = Number(
        detected.stderr.match(/mean_volume:\s*(-?[0-9.]+) dB/)?.[1],
      );
      assert.ok(mean > -45, detected.stderr.slice(-400));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
