import {
  approvedCopyConcepts,
  formatCopyConceptsForCreative,
  formatCopyConceptsForImagePrompt,
  parseCopyConceptsFromPayload,
  type CopyConcept,
} from "./copyConcepts.ts";
import {
  approvedCopyVariations,
  hydrateCopyVariations,
  joinCopyVariations,
  pairConceptsToCopyVariations,
  parseCopyVariationsFromPayload,
} from "./departments/creative/copyVariations.ts";
import { isCreativeDepartmentItem } from "./departmentFilters.ts";

export type HandoffWorkItem = {
  id: string;
  title: string | null;
  payload: Record<string, unknown> | null;
  client_id: string | null;
  status?: string | null;
  current_stage_id?: string | null;
  updated_at?: string;
  created_at?: string;
};

const asText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const byUpdatedDesc = (a: HandoffWorkItem, b: HandoffWorkItem) => {
  const aTime = Date.parse(a.updated_at || a.created_at || "") || 0;
  const bTime = Date.parse(b.updated_at || b.created_at || "") || 0;
  return bTime - aTime;
};

const isCopyLinkedCreative = (item: HandoffWorkItem) => {
  const intake = asText(item.payload?.intake_source);
  return item.payload?.handoff_from === "copy"
    || intake === "copy_link"
    || intake === "copy_handoff";
};

/** Prefer an explicit pointer, then linked_copy_item_id, then same-title copy-origin sibling. */
export function findExistingCreativeSibling(
  copyItem: HandoffWorkItem,
  candidates: HandoffWorkItem[],
): HandoffWorkItem | null {
  const others = candidates.filter((item) => item.id !== copyItem.id);
  const pointed = asText(copyItem.payload?.handoff_to_creative_item_id);
  if (pointed) {
    const hit = others.find((item) => item.id === pointed);
    if (hit) return hit;
  }

  const linked = others
    .filter((item) => asText(item.payload?.linked_copy_item_id) === copyItem.id)
    .sort(byUpdatedDesc);
  if (linked[0]) return linked[0];

  const title = (copyItem.title ?? "").trim();
  if (!title) return null;
  const sameTitle = others
    .filter((item) => (item.title ?? "").trim() === title)
    .filter((item) => item.client_id === copyItem.client_id)
    .filter(isCopyLinkedCreative)
    .sort(byUpdatedDesc);
  return sameTitle[0] ?? null;
}

/** Open creative projects for the same client — used when the user chooses existing vs new. */
export function listOpenCreativeProjects(
  copyItem: HandoffWorkItem,
  candidates: HandoffWorkItem[],
  creativeStageIds: Iterable<string> = [],
): HandoffWorkItem[] {
  const stageIds = new Set(creativeStageIds);
  return candidates
    .filter((item) => item.id !== copyItem.id)
    .filter((item) => !copyItem.client_id || item.client_id === copyItem.client_id)
    .filter((item) => (item.status ?? "draft") !== "archived")
    .filter((item) => {
      const stageId = item.current_stage_id && stageIds.has(item.current_stage_id)
        ? item.current_stage_id
        : undefined;
      return isCreativeDepartmentItem(item, stageId);
    })
    .sort(byUpdatedDesc);
}

export function suggestedCreativeTarget(
  copyItem: HandoffWorkItem,
  openProjects: HandoffWorkItem[],
): HandoffWorkItem | null {
  const sibling = findExistingCreativeSibling(copyItem, openProjects);
  if (sibling && openProjects.some((item) => item.id === sibling.id)) return sibling;
  return openProjects[0] ?? null;
}

