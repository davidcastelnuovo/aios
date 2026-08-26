import { CREATIVE_DIRECT_JOB_PREAMBLE } from "./creativeDirect";
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
  directorRefUrls?: string[];
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
  directorRefUrls = [],
  liveTextLayers,
}: CreativeAgentBrief): string => {
  const parts = parseCreativeCopy(copyText, title);
  const headline = strongestLine(copyText, title) || parts.headline;
  const concept = visualPrompt?.trim();
  const conceptLocked = CONCEPT_LOCK.test(concept ?? "") || Boolean(concept);
  const refs = [
    editTargetUrl && `Edit target (revise this exact ad, change only the director note): ${editTargetUrl}`,
    ...directorRefUrls.map((url, index) => `Director / reject reference ${index + 1} (match this taste, lighting, crop, material): ${url}`),
    ...talentUrls.map((url, index) => `Talent / spokesman ${index + 1} (keep this face, new scene): ${url}`),
    kit.logoUrl && `Brand logo asset (do not redraw; composite or reserve a clean pocket): ${kit.logoUrl}`,
  ].filter(Boolean);

  const typeLines = [
    copyLabel && `Copy variation: ${copyLabel} — same concept world, this line of type.`,
    headline && `HEADLINE (TYPE ONLY, RTL): «${headline}»`,
    parts.cta && parts.cta !== headline && `CTA (TYPE ONLY, RTL): «${parts.cta}»`,
  ].filter(Boolean).join("\n");

  return [
    CREATIVE_DIRECT_JOB_PREAMBLE,
    `Asset: standalone ${format} Hebrew advertising still.`,
    title && `Project: ${title}`,
    kit.brandBook?.name && `Brand: ${kit.brandBook.name}.`,
    kit.brandBook?.colors?.length && `Brand colors: ${kit.brandBook.colors.join(", ")}.`,
    kit.website && `Website: ${kit.website}.`,
    concept && (conceptLocked
      ? `CONCEPT PHOTOGRAPH:\n${concept}`
      : `Scene:\n${concept}`),
    typeLines,
    brief?.trim() && `Brief (supporting): ${brief.trim().slice(0, 400)}`,
    instructions?.trim() && `Project instruction: ${instructions.trim()}`,
    directorNote?.trim() && `DIRECTOR / REJECT: ${directorNote.trim()}`,
    refs.length > 0 && `References — download, then attach to GenerateImage:\n${refs.join("\n")}`,
    liveTextLayers ? "LIVE TEXT: letter-empty photograph, no painted letters." : "FINISHED AD: paint the quoted Hebrew on the concept photograph.",
  ].filter(Boolean).join("\n\n");
};
