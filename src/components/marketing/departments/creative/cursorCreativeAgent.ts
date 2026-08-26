import type { CopyConcept } from "@/components/marketing/copyConcepts";
import { CREATIVE_DIRECT_JOB_PREAMBLE } from "./creativeDirect.ts";
import { parseCreativeCopy, strongestLine } from "./designedLayers.ts";
import type { CreativeBrandKit } from "./brandKit.ts";
import {
  LOGO_PLACEMENT_LOCK,
  STATIC_CAST_LOCK,
  STYLE_REFERENCE_DESIGN_LOCK,
  labelStaticRef,
  type StaticRef,
} from "./cursorArtDirector.ts";
import { buildVisualStyleLock, visualStyleById, type CreativeVisualStyleId } from "./visualStyles.ts";

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
  concept?: Pick<CopyConcept, "name" | "bigIdea" | "visualLanguage" | "hook" | "copyAngle" | "whyItWorks" | "reference">;
  styleId?: CreativeVisualStyleId;
  /** Style on the last / parent card. When it differs from styleId, the job must switch technique. */
  previousStyleId?: CreativeVisualStyleId;
}

const resolveLabeledRefs = ({
  refs,
  talentUrls,
  editTargetUrl,
  directorRefUrls,
  logoUrl,
}: {
  refs: StaticRef[];
  talentUrls: string[];
  editTargetUrl?: string;
  directorRefUrls: string[];
  logoUrl?: string;
}): StaticRef[] => {
  const labeled = refs.length > 0
    ? [...refs]
    : [
      editTargetUrl ? { url: editTargetUrl, kind: "edit" as const } : null,
      ...directorRefUrls.map((url) => ({ url, kind: "director" as const })),
      ...talentUrls.map((url) => ({ url, kind: "style" as const })),
    ].filter((item): item is StaticRef => !!item);
  if (logoUrl && !labeled.some((item) => item.kind === "logo" || item.url === logoUrl)) {
    labeled.push({ url: logoUrl, kind: "logo" });
  }
  return labeled;
};

export const formatConceptJobBrief = (
  concept?: CreativeAgentBrief["concept"],
  visualPrompt?: string,
): string => {
  if (concept && (concept.name || concept.bigIdea || concept.hook || concept.visualLanguage)) {
    return [
      "1. CONCEPT — photograph THIS scene. Headline/CTA are TYPE only; they do not choose a new metaphor.",
      concept.name && `Name: ${concept.name}`,
      concept.bigIdea && `Scene / big idea: ${concept.bigIdea}`,
      concept.visualLanguage && `Visual language: ${concept.visualLanguage}`,
      concept.hook && `Hook (first second): ${concept.hook}`,
      concept.copyAngle && `Copy angle (words only): ${concept.copyAngle}`,
      concept.whyItWorks && `Why it works: ${concept.whyItWorks}`,
      concept.reference && `Campaign method: ${concept.reference}`,
    ].filter(Boolean).join("\n");
  }
  const fallback = visualPrompt?.trim();
  if (fallback) {
    return "1. CONCEPT — photograph the scene in CONCEPT PHOTOGRAPH below. Headline/CTA are TYPE only.";
  }
  return "1. CONCEPT — no approved concept on file. Photograph the copy idea as a concrete situation. Do not invent a generic lifestyle default.";
};

export const formatBrandColorJobBrief = (kit: CreativeBrandKit): string => {
  const colors = kit.brandBook?.colors ?? [];
  if (colors.length === 0) {
    return "2. BRAND COLORS — none on file. Do not invent a style-board palette (no purple-orange, no pink-cyan unless the topic is that).";
  }
  return [
    `2. BRAND COLORS (hard lock) — use ONLY these plus black, white, or paper: ${colors.join(", ")}.`,
    "Match the dominance of attached style references. No extra neon, no random primaries that fight the logo.",
    kit.brandBook?.name && `Brand: ${kit.brandBook.name}.`,
  ].filter(Boolean).join(" ");
};

export const formatReferenceJobBrief = (refs: StaticRef[]): string => {
  if (refs.length === 0) {
    return "3. CRITICAL REFERENCE URLS — none on file.";
  }
  const lines = refs.map((item, index) => labelStaticRef(item, index));
  const hasStyleRef = refs.some((item) => item.kind === "style");
  return [
    "3. CRITICAL REFERENCE URLS — download each URL and ATTACH it to GenerateImage. Skipping these is a fail.",
    hasStyleRef && STYLE_REFERENCE_DESIGN_LOCK,
    ...lines,
  ].filter(Boolean).join("\n");
};

