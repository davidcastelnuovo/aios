import { approvedCopyConcepts, parseCopyConceptsFromPayload, type CopyConcept } from "../../copyConcepts.ts";
import { parseCreativeCopy, type CopyParts } from "./designedLayers.ts";

export interface CopyVariationBlock {
  key: string;
  index: number;
  label: string;
  angle?: string;
  text: string;
  parts: CopyParts;
}

/** First-class copy unit stored on the work-item payload (`copy_variations`). */
export interface StoredCopyVariation {
  id: string;
  key: string;
  label: string;
  angle?: string;
  text: string;
  headline?: string;
  cta?: string;
  /** Concept this copy was written to serve. */
  conceptId?: string;
  conceptName?: string;
  approved: boolean;
  approvedAt: string | null;
}

export const COPY_VARIATIONS_PER_CONCEPT = 2;

export type ConceptCopyJob = {
  copy: CopyVariationBlock;
  concept?: CopyConcept;
};

const VARIATION_HEADER = /^(?:וריאציה|variation)\s*(\d+)\b/i;
const SPLIT_VARIATION = /(?:^|\n)(?=(?:וריאציה|variation)\s*\d+)/i;
const SPLIT_HEADLINE = /(?:^|\n)(?=כותרת\s*:)/;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const asText = (value: unknown) => typeof value === "string" ? value.trim() : "";

const parseHeader = (chunk: string) => {
  const line = chunk.split("\n")[0]?.trim() ?? "";
  const match = line.match(/^(?:וריאציה|variation)\s*(\d+)\s*(?:[—–\-|:•·]\s*(.*))?/i);
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
  const raw = typeof copyText === "string" ? copyText.trim() : "";
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

export const copyBlockLabel = (block: Pick<CopyVariationBlock, "label" | "angle">) =>
  block.angle ? `${block.label} · ${block.angle}` : block.label;

export const parseCopyVariationsFromPayload = (
  payload: Record<string, unknown> | null | undefined,
): StoredCopyVariation[] => {
  const raw = payload?.copy_variations;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    const rec = asRecord(value);
    if (!rec) return [];
    const text = asText(rec.text);
    const key = asText(rec.key);
    if (!text && !key) return [];
    const parts = text ? parseCreativeCopy(text) : {};
    return [{
      id: asText(rec.id) || crypto.randomUUID(),
      key: key || "1",
      label: asText(rec.label) || `וריאציה ${key || "1"}`,
      angle: asText(rec.angle) || undefined,
      text,
      headline: asText(rec.headline) || parts.headline,
      cta: asText(rec.cta) || parts.cta,
      conceptId: asText(rec.conceptId) || undefined,
      conceptName: asText(rec.conceptName) || undefined,
      approved: rec.approved === true,
      approvedAt: asText(rec.approvedAt) || null,
    }];
  });
};

export const hydrateCopyVariations = (
  copyText: string,
  stored: StoredCopyVariation[] = [],
): StoredCopyVariation[] => {
  const blocks = splitCopyVariations(copyText);
  if (blocks.length === 0) return stored.filter((item) => item.text.trim());
  const byKey = new Map(stored.map((item) => [item.key, item]));
  return blocks.map((block) => {
    const prev = byKey.get(block.key);
    if (prev) byKey.delete(block.key);
    return {
      id: prev?.id || crypto.randomUUID(),
      key: block.key,
      label: block.label,
      angle: block.angle,
      text: block.text,
      headline: block.parts.headline,
      cta: block.parts.cta,
      conceptId: prev?.conceptId,
      conceptName: prev?.conceptName,
      approved: prev?.approved === true,
      approvedAt: prev?.approved ? prev.approvedAt : null,
    };
  });
};

export const joinCopyVariations = (variations: StoredCopyVariation[]): string =>
  variations.map((item) => item.text.trim()).filter(Boolean).join("\n\n");

/** Body only — the `וריאציה N` header is rebuilt on save so sibling copy is never parsed in. */
export const stripVariationHeader = (text: string) => {
  const lines = text.split("\n");
  if (/^(?:וריאציה|variation)\s*\d+/i.test(lines[0]?.trim() ?? "")) {
    return lines.slice(1).join("\n").replace(/^\n+/, "");
  }
  return text;
};

