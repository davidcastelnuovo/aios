import { parseCreativeCopy, type CopyParts } from "./designedLayers";

export interface CopyVariationBlock {
  key: string;
  index: number;
  label: string;
  angle?: string;
  text: string;
  parts: CopyParts;
}

const VARIATION_HEADER = /^(?:וריאציה|variation)\s*(\d+)\b/i;
const SPLIT_VARIATION = /(?:^|\n)(?=(?:וריאציה|variation)\s*\d+)/i;
const SPLIT_HEADLINE = /(?:^|\n)(?=כותרת\s*:)/;

const parseHeader = (chunk: string) => {
  const line = chunk.split("\n")[0]?.trim() ?? "";
  const match = line.match(/^(?:וריאציה|variation)\s*(\d+)\s*(?:[—–\-|:]\s*(.*))?/i);
  if (!match) return {};
  const angle = (match[2] ?? "")
    .replace(/\b(AIDA|PAS|BAB|4Ps|4PS|framework)\b/gi, "")
    .replace(/[—–\-:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { n: match[1], label: `וריאציה ${match[1]}`, angle: angle || undefined };
};

const toBlock = (chunk: string, index: number, fallbackKey?: string): CopyVariationBlock => {
  const header = parseHeader(chunk);
  const key = header.n ?? fallbackKey ?? String(index);
  const label = header.label ?? `וריאציה ${index}`;
  return {
    key,
    index,
    label,
    angle: header.angle,
    text: chunk.trim(),
    parts: parseCreativeCopy(chunk),
  };
};

export const splitCopyVariations = (copyText: string): CopyVariationBlock[] => {
  const raw = copyText.trim();
  if (!raw) return [];

  const variationChunks = raw.split(SPLIT_VARIATION).map((chunk) => chunk.trim()).filter(Boolean);
  if (variationChunks.length > 1 || VARIATION_HEADER.test(variationChunks[0] ?? "")) {
    return variationChunks.map((chunk, index) => toBlock(chunk, index + 1));
  }

  const headlineChunks = raw.split(SPLIT_HEADLINE).map((chunk) => chunk.trim()).filter(Boolean);
  if (headlineChunks.length > 1) {
    return headlineChunks.map((chunk, index) => toBlock(chunk.startsWith("כותרת") ? chunk : `כותרת:\n${chunk}`, index + 1, String(index + 1)));
  }

  return [toBlock(raw, 1, "1")];
};

export const copyBlockLabel = (block: CopyVariationBlock) =>
  block.angle ? `${block.label} · ${block.angle}` : block.label;
