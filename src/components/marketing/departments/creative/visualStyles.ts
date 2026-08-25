export type CreativeVisualStyleId =
  | "adaptive"
  | "swiss"
  | "industrial"
  | "mediterranean"
  | "kinetic"
  | "glass"
  | "collage"
  | "bauhaus"
  | "cinematic"
  | "holographic"
  | "organic"
  | "photoreal"
  | "animation"
  | "illustration"
  | "popart"
  | "render3d"
  | "editorial"
  | "ugc"
  | "watercolor"
  | "comic";

export type CreativeVisualStyleGroup = "auto" | "reference" | "more";

export interface CreativeVisualStyle {
  id: CreativeVisualStyleId;
  label: string;
  hint: string;
  group: CreativeVisualStyleGroup;
  lock: string;
}

export const DEFAULT_VISUAL_STYLE_ID: CreativeVisualStyleId = "adaptive";

const style = (
  id: CreativeVisualStyleId,
  label: string,
  hint: string,
  group: CreativeVisualStyleGroup,
  lock: string[],
): CreativeVisualStyle => ({ id, label, hint, group, lock: lock.join(" ") });

export const CREATIVE_VISUAL_STYLES: CreativeVisualStyle[] = [
  style("adaptive", "מותאם לקופי", "סגנון שנבנה מהקופי, מצבעי הלוגו ומהנושא", "auto", [
    "ADAPTIVE STYLE: invent a treatment from this copy, this topic, and the logo colors.",
    "Do not apply a named style-board recipe.",
  ]),
  style("swiss", "מסחרי נקי", "שוויצרי, אוויר, צל רך, גריד נקי", "reference", [
    "ART DIRECTION only: clean Swiss / international commercial still applied to THIS copy's subject.",
    "Light grey-to-white field, generous negative space, catalog-precise 35mm, high-key daylight, one soft contact shadow.",
    "The hero object is whatever the copy is about — not a default airplane or travel catalog.",
    "Forbidden: dark cyber, collage, neon, studio headshot, busy texture, caption plates.",
    "Palette: cool grey, white, navy, one primary blue accent.",
  ]),
  style("industrial", "תעשייתי", "בלופרינט, מתכת, צהוב על שחור", "reference", [
    "ART DIRECTION only: industrial tech / blueprint treatment of THIS copy's subject.",
    "Dark textured black metal, yellow construction marks, plus signs, faint coordinate ticks.",
    "Gritty high-contrast close-up of the idea in the copy — machinery only if the copy is about machines.",
    "Forbidden: pastel lifestyle, watercolor, cute illustration, grey-studio portrait, glassmorphism.",
    "Palette: black, industrial yellow, electric blue, steel.",
  ]),
  style("mediterranean", "ים־תיכוני", "אור זהב, חול, חום רך", "reference", [
    "ART DIRECTION only: warm Mediterranean light and materials on THIS copy's subject.",
    "Sand, cream, arched daylight, golden-hour sun. Use a village or sea ONLY if the copy is about a destination.",
    "Otherwise keep the warmth and stone/linen textures on the actual situation in the copy.",
    "Forbidden: neon, cyber, collage scraps, grey studio, comic ink.",
    "Palette: sand, cream, Aegean blue, olive, soft gold.",
  ]),
  style("kinetic", "קינטי", "מוישן בלר, כתום על סגול", "reference", [
    "ART DIRECTION only: kinetic motion-design still of THIS copy's action.",
    "Heavy motion blur and speed smear on the real action (a thumb scrolling, a person turning away, a choice being made) — not a random streaking car.",
    "Deep royal purple to hot orange/red energy. Thin white tick marks allowed, no words.",
    "Forbidden: static catalog pose, watercolor, scrapbook, quiet beige luxury.",
    "Palette: royal purple, orange, red, white ticks.",
  ]),
  style("glass", "זכוכית", "צורות זכוכית אירידסנטיות בחושך", "reference", [
    "ART DIRECTION only: iridescent glass / 3D still life of THIS copy's subject.",
    "Octane-quality translucent glass, splash, rainbow caustics on near-black — the object inside the glass is the copy's idea, not a random cube.",
    "Premium refractive world. No UI text.",
    "Forbidden: paper collage, live-action street photo, bauhaus primaries, studio headshot.",
    "Palette: black, iridescent cyan/magenta/gold highlights.",
  ]),
  style("collage", "קולאז'", "נייר קרוע, דיו, טקסטורה", "reference", [
    "ART DIRECTION only: analog mixed-media collage TECHNIQUE of THIS copy's story.",
    "Torn paper, ink splatters, charcoal, physical paper texture. Every collage is a NEW board: new figure, new cut-outs, new marks that illustrate THIS sentence.",
    "One coherent handmade board, not a reprint of a previous collage and not a digital mashup of styles.",
    "Forbidden: photoreal studio, neon glass, clean Swiss grid, 3D render.",
    "Palette: beige paper, grey newsprint, black ink, one red accent.",
  ]),
  style("bauhaus", "באוהאוס", "גריד, עיגול, צורות ראשוניות", "reference", [
    "ART DIRECTION only: Bauhaus geometric poster of THIS copy's idea.",
    "Cream field, strict grid, primary circle/square/rectangle. A circular window may reveal a fragment of the copy's actual subject — never a default airplane wing.",
    "Asymmetric balance, thick black bars, no decoration beyond geometry.",
    "Forbidden: photoreal full-bleed photo, neon, collage torn paper, cinematic grade.",
    "Palette: cream, black, primary red, blue, yellow.",
  ]),
  style("cinematic", "קולנועי", "שעת זהב, פילם, דרמה", "reference", [
    "ART DIRECTION only: cinematic golden-hour film still of THIS copy's moment.",
    "Anamorphic feel, rich contrast, film grain, movie-grade amber light on the real situation in the copy.",
    "Do not default to a coastline or airplane silhouette unless the copy is about travel.",
    "Forbidden: flat graphic design, clipart, collage, UI chrome, grey-studio portrait.",
    "Palette: deep brown, black, warm gold, cool shadow.",
  ]),
  style("holographic", "הולוגרפי", "פאנלי זכוכית, ורוד־ציאן", "reference", [
    "ART DIRECTION only: soft-futuristic holographic world around THIS copy's subject.",
    "Pink-purple-cyan gradient, frosted glass panels, thin wireframe ornaments. The floating object is the copy's idea, not a default suitcase.",
    "Empty cards only — no words, numbers, logos, or fake buttons.",
    "Forbidden: dirty analog collage, bauhaus primaries, documentary photo, grey studio.",
    "Palette: pink, purple, cyan, frosted white, gloss blue.",
  ]),
  style("organic", "אורגני", "אבן, עלה, אור טבעי", "reference", [
    "ART DIRECTION only: organic earthy materials around THIS copy's subject.",
    "Stone, sand, leaf, clay, soft natural daylight. A window to the sea ONLY if the copy is about a place.",
    "Tactile and carved-from-the-land — the person or object in frame must act out the copy.",
    "Forbidden: neon, cyber, chrome UI, comic ink, grey cyclorama portrait.",
    "Palette: stone grey, moss green, sand, deep leaf, warm beige.",
  ]),
  style("photoreal", "ראליסטי", "צילום אמיתי, תאורה טבעית", "more", [
    "ART DIRECTION: photoreal photography only — a commercial environment, not a studio portrait.",
    "35mm look, shallow depth of field, motivated natural light, real materials and atmosphere.",
    "Forbidden: illustration, 3D render, cartoon, collage, split-screen, stock montage, grey-studio headshot.",
    "Palette: warm neutrals (cream, walnut, charcoal) plus one muted teal accent.",
  ]),
  style("animation", "אנימציה", "עולם מצויר תלת־ממדי רך", "more", [
    "ART DIRECTION: stylized 3D animation still, Pixar/DreamWorks quality.",
    "Soft global illumination, appealing character design, clean readable shapes.",
    "Forbidden: live-action photography, grimy realism, collage, mixed 2D/3D mashup.",
    "Palette: saturated but tasteful, clear key light, storybook warmth.",
  ]),
  style("illustration", "איור", "איור ידני מודרני", "more", [
    "ART DIRECTION: modern editorial illustration, one consistent hand.",
    "Confident line, designed shapes, limited color, poster-like composition.",
    "Forbidden: photoreal faces, 3D render, collage of mixed artists, stock icons.",
    "Palette: 4-color designed set, bold but not neon chaos.",
  ]),
  style("popart", "פופ ארט", "וורהול / ליכטנשטיין", "more", [
    "ART DIRECTION: pop-art poster, Warhol/Lichtenstein energy.",
    "Bold Ben-Day dots or flat silkscreen blocks, thick contour, high-contrast primaries.",
    "Forbidden: muted photoreal, watercolor wash, photobashing, tiny detail clutter.",
    "Palette: primary red/yellow/blue plus black and cream.",
  ]),
  style("render3d", "תלת־ממד", "רנדר מוצר נקי", "more", [
    "ART DIRECTION: clean studio 3D product/environment render.",
    "Octane/Redshift quality, precise materials, soft studio lighting, crisp edges.",
    "Forbidden: sketchy illustration, live-action photography, collage.",
    "Palette: controlled studio neutrals with one brand accent.",
  ]),
  style("editorial", "מגזין", "אופנה / editorial", "more", [
    "ART DIRECTION: high-fashion editorial photograph.",
    "Art-directed posing, magazine lighting, stylish location, couture styling.",
    "Forbidden: cheap stock smile-to-camera, clipart, collage, busy infographic.",
    "Palette: sophisticated muted tones, one sharp accent color.",
  ]),
  style("ugc", "UGC", "טלפון ביד, אותנטי", "more", [
    "ART DIRECTION: authentic handheld UGC still.",
    "Phone-camera look, available light, slightly imperfect framing, real environment.",
    "Forbidden: glossy studio ad, illustration, heavy retouch, collage.",
    "Palette: whatever the real room gives — no fake grade.",
  ]),
  style("watercolor", "צבעי מים", "ציור רך שקוף", "more", [
    "ART DIRECTION: watercolor painting on paper.",
    "Visible pigment blooms, paper texture, soft edges, handmade feel.",
    "Forbidden: photoreal, vector flat, 3D, collage of photos.",
    "Palette: airy washes, limited pigments, lots of paper white.",
  ]),
  style("comic", "קומיקס", "פאנל קומיקס", "more", [
    "ART DIRECTION: single comic-book panel, inked and colored.",
    "Clear linework, cel shading, dynamic composition, one moment.",
    "Forbidden: photoreal, watercolor, 3D render, multi-panel page, speech balloons or any lettering.",
    "Palette: bold print inks, controlled primaries.",
  ]),
];

