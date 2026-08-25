import type { CreativeReferenceRole } from "@/components/marketing/lib/creativeImagePrompt";
import type { CreativeBrandKit } from "./brandKit";

const TALENT_LOCK = /דמות|פרזנטור|שחקן|מהרפרנס|הדמות|talent|spokesman|this (?:man|woman|person|character)|use the (?:man|woman|person|character|face)/i;

export const wantsTalentLock = (instructions?: string | null): boolean =>
  TALENT_LOCK.test(String(instructions ?? "").trim());

export const collectStaticReferencePlan = ({
  talentUrls,
  techniqueUrl,
  instructions,
  editTargetUrl,
}: {
  talentUrls: string[];
  techniqueUrl?: string;
  instructions?: string | null;
  editTargetUrl?: string;
}): { urls: string[]; role?: CreativeReferenceRole } => {
  const talent = wantsTalentLock(instructions) ? talentUrls.filter(Boolean) : [];
  const ordered = [editTargetUrl, ...talent, techniqueUrl].filter(
    (url, index, list): url is string => !!url && list.indexOf(url) === index,
  ).slice(0, 2);
  if (ordered.length === 0) return { urls: [] };
  return {
    urls: ordered,
    role: editTargetUrl ? "revision" : talent.length > 0 ? "talent" : "technique",
  };
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
    hasTalentRef && (revising
      ? "TALENT LOCK: image 1 is the ad to revise. If a second image is attached it is the spokesman — keep that face, glasses, age, hair, and body."
      : "TALENT LOCK: the first attached image is the exact spokesman. Keep this face, glasses, age, hair, and body. New scene, same person. Do not swap in a different extra. Do not copy the source ad's layout, lettering, logo, or UI chrome."),
    note && `Director instruction (hard): ${note}`,
    kit.brandBook?.name && `Brand: ${kit.brandBook.name}.`,
    `Asset: standalone ${format} advertising still.`,
    liveTextLayers
      ? "HEBREW / RTL: do not paint any letters. Hebrew type is composited later as isolated RTL layers (dir=rtl, unicode-bidi:isolate, logical order, no mirrored glyphs). Leave one quiet atmospheric pocket (shadow, wall, sky) for that type — not a painted caption bar."
      : hasApprovedConcept
        ? "HEBREW / RTL: paint the quoted Hebrew headline and CTA as TYPE on the concept photograph. Right-to-left, logical Unicode order, unreversed glyphs, exact spelling. No extra slogans. Do not change the scene to match the copy."
        : "HEBREW / RTL: paint the quoted Hebrew headline and CTA on the still as finished advertising type. Right-to-left, logical Unicode order, unreversed glyphs, exact spelling. No extra slogans. Integrate type into a quiet pocket in the photograph — not a Canva caption bar.",
    liveTextLayers
      ? "Forbidden: grey cyclorama, thinking-hand stock pose, caption plates, baked lettering, invented logos, style-board clichés that replace the concept."
      : "Forbidden: grey cyclorama, thinking-hand stock pose, Canva caption templates, invented logos, style-board clichés that replace the concept, reversed or garbled Hebrew, restaging the headline instead of the concept.",
  ].filter(Boolean).join("\n");
};
