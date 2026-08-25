import { parseCreativeCopy, strongestLine } from "./designedLayers";
import type { CreativeBrandKit } from "./brandKit";

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
  const refs = [
    editTargetUrl && `Edit target (revise this exact ad, change only the director note): ${editTargetUrl}`,
    ...talentUrls.map((url, index) => `Talent / spokesman ${index + 1} (keep this face, new scene): ${url}`),
    kit.logoUrl && `Brand logo asset (do not redraw; composite or reserve a clean pocket): ${kit.logoUrl}`,
  ].filter(Boolean);

  return [
    "You are the AIOS Creative Agent — a premium Hebrew art director, not a coding agent.",
    "Do NOT edit the repository. Do NOT open a pull request. Do NOT write code.",
    "Generate ONE finished advertising still with your image-generation tool (GenerateImage).",
    "Use case: ads-marketing.",
    `Asset type: standalone ${format} cinematic Hebrew advertising still.`,
    title && `Campaign / project: ${title}`,
    kit.brandBook?.name && `Brand: ${kit.brandBook.name}.`,
    kit.brandBook?.colors?.length && `Brand colors: ${kit.brandBook.colors.join(", ")}.`,
    kit.website && `Website: ${kit.website}.`,
    concept && `APPROVED VISUAL CONCEPT (the photograph must depict this, not a prettier default):\n${concept}`,
    copyLabel && `Copy variation: ${copyLabel}`,
    headline && `Exact Hebrew HEADLINE, RTL, verbatim: «${headline}»`,
    parts.cta && parts.cta !== headline && `Exact Hebrew CTA, RTL, verbatim: «${parts.cta}»`,
    brief?.trim() && `Brief: ${brief.trim().slice(0, 400)}`,
    instructions?.trim() && `Director instruction (hard): ${instructions.trim()}`,
    directorNote?.trim() && `REVISION REQUEST (apply this, keep what still works): ${directorNote.trim()}`,
    refs.length > 0 && `Reference images — download them first, then attach to GenerateImage:\n${refs.join("\n")}`,
    liveTextLayers
      ? "LIVE TEXT MODE: output a letter-empty photograph. Do not paint letters. Hebrew is composited later."
      : [
        "FINISHED AD: paint the quoted Hebrew headline and CTA on the PNG.",
        "RTL HARD RULES: Hebrew reads right-to-left. Logical Unicode order. Unreversed glyphs. Exact spelling. No extra slogans. No English unless the quoted copy contains it.",
        "Integrate type into a quiet pocket in the photograph — cinematic poster lockup, not a Canva caption bar, not fake Instagram/chat UI unless the concept is actually about a chat screen.",
      ].join("\n"),
    "IRON RULE — SUBJECT FIRST. Style is costume, light, material, and crop only. A stranger must recognize the idea from the picture.",
    "Forbidden: grey cyclorama, thinking-hand stock, bland LinkedIn portrait, Canva templates, invented logos, reversed or garbled Hebrew, style-board clichés that replace the concept.",
    "After the image is generated, POST it back with action=complete as instructed in the dispatch footer. Then stop.",
  ].filter(Boolean).join("\n\n");
};
