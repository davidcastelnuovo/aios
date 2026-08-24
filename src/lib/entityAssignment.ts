export type EntityAssignmentOption = {
  id: string;
  label: string;
  description?: string | null;
};

export function filterEntityAssignmentOptions<T extends EntityAssignmentOption>(
  options: readonly T[],
  search: string,
): T[] {
  const term = search.trim().toLocaleLowerCase("he");
  if (!term) return [...options];
  return options.filter((option) =>
    `${option.label} ${option.description || ""}`.toLocaleLowerCase("he").includes(term)
  );
}

export function toggleEntityAssignmentId(
  selectedIds: readonly string[],
  id: string,
  multiple: boolean,
): string[] {
  if (!multiple) return [id];
  return selectedIds.includes(id)
    ? selectedIds.filter((selectedId) => selectedId !== id)
    : [...selectedIds, id];
}

