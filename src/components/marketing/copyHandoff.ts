import {
  formatCopyConceptsForCreative,
  formatCopyConceptsForImagePrompt,
  type CopyConcept,
} from "./copyConcepts.ts";

export type HandoffWorkItem = {
  id: string;
  title: string | null;
  payload: Record<string, unknown> | null;
  client_id: string | null;
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
  const primary = approved[0];
  const conceptBrief = formatCopyConceptsForCreative(approved);
  const visualPrompt = formatCopyConceptsForImagePrompt(approved);
  return {
    ...existing,
    department: "creative",
    project_type: existing.project_type ?? "static",
    format: existing.format ?? copy.format ?? "1:1",
    copy_text: copy.copy_text ?? existing.copy_text ?? "",
    brief_text: copy.brief_text ?? existing.brief_text ?? "",
    copy_concepts: cloneJson(concepts),
    approved_concepts: cloneJson(approved),
    creative_concept: primary
      ? {
        name: primary.name,
        bigIdea: primary.bigIdea,
        visualLanguage: primary.visualLanguage,
        whyItWorks: primary.whyItWorks,
        hook: primary.hook,
      }
      : existing.creative_concept,
    concept_brief: conceptBrief,
    visual_prompt: visualPrompt,
    linked_copy_item_id: copyItem.id,
    linked_copy_title: copyItem.title,
    handoff_from: "copy",
    handoff_at: at,
    intake_source: existing.intake_source ?? "copy_handoff",
    content_type: copy.content_type ?? existing.content_type,
    channel: copy.channel ?? existing.channel,
    instructions: copy.instructions ?? existing.instructions,
    notes: [`קונספטים מאושרים:\n${conceptBrief}`, asText(copy.notes)].filter(Boolean).join("\n\n"),
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
