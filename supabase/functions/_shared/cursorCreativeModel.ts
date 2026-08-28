/** Cloud Agent model selection. IDs come from GET /v1/models — never `composer-2.5-fast`. */

export type CursorModelSelection = {
  id: string;
  params?: Array<{ id: string; value: string }>;
};

type CatalogItem = {
  id?: string;
  aliases?: string[];
  parameters?: Array<{ id?: string; values?: Array<{ value?: string }> }>;
};

const FAST = { id: "fast", value: "true" } as const;

/** Map a secret / alias to a valid `model` object for POST /v1/agents. */
export function resolveCreativeCursorModel(raw?: string | null): CursorModelSelection {
  const value = String(raw ?? "").trim();
  if (!value || value === "default" || value === "auto") {
    return { id: "composer-2.5", params: [FAST] };
  }
  if (value.endsWith("-fast")) {
    const id = value.slice(0, -"-fast".length);
    return { id: id || "composer-2.5", params: [FAST] };
  }
  if (/^composer-2(\.5)?$/.test(value)) {
    return { id: value === "composer-2" ? "composer-2.5" : value, params: [FAST] };
  }
  return { id: value };
}

export function pickCreativeModelFromCatalog(
  items: CatalogItem[] | undefined,
  preferred: CursorModelSelection,
): CursorModelSelection {
  const list = Array.isArray(items) ? items : [];
  const match = list.find((item) => {
    const id = String(item.id ?? "");
    const aliases = Array.isArray(item.aliases) ? item.aliases.map(String) : [];
    return id === preferred.id || aliases.includes(preferred.id);
  }) ?? list.find((item) => String(item.id ?? "").startsWith("composer-"));
  if (!match?.id) return preferred;
  const hasFast = (match.parameters ?? []).some((parameter) => parameter.id === "fast"
    && (parameter.values ?? []).some((entry) => entry.value === "true"));
  return hasFast ? { id: match.id, params: [FAST] } : { id: match.id };
}

export const isInvalidCursorModelError = (message: string): boolean =>
  /not available or invalid|unknown model|invalid model/i.test(message);
