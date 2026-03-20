import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type UIMode = "classic" | "aios";

interface UIModeContextType {
  mode: UIMode;
  toggleMode: () => void;
  isLoading: boolean;
}

const UIModeContext = createContext<UIModeContextType>({
  mode: "classic",
  toggleMode: () => {},
  isLoading: true,
});

export function UIModeProvider({ children }: { children: ReactNode }) {
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: mode = "classic", isLoading } = useQuery({
    queryKey: ["ui-mode", userId],
    queryFn: async () => {
      if (!userId) return "classic" as UIMode;
      const { data, error } = await supabase
        .from("profiles")
        .select("ui_mode")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return (data?.ui_mode as UIMode) || "classic";
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
  });

  const toggleMode = async () => {
    if (!userId) return;
    const newMode: UIMode = mode === "classic" ? "aios" : "classic";
    
    // Optimistic update
    queryClient.setQueryData(["ui-mode", userId], newMode);
    
    await (supabase as any)
      .from("profiles")
      .update({ ui_mode: newMode })
      .eq("id", userId);
  };

  return (
    <UIModeContext.Provider value={{ mode, toggleMode, isLoading }}>
      {children}
    </UIModeContext.Provider>
  );
}

export const useUIMode = () => useContext(UIModeContext);
