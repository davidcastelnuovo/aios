import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  LEAD_VIEW_MODE_LABELS,
  parseLeadViewMode,
  readStoredLeadDefaultView,
  readStoredLeadViewMode,
  writeStoredLeadViewMode,
  type LeadViewMode,
} from "@/lib/leadViewMode";

export function useLeadsViewMode(userId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const userTouchedView = useRef(false);
  const appliedProfileDefault = useRef(false);
  const [viewMode, setViewModeState] = useState<LeadViewMode>(readStoredLeadViewMode);
  const [defaultView, setDefaultViewState] = useState<LeadViewMode | null>(readStoredLeadDefaultView);

  const { data: profileDefault } = useQuery({
    queryKey: ["leads-default-view", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("leads_default_view")
        .eq("id", userId)
        .maybeSingle();
      if (error) return readStoredLeadDefaultView();
      return parseLeadViewMode(data?.leads_default_view);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (profileDefault == null || appliedProfileDefault.current || userTouchedView.current) return;
    appliedProfileDefault.current = true;
    setDefaultViewState(profileDefault);
    setViewModeState(profileDefault);
    writeStoredLeadViewMode(profileDefault, true);
  }, [profileDefault]);

  const setViewMode = (mode: LeadViewMode) => {
    userTouchedView.current = true;
    setViewModeState(mode);
    writeStoredLeadViewMode(mode);
  };

  const saveDefault = useMutation({
    mutationFn: async (mode: LeadViewMode) => {
      if (!userId) return mode;
      const { error } = await supabase
        .from("profiles")
        .update({ leads_default_view: mode })
        .eq("id", userId);
      if (error) throw error;
      return mode;
    },
    onSuccess: (mode) => {
      queryClient.setQueryData(["leads-default-view", userId], mode);
      toast({ title: `ברירת המחדל: ${LEAD_VIEW_MODE_LABELS[mode]}` });
    },
    onError: () => {
      toast({
        title: "נשמר במכשיר הזה",
        description: "לא הצלחנו לשמור בשרת — ברירת המחדל תישאר בדפדפן.",
      });
    },
  });

  const setDefaultView = (mode: LeadViewMode) => {
    userTouchedView.current = true;
    appliedProfileDefault.current = true;
    setViewModeState(mode);
    setDefaultViewState(mode);
    writeStoredLeadViewMode(mode, true);
    saveDefault.mutate(mode);
  };

  return {
    viewMode,
    setViewMode,
    defaultView: profileDefault ?? defaultView,
    setDefaultView,
    isSavingDefault: saveDefault.isPending,
  };
}
