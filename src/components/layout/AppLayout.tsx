import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { LogOut, Building2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/contexts/AgencyContext";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedAgency, setSelectedAgency, agencies } = useAgency();
  const { userId } = useCurrentUser();
  const { currentTenantId, setCurrentTenantId, currentTenant } = useTenant();

  // Fetch available tenants for the user
  const { data: userTenants } = useQuery({
    queryKey: ["user-tenants", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(id, name)")
        .eq("user_id", userId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const handleTenantChange = async (tenantId: string) => {
    try {
      // Update user_active_tenant in the database
      await (supabase as any)
        .from("user_active_tenant")
        .upsert({
          user_id: userId,
          tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id"
        });

      setCurrentTenantId(tenantId);
      
      toast({
        title: "עובר לארגון...",
        description: "המערכת עוברת לארגון החדש",
      });

      // Reload to refresh all data
      window.location.reload();
    } catch (error) {
      console.error("Error switching tenant:", error);
      toast({
        title: "שגיאה",
        description: "לא הצלחנו לעבור לארגון החדש",
        variant: "destructive",
      });
    }
  };

  // Check user status and process invitation if pending
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchInterval: false, // Don't auto-refetch
  });

  useEffect(() => {
    const processInvitation = async () => {
      if (!userId || !userProfile || userProfile.status !== 'pending') return;

      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) return;

        const { data, error } = await supabase.functions.invoke("process-user-invitation", {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });

        if (error) {
          console.error("Error processing invitation:", error);
        } else if (data?.success) {
          // Reload the page to refresh all data
          window.location.reload();
        }
      } catch (error) {
        console.error("Error calling process-user-invitation:", error);
      }
    };

    processInvitation();
  }, [userId, userProfile]);

  const handleLogout = async () => {
    try {
      // Try to revoke tokens server-side (global)
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
    } catch (err) {
      // If server rejects (e.g., session_not_found), clear locally as fallback
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (_) {}
      // Hard-clear any lingering auth tokens in localStorage
      try {
        Object.keys(localStorage).forEach((k) => {
          if (/^sb-.*-auth-token$/.test(k)) localStorage.removeItem(k);
        });
      } catch (_) {}
    } finally {
      // Ensure redirect to auth regardless
      navigate('/auth', { replace: true });
      toast({
        title: 'התנתקת בהצלחה',
        description: 'להתראות!',
      });
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full overflow-x-hidden" dir="rtl">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-x-hidden">
          <header className="sticky top-0 z-50 h-16 border-b bg-card flex items-center justify-between px-4 md:px-6 gap-2 md:gap-4 flex-shrink-0">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <SidebarTrigger className="hover:bg-accent transition-colors" />
              <h1 className="text-sm md:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
                מערכת ניהול סוכנויות
              </h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              {agencies && agencies.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden sm:inline">סוכנות:</span>
                  <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                    <SelectTrigger className="w-[160px] md:w-[220px] bg-background border-2">
                      <Building2 className="h-4 w-4 mr-2 flex-shrink-0" />
                      <SelectValue placeholder="בחר סוכנות" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-[100]">
                      {agencies.length > 1 && (
                        <SelectItem value="all">כל הסוכנויות</SelectItem>
                      )}
                      {agencies.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id}>
                          {agency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <img src={logo} alt="Logo" className="h-8 w-8 object-contain" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background z-[100]">
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    התנתק
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-y-scroll overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
