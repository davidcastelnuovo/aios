import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";

const useBuildPath = () => {
  const { buildPath } = useTenantPath();
  return buildPath;
};
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Search, Plus, Settings, TrendingUp, TrendingDown, Minus, 
  RefreshCw, ExternalLink, MoreVertical, Trash2, Play, AlertCircle
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface RankProject {
  id: string;
  name: string;
  domain: string;
  country: string;
  language: string;
  device: string;
  check_frequency: string;
  is_active: boolean;
  last_checked_at: string | null;
  created_at: string;
  client_id: string | null;
  agency_id: string | null;
  keywords_count?: number;
  avg_position?: number;
  top10_count?: number;
}

export default function RankTracking() {
  const { tenantId } = useCurrentTenant();
  const tenantPath = useBuildPath();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    domain: "",
    country: "il",
    language: "he",
    device: "desktop",
    check_frequency: "daily",
    client_id: "",
    agency_id: "",
  });

  // Check SerpAPI connection
  const { data: serpStatus } = useQuery({
    queryKey: ["serpapi-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { connected: false };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serpapi-auth?action=status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) return { connected: false };
      return response.json();
    },
  });

  // Fetch projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ["rank-tracking-projects", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data: projectsData, error } = await supabase
        .from("rank_tracking_projects")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get keyword stats for each project
      const projectsWithStats = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { data: keywords } = await supabase
            .from("rank_tracking_keywords")
            .select("current_position")
            .eq("project_id", project.id)
            .eq("is_active", true);

          const positions = (keywords || [])
            .map(k => k.current_position)
            .filter((p): p is number => p !== null);

          return {
            ...project,
            keywords_count: keywords?.length || 0,
            avg_position: positions.length > 0 
              ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length * 10) / 10 
              : null,
            top10_count: positions.filter(p => p <= 10).length,
          };
        })
      );

      return projectsWithStats as RankProject[];
    },
    enabled: !!tenantId,
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newProject) => {
      if (!tenantId) throw new Error("No tenant");

      const { error } = await supabase.from("rank_tracking_projects").insert({
        tenant_id: tenantId,
        name: data.name,
        domain: data.domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0],
        country: data.country,
        language: data.language,
        device: data.device,
        check_frequency: data.check_frequency,
        client_id: data.client_id || null,
        agency_id: data.agency_id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("פרויקט נוצר בהצלחה!");
      setIsCreateOpen(false);
      setNewProject({
        name: "",
        domain: "",
        country: "il",
        language: "he",
        device: "desktop",
        check_frequency: "daily",
        client_id: "",
        agency_id: "",
      });
      queryClient.invalidateQueries({ queryKey: ["rank-tracking-projects"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "שגיאה ביצירת פרויקט");
    },
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from("rank_tracking_projects")
        .delete()
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("פרויקט נמחק");
      queryClient.invalidateQueries({ queryKey: ["rank-tracking-projects"] });
    },
    onError: () => {
      toast.error("שגיאה במחיקת פרויקט");
    },
  });

  // Scan project mutation
  const scanMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serpapi-search`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "bulk_search",
            projectId,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Scan failed");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`סריקה הושלמה! נבדקו ${data.checked_count} ביטויים`);
      queryClient.invalidateQueries({ queryKey: ["rank-tracking-projects"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "שגיאה בסריקה");
    },
  });

  const handleCreate = () => {
    if (!newProject.name.trim() || !newProject.domain.trim()) {
      toast.error("יש למלא שם ודומיין");
      return;
    }
    createMutation.mutate(newProject);
  };

  if (!serpStatus?.connected) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Search className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">מעקב דירוגים</h1>
            <p className="text-muted-foreground">מעקב אחרי מיקום הביטויים שלך בגוגל</p>
          </div>
        </div>

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              נדרש חיבור ל-DataForSEO
            </CardTitle>
            <CardDescription>
              כדי להשתמש במעקב דירוגים, יש לחבר תחילה את DataForSEO
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={tenantPath("/integrations/serpapi")}>
                <Settings className="h-4 w-4 mr-2" />
                הגדר DataForSEO
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Search className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">מעקב דירוגים</h1>
            <p className="text-muted-foreground">מעקב אחרי מיקום הביטויים שלך בגוגל</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={tenantPath("/integrations/serpapi")}>
              <Settings className="h-4 w-4 mr-2" />
              הגדרות
            </Link>
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                פרויקט חדש
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>יצירת פרויקט Rank Tracking</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">שם הפרויקט</Label>
                  <Input
                    id="name"
                    placeholder="לדוגמה: האתר הראשי"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="domain">דומיין</Label>
                  <Input
                    id="domain"
                    placeholder="example.com"
                    value={newProject.domain}
                    onChange={(e) => setNewProject({ ...newProject, domain: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>מדינה</Label>
                    <Select
                      value={newProject.country}
                      onValueChange={(v) => setNewProject({ ...newProject, country: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="il">ישראל</SelectItem>
                        <SelectItem value="us">ארה"ב</SelectItem>
                        <SelectItem value="uk">בריטניה</SelectItem>
                        <SelectItem value="de">גרמניה</SelectItem>
                        <SelectItem value="fr">צרפת</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>שפה</Label>
                    <Select
                      value={newProject.language}
                      onValueChange={(v) => setNewProject({ ...newProject, language: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="he">עברית</SelectItem>
                        <SelectItem value="en">אנגלית</SelectItem>
                        <SelectItem value="de">גרמנית</SelectItem>
                        <SelectItem value="fr">צרפתית</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>מכשיר</Label>
                    <Select
                      value={newProject.device}
                      onValueChange={(v) => setNewProject({ ...newProject, device: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desktop">Desktop</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                        <SelectItem value="tablet">Tablet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>תדירות בדיקה</Label>
                    <Select
                      value={newProject.check_frequency}
                      onValueChange={(v) => setNewProject({ ...newProject, check_frequency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">יומי</SelectItem>
                        <SelectItem value="weekly">שבועי</SelectItem>
                        <SelectItem value="manual">ידני</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>לקוח (אופציונלי)</Label>
                  <Select
                    value={newProject.client_id || "none"}
                    onValueChange={(v) => setNewProject({ ...newProject, client_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר לקוח" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא</SelectItem>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  ביטול
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  צור פרויקט
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {project.domain}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => scanMutation.mutate(project.id)}
                        disabled={scanMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        סרוק עכשיו
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteMutation.mutate(project.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        מחק
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{project.keywords_count}</div>
                    <div className="text-xs text-muted-foreground">ביטויים</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {project.avg_position ?? "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">ממוצע</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {project.top10_count}
                    </div>
                    <div className="text-xs text-muted-foreground">Top 10</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>
                    {project.country.toUpperCase()} • {project.device}
                  </span>
                  {project.last_checked_at && (
                    <span>
                      נבדק: {format(new Date(project.last_checked_at), "dd/MM HH:mm", { locale: he })}
                    </span>
                  )}
                </div>

                <Button asChild variant="outline" className="w-full">
                  <Link to={tenantPath(`/rank-tracking/${project.id}`)}>
                    צפה בפרויקט
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">אין פרויקטים עדיין</h3>
            <p className="text-muted-foreground text-center mb-4">
              צור פרויקט חדש כדי להתחיל לעקוב אחרי הדירוגים שלך
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              צור פרויקט ראשון
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
