export type CreativeVisualStyleId =
  | "photoreal"
  | "cinematic"
  | "animation"
  | "illustration"
  | "popart"
  | "render3d"
  | "editorial"
  | "ugc"
  | "watercolor"
  | "comic";

export interface CreativeVisualStyle {
  id: CreativeVisualStyleId;
  label: string;
  hint: string;
  lock: string;
}

export const DEFAULT_VISUAL_STYLE_ID: CreativeVisualStyleId = "photoreal";

export const CREATIVE_VISUAL_STYLES: CreativeVisualStyle[] = [
  {
    id: "photoreal",
    label: "ראליסטי",
    hint: "צילום אמיתי, תאורה טבעית",
    lock: [
      "ART DIRECTION: photoreal photography only.",
      "35mm look, shallow depth of field, motivated natural light, real skin and materials.",
      "Forbidden: illustration, 3D render, cartoon, collage, split-screen, stock montage.",
      "Palette: warm neutrals (cream, walnut, charcoal) plus one muted teal accent.",
    ].join(" "),
  },
  {
    id: "cinematic",
    label: "קולנועי",
    hint: "שוט סרט, אנמורפי, דרמה",
    lock: [
      "ART DIRECTION: cinematic film still.",
      "Anamorphic widescreen feel, dramatic motivated lighting, film grain, rich contrast, movie-grade color.",
      "Forbidden: flat graphic design, clipart, collage, UI chrome, stock montage.",
      "Palette: teal-and-amber cinema grade, deep shadows, practical lights.",
    ].join(" "),
  },
  {
    id: "animation",
    label: "אנימציה",
    hint: "עולם מצויר תלת־ממדי רך",
    lock: [
      "ART DIRECTION: stylized 3D animation still, Pixar/DreamWorks quality.",
      "Soft global illumination, appealing character design, clean readable shapes.",
      "Forbidden: live-action photography, grimy realism, collage, mixed 2D/3D mashup.",
      "Palette: saturated but tasteful, clear key light, storybook warmth.",
    ].join(" "),
  },
  {
    id: "illustration",
    label: "איור",
    hint: "איור ידני מודרני",
    lock: [
      "ART DIRECTION: modern editorial illustration, one consistent hand.",
      "Confident line, designed shapes, limited color, poster-like composition.",
      "Forbidden: photoreal faces, 3D render, collage of mixed artists, stock icons.",
      "Palette: 4-color designed set, bold but not neon chaos.",
    ].join(" "),
  },
  {
    id: "popart",
    label: "פופ ארט",
    hint: "וורהול / ליכטנשטיין",
    lock: [
      "ART DIRECTION: pop-art poster, Warhol/Lichtenstein energy.",
      "Bold Ben-Day dots or flat silkscreen blocks, thick contour, high-contrast primaries.",
      "Forbidden: muted photoreal, watercolor wash, photobashing, tiny detail clutter.",
      "Palette: primary red/yellow/blue plus black and cream.",
    ].join(" "),
  },
  {
    id: "render3d",
    label: "תלת־ממד",
    hint: "רנדר מוצר נקי",
    lock: [
      "ART DIRECTION: clean studio 3D product/environment render.",
      "Octane/Redshift quality, precise materials, soft studio lighting, crisp edges.",
      "Forbidden: sketchy illustration, live-action photography, collage.",
      "Palette: controlled studio neutrals with one brand accent.",
    ].join(" "),
  },
  {
    id: "editorial",
    label: "מגזין",
    hint: "אופנה / editorial",
    lock: [
      "ART DIRECTION: high-fashion editorial photograph.",
      "Art-directed posing, magazine lighting, stylish location, couture styling.",
      "Forbidden: cheap stock smile-to-camera, clipart, collage, busy infographic.",
      "Palette: sophisticated muted tones, one sharp accent color.",
    ].join(" "),
  },
  {
    id: "ugc",
    label: "UGC",
    hint: "טלפון ביד, אותנטי",
    lock: [
      "ART DIRECTION: authentic handheld UGC still.",
      "Phone-camera look, available light, slightly imperfect framing, real environment.",
      "Forbidden: glossy studio ad, illustration, heavy retouch, collage.",
      "Palette: whatever the real room gives — no fake grade.",
    ].join(" "),
  },
  {
    id: "watercolor",
    label: "צבעי מים",
    hint: "ציור רך שקוף",
    lock: [
      "ART DIRECTION: watercolor painting on paper.",
      "Visible pigment blooms, paper texture, soft edges, handmade feel.",
      "Forbidden: photoreal, vector flat, 3D, collage of photos.",
      "Palette: airy washes, limited pigments, lots of paper white.",
    ].join(" "),
  },
  {
    id: "comic",
    label: "קומיקס",
    hint: "פאנל קומיקס",
    lock: [
      "ART DIRECTION: single comic-book panel, inked and colored.",
      "Clear linework, cel shading, dynamic composition, one moment.",
      "Forbidden: photoreal, watercolor, 3D render, multi-panel page, speech balloons or any lettering.",
      "Palette: bold print inks, controlled primaries.",
    ].join(" "),
  },
];