/** Replace one variation's body while keeping its id/key/approval. Sibling copy is ignored. */
export const applyVariationText = (item: StoredCopyVariation, nextText: string): StoredCopyVariation => {
  const trimmed = typeof nextText === "string" ? nextText.trim() : "";
  const firstChunk = trimmed.split(SPLIT_VARIATION).map((chunk) => chunk.trim()).filter(Boolean)[0] ?? "";
  const header = parseHeader(firstChunk);
  const angle = header.angle || item.angle;
  const body = stripVariationHeader(firstChunk);
  const text = [`וריאציה ${item.key}${angle ? ` — ${angle}` : ""}`, body].filter(Boolean).join("\n").trim();
  const parts = parseCreativeCopy(text);
  return {
    ...item,
    label: `וריאציה ${item.key}`,
    angle,
    text,
    headline: parts.headline,
    cta: parts.cta,
  };
};

export const replaceCopyVariationText = (
  variations: StoredCopyVariation[],
  id: string,
  nextText: string,
): StoredCopyVariation[] =>
  variations.map((item) => item.id === id ? applyVariationText(item, nextText) : item);

export const remapCopyVariationKeys = (
  incoming: StoredCopyVariation[],
  existing: StoredCopyVariation[],
): StoredCopyVariation[] => {
  let nextKey = existing.reduce((max, item) => Math.max(max, Number.parseInt(item.key, 10) || 0), 0);
  return incoming.map((item) => {
    nextKey += 1;
    const key = String(nextKey);
    return applyVariationText({
      ...item,
      id: crypto.randomUUID(),
      key,
      label: `וריאציה ${key}`,
      approved: false,
      approvedAt: null,
    }, item.text);
  });
};

export const copiesForConcept = (
  copies: StoredCopyVariation[],
  conceptId: string,
): StoredCopyVariation[] =>
  copies.filter((item) => item.conceptId === conceptId);

export const stampCopiesWithConcept = (
  copies: StoredCopyVariation[],
  concept: Pick<CopyConcept, "id" | "name">,
): StoredCopyVariation[] =>
  copies.map((item) => applyVariationText({
    ...item,
    conceptId: concept.id,
    conceptName: concept.name,
    angle: concept.name,
  }, stripVariationHeader(item.text)));

export const linkConceptToGeneratedCopy = (
  concepts: CopyConcept[],
  conceptId: string,
  copies: StoredCopyVariation[],
): CopyConcept[] => {
  const first = copies[0];
  if (!first) return concepts;
  return concepts.map((concept) => {
    if (concept.id !== conceptId || concept.copyId) return concept;
    return {
      ...concept,
      copyId: first.id,
      copyKey: first.key,
      copyAngle: copyBlockLabel(first),
    };
  });
};

export const linkApprovedConceptsToCopy = (
  concepts: CopyConcept[],
  copies: StoredCopyVariation[],
): CopyConcept[] => {
  let index = 0;
  return concepts.map((concept) => {
    if (!concept.approved || concept.copyId) return concept;
    const copy = copies[index];
    if (!copy) return concept;
    index += 1;
    return {
      ...concept,
      copyId: copy.id,
      copyKey: copy.key,
      copyAngle: copyBlockLabel(copy),
    };
  });
};

export const approvedCopyVariations = (variations: StoredCopyVariation[]): StoredCopyVariation[] =>
  variations.filter((item) => item.approved && item.text.trim());

export const storedToCopyBlock = (item: StoredCopyVariation, index: number): CopyVariationBlock => ({
  key: item.key,
  index: index + 1,
  label: item.label,
  angle: item.angle,
  text: item.text,
  parts: parseCreativeCopy(item.text),
});

export const storedCopiesForGeneration = (
  payload: Record<string, unknown> | null | undefined,
): StoredCopyVariation[] => {
  const text = asText(payload?.copy_text);
  const hydrated = hydrateCopyVariations(text, parseCopyVariationsFromPayload(payload));
  const approved = approvedCopyVariations(hydrated);
  if (approved.length > 0) return approved;
  return hydrated.filter((item) => item.text.trim());
};

