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
      "ART DIRECTION: photoreal photography only — a commercial environment, not a studio portrait.",
      "35mm look, shallow depth of field, motivated natural light, real materials and atmosphere.",
      "Forbidden: illustration, 3D render, cartoon, collage, split-screen, stock montage, grey-studio headshot.",
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
  "MILLION-DOLLAR commercial still — luxury travel / premium brand ad, not a stock photo and not a flat Canva template.",
  "The picture is a cinematic ENVIRONMENT that illustrates the offer: destination, product-in-world, vehicle, or flagship moment.",
  "Vertical hierarchy: hero subject in the top half, open center sky for a floating 3D title, clean bottom for a CTA.",
  "Photoreal or style-locked, 8K, cinematic depth of field, motivated light from upper-right, atmosphere and color grade.",
  "Cohesive 3-color world. Supporting props sit IN the environment with matching shadows — never pasted on a blank backdrop.",
  "Leave the center and lower third visually open — no letters, numbers, logos, buttons, or fake UI. Typesetting is added later.",
  "Forbidden: grey/white seamless studio, cyclorama, cutout headshot, thinking-hand pose, passport portrait, caption box, collage, split-screen, generic lifestyle, Canva chrome.",
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
