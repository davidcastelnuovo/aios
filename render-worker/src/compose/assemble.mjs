import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { probe } from "../ffmpeg.mjs";

const ffmpeg = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-600)}`)),
    );
  });

const FONT = () =>
  process.env.OVERLAY_FONT ||
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

/** Breaks overlay text into lines of about maxChars at spaces (drawtext does not wrap). */
export function wrapOverlay(text, maxChars = 22) {
  const lines = [];
  for (const paragraph of String(text ?? "").split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && line.length + 1 + word.length > maxChars) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
  }
  return lines.slice(0, 4).join("\n");
}

/**
 * drawtext filters for the scene title, one per line so every line is centred (drawtext
 * aligns multi-line text to the left, which looks wrong for Hebrew). Each line is read
 * from a file so nothing needs escaping; fribidi in ffmpeg orders the Hebrew.
 */
export function overlayFilters(lineFiles, fontFile = FONT()) {
  const count = lineFiles.length;
  return lineFiles.map((file, index) =>
    [
      `drawtext=textfile='${file}'`,
      `fontfile='${fontFile}'`,
      "fontsize=h/20",
      "fontcolor=white",
      "box=1",
      "boxcolor=black@0.45",
      "boxborderw=18",
      "x=(w-text_w)/2",
      `y=h-h/9-${count - index}*h/20*1.5`,
    ].join(":"),
  );
}

/** One scene: the clip, fitted to the frame, with its title, and the voiceover (or silence). */
async function segment(timeline, scene, index, dir) {
  const output = join(dir, `seg-${index}.mp4`);
  const duration = scene.durationS.toFixed(3);
  const fitted = join(dir, `fit-${index}.mp4`);
  const filters = [
    `scale=${timeline.width}:${timeline.height}:force_original_aspect_ratio=increase,crop=${timeline.width}:${timeline.height}`,
    // Providers cap clips at 5–15 s while a scene may run longer: hold the last frame.
    `tpad=stop_mode=clone:stop_duration=${duration}`,
  ];
  const lines = wrapOverlay(scene.overlayText).split("\n").filter(Boolean);
  const lineFiles = [];
  for (const [line, text] of lines.entries()) {
    const file = join(dir, `title-${index}-${line}.txt`);
    await writeFile(file, text);
    lineFiles.push(file);
  }
  filters.push(...overlayFilters(lineFiles));
  await ffmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    scene.clipPath,
    "-t",
    duration,
    "-vf",
    filters.join(","),
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(timeline.fps),
    fitted,
  ]);
  // Voiceover first; otherwise the clip's own sound (engines that generate audio), else silence.
  const clipHasAudio =
    !scene.voicePath &&
    (await probe(scene.clipPath).catch(() => null))?.hasAudio;
  const audioArgs = scene.voicePath
    ? ["-i", scene.voicePath]
    : clipHasAudio
      ? ["-i", scene.clipPath]
      : [
          "-f",
          "lavfi",
          "-i",
          "anullsrc=channel_layout=stereo:sample_rate=48000",
        ];
  await ffmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    fitted,
    ...audioArgs,
    "-filter_complex",
    // Every segment gets the same audio layout (stereo 48 kHz), so the stream copy in the
    // concat step never joins mono voice segments with stereo silent ones.
    `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,apad,atrim=0:${duration},asetpts=PTS-STARTPTS[a]`,
    "-map",
    "0:v",
    "-map",
    "[a]",
    "-t",
    duration,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-shortest",
    output,
  ]);
  return output;
}

/** Concatenates the segments and lays the music bed under the voice. */
export async function assembleFilm(timeline, outputPath) {
  if (!timeline.scenes.length) throw new Error("render: no approved clips");
  const dir = join(outputPath, "..", "segments");
  await mkdir(dir, { recursive: true });
  const segments = [];
  for (const [index, scene] of timeline.scenes.entries()) {
    segments.push(await segment(timeline, scene, index, dir));
  }
  const list = join(dir, "list.txt");
  await writeFile(
    list,
    segments
      .map((file) => `file '${file.replaceAll("'", "'\\''")}'`)
      .join("\n"),
  );
  const picture = join(dir, "picture.mp4");
  await ffmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    "-c",
    "copy",
    picture,
  ]);
  if (!timeline.narrationPath && !timeline.musicPath) {
    await ffmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      picture,
      "-c",
      "copy",
      outputPath,
    ]);
    return outputPath;
  }
  const duration = Number(timeline.totalS || 0).toFixed(3);
  const inputs = ["-i", picture];
  const filters = [];
  const beds = [];
  if (timeline.narrationPath) {
    inputs.push("-i", timeline.narrationPath);
    filters.push(
      `[${beds.length + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,apad,atrim=0:${duration},volume=1[n]`,
    );
    beds.push("[n]");
  }
  if (timeline.musicPath) {
    inputs.push("-i", timeline.musicPath);
    filters.push(
      `[${beds.length + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.18[m]`,
    );
    beds.push("[m]");
  }
  await ffmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    ...inputs,
    "-filter_complex",
    `${filters.join(";")};[0:a]${beds.join("")}amix=inputs=${beds.length + 1}:duration=first:dropout_transition=0:normalize=0[a]`,
    "-map",
    "0:v",
    "-map",
    "[a]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    outputPath,
  ]);
  return outputPath;
}
