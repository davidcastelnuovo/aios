import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

import { DEFAULT_LAYOUTS } from "../utils/layoutUtils";
import type { IslandId, LayoutItem } from "../types/visualWorkspaceTypes";

type LayoutMap = Record<string, LayoutItem>;

export function useWorkspaceLayout() {
  const { tenantId } = useCurrentTenant();
  const [userId, setUserId] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutMap>(() => ({ ...DEFAULT_LAYOUTS }));
  const [loaded, setLoaded] = useState(false);
  const saveTimers = useRef<Record<string, any>>({});

  // Resolve user id once
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Load saved layout
  useEffect(() => {
    if (!userId || !tenantId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_workspace_layout")
        .select("module_id, x_position, y_position, width, height, is_open")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId);
      if (cancelled) return;
      const merged: LayoutMap = { ...DEFAULT_LAYOUTS };
      (data ?? []).forEach((row: any) => {
        merged[row.module_id] = {
          module_id: row.module_id,
          x_position: row.x_position,
          y_position: row.y_position,
          width: row.width,
          height: row.height,
          is_open: row.is_open,
        };
      });
      setLayout(merged);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [userId, tenantId]);

  const persist = useCallback((moduleId: string, item: LayoutItem) => {
    if (!userId || !tenantId) return;
    clearTimeout(saveTimers.current[moduleId]);
    saveTimers.current[moduleId] = setTimeout(async () => {
      await supabase
        .from("user_workspace_layout")
        .upsert(
          {
            user_id: userId,
            tenant_id: tenantId,
            module_id: moduleId,
            x_position: item.x_position,
            y_position: item.y_position,
            width: item.width,
            height: item.height,
            is_open: item.is_open,
          },
          { onConflict: "user_id,tenant_id,module_id" }
        );
    }, 800);
  }, [userId, tenantId]);

  const updateItem = useCallback((moduleId: string, patch: Partial<LayoutItem>) => {
    setLayout((prev) => {
      const current = prev[moduleId] ?? DEFAULT_LAYOUTS[(moduleId as IslandId)] ?? {
        module_id: moduleId, x_position: 0, y_position: 0, width: 320, height: 220, is_open: false,
      };
      const next = { ...current, ...patch, module_id: moduleId };
      persist(moduleId, next);
      return { ...prev, [moduleId]: next };
    });
  }, [persist]);

  return { layout, updateItem, loaded };
}
