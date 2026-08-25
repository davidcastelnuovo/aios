export type CompositionId = "offer" | "flush" | "rail" | "slash" | "badge" | "flag" | "split";

export interface CompositionLayout {
  id: CompositionId;
  label: string;
  /** Image-model instruction: invent THIS graphic architecture, not a caption template. */
  prompt: string;
  type: { x: number; y: number; width: number; height: number; align: "right" | "center" | "left" };
  /** Designed support behind type. Omit for flush type with no plate. */
  field?: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius?: number;
    rotation?: number;
    shadow?: boolean;
  };
  /** Second graphic piece so the overlay is not a single boring rectangle. */
  accent?: { x: number; y: number; width: number; height: number; radius?: number; rotation?: number };
  bar?: { x: number; y: number; width: number; height: number };
  cta: { x: number; y: number; width: number; height: number; pill: boolean };
  logo: { x: number; y: number; width: number; height: number };
}

const layout = (item: CompositionLayout): CompositionLayout => item;

export const CREATIVE_COMPOSITIONS: CompositionLayout[] = [
  layout({
    id: "offer",
    label: "לוח הצעה",
    prompt: "OFFER-BOARD: full-bleed photograph of THIS copy's subject, edge to edge. Fill the frame with a real person/scene. Leave one naturally quiet atmospheric pocket (soft shadow, wall, sky) — not a painted panel. Do NOT paint a layout: no white column, no diagonal split, no footer bar, no colored band, no icons, no buttons, no letters. Chrome is composited later as layers.",
    type: { x: 6, y: 12, width: 48, height: 22, align: "right" },
    field: { x: 0, y: 0, width: 54, height: 68 },
    accent: { x: 0, y: 68, width: 100, height: 32 },
    cta: { x: 18, y: 90, width: 64, height: 7, pill: true },
    logo: { x: 4, y: 3, width: 22, height: 8 },
  }),
  layout({
    id: "flush",
    label: "טיפוגרפיה חשופה",
    prompt: "GRAPHIC ARCHITECTURE: flush poster type sitting in a designed dark or light pocket that already exists in the picture (shadow, sky, wall, color bloom) — NO rectangle, NO caption bar, NO bottom pill reserved. Multiple designed pieces in frame (object + graphic + light). Logo lands bottom-start.",
    type: { x: 6, y: 8, width: 88, height: 28, align: "right" },
    bar: { x: 78, y: 37, width: 16, height: 1.1 },
    cta: { x: 52, y: 88, width: 40, height: 7, pill: false },
    logo: { x: 6, y: 86, width: 20, height: 9 },
  }),
  layout({
    id: "rail",
    label: "פס אנכי",
    prompt: "GRAPHIC ARCHITECTURE: a vertical designed color rail on the RIGHT (~30% width) that is part of the art (printed stock, lacquer, metal, paper) — not a UI panel. The scene occupies the left 70% as several elements. Type lives inside the rail. Do not use a top headline strip.",
    type: { x: 70, y: 14, width: 26, height: 48, align: "right" },
    field: { x: 68, y: 0, width: 32, height: 100 },
    accent: { x: 66.4, y: 0, width: 1.6, height: 100 },
    bar: { x: 74, y: 64, width: 18, height: 1.1 },
    cta: { x: 71, y: 78, width: 24, height: 8, pill: false },
    logo: { x: 72, y: 4, width: 22, height: 8 },
  }),
  layout({
    id: "slash",
    label: "אלכסון",
    prompt: "GRAPHIC ARCHITECTURE: a bold diagonal color slash / folded paper / painted stroke crossing the frame. Type sits on that slash. The rest of the picture is a multi-element scene. Forbidden: horizontal caption bar, centered bottom button reserved empty.",
    type: { x: 8, y: 18, width: 70, height: 26, align: "right" },
    field: { x: -8, y: 12, width: 118, height: 38, radius: 0, rotation: -11 },
    accent: { x: 4, y: 8, width: 22, height: 1.4, rotation: -11 },
    bar: { x: 56, y: 45, width: 20, height: 1.2 },
    cta: { x: 10, y: 48, width: 36, height: 8, pill: false },
    logo: { x: 74, y: 86, width: 20, height: 9 },
  }),
  layout({
    id: "badge",
    label: "תג עגול",
    prompt: "GRAPHIC ARCHITECTURE: a circular or arched designed badge / stamp / window holding the lockup — a graphic object, not a text box. Surround it with other designed pieces (pattern, object, second figure). No full-width bars.",
    type: { x: 22, y: 24, width: 56, height: 26, align: "center" },
    field: { x: 22, y: 14, width: 56, height: 46, radius: 999, shadow: true },
    accent: { x: 70, y: 10, width: 10, height: 10, radius: 999 },
    cta: { x: 30, y: 56, width: 40, height: 7, pill: false },
    logo: { x: 74, y: 4, width: 20, height: 8 },
  }),
  layout({
    id: "flag",
    label: "דגל פינתי",
    prompt: "GRAPHIC ARCHITECTURE: a chunky corner flag / folded poster / hard geometric bite in one corner. Type lives in that flag. The remaining canvas is a rich multi-element scene. Do not stretch a bar across the top.",
    type: { x: 38, y: 6, width: 56, height: 24, align: "right" },
    field: { x: 36, y: 0, width: 64, height: 40, radius: 0 },
    accent: { x: 36, y: 38, width: 18, height: 4 },
    bar: { x: 70, y: 31, width: 16, height: 1.1 },
    cta: { x: 48, y: 34, width: 40, height: 7, pill: false },
    logo: { x: 6, y: 5, width: 20, height: 8 },
  }),
  layout({
    id: "split",
    label: "פיצול שדה",
    prompt: "GRAPHIC ARCHITECTURE: a designed split — one half is a solid graphic color field (print, lacquer, paper), the other half is the scene built from several elements. Type belongs to the color field. This is a poster split, not a photo with a caption plate stuck on.",
    type: { x: 6, y: 58, width: 88, height: 22, align: "right" },
    field: { x: 0, y: 52, width: 100, height: 48 },
    accent: { x: 0, y: 50.6, width: 100, height: 1.6 },
    bar: { x: 72, y: 81, width: 18, height: 1.1 },
    cta: { x: 8, y: 84, width: 42, height: 8, pill: false },
    logo: { x: 74, y: 88, width: 20, height: 8 },
  }),
];

