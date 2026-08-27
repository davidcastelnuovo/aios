export type CreativeReferenceRole = "continuity" | "technique" | "talent" | "revision";

export const NO_TEXT_ON_IMAGE = [
  "ZERO GLYPHS ON THE PNG.",
  "Do not paint, stamp, carve, neon, collage, or engrave any letters, digits, words, captions, headlines, CTAs, watermarks, buttons, or fake UI.",
  "Not Hebrew. Not English. Not numbers. Not newspaper headlines. Not street signs with words.",
  "Hebrew type is composited later as layers — the image API garbles Hebrew (reversed letters, missing glyphs, gibberish).",
  "DO paint the real brand logo into the PNG. The app will not overlay a watermark. Never default to a bottom-corner sticker. Do not invent or redraw a logo.",
  "Do NOT reserve a top headline strip, a bottom CTA pill, or a top-right logo pad (that is the old caption template).",
  "Leave one naturally quiet atmospheric pocket (soft shadow, wall, sky, or out-of-focus area) where type can sit later. No hard geometric cutout, white panel, footer bar, or painted silhouette of a layout.",
  "Build a finished multi-element graphic poster: several designed pieces already in the still (rail, slash, badge, split field, shadow pocket, object, light) so type can sit inside the art later.",
].join(" ");

export const FINISHED_HEBREW_AD = [
  "FINISHED HEBREW AD PNG.",
  "The photograph is the APPROVED CONCEPT (scene, people, place, props). Paint the quoted Hebrew headline and CTA as real advertising type ON that concept still — type only, not a new subject.",
  "Do not restage the headline as a new situation. Do not replace the concept with a literal illustration of the copy.",
  "RTL: Hebrew reads right-to-left. Use logical Unicode order. Do not reverse, mirror, or scramble glyphs.",
  "Quote the copy exactly — no invented slogans, no missing letters, no English unless the quoted copy contains it.",
  "Place the real brand logo in a visible quiet pocket that does not overlap headline or CTA. Never default to a bottom-corner watermark. The app does not overlay the mark. If type would cover it, omit the logo.",
  "This is a finished cinematic advertising still, not a letter-empty plate for later overlay, and not a Canva caption template.",
].join(" ");

export type CreativeImageWrapOptions = {
  regenerate?: boolean;
  liveTextLayers?: boolean;
  inpaint?: boolean;
};

export const buildNoGlyphLock = (options?: { regenerate?: boolean }): string => [
  NO_TEXT_ON_IMAGE,
  options?.regenerate
    && "REGENERATE: the previous still may have had baked type or gibberish. Do not copy those marks and do not paint replacement words. The new PNG must be completely letter-empty.",
].filter(Boolean).join(" ");

export const buildFinishedAdLock = (options?: { regenerate?: boolean }): string => [
  FINISHED_HEBREW_AD,
  options?.regenerate
    && "REVISION: keep the photograph, talent, lighting, and composition unless the director asked to change them. Fix the requested issue. Output a finished ad with correct RTL Hebrew type.",
].filter(Boolean).join(" ");

export const wrapCreativeImagePrompt = (prompt: string, options?: CreativeImageWrapOptions): string => {
  const trimmed = prompt.trim();
  if (options?.inpaint) return trimmed;
  const lock = options?.liveTextLayers ? buildNoGlyphLock(options) : buildFinishedAdLock(options);
  if (/MUST FOLLOW THIS APPROVED VISUAL CONCEPT|CONCEPT PHOTOGRAPH — HARD LOCK/i.test(trimmed)) {
    return `${trimmed}\n\n${lock}`;
  }
  return `${lock}\n\n${trimmed}\n\n${lock}`;
};
