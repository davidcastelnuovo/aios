import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTenant } from "@/contexts/TenantContext";
import {
  headerShortcutsStorageKey,
  MAX_HEADER_SHORTCUTS,
  resolveHeaderShortcuts,
  toggleHeaderShortcut,
} from "@/lib/headerShortcuts";

export function useHeaderShortcuts(accessibleKeys: string[]) {
  const { userId } = useCurrentUser();
  const { currentTenantId } = useTenant();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const accessibleFingerprint = accessibleKeys.join("|");

  const storageKey = useMemo(
    () => userId && currentTenantId
      ? headerShortcutsStorageKey(userId, currentTenantId)
      : null,
    [userId, currentTenantId],
  );

  useEffect(() => {
    if (!storageKey) {
      setSelectedKeys([]);
      return;
    }
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(storageKey);
    } catch {
      // Private browsing/storage denial: use defaults for this session.
    }
    setSelectedKeys(resolveHeaderShortcuts(stored, accessibleKeys));
    // The fingerprint keeps this stable when callers rebuild the same array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, accessibleFingerprint]);

  const toggle = useCallback((key: string) => {
    setSelectedKeys((previous) => {
      const next = toggleHeaderShortcut(previous, key);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Keep the in-memory preference when storage is unavailable.
        }
      }
      return next;
    });
  }, [storageKey]);

  return {
    selectedKeys,
    toggle,
    maxShortcuts: MAX_HEADER_SHORTCUTS,
    isAtLimit: selectedKeys.length >= MAX_HEADER_SHORTCUTS,
  };
}