export function overlayCopyHandoffPayload({
  existingPayload,
  copyPayload,
  copyItem,
  concepts,
  approved,
  at,
}: {
  existingPayload: Record<string, unknown> | null | undefined;
  copyPayload: Record<string, unknown> | null | undefined;
  copyItem: { id: string; title: string | null };
  concepts: CopyConcept[];
  approved: CopyConcept[];
  at: string;
}): Record<string, unknown> {
  const existing = existingPayload ?? {};
  const copy = copyPayload ?? {};
  const copyVariations = hydrateCopyVariations(
    asText(copy.copy_text) || asText(existing.copy_text),
    parseCopyVariationsFromPayload(copy).length > 0
      ? parseCopyVariationsFromPayload(copy)
      : parseCopyVariationsFromPayload(existing),
  );
  const approvedCopy = approvedCopyVariations(copyVariations);
  const pairSource = approvedCopy.length > 0 ? approvedCopy : copyVariations;
  const pairedConcepts = concepts.length > 0
    ? pairConceptsToCopyVariations(concepts, pairSource)
    : parseCopyConceptsFromPayload(existing);
  const pairedApproved = approved.length > 0
    ? pairConceptsToCopyVariations(approved, pairSource)
    : approvedCopyConcepts(pairedConcepts);
  const copyText = joinCopyVariations(approvedCopy.length > 0 ? approvedCopy : copyVariations)
    || asText(copy.copy_text)
    || asText(existing.copy_text);
  const primary = pairedApproved[0];
  const conceptBrief = formatCopyConceptsForCreative(pairedApproved);
  const visualPrompt = formatCopyConceptsForImagePrompt(pairedApproved);
  return {
    ...existing,
    department: "creative",
    project_type: existing.project_type ?? "static",
    format: existing.format ?? copy.format ?? "1:1",
    copy_text: copyText,
    copy_variations: copyVariations.length > 0 ? cloneJson(copyVariations) : cloneJson(existing.copy_variations ?? []),
    brief_text: copy.brief_text ?? existing.brief_text ?? "",
    copy_concepts: pairedConcepts.length > 0 ? cloneJson(pairedConcepts) : cloneJson(existing.copy_concepts ?? []),
    approved_concepts: pairedApproved.length > 0 ? cloneJson(pairedApproved) : cloneJson(existing.approved_concepts ?? []),
    creative_concept: primary
      ? {
        name: primary.name,
        bigIdea: primary.bigIdea,
        visualLanguage: primary.visualLanguage,
        whyItWorks: primary.whyItWorks,
        hook: primary.hook,
      }
      : existing.creative_concept,
    concept_brief: conceptBrief || existing.concept_brief || "",
    visual_prompt: visualPrompt || asText(existing.visual_prompt),
    linked_copy_item_id: copyItem.id,
    linked_copy_title: copyItem.title,
    handoff_from: "copy",
    handoff_at: at,
    intake_source: existing.intake_source ?? "copy_handoff",
    content_type: copy.content_type ?? existing.content_type,
    channel: copy.channel ?? existing.channel,
    instructions: copy.instructions ?? existing.instructions,
    notes: [
      conceptBrief && `קונספטים מאושרים:\n${conceptBrief}`,
      asText(copy.notes) || asText(existing.notes),
    ].filter(Boolean).join("\n\n"),
  };
}

/** Copy items that still have text or concepts worth attaching to a creative project. */
export function copyPullSummary(payload: Record<string, unknown> | null | undefined) {
  const concepts = parseCopyConceptsFromPayload(payload);
  const approved = approvedCopyConcepts(concepts);
  const copyText = asText(payload?.copy_text);
  const briefText = asText(payload?.brief_text);
  return {
    concepts,
    approved,
    conceptCount: concepts.length,
    approvedCount: approved.length,
    copyText,
    briefText,
    pullable: copyText.length > 0 || briefText.length > 0 || concepts.length > 0,
  };
}

export function stampCopyPayloadAfterHandoff(
  copyPayload: Record<string, unknown> | null | undefined,
  creativeItemId: string,
  at: string,
): Record<string, unknown> {
  return {
    ...(copyPayload ?? {}),
    department: "copy",
    handoff_to_creative_item_id: creativeItemId,
    last_handoff_at: at,
  };
}
