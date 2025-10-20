import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { User, LogOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAgency } from "@/contexts/AgencyContext";
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
  const { selectedAgency, setSelectedAgency } = useAgency();

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast({
      title: "התנתקת בהצלחה",
      description: "להתראות!",
    });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden" dir="rtl">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-x-hidden">
          <header className="sticky top-0 z-50 h-16 border-b bg-card flex items-center justify-between px-4 md:px-6 gap-2 md:gap-4 flex-shrink-0">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <SidebarTrigger />
              <h1 className="text-sm md:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
                מערכת ניהול סוכנויות
              </h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                <SelectTrigger className="w-[140px] md:w-[200px] bg-background">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="כל הסוכנויות" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">כל הסוכנויות</SelectItem>
                  {agencies?.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background z-50">
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    התנתק
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}