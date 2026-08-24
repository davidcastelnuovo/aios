export const DEFAULT_HEADER_SHORTCUT_KEYS = ["tasks", "clients", "dynamic-tables"] as const;
export const MAX_HEADER_SHORTCUTS = 5;

export function headerShortcutsStorageKey(userId: string, tenantId: string): string {
  return `headerShortcuts:${userId}:${tenantId}`;
}

function uniqueAccessible(keys: string[], accessibleKeys: readonly string[]): string[] {
  const accessible = new Set(accessibleKeys);
  return [...new Set(keys)].filter((key) => accessible.has(key));
}

export function resolveHeaderShortcuts(
  storedValue: string | null,
  accessibleKeys: readonly string[],
): string[] {
  const defaults = () =>
    uniqueAccessible([...DEFAULT_HEADER_SHORTCUT_KEYS], accessibleKeys)
      .slice(0, MAX_HEADER_SHORTCUTS);

  if (storedValue === null) {
    return defaults();
  }

  try {
    const parsed = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) return defaults();
    return uniqueAccessible(
      parsed.filter((key): key is string => typeof key === "string"),
      accessibleKeys,
    ).slice(0, MAX_HEADER_SHORTCUTS);
  } catch {
    return defaults();
  }
}

export function toggleHeaderShortcut(
  selectedKeys: readonly string[],
  key: string,
  max = MAX_HEADER_SHORTCUTS,
): string[] {
  if (selectedKeys.includes(key)) {
    return selectedKeys.filter((selectedKey) => selectedKey !== key);
  }
  if (selectedKeys.length >= max) return [...selectedKeys];
  return [...selectedKeys, key];
}