const STYLE_BY_ID = Object.fromEntries(CREATIVE_VISUAL_STYLES.map((style) => [style.id, style])) as Record<
  CreativeVisualStyleId,
  CreativeVisualStyle
>;

export const isVisualStyleId = (value: unknown): value is CreativeVisualStyleId =>
  typeof value === "string" && value in STYLE_BY_ID;

export const getVisualStyleId = (payload: Record<string, unknown> | null | undefined): CreativeVisualStyleId => {
  const value = payload?.visual_style;
  return isVisualStyleId(value) ? value : DEFAULT_VISUAL_STYLE_ID;
};

export const visualStyleById = (id: CreativeVisualStyleId): CreativeVisualStyle =>
  STYLE_BY_ID[id] ?? STYLE_BY_ID[DEFAULT_VISUAL_STYLE_ID];

export const getVisualStyle = (payload: Record<string, unknown> | null | undefined): CreativeVisualStyle =>
  visualStyleById(getVisualStyleId(payload));

const STORYBOARD_CONTINUITY = [
  "STORYBOARD CONTINUITY — every frame is the same commercial in THIS style only.",
  "Keep the same world, cast, wardrobe, lighting and color language.",
  "Do not switch art styles between frames.",
  "Forbidden: collage, split-screen, infographic, mixed-media mashup.",
].join(" ");

const STATIC_QUALITY = [
  "This is a FINISHED paid-social ad layout, as if art-directed in Photoshop or Illustrator — not a random pretty photo.",
  "Sell the campaign idea through composition, contrast, one hero subject, and a designed copy area.",
  "Reserve 30-40% of the frame as an EMPTY designed plate: lower-third band, side panel, or solid/gradient field with clean margins.",
  "The copy area must contain no letters, numbers, logos, buttons, or fake UI — typesetting is added later as layers.",
  "Think hierarchy and safe zones. Forbidden: stock lifestyle with no layout, collage, split-screen, on-image typography.",
].join(" ");

export const buildVisualStyleLock = (
  payload: Record<string, unknown> | null | undefined,
  options?: { storyboard?: boolean; styleId?: CreativeVisualStyleId },
): string => {
  const style = options?.styleId ? visualStyleById(options.styleId) : getVisualStyle(payload);
  return [style.lock, options?.storyboard ? STORYBOARD_CONTINUITY : STATIC_QUALITY].join("\n");
};

export const imageSizeForFormat = (format?: string): "1024x1024" | "1024x1536" | "1536x1024" => {
  if (format === "9:16" || format === "4:5") return "1024x1536";
  if (format === "16:9") return "1536x1024";
  return "1024x1024";
};