const BY_ID = Object.fromEntries(CREATIVE_COMPOSITIONS.map((item) => [item.id, item])) as Record<CompositionId, CompositionLayout>;

export const isCompositionId = (value: unknown): value is CompositionId =>
  typeof value === "string" && value in BY_ID;

export const compositionById = (id?: CompositionId | null): CompositionLayout =>
  (id && BY_ID[id]) || CREATIVE_COMPOSITIONS[0];

export const pickCompositionId = (seed: string, used: CompositionId[] = []): CompositionId => {
  const unused = CREATIVE_COMPOSITIONS.filter((item) => !used.includes(item.id));
  const pool = unused.length > 0 ? unused : CREATIVE_COMPOSITIONS;
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length].id;
};

export const DEFAULT_COMPOSITION_ID: CompositionId = "offer";

export const buildCompositionLock = (id?: CompositionId | null): string => {
  const selected = compositionById(id);
  if (selected.id === "offer") {
    return [
      "COMPOSITION LOCK — OFFER (לוח הצעה). Full-bleed photo only. Do not draw the template.",
      selected.prompt,
      "Forbidden in the PNG: white type column, diagonal cut, maroon/black footer, icon row, CTA pill, letters. Those are separate layers.",
      "A soft unoccupied pocket in the photo is OK. A drawn silhouette of the template is not.",
    ].join(" ");
  }
  return [
    `COMPOSITION LOCK — ${selected.id.toUpperCase()} (${selected.label}).`,
    selected.prompt,
    "This variation MUST look structurally different from the others. Do not reuse logo-top-right + top headline strip + bottom CTA pill.",
    "The attached style-board images (if any) were examples of RANGE, not layouts to copy. Invent a new graphic structure.",
    "Build the still from several designed elements, not one stock photo with type on top.",
  ].join(" ");
};
