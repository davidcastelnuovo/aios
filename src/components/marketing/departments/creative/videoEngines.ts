import type { StoryboardFrame } from "./types";

/** Scene animation engine stored on the video project (`payload.video.scene_engine`). */
export type SceneEngine = "mock" | "kling" | "elevenlabs" | "higgsfield";

/**
 * Sound engine. ElevenLabs writes a separate voiceover and music bed.
 * Higgsfield has no voice or music API; its sound is generated inside the clip.
 */
export type SoundEngine = "elevenlabs" | "higgsfield";

export interface EngineEstimate {
  count: number;
  seconds: number;
  usd: number;
  credits: number;
  label: string;
}

const SCENE_ENGINES: SceneEngine[] = [
  "mock",
  "kling",
  "elevenlabs",
  "higgsfield",
];
const SOUND_ENGINES: SoundEngine[] = ["elevenlabs", "higgsfield"];

export const SCENE_ENGINE_LABEL: Record<SceneEngine, string> = {
  mock: "חינם — תצוגה",
  kling: "Kling",
  elevenlabs: "ElevenLabs",
  higgsfield: "Higgsfield",
};

export const SOUND_ENGINE_LABEL: Record<SoundEngine, string> = {
  elevenlabs: "ElevenLabs — קריינות ומוזיקה",
  higgsfield: "Higgsfield — סאונד בתוך הקליפ",
};

/** Planning rates until the first paid run records the real invoice. */
const KLING_USD_PER_5S = 0.85;
const KLING_CREDITS_PER_5S = 5100;
const ELEVENLABS_VIDEO_USD_PER_SECOND = 0.15;
const HIGGSFIELD_USD_PER_SECOND = 0.1;
const ELEVENLABS_VOICE_USD_PER_1000_CHARS = 0.12;
const ELEVENLABS_MUSIC_USD_PER_MINUTE = 0.5;

const roundUsd = (value: number) => Math.round(value * 100) / 100;

export const isSceneEngine = (value: unknown): value is SceneEngine =>
  SCENE_ENGINES.includes(value as SceneEngine);

export const isSoundEngine = (value: unknown): value is SoundEngine =>
  SOUND_ENGINES.includes(value as SoundEngine);

const videoSettings = (payload: Record<string, unknown> | null | undefined) => {
  const video = payload?.video;
  return video && typeof video === "object"
    ? (video as Record<string, unknown>)
    : {};
};

/** Missing or unknown values stay on the free preview so nothing is billed by surprise. */
export const getSceneEngine = (
  payload: Record<string, unknown> | null | undefined,
): SceneEngine => {
  const engine = videoSettings(payload).scene_engine;
  return isSceneEngine(engine) ? engine : "mock";
};

export const getSoundEngine = (
  payload: Record<string, unknown> | null | undefined,
): SoundEngine => {
  const engine = videoSettings(payload).sound_engine;
  return isSoundEngine(engine) ? engine : "elevenlabs";
};

export const getVoiceId = (
  payload: Record<string, unknown> | null | undefined,
): string | null => {
  const voiceId = videoSettings(payload).voice_id;
  return typeof voiceId === "string" && voiceId.trim() ? voiceId.trim() : null;
};

/** Veo on ElevenLabs only renders 4, 6 or 8 seconds. */
export const elevenLabsClipSeconds = (duration: number) => {
  const seconds = Number(duration) || 5;
  if (seconds <= 4) return 4;
  if (seconds <= 6) return 6;
  return 8;
};

/** Kling and the free preview render a 5 s or 10 s clip. Higgsfield uses the scene length. */
export const sceneClipSeconds = (engine: SceneEngine, duration: number) => {
  if (engine === "elevenlabs") return elevenLabsClipSeconds(duration);
  if (engine === "higgsfield")
    return Math.min(15, Math.max(1, Math.ceil(Number(duration) || 5)));
  return Number(duration) > 5 ? 10 : 5;
};

/** Veo accepts 16:9 and 9:16. Square and 4:5 storyboards render as 9:16. */
export const elevenLabsAspect = (aspect: string) =>
  aspect === "16:9" ? "16:9" : "9:16";

export function sceneEstimate(
  engine: SceneEngine,
  frames: StoryboardFrame[],
): EngineEstimate {
  const seconds = frames.reduce(
    (sum, frame) => sum + sceneClipSeconds(engine, frame.duration),
    0,
  );
  if (engine === "mock") {
    return {
      count: frames.length,
      seconds,
      usd: 0,
      credits: 0,
      label: SCENE_ENGINE_LABEL.mock,
    };
  }
  if (engine === "kling") {
    const blocks = seconds / 5;
    return {
      count: frames.length,
      seconds,
      usd: roundUsd(blocks * KLING_USD_PER_5S),
      credits: blocks * KLING_CREDITS_PER_5S,
      label: SCENE_ENGINE_LABEL.kling,
    };
  }
  const rate =
    engine === "elevenlabs"
      ? ELEVENLABS_VIDEO_USD_PER_SECOND
      : HIGGSFIELD_USD_PER_SECOND;
  return {
    count: frames.length,
    seconds,
    usd: roundUsd(seconds * rate),
    credits: 0,
    label: SCENE_ENGINE_LABEL[engine],
  };
}

/**
 * Scenes that need a (new) voiceover: they have text, and no current voice or one spoken
 * from different text. Unchanged voiceovers are not paid for again.
 */
export const framesToVoice = (frames: StoryboardFrame[]) => {
  const spoken = frames.filter((frame) => frame.voiceover.trim());
  const stale = spoken.some((frame) => {
    const text = frame.voiceover.trim();
    return !frame.voiceAssetId || frame.voiceText !== text;
  });
  // One changed line re-speaks the whole script, so the narration stays one take.
  return stale ? spoken : [];
};

export function voiceEstimate(frames: StoryboardFrame[]): EngineEstimate {
  const spoken = framesToVoice(frames);
  const characters = spoken.reduce(
    (sum, frame) => sum + frame.voiceover.trim().length,
    0,
  );
  return {
    count: spoken.length,
    seconds: spoken.reduce(
      (sum, frame) => sum + (Number(frame.duration) || 0),
      0,
    ),
    usd: roundUsd((characters / 1000) * ELEVENLABS_VOICE_USD_PER_1000_CHARS),
    credits: 0,
    label: "ElevenLabs קריינות",
  };
}

export function musicEstimate(frames: StoryboardFrame[]): EngineEstimate {
  const seconds = frames.reduce(
    (sum, frame) => sum + (Number(frame.duration) || 0),
    0,
  );
  return {
    count: 1,
    seconds,
    usd: roundUsd((seconds / 60) * ELEVENLABS_MUSIC_USD_PER_MINUTE),
    credits: 0,
    label: "ElevenLabs מוזיקה",
  };
}

/**
 * Higgsfield sound is generated inside a Higgsfield clip, so it is not a separate paid job.
 * With any other scene engine the clips carry no sound, so voice and music still run.
 */
export const soundRunsSeparately = (
  engine: SoundEngine,
  sceneEngine: SceneEngine = "higgsfield",
) => engine === "elevenlabs" || sceneEngine !== "higgsfield";
