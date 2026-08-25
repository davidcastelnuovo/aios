export interface CopyConcept {
  id: string;
  name: string;
  bigIdea: string;
  visualLanguage: string;
  hook: string;
  copyAngle: string;
  whyItWorks: string;
  reference: string;
  approved: boolean;
  approvedAt: string | null;
}

const FIELD_ALIASES: Record<keyof Omit<CopyConcept, "id" | "approved" | "approvedAt">, string[]> = {
  name: ["שם", "name", "title"],
  bigIdea: ["רעיון", "רעיון גדול", "big idea", "idea"],
  visualLanguage: ["ויזואל", "שפה ויזואלית", "visual", "visual language"],
  hook: ["הוק", "סצנה", "hook", "scene"],
  copyAngle: ["קופי", "זווית קופי", "copy"],
  whyItWorks: ["למה", "למה זה עובד", "why"],
  reference: ["רפרנס", "reference", "ref"],
};

const emptyConcept = (): CopyConcept => ({
  id: crypto.randomUUID(),
  name: "",
  bigIdea: "",
  visualLanguage: "",
  hook: "",
  copyAngle: "",
  whyItWorks: "",
  reference: "",
  approved: false,
  approvedAt: null,
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function parseCopyConceptsFromPayload(payload: Record<string, unknown> | null | undefined): CopyConcept[] {
  const raw = payload?.copy_concepts;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    const rec = asRecord(value);
    if (!rec) return [];
    const name = text(rec.name);
    const bigIdea = text(rec.bigIdea);
    if (!name && !bigIdea) return [];
    return [{
      id: text(rec.id) || crypto.randomUUID(),
      name: name || "קונספט",
      bigIdea,
      visualLanguage: text(rec.visualLanguage),
      hook: text(rec.hook),
      copyAngle: text(rec.copyAngle),
      whyItWorks: text(rec.whyItWorks),
      reference: text(rec.reference),
      approved: rec.approved === true,
      approvedAt: text(rec.approvedAt) || null,
    }];
  });
}

export function approvedCopyConcepts(concepts: CopyConcept[]): CopyConcept[] {
  return concepts.filter((concept) => concept.approved);
}

export function formatCopyConceptsForCreative(concepts: CopyConcept[]): string {
  return concepts.map((concept, index) => [
    `${index + 1}. ${concept.name}`,
    concept.bigIdea && `רעיון גדול: ${concept.bigIdea}`,
    concept.visualLanguage && `שפה ויזואלית: ${concept.visualLanguage}`,
    concept.hook && `הוק / סצנה: ${concept.hook}`,
    concept.copyAngle && `קופי על הקונספט: ${concept.copyAngle}`,
    concept.whyItWorks && `למה זה עובד: ${concept.whyItWorks}`,
    concept.reference && `רפרנס: ${concept.reference}`,
  ].filter(Boolean).join("\n")).join("\n\n");
}

export function extractConceptsDocument(output: string): string {
  const marker = output.split(/---CONCEPTS---/i);
  const body = (marker.length > 1 ? marker.slice(1).join("---CONCEPTS---") : output).trim();
  return body.replace(/^```(?:markdown|md|json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

const matchField = (label: string): keyof CopyConcept | null => {
  const normalized = label.trim().toLowerCase();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof typeof FIELD_ALIASES, string[]][]) {
    if (aliases.some((alias) => normalized === alias.toLowerCase() || normalized.startsWith(`${alias.toLowerCase()} `))) {
      return field;
    }
  }
  return null;
};

const applyField = (concept: CopyConcept, field: keyof CopyConcept, value: string) => {
  if (field === "id" || field === "approved" || field === "approvedAt") return;
  concept[field] = value;
};

export function parseConceptsFromCarmen(output: string): CopyConcept[] {
  const document = extractConceptsDocument(output);
  const jsonBlock = document.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock[0]) as unknown;
      const rows = Array.isArray(parsed)
        ? parsed
        : asRecord(parsed)?.concepts ?? asRecord(parsed)?.copy_concepts;
      if (Array.isArray(rows)) {
        const fromJson = parseCopyConceptsFromPayload({ copy_concepts: rows });
        if (fromJson.length > 0) return fromJson.slice(0, 5);
      }
    } catch {
      // Fall through to markdown parser.
    }
  }

  const headingChunks = document.split(/^#{1,3}\s+/m).map((chunk) => chunk.trim()).filter(Boolean);
  const numberedChunks = document.split(/\n(?=\d+\s*[.)\-–])/).map((chunk) => chunk.trim()).filter(Boolean);
  const source = headingChunks.length > 1 ? headingChunks : numberedChunks;
  const concepts: CopyConcept[] = [];

  for (const chunk of source) {
    const concept = emptyConcept();
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const heading = lines[0].replace(/^\d+\s*[.|)\-–]\s*/, "").replace(/^\|\s*/, "").trim();
    if (heading && !heading.includes(":")) concept.name = heading.replace(/^שם[:\s]*/, "");

    for (const line of lines.slice(concept.name === heading ? 1 : 0)) {
      const split = line.match(/^([^:]{2,24})\s*[:：]\s*(.+)$/);
      if (!split) continue;
      const field = matchField(split[1]);
      if (field) applyField(concept, field, split[2].trim());
    }

    if (concept.name || concept.bigIdea) {
      concept.name = concept.name || `קונספט ${concepts.length + 1}`;
      concepts.push(concept);
    }
  }

  return concepts.slice(0, 5);
}

export const CONCEPTS_OUTPUT_HINT = [
  "---CONCEPTS---",
  "### 1 | שם הקונספט",
  "רעיון: הרעיון הגדול במשפט אחד",
  "ויזואל: שפה ויזואלית, קומפוזיציה, צבע, טיפוגרפיה",
  "הוק: מה רואים בשנייה הראשונה",
  "קופי: איזו שורת קופי יושבת על הקונספט הזה",
  "למה: למה זה ייצר גרפיקה מעניינת יותר מטקסט על רקע",
  "רפרנס: שם קמפיין קנוני או בלי",
].join("\n");