const STYLE_BY_ID = Object.fromEntries(CREATIVE_VISUAL_STYLES.map((item) => [item.id, item])) as Record<
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

export const stylesInGroup = (group: CreativeVisualStyleGroup) =>
  CREATIVE_VISUAL_STYLES.filter((item) => item.group === group);

const STORYBOARD_CONTINUITY = [
  "STORYBOARD CONTINUITY — every frame is the same commercial in THIS style only.",
  "Keep the same world, cast, wardrobe, lighting and color language.",
  "Do not switch art styles between frames.",
  "Forbidden: mixing a second art style into later frames.",
].join(" ");

const STATIC_QUALITY_CORE = [
  "IRON RULE: style is costume and lighting only. The picture MUST depict THIS variation's copy idea as a concrete situation.",
  "A stranger should recognize which variation this is without reading type. If the still could be reused for a different angle, it failed.",
  "Do not replace the copy with a prettier default (vacation village, airplane, suitcase, jet engine, generic landscape, abstract glass toy) unless the copy is about that.",
  "MILLION-DOLLAR GRAPHIC DESIGN — not a stock photo with a caption. Build the still from several designed pieces (hero acting the copy + 2-4 graphic objects: geometric field, torn paper, 3D object, light, architectural frame, printed texture).",
  "Forbidden template: logo top-right + top headline strip + bottom CTA pill.",
  "Type will be composited into a designed zone that is already part of the art (slash, rail, badge, split field, shadow pocket). Do not leave a white/cream rectangle or caption plate.",
  "If BRAND COLOR LOCK is present, it OVERRIDES any palette listed in this style. Use only those logo/brand colors plus black, white, or paper.",
  "No letters, numbers, logos, watermarks, buttons, or fake UI with words — Hebrew is composited later because the image API still garbles Hebrew glyphs. Never invent or redraw a logo.",
  "Forbidden: grey/white seamless studio headshot, thinking-hand pose, caption plate, Canva template, random portrait unrelated to the copy.",
];

