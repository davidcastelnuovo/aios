import { CREATIVE_DIRECT_JOB_PREAMBLE } from "./creativeDirect";
import { parseCreativeCopy, strongestLine } from "./designedLayers";
import type { CreativeBrandKit } from "./brandKit";
import {
  LOGO_PLACEMENT_LOCK,
  STATIC_CAST_LOCK,
  labelStaticRef,
  type StaticRef,
} from "./cursorArtDirector";

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
  refs?: StaticRef[];
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
  refs = [],
  talentUrls = [],
  editTargetUrl,
  directorRefUrls = [],
  liveTextLayers,
}: CreativeAgentBrief): string => {
  const parts = parseCreativeCopy(copyText, title);
  const headline = strongestLine(copyText, title) || parts.headline;
  const concept = visualPrompt?.trim();
  const conceptLocked = CONCEPT_LOCK.test(concept ?? "") || Boolean(concept);
  const labeled = refs.length > 0
    ? refs
    : [
      editTargetUrl ? { url: editTargetUrl, kind: "edit" as const } : null,
      ...directorRefUrls.map((url) => ({ url, kind: "director" as const })),
      ...talentUrls.map((url) => ({ url, kind: "style" as const })),
    ].filter((item): item is StaticRef => !!item);
  const hasTalent = labeled.some((item) => item.kind === "talent");
  const lines = [
    ...labeled.map((item, index) => labelStaticRef(item, index)),
    kit.logoUrl && `Brand logo asset (download and place the real mark — see LOGO PLACEMENT): ${kit.logoUrl}`,
  ].filter(Boolean);

  const typeLines = [
    copyLabel && `Copy variation: ${copyLabel} — same concept world, this line of type.`,
    headline && `HEADLINE (TYPE ONLY, RTL): «${headline}»`,
    parts.cta && parts.cta !== headline && `CTA (TYPE ONLY, RTL): «${parts.cta}»`,
  ].filter(Boolean).join("\n");

  return [
    CREATIVE_DIRECT_JOB_PREAMBLE,
    `Asset: standalone ${format} Hebrew advertising still — not a storyboard frame.`,
    title && `Project: ${title}`,
    kit.brandBook?.name && `Brand: ${kit.brandBook.name}.`,
    kit.brandBook?.colors?.length && `BRAND COLOR LOCK: use ONLY these colors (plus black, white, or paper): ${kit.brandBook.colors.join(", ")}. Palette dominance must match the attached style references.`,
    kit.website && `Website: ${kit.website}.`,
    hasTalent ? "TALENT LOCK is on for this job. Keep the labeled spokesman." : STATIC_CAST_LOCK,
    concept && (conceptLocked
      ? `CONCEPT PHOTOGRAPH:\n${concept}`
      : `Scene:\n${concept}`),
    typeLines,
    brief?.trim() && `Brief (supporting): ${brief.trim().slice(0, 400)}`,
    instructions?.trim() && `Project instruction: ${instructions.trim()}`,
    directorNote?.trim() && `DIRECTOR / REJECT: ${directorNote.trim()}`,
    lines.length > 0 && `References — download each URL, then ATTACH them to GenerateImage with the labels above. Do not skip project style references.\n${lines.join("\n")}`,
    !liveTextLayers && kit.logoUrl && LOGO_PLACEMENT_LOCK,
    liveTextLayers ? "LIVE TEXT: letter-empty photograph, no painted letters." : "FINISHED AD: paint the quoted Hebrew on the concept photograph.",
  ].filter(Boolean).join("\n\n");
};