export const formatStyleJobBrief = (
  styleId?: CreativeVisualStyleId,
  previousStyleId?: CreativeVisualStyleId,
): string => {
  const selected = styleId ? visualStyleById(styleId) : undefined;
  if (!selected) {
    return "4. PROJECT STYLE — none sent. Invent from the copy, brand colors, and concept.";
  }
  const change = previousStyleId && previousStyleId !== selected.id
    ? visualStyleById(previousStyleId)
    : undefined;
  return [
    `4. PROJECT STYLE — the user selected this in the project dropdown: ${selected.label} (${selected.id}).`,
    "This is the TECHNIQUE for this still (material, grade, composition approach). Apply it. Do not ignore it and do not reprint a previous card.",
    selected.hint && `Hint: ${selected.hint}.`,
    buildVisualStyleLock({}, { styleId: selected.id }),
    change && `STYLE CHANGE — previous card was ${change.label} (${change.id}). THIS job is ${selected.label} (${selected.id}). Switch grade, material, and composition. Do not keep the old look.`,
  ].filter(Boolean).join("\n");
};

/** Style on the card being replaced / siblinged, else the last live card. Same id as the job → no STYLE CHANGE. */
export const resolvePreviousStyleId = (
  replacing?: { visualStyle?: CreativeVisualStyleId },
  styleSource?: { visualStyle?: CreativeVisualStyleId },
  live: Array<{ rejected?: boolean; visualStyle?: CreativeVisualStyleId }> = [],
): CreativeVisualStyleId | undefined => {
  if (replacing) return replacing.visualStyle;
  if (styleSource) return styleSource.visualStyle;
  return [...live].reverse().find((item) => !item.rejected && item.visualStyle)?.visualStyle;
};

/** Compact mandatory brief Cursor Creative Direct must honor on every job. */
export const buildCreativeJobBrief = ({
  concept,
  visualPrompt,
  kit,
  refs,
  styleId,
  previousStyleId,
}: {
  concept?: CreativeAgentBrief["concept"];
  visualPrompt?: string;
  kit: CreativeBrandKit;
  refs: StaticRef[];
  styleId?: CreativeVisualStyleId;
  previousStyleId?: CreativeVisualStyleId;
}): string => [
  "JOB BRIEF — four hard facts. Honor all of them.",
  formatConceptJobBrief(concept, visualPrompt),
  formatBrandColorJobBrief(kit),
  formatReferenceJobBrief(refs),
  formatStyleJobBrief(styleId, previousStyleId),
].join("\n\n");

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
  concept,
  styleId,
  previousStyleId,
}: CreativeAgentBrief): string => {
  const parts = parseCreativeCopy(copyText, title);
  const headline = strongestLine(copyText, title) || parts.headline;
  const photograph = visualPrompt?.trim();
  const conceptLocked = CONCEPT_LOCK.test(photograph ?? "") || Boolean(photograph);
  const labeled = resolveLabeledRefs({
    refs,
    talentUrls,
    editTargetUrl,
    directorRefUrls,
    logoUrl: kit.logoUrl,
  });
  const hasTalent = labeled.some((item) => item.kind === "talent");
  const typeLines = [
    copyLabel && `Copy variation: ${copyLabel} — same concept world, this line of type.`,
    headline && `HEADLINE (TYPE ONLY, RTL): «${headline}»`,
    parts.cta && parts.cta !== headline && `CTA (TYPE ONLY, RTL): «${parts.cta}»`,
  ].filter(Boolean).join("\n");

  return [
    CREATIVE_DIRECT_JOB_PREAMBLE,
    buildCreativeJobBrief({
      concept,
      visualPrompt: photograph,
      kit,
      refs: labeled,
      styleId,
      previousStyleId,
    }),
    `Asset: standalone ${format} Hebrew advertising still — not a storyboard frame.`,
    title && `Project: ${title}`,
    kit.website && `Website: ${kit.website}.`,
    hasTalent ? "TALENT LOCK is on for this job. Keep the labeled spokesman." : STATIC_CAST_LOCK,
    photograph && (conceptLocked
      ? `CONCEPT PHOTOGRAPH:\n${photograph}`
      : `Scene:\n${photograph}`),
    typeLines,
    brief?.trim() && `Brief (supporting): ${brief.trim().slice(0, 400)}`,
    instructions?.trim() && `Project instruction: ${instructions.trim()}`,
    directorNote?.trim() && `DIRECTOR / REJECT: ${directorNote.trim()}`,
    kit.logoUrl && LOGO_PLACEMENT_LOCK,
    liveTextLayers ? "LIVE TEXT: letter-empty photograph, no painted letters. DO paint the real brand logo into the still." : "FINISHED AD: paint the quoted Hebrew on the concept photograph.",
  ].filter(Boolean).join("\n\n");
};
