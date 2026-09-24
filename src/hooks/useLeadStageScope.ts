import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  LEAD_STAGE_SCOPE_LABELS,
  parseLeadStageScope,
  readStoredLeadStageScope,
  writeStoredLeadStageScope,
  type LeadStageScope,
} from "@/lib/leadStageScope";

export function useLeadStageScope(userId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const appliedProfileDefault = useRef(false);
  const [stageScope, setStageScopeState] = useState<LeadStageScope | null>(readStoredLeadStageScope);

  const { data: profileDefault } = useQuery({
    queryKey: ["leads-default-stage-scope", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("leads_default_stage")
        .eq("id", userId)
        .maybeSingle();
      if (error) return readStoredLeadStageScope();
      return parseLeadStageScope(data?.leads_default_stage);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (profileDefault == null || appliedProfileDefault.current) return;
    appliedProfileDefault.current = true;
    setStageScopeState(profileDefault);
    writeStoredLeadStageScope(profileDefault);
  }, [profileDefault]);

  const saveDefault = useMutation({
    mutationFn: async (scope: LeadStageScope) => {
      if (!userId) return scope;
      const { error } = await supabase
        .from("profiles")
        .update({ leads_default_stage: scope })
        .eq("id", userId);
      if (error) throw error;
      return scope;
    },
    onSuccess: (scope) => {
      queryClient.setQueryData(["leads-default-stage-scope", userId], scope);
      toast({ title: `ברירת המחדל: ${LEAD_STAGE_SCOPE_LABELS[scope]}` });
    },
    onError: () => {
      toast({
        title: "נשמר במכשיר הזה",
        description: "לא הצלחנו לשמור בשרת — ברירת המחדל תישאר בדפדפן.",
      });
    },
  });

  const setDefaultStageScope = (scope: LeadStageScope) => {
    appliedProfileDefault.current = true;
    setStageScopeState(scope);
    writeStoredLeadStageScope(scope);
    saveDefault.mutate(scope);
  };

  return {
    defaultStageScope: profileDefault ?? stageScope,
    setDefaultStageScope,
  };
}