/** Approved copies when any exist; otherwise every hydrated block (legacy projects). */
export const copyBlocksForGeneration = (
  payload: Record<string, unknown> | null | undefined,
): CopyVariationBlock[] => {
  const source = storedCopiesForGeneration(payload);
  if (source.length === 0) return splitCopyVariations(asText(payload?.copy_text));
  return source.map(storedToCopyBlock);
};

const asCopyBlock = (item: StoredCopyVariation | CopyVariationBlock, index: number): CopyVariationBlock =>
  "index" in item ? item : storedToCopyBlock(item, index);

export const findCopyForConcept = (
  copies: Array<StoredCopyVariation | CopyVariationBlock>,
  concept?: Pick<CopyConcept, "copyId" | "copyKey" | "copyAngle"> | null,
): (StoredCopyVariation | CopyVariationBlock) | undefined => {
  if (!concept || copies.length === 0) return undefined;
  const byId = concept.copyId
    ? copies.find((item) => "id" in item && item.id === concept.copyId)
    : undefined;
  if (byId) return byId;
  if (concept.copyKey) {
    const byKey = copies.find((item) => item.key === concept.copyKey);
    if (byKey) return byKey;
  }
  const angle = (concept.copyAngle ?? "").trim();
  if (angle) {
    const byAngle = copies.find((item) => {
      const label = copyBlockLabel(item);
      return label === angle
        || item.key === angle
        || item.label === angle
        || (item.angle && angle.includes(item.angle))
        || angle.includes(item.key)
        || angle.includes(item.label);
    });
    if (byAngle) return byAngle;
  }
  return undefined;
};

export const pairConceptsToCopyVariations = (
  concepts: CopyConcept[],
  copies: StoredCopyVariation[],
): CopyConcept[] => {
  if (concepts.length === 0 || copies.length === 0) return concepts;
  const used = new Set<string>();
  return concepts.map((concept, index) => {
    const explicit = findCopyForConcept(copies, concept);
    const unused = copies.find((item) => !used.has(item.id));
    const linked = explicit ?? unused ?? copies[index] ?? copies[0];
    if (!linked) return concept;
    const stored = linked as StoredCopyVariation;
    if (stored.id) used.add(stored.id);
    return {
      ...concept,
      copyId: stored.id ?? concept.copyId,
      copyKey: stored.key,
      copyAngle: concept.copyAngle || copyBlockLabel(stored),
    };
  });
};

const approvedConceptsFromPayload = (payload: Record<string, unknown> | null | undefined): CopyConcept[] => {
  const storedApproved = parseCopyConceptsFromPayload({ copy_concepts: payload?.approved_concepts });
  if (storedApproved.length > 0) return storedApproved.map((concept) => ({ ...concept, approved: true }));
  return approvedCopyConcepts(parseCopyConceptsFromPayload(payload));
};

/**
 * One still per approved concept, using the copy assigned to it.
 * If there are no concepts, fall back to one still per copy block.
 */
export const conceptCopyJobsForGeneration = (
  payload: Record<string, unknown> | null | undefined,
): ConceptCopyJob[] => {
  const stored = storedCopiesForGeneration(payload);
  const blocks = stored.length > 0
    ? stored.map(storedToCopyBlock)
    : splitCopyVariations(asText(payload?.copy_text));
  const concepts = approvedConceptsFromPayload(payload);
  if (concepts.length === 0) return blocks.map((copy) => ({ copy }));
  if (blocks.length === 0) return concepts.map((concept) => ({ concept, copy: toBlock("", 1, concept.copyKey || "1") }));
  return concepts.map((concept, index) => {
    const linked = findCopyForConcept(stored.length > 0 ? stored : blocks, concept);
    const copy = linked ? asCopyBlock(linked, index) : (blocks[index] ?? blocks[0]);
    return { concept, copy };
  });
};

export const formatCopyVariationsForConcepts = (copies: StoredCopyVariation[]): string =>
  copies.map((item) => [
    `${item.key}. ${copyBlockLabel(item)}`,
    item.headline && `כותרת: ${item.headline}`,
    item.cta && `CTA: ${item.cta}`,
    item.text,
  ].filter(Boolean).join("\n")).join("\n\n");
