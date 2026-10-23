import type { ImageGenerationCost } from "./imageCost";
import type { StoryboardFrame, VideoSceneStatus } from "./types";

/** Columns the storyboard editor reads from marketing_video_scenes. */
export const VIDEO_SCENE_COLUMNS =
  "id,item_id,position,title,shot,visual_prompt,overlay_text,voiceover_text,motion_prompt,duration_s,still_asset_id,clip_asset_id,voice_asset_id,clip_stale,status,locked,meta";

export interface VideoSceneRecord {
  id: string;
  item_id: string;
  position: number | string;
  title: string;
  shot: string;
  visual_prompt: string;
  overlay_text: string;
  voiceover_text: string;
  motion_prompt?: string;
  duration_s: number | string;
  still_asset_id: string | null;
  clip_asset_id?: string | null;
  voice_asset_id?: string | null;
  clip_stale?: boolean;
  status?: VideoSceneStatus;
  locked?: boolean;
  meta: unknown;
}

export interface SceneStillRecord {
  id: string;
  url: string | null;
  meta: unknown;
}

/** One scene as sent to save_video_storyboard. */
export interface VideoSceneInput {
  id: string;
  position: number;
  title: string;
  shot: string;
  visual_prompt: string;
  overlay_text: string;
  voiceover_text: string;
  motion_prompt: string;
  duration_s: number;
  canvas: { x: number; y: number };
  locked: boolean;
  has_character: boolean;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const finiteOr = (value: unknown, fallback: number) => {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) ? number : fallback;
};

const generationCostOf = (meta: unknown): ImageGenerationCost | undefined => {
  const cost = asRecord(meta).generation_cost;
  return cost && typeof cost === "object"
    ? (cost as ImageGenerationCost)
    : undefined;
};

/** Scene rows (any order) → editor frames ordered by position, with the current still and clip attached. */
export function scenesToFrames(
  rows: VideoSceneRecord[],
  assetsById: Map<string, SceneStillRecord>,
  defaultX: (order: number) => number,
): StoryboardFrame[] {
  return [...rows]
    .sort((a, b) => finiteOr(a.position, 0) - finiteOr(b.position, 0))
    .map((row, index) => {
      const order = index + 1;
      const still = row.still_asset_id
        ? assetsById.get(row.still_asset_id)
        : undefined;
      const clip = row.clip_asset_id
        ? assetsById.get(row.clip_asset_id)
        : undefined;
      const canvas = asRecord(asRecord(row.meta).canvas);
      const frame: StoryboardFrame = {
        id: row.id,
        order,
        title: row.title,
        shot: row.shot,
        visualPrompt: row.visual_prompt,
        overlayText: row.overlay_text,
        voiceover: row.voiceover_text,
        motionPrompt: row.motion_prompt ?? "",
        duration: finiteOr(row.duration_s, 3),
        x: finiteOr(canvas.x, defaultX(order)),
        y: finiteOr(canvas.y, 100),
      };
      if (row.status) frame.status = row.status;
      frame.locked = row.locked === true;
      frame.hasCharacter = asRecord(row.meta).has_character !== false;
      if (row.still_asset_id) frame.stillAssetId = row.still_asset_id;
      if (still?.url) frame.imageUrl = still.url;
      if (row.clip_asset_id) frame.clipAssetId = row.clip_asset_id;
      if (clip?.url) frame.clipPath = clip.url;
      if (row.clip_stale) frame.clipStale = true;
      if (row.voice_asset_id) {
        frame.voiceAssetId = row.voice_asset_id;
        const voiceMeta = asRecord(assetsById.get(row.voice_asset_id)?.meta);
        const line = asRecord(voiceMeta.lines)[row.id];
        const spoken = typeof line === "string" ? line : voiceMeta.text;
        if (typeof spoken === "string") frame.voiceText = spoken;
      }
      const cost = generationCostOf(still?.meta);
      if (cost) frame.generationCost = cost;
      return frame;
    });
}

/** Editor frames → save_video_storyboard payload; position follows the frame order. */
export function framesToScenes(frames: StoryboardFrame[]): VideoSceneInput[] {
  return [...frames]
    .sort((a, b) => a.order - b.order)
    .map((frame, index) => ({
      id: frame.id,
      position: index + 1,
      title: frame.title ?? "",
      shot: frame.shot ?? "",
      visual_prompt: frame.visualPrompt ?? "",
      overlay_text: frame.overlayText ?? "",
      voiceover_text: frame.voiceover ?? "",
      motion_prompt: frame.motionPrompt ?? "",
      duration_s: finiteOr(frame.duration, 3),
      canvas: { x: finiteOr(frame.x, 0), y: finiteOr(frame.y, 100) },
      locked: frame.locked === true,
      has_character: frame.hasCharacter !== false,
    }));
}

/**
 * Frames whose picture is not yet the scene's stored still: a freshly generated frame,
 * or a duplicate that carries its source frame's picture.
 */
export function stillsToAttach(
  persistedStills: Map<string, string | undefined>,
  frames: StoryboardFrame[],
): { sceneId: string; imageUrl: string; cost?: ImageGenerationCost }[] {
  return frames
    .filter(
      (frame): frame is StoryboardFrame & { imageUrl: string } =>
        !!frame.imageUrl && persistedStills.get(frame.id) !== frame.imageUrl,
    )
    .map((frame) => ({
      sceneId: frame.id,
      imageUrl: frame.imageUrl,
      cost: frame.generationCost,
    }));
}

/** Scenes the editor loaded that are no longer in the draft; only these are deleted on save. */
export function removedSceneIds(
  loadedIds: Iterable<string>,
  frames: StoryboardFrame[],
): string[] {
  const kept = new Set(frames.map((frame) => frame.id));
  return [...new Set(loadedIds)].filter((id) => !kept.has(id));
}
