import type { CreativeReferenceRole } from "@/components/marketing/lib/creativeImagePrompt";
import type { CreativeBrandKit } from "./brandKit";

const TALENT_LOCK = /דמות|פרזנטור|שחקן|מהרפרנס|הדמות|talent|spokesman|this (?:man|woman|person|character)|use the (?:man|woman|person|character|face)/i;

export const wantsTalentLock = (instructions?: string | null): boolean =>
  TALENT_LOCK.test(String(instructions ?? "").trim());

export type StaticRefKind = "edit" | "director" | "style" | "talent" | "technique" | "logo";

export type StaticRef = { url: string; kind: StaticRefKind };

export const labelStaticRef = (ref: StaticRef, index: number): string => {
  const n = index + 1;
  if (ref.kind === "edit") return `Edit target (revise this exact ad, change only the director note): ${ref.url}`;
  if (ref.kind === "director") {
    return `Director / reject reference ${n} (match taste, lighting, crop, material — new people unless this is also the edit target): ${ref.url}`;
  }
  if (ref.kind === "talent") return `Talent / spokesman ${n} (keep this face, new scene): ${ref.url}`;
  if (ref.kind === "logo") {
    return `LOGO ${n} (download and ATTACH this exact mark. Integrate it into the still — the app will NOT overlay a watermark): ${ref.url}`;
  }
  if (ref.kind === "technique") {
    return `Technique sample ${n} (match material / light / grade only. NEW cast, NEW crop. Not storyboard continuity): ${ref.url}`;
  }
  return `STYLE REFERENCE ${n} — PRIMARY DESIGN ANCHOR from project settings (download + ATTACH — skipping is a fail). Match this reference's graphic design system: palette dominance, layout architecture (logo zone, hero zone, footer band/wave, icon row, CTA pill), material, lighting grade, and brand energy. NEW scene and NEW people in the hero — do not photocopy faces or exact Hebrew from the reference. The still must feel like the same ad family: ${ref.url}`;
};

export const STYLE_REFERENCE_DESIGN_LOCK = [
  "STYLE REFERENCE — DESIGN SYSTEM LOCK.",
  "Every attached STYLE REFERENCE is the primary design anchor — not optional mood.",
  "Match palette dominance, split-band layout (hero + footer), wave/divider treatment, icon-row zone, CTA pill styling, logo zone, material, and lighting grade.",
  "Stage a NEW scene with NEW people in the hero. Do not photocopy faces from the reference.",
  "Use only the job's quoted Hebrew — never copy lettering from the reference.",
  "If the result could pass as an unrelated illustration instead of the same brand family as the reference, it failed.",
].join(" ");

export const STATIC_CAST_LOCK = [
  "STATIC STILL — not a storyboard beat.",
  "Do NOT keep faces, wardrobe, or cast from a storyboard, a previous card, or a style reference.",
  "Talent / spokesman lock is opt-in only (project instruction like «תשתמש בדמות מהרפרנס»).",
  "Style references lock the ad's design system (palette, layout bands, footer, CTA zone) — new scene and new people in the hero.",
].join(" ");

export const LOGO_PLACEMENT_LOCK = [
  "LOGO PLACEMENT (hard): download the labeled logo file and paint the REAL brand mark into the PNG.",
  "The app does NOT overlay a logo watermark. If you skip attaching this file, the ad ships without a brand mark.",
  "Place it in a visible quiet pocket that does NOT overlap headline or CTA.",
  "Never default to a bottom-corner watermark (left or right). Never hide it under type.",
  "Put type and logo in different regions: if type is lower-third, logo goes top; if type is a right rail, logo goes the opposite corner.",
  "If the only remaining pocket is smaller than ~8% of the short edge, or type would cover the mark, OMIT the logo. A missing logo is better than a hidden or colliding one.",
  "Never invent, redraw, or smear a fake logo.",
].join(" ");

const MAX_STATIC_REFS = 3;

const pushRef = (refs: StaticRef[], url: string | undefined, kind: StaticRefKind) => {
  if (!url || refs.some((item) => item.url === url)) return;
  refs.push({ url, kind });
};

