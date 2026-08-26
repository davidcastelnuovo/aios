import { CREATIVE_DIRECT_IDENTITY } from "./creativeDirect";
import { parseCreativeCopy, strongestLine } from "./designedLayers";
import type { CreativeBrandKit } from "./brandKit";

const CONCEPT_LOCK = /MUST FOLLOW THIS APPROVED VISUAL CONCEPT|CONCEPT PHOTOGRAPH — HARD LOCK/i;

export interface CreativeAgentBrief {
  title?: string;
  format: string;
  copyText: string;
  copyLabel?: string;
  brief?: string;
  instructions?: string;
  visualPrompt?: string;
  directorNote?: string;
  kit: CreativeBrandKit;
  talentUrls?: string[];
  editTargetUrl?: string;
  liveTextLayers?: boolean;
}

export const buildCreativeAgentPrompt = ({
  title,
  format,
  copyText,
  copyLabel,
  brief,
  instructions,
  visualPrompt,
  directorNote,
  kit,
  talentUrls = [],
  editTargetUrl,
  liveTextLayers,
}: CreativeAgentBrief): string => {
  const parts = parseCreativeCopy(copyText, title);
  const headline = strongestLine(copyText, title) || parts.headline;
  const concept = visualPrompt?.trim();
  const conceptLocked = CONCEPT_LOCK.test(concept ?? "") || Boolean(concept);
  const refs = [
    editTargetUrl && `Edit target (revise this exact ad, change only the director note): ${editTargetUrl}`,
    ...talentUrls.map((url, index) => `Talent / spokesman ${index + 1} (keep this face, new scene): ${url}`),
    kit.logoUrl && `Brand logo asset (do not redraw; composite or reserve a clean pocket): ${kit.logoUrl}`,
  ].filter(Boolean);

  const typeOnly = [
    "TYPE ONLY — paint these exact Hebrew words on the concept photograph.",
    "Do not restage the scene from this copy. Do not change people, place, or props to illustrate the headline.",
    "Do not invent a chat UI, Google search, or a person reading the slogan unless that IS the approved concept hook.",
    copyLabel && `Copy variation: ${copyLabel} — same concept world, this line of type.`,
    headline && `HEADLINE (words to typeset, RTL — not a new scene): «${headline}»`,
    parts.cta && parts.cta !== headline && `CTA (words to typeset, RTL — not a new scene): «${parts.cta}»`,
  ].filter(Boolean).join("\n");

  const copyAsScene = [
    copyLabel && `Copy variation: ${copyLabel}`,
    headline && `Exact Hebrew HEADLINE, RTL, verbatim: «${headline}»`,
    parts.cta && parts.cta !== headline && `Exact Hebrew CTA, RTL, verbatim: «${parts.cta}»`,
  ].filter(Boolean).join("\n");

  return [
    CREATIVE_DIRECT_IDENTITY,
    "This message is one job in the Creative Direct chat. Generate the still, write it back, stop.",
    "Use case: ads-marketing.",
    `Asset type: standalone ${format} cinematic Hebrew advertising still.`,
    title && `Campaign / project: ${title}`,
    kit.brandBook?.name && `Brand: ${kit.brandBook.name}.`,
    kit.brandBook?.colors?.length && `Brand colors: ${kit.brandBook.colors.join(", ")}.`,
    kit.website && `Website: ${kit.website}.`,
    conceptLocked && concept && [
      "CONCEPT PHOTOGRAPH — HARD LOCK. The entire still is this approved concept. Copy does not choose the scene.",
      concept,
      "Photograph the concept's people, place, props, and hook. The headline is type on that photograph, never a replacement scene.",
    ].join("\n"),
    conceptLocked ? typeOnly : copyAsScene,
    brief?.trim() && `Brief (supporting only — do not replace the concept): ${brief.trim().slice(0, 400)}`,
    instructions?.trim() && `Director instruction (hard): ${instructions.trim()}`,
    directorNote?.trim() && `REVISION REQUEST (apply this, keep the concept photograph): ${directorNote.trim()}`,
    refs.length > 0 && `Reference images — download them first, then attach to GenerateImage:\n${refs.join("\n")}`,
    liveTextLayers
      ? "LIVE TEXT MODE: output a letter-empty photograph of the concept. Do not paint letters. Hebrew is composited later."
      : [
        "FINISHED AD: paint the quoted Hebrew headline and CTA as TYPE on the concept photograph.",
        "RTL HARD RULES: Hebrew reads right-to-left. Logical Unicode order. Unreversed glyphs. Exact spelling. No extra slogans. No English unless the quoted copy contains it.",
        "Integrate type into a quiet pocket in the photograph — cinematic poster lockup, not a Canva caption bar, not fake Instagram/chat UI unless the concept is actually about a chat screen.",
      ].join("\n"),
    conceptLocked
      ? "IRON RULE — CONCEPT FIRST. Style is costume, light, material, and crop only. A stranger must recognize the approved concept from the picture, not the headline."
      : "IRON RULE — SUBJECT FIRST. Style is costume, light, material, and crop only. A stranger must recognize the idea from the picture.",
    "Forbidden: grey cyclorama, thinking-hand stock, bland LinkedIn portrait, Canva templates, invented logos, reversed or garbled Hebrew, style-board clichés that replace the concept, restaging the headline instead of the concept.",
    "CLOSER: if the concept and the headline disagree, photograph the concept. Type the headline.",
    "After the image is generated, POST it back with action=complete as instructed in the dispatch footer. Then stop.",
  ].filter(Boolean).join("\n\n");
};
