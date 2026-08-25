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
  const stored = asConcepts(payload.approved_concepts);
  const fallback = asConcepts(payload.copy_concepts).filter((row) => row.approved === true);
  const rows = stored.length > 0 ? stored : fallback;
  if (rows.length > 0) {
    return [
      "MUST FOLLOW THIS APPROVED VISUAL CONCEPT. This block IS the photograph — subject, location, props, lighting, and the first-second hook.",
      "The slogan and headline do NOT choose the scene.",
      ...rows.map((row, index) => [
        `${index + 1}. ${text(row.name) || "קונספט"}`,
        text(row.bigIdea) && `Big idea: ${text(row.bigIdea)}`,
        text(row.visualLanguage) && `Visual language: ${text(row.visualLanguage)}`,
        text(row.hook) && `Hook/scene: ${text(row.hook)}`,
        text(row.copyAngle) && `Copy on concept: ${text(row.copyAngle)}`,
        text(row.whyItWorks) && `Why it works: ${text(row.whyItWorks)}`,
        text(row.reference) && `Reference: ${text(row.reference)}`,
      ].filter(Boolean).join("\n")),
    ].filter(Boolean).join("\n\n");
  }
  if (typeof payload.visual_prompt === "string" && payload.visual_prompt.trim()) {
    return payload.visual_prompt.trim();
  }
  if (typeof payload.concept_brief === "string" && payload.concept_brief.trim()) {
    return payload.concept_brief.trim();
  }
  return "";
}