export const collectStaticReferencePlan = ({
  projectRefUrls = [],
  talentUrls,
  techniqueUrl,
  instructions,
  editTargetUrl,
  directorUrls = [],
  logoUrl,
}: {
  projectRefUrls?: string[];
  /** @deprecated alias of projectRefUrls */
  talentUrls?: string[];
  techniqueUrl?: string;
  instructions?: string | null;
  editTargetUrl?: string;
  directorUrls?: string[];
  logoUrl?: string;
}): { urls: string[]; role?: CreativeReferenceRole; refs: StaticRef[] } => {
  const project = (projectRefUrls.length > 0 ? projectRefUrls : talentUrls ?? []).filter(Boolean);
  const talent = wantsTalentLock(instructions);
  const refs: StaticRef[] = [];
  pushRef(refs, editTargetUrl, "edit");
  for (const url of directorUrls) pushRef(refs, url, "director");
  for (const url of project) pushRef(refs, url, talent ? "talent" : "style");
  pushRef(refs, techniqueUrl, "technique");
  const sliced = refs.slice(0, MAX_STATIC_REFS);
  if (logoUrl && !sliced.some((item) => item.url === logoUrl)) {
    sliced.push({ url: logoUrl, kind: "logo" });
  }
  if (sliced.length === 0) return { urls: [], refs: [] };
  const kinds = new Set(sliced.map((item) => item.kind));
  const role: CreativeReferenceRole | undefined = kinds.has("edit")
    ? "revision"
    : kinds.has("talent")
      ? "talent"
      : kinds.has("style") || kinds.has("technique")
        ? "technique"
        : undefined;
  return { urls: sliced.map((item) => item.url), role, refs: sliced };
};

export const buildCursorArtDirectorLock = ({
  format,
  instructions,
  kit,
  hasTalentRef,
  liveTextLayers,
  revising,
  hasApprovedConcept,
}: {
  format: string;
  instructions?: string | null;
  kit: CreativeBrandKit;
  hasTalentRef?: boolean;
  liveTextLayers?: boolean;
  revising?: boolean;
  hasApprovedConcept?: boolean;
}): string => {
  const note = String(instructions ?? "").trim();
  return [
    "CURSOR ART DIRECTOR — premium Hebrew advertising still.",
    "You are the creative department's art director. Produce a finished cinematic poster-quality photograph, not a bland stock portrait and not a Canva caption template.",
    hasApprovedConcept
      ? "IRON RULE — CONCEPT FIRST. The photograph IS the approved concept (name, big idea, hook, visual language). Copy is type on that photograph. Do not restage the headline. Do not swap the person, product, or place because the copy mentions something else. A stranger should recognize the concept without reading type."
      : "IRON RULE — SUBJECT FIRST. Style is costume, light, material, and crop only. The picture must depict this variation's idea as a concrete situation. A stranger should recognize the idea without reading type.",
    hasTalentRef
      ? (revising
        ? "TALENT LOCK: image 1 is the ad to revise. If a second image is attached it is the spokesman — keep that face, glasses, age, hair, and body."
        : "TALENT LOCK: the first attached image is the exact spokesman. Keep this face, glasses, age, hair, and body. New scene, same person. Do not swap in a different extra. Do not copy the source ad's layout, lettering, logo, or UI chrome.")
      : STATIC_CAST_LOCK,
    note && `Director instruction (hard): ${note}`,
    kit.brandBook?.name && `Brand: ${kit.brandBook.name}.`,
    `Asset: standalone ${format} advertising still.`,
    liveTextLayers
      ? "HEBREW / RTL: do not paint any letters. Hebrew type is composited later as isolated RTL layers (dir=rtl, unicode-bidi:isolate, logical order, no mirrored glyphs). Leave one quiet atmospheric pocket (shadow, wall, sky) for that type — not a painted caption bar. DO paint the real brand logo into the photograph."
      : hasApprovedConcept
        ? "HEBREW / RTL: paint the quoted Hebrew headline and CTA as TYPE on the concept photograph. Right-to-left, logical Unicode order, unreversed glyphs, exact spelling. No extra slogans. Do not change the scene to match the copy."
        : "HEBREW / RTL: paint the quoted Hebrew headline and CTA on the still as finished advertising type. Right-to-left, logical Unicode order, unreversed glyphs, exact spelling. No extra slogans. Integrate type into a quiet pocket in the photograph — not a Canva caption bar.",
    kit.logoUrl && LOGO_PLACEMENT_LOCK,
    liveTextLayers
      ? "Forbidden: grey cyclorama, thinking-hand stock pose, caption plates, baked lettering, invented logos, style-board clichés that replace the concept."
      : "Forbidden: grey cyclorama, thinking-hand stock pose, Canva caption templates, invented logos, style-board clichés that replace the concept, reversed or garbled Hebrew, restaging the headline instead of the concept, default bottom-left logo watermarks.",
  ].filter(Boolean).join("\n");
};
