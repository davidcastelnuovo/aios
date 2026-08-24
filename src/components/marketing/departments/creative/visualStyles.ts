export type CreativeVisualStyleId =
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

export type CreativeVisualStyleGroup = "reference" | "more";

export interface CreativeVisualStyle {
  id: CreativeVisualStyleId;
  label: string;
  hint: string;
  group: CreativeVisualStyleGroup;
  lock: string;
}

export const DEFAULT_VISUAL_STYLE_ID: CreativeVisualStyleId = "swiss";

const style = (
  id: CreativeVisualStyleId,
  label: string,
  hint: string,
  group: CreativeVisualStyleGroup,
  lock: string[],
): CreativeVisualStyle => ({ id, label, hint, group, lock: lock.join(" ") });

export const CREATIVE_VISUAL_STYLES: CreativeVisualStyle[] = [
  style("swiss", "מסחרי נקי", "שוויצרי, מטוס ומוצר על רקע בהיר", "reference", [
    "ART DIRECTION: clean Swiss / international commercial still.",
    "Light grey-to-white gradient, generous negative space, one hero vehicle or product sitting in real space with a soft contact shadow.",
    "Catalog-precise, 35mm, high-key daylight, no grit. Think flagship travel OTA key visual.",
    "Forbidden: dark cyber, collage, neon, studio headshot, busy texture, caption plates.",
    "Palette: cool grey, white, navy, one primary blue accent.",
  ]),
  style("industrial", "תעשייתי", "בלופרינט, מנוע, צהוב על שחור", "reference", [
    "ART DIRECTION: industrial tech / blueprint still.",
    "Dark textured black metal, yellow construction marks, plus signs, faint coordinate ticks, close-up of machinery or a jet engine.",
    "Gritty, high-contrast, travel-hacker energy. Weathered yellow frame language without any letters.",
    "Forbidden: pastel lifestyle, watercolor, cute illustration, grey-studio portrait, glassmorphism.",
    "Palette: black, industrial yellow, electric blue, steel.",
  ]),
  style("mediterranean", "ים־תיכוני", "קשת, מזוודה, כפר לבן וים", "reference", [
    "ART DIRECTION: Mediterranean lifestyle editorial.",
    "Arched window or terrace looking onto whitewashed village, blue domes, sea; a suitcase in the foreground; olive branch accents.",
    "Warm sand and cream architecture, golden-hour sun, romantic vacation still.",
    "Forbidden: neon, cyber, collage scraps, grey studio, comic ink.",
    "Palette: sand, cream, Aegean blue, olive, soft gold.",
  ]),
  style("kinetic", "קינטי", "מוישן בלר, כתום על סגול", "reference", [
    "ART DIRECTION: kinetic motion-design still.",
    "A vehicle or hero object streaking through frame with heavy motion blur and speed smear, frozen mid-move.",
    "Deep royal purple to hot orange/red energy. Thin white tick marks allowed, no words.",
    "Forbidden: static catalog pose, watercolor, scrapbook, quiet beige luxury.",
    "Palette: royal purple, orange, red, white ticks.",
  ]),
  style("glass", "זכוכית", "צורות זכוכית אירידסנטיות בחושך", "reference", [
    "ART DIRECTION: iridescent glass / 3D still life.",
    "Octane-quality translucent glass cube, sphere, splash; rainbow caustics on near-black.",
    "Premium abstract product world. Glossy, refractive, no UI text.",
    "Forbidden: paper collage, live-action street photo, bauhaus primaries, studio headshot.",
    "Palette: black, iridescent cyan/magenta/gold highlights.",
  ]),
  style("collage", "קולאז'", "נייר קרוע, מפה, חותמת מסע", "reference", [
    "ART DIRECTION: analog mixed-media collage.",
    "Torn paper edges, vintage map fragment, cut-out vehicle or portrait piece, ink splatters, charcoal scribbles.",
    "Handmade scrapbook / explorer board. Physical paper texture only — one coherent collage, not a digital mashup of styles.",
    "Forbidden: photoreal studio, neon glass, clean Swiss grid, 3D render.",
    "Palette: beige paper, grey newsprint, black ink, one red accent.",
  ]),
  style("bauhaus", "באוהאוס", "גריד, עיגול אדום, צורות ראשוניות", "reference", [
    "ART DIRECTION: Bauhaus geometric poster.",
    "Cream field, strict grid, primary circle/square/rectangle; a circular window may reveal a fragment of the offer (wing, cloud, destination).",
    "Asymmetric balance, thick black bars, no decoration beyond geometry.",
    "Forbidden: photoreal full-bleed photo, neon, collage torn paper, cinematic grade.",
    "Palette: cream, black, primary red, blue, yellow.",
  ]),
  style("cinematic", "קולנועי", "שעת זהב, קו חוף, צללית מטוס", "reference", [
    "ART DIRECTION: cinematic golden-hour film still.",
    "Wide dramatic photograph of the destination at sunset — coastline, water, ancient stone — a vehicle silhouette may cross the sky.",
    "Anamorphic feel, rich contrast, film grain, movie-grade amber light.",
    "Forbidden: flat graphic design, clipart, collage, UI chrome, grey-studio portrait.",
    "Palette: deep brown, black, warm gold, cool shadow.",
  ]),
  style("holographic", "הולוגרפי", "פאנלי זכוכית, ורוד־ציאן, UI רך", "reference", [
    "ART DIRECTION: soft-futuristic holographic UI world — without any readable text or icons that look like letters.",
    "Pink-purple-cyan gradient, frosted glass panels, glossy 3D product (suitcase/vehicle) floating, thin wireframe ornaments.",
    "Web3 / app-key-visual energy. Empty cards only — no words, numbers, logos, or fake buttons.",
    "Forbidden: dirty analog collage, bauhaus primaries, documentary photo, grey studio.",
    "Palette: pink, purple, cyan, frosted white, gloss blue.",
  ]),
  style("organic", "אורגני", "אבן, עלה, חלון לים", "reference", [
    "ART DIRECTION: organic earthy still.",
    "Textured stone or sand wall, a real leaf or olive branch, a window cut-out onto the destination coast, clay pot in the foreground.",
    "Tactile, sustainable, carved-from-the-land. Soft natural daylight.",
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

const STATIC_QUALITY = [
  "Finished commercial key visual in THIS style only — same campaign idea, this exact art system.",
  "Illustrate the offer (destination, product, vehicle, or place) inside this style's world.",
  "Leave an open center, lower third, and a clean top-right pad (~18% width) so a title, CTA, and brand logo can be composited later.",
  "No letters, numbers, logos, watermarks, buttons, or fake UI with words — Hebrew and the real logo are added as layers. Never invent or redraw a logo.",
  "Forbidden: grey/white seamless studio headshot, thinking-hand pose, caption plate, random portrait unrelated to the offer.",
].join(" ");

export const buildVisualStyleLock = (
  payload: Record<string, unknown> | null | undefined,
  options?: { storyboard?: boolean; styleId?: CreativeVisualStyleId },
): string => {
  const selected = options?.styleId ? visualStyleById(options.styleId) : getVisualStyle(payload);
  return [selected.lock, options?.storyboard ? STORYBOARD_CONTINUITY : STATIC_QUALITY].join("\n");
};

export const imageSizeForFormat = (format?: string): "1024x1024" | "1024x1536" | "1536x1024" => {
  if (format === "9:16" || format === "4:5") return "1024x1536";
  if (format === "16:9") return "1536x1024";
  return "1024x1024";
};