const STATIC_QUALITY = [
  ...STATIC_QUALITY_CORE,
  "The ten style boards were examples of RANGE, not a style system. Do not recall or apply those recipes. Invent a treatment that fits THIS copy, THIS topic, and the logo colors.",
].join(" ");

const STATIC_QUALITY_SELECTED = [
  ...STATIC_QUALITY_CORE,
  "A named style was selected. APPLY that TECHNIQUE (material, color family, composition approach) — not a photocopy of a previous card.",
  "STYLE ≠ CLONE. Change people, poses, props, graphic marks, and crop so they fit THIS copy. Two cards in the same style must be instantly distinguishable.",
  "If this still could be mistaken for another variation, it failed. Logo/brand colors override the style palette if present.",
].join(" ");

export const buildStaticQualityLock = (options?: { selectedStyle?: boolean }) =>
  options?.selectedStyle ? STATIC_QUALITY_SELECTED : STATIC_QUALITY;

export const buildVisualStyleLock = (
  payload: Record<string, unknown> | null | undefined,
  options?: { storyboard?: boolean; styleId?: CreativeVisualStyleId },
): string => {
  const selected = options?.styleId ? visualStyleById(options.styleId) : getVisualStyle(payload);
  if (options?.storyboard) return [selected.lock, STORYBOARD_CONTINUITY].join("\n");
  if (selected.id === "adaptive") return [selected.lock, STATIC_QUALITY].join("\n");
  return [
    `SELECTED STYLE — ${selected.label}. The user chose this TECHNIQUE (craft, color family, composition approach). Apply the technique. Do not reprint the same picture.`,
    selected.lock,
    STATIC_QUALITY_SELECTED,
  ].join("\n");
};

export const imageSizeForFormat = (format?: string): "1024x1024" | "1024x1536" | "1536x1024" => {
  if (format === "9:16" || format === "4:5") return "1024x1536";
  if (format === "16:9") return "1536x1024";
  return "1024x1024";
};
