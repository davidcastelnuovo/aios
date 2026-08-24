export type CreativeReferenceRole = "continuity" | "technique";

export const NO_TEXT_ON_IMAGE = [
  "ZERO GLYPHS ON THE PNG.",
  "Do not paint, stamp, carve, neon, collage, or engrave any letters, digits, words, captions, headlines, CTAs, logos, watermarks, buttons, or fake UI.",
  "Not Hebrew. Not English. Not numbers. Not newspaper headlines. Not street signs with words.",
  "Hebrew type and the real logo are composited later as layers — the image API garbles Hebrew (reversed letters, missing glyphs, gibberish).",
  "Do not invent or redraw a logo. Do NOT reserve a top headline strip, a bottom CTA pill, or a top-right logo pad (that is the old caption template).",
  "Build a finished multi-element graphic poster: several designed pieces already in the still (rail, slash, badge, split field, shadow pocket, object, light) so type can sit inside the art later.",
].join(" ");

export const buildNoGlyphLock = (options?: { regenerate?: boolean }): string => [
  NO_TEXT_ON_IMAGE,
  options?.regenerate
    && "REGENERATE: the previous still may have had baked type or gibberish. Do not copy those marks and do not paint replacement words. The new PNG must be completely letter-empty.",
].filter(Boolean).join(" ");

export const wrapCreativeImagePrompt = (prompt: string, options?: { regenerate?: boolean }): string => {
  const lock = buildNoGlyphLock(options);
  return `${lock}\n\n${prompt}\n\n${lock}`;
};
