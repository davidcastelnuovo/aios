/** Read approved copy concepts off a work-item payload for creative generation. */

type ConceptLike = {
  name?: unknown;
  bigIdea?: unknown;
  visualLanguage?: unknown;
  hook?: unknown;
  copyAngle?: unknown;
  whyItWorks?: unknown;
  reference?: unknown;
  approved?: unknown;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function asConcepts(value: unknown): ConceptLike[] {
  return Array.isArray(value) ? value.filter((row): row is ConceptLike => !!row && typeof row === "object") : [];
}

export function formatApprovedConceptsFromPayload(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return "";
  if (typeof payload.concept_brief === "string" && payload.concept_brief.trim()) {
    return payload.concept_brief.trim();
  }
  const stored = asConcepts(payload.approved_concepts);
  const fallback = asConcepts(payload.copy_concepts).filter((row) => row.approved === true);
  const rows = stored.length > 0 ? stored : fallback;
  return rows.map((row, index) => [
    `${index + 1}. ${text(row.name) || "קונספט"}`,
    text(row.bigIdea) && `Big idea: ${text(row.bigIdea)}`,
    text(row.visualLanguage) && `Visual language: ${text(row.visualLanguage)}`,
    text(row.hook) && `Hook/scene: ${text(row.hook)}`,
    text(row.copyAngle) && `Copy on concept: ${text(row.copyAngle)}`,
    text(row.whyItWorks) && `Why it works: ${text(row.whyItWorks)}`,
    text(row.reference) && `Reference: ${text(row.reference)}`,
  ].filter(Boolean).join("\n")).join("\n\n");
}
