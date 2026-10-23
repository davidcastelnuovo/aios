/** The edit decision list the ffmpeg assembly renders. */

export const FRAME_SIZE = {
  "16:9": [1280, 720],
  "9:16": [720, 1280],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
};

export const frameSize = (aspect) => FRAME_SIZE[aspect] ?? FRAME_SIZE["9:16"];

/**
 * Approved scenes, in storyboard order. A scene without a clip is skipped.
 * Duration is the scene length the editor saved, not the provider clip length.
 */
export function buildTimeline(
  scenes,
  { aspect = "9:16", musicPath = null, narrationPath = null } = {},
) {
  const narration = narrationPath || null;
  const frames = [...scenes]
    .filter((scene) => scene.clipPath)
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((scene) => ({
      id: scene.id,
      clipPath: scene.clipPath,
      // A continuous narration plays across the whole film, not inside each scene.
      voicePath: narration ? null : scene.voicePath || null,
      overlayText: String(scene.overlayText ?? "").trim(),
      durationS: Math.min(120, Math.max(0.5, Number(scene.durationS) || 3)),
    }));
  const [width, height] = frameSize(aspect);
  const totalS = frames.reduce((sum, frame) => sum + frame.durationS, 0);
  return {
    fps: 25,
    aspect,
    width,
    height,
    musicPath,
    narrationPath: narration,
    totalS: Math.round(totalS * 100) / 100,
    scenes: frames,
  };
}
