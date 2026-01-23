import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantPath } from "@/hooks/useTenantPath";

const useBuildPath = () => {
  const { buildPath } = useTenantPath();
  return buildPath;
};
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Search, Plus, ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus, 
  Trash2, ExternalLink, Play, Download, Upload, LineChart, History
} from "lucide-react";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { he } from "date-fns/locale";

interface Keyword {
  id: string;
  keyword: string;
  target_url: string | null;
  current_position: number | null;
  previous_position: number | null;
  best_position: number | null;
  worst_position: number | null;
  position_change: number | null;
  found_url: string | null;
  search_volume: number | null;
  is_active: boolean;
  last_checked_at: string | null;
}

interface HistoryRecord {
  id: string;
  position: number | null;
  url_found: string | null;
  checked_at: string;
}

export default function RankTrackingProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const tenantPath = useBuildPath();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newKeywords, setNewKeywords] = useState("");
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);

  // Fetch project
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["rank-tracking-project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("rank_tracking_projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch keywords
  const { data: keywords, isLoading: keywordsLoading } = useQuery({
    queryKey: ["rank-tracking-keywords", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("rank_tracking_keywords")
        .select("*")
        .eq("project_id", projectId)
        .order("current_position", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Keyword[];
    },
    enabled: !!projectId,
  });

  // Fetch history for selected keyword
  const { data: keywordHistory } = useQuery({
    queryKey: ["rank-tracking-history", selectedKeywordId],
    queryFn: async () => {
      if (!selectedKeywordId) return [];
      const { data, error } = await supabase
        .from("rank_tracking_history")
        .select("*")
        .eq("keyword_id", selectedKeywordId)
        .order("checked_at", { ascending: true })
        .limit(60);
      if (error) throw error;
      return data as HistoryRecord[];
    },
    enabled: !!selectedKeywordId,
  });

  // Add keywords mutation
  const addKeywordsMutation = useMutation({
    mutationFn: async (keywordsList: string[]) => {
      if (!projectId) throw new Error("No project");

      const keywordsToInsert = keywordsList.map(keyword => ({
        project_id: projectId,
        keyword: keyword.trim(),
      }));

      const { error } = await supabase
        .from("rank_tracking_keywords")
        .insert(keywordsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ביטויים נוספו בהצלחה!");
      setIsAddOpen(false);
      setNewKeywords("");
      queryClient.invalidateQueries({ queryKey: ["rank-tracking-keywords"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "שגיאה בהוספת ביטויים");
    },
  });

  // Delete keyword mutation
  const deleteKeywordMutation = useMutation({
    mutationFn: async (keywordId: string) => {
      const { error } = await supabase
        .from("rank_tracking_keywords")
        .delete()
        .eq("id", keywordId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ביטוי נמחק");
      queryClient.invalidateQueries({ queryKey: ["rank-tracking-keywords"] });
    },
    onError: () => {
      toast.error("שגיאה במחיקת ביטוי");
    },
  });

  // Scan mutation
  const scanMutation = useMutation({
    mutationFn: async (keywordIds?: string[]) => {
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
            keywordIds,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Scan failed");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`סריקה הושלמה! נבדקו ${data.checked_count} ביטויים`);
      queryClient.invalidateQueries({ queryKey: ["rank-tracking-keywords", projectId] });
      queryClient.invalidateQueries({ queryKey: ["rank-tracking-project", projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "שגיאה בסריקה");
    },
  });

  const handleAddKeywords = () => {
    const keywordsList = newKeywords
      .split("\n")
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywordsList.length === 0) {
      toast.error("יש להזין לפחות ביטוי אחד");
      return;
    }

    addKeywordsMutation.mutate(keywordsList);
  };

  const getPositionBadge = (position: number | null) => {
    if (position === null) return <Badge variant="secondary">לא נמצא</Badge>;
    if (position <= 3) return <Badge className="bg-green-500">{position}</Badge>;
    if (position <= 10) return <Badge className="bg-blue-500">{position}</Badge>;
    if (position <= 20) return <Badge className="bg-amber-500">{position}</Badge>;
    return <Badge variant="secondary">{position}</Badge>;
  };

  const getChangeIndicator = (change: number | null) => {
    if (change === null || change === 0) {
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
    if (change > 0) {
      return (
        <span className="flex items-center text-green-600 gap-1">
          <TrendingUp className="h-4 w-4" />
          +{change}
        </span>
      );
    }
    return (
      <span className="flex items-center text-red-600 gap-1">
        <TrendingDown className="h-4 w-4" />
        {change}
      </span>
    );
  };

  // Calculate stats
  const stats = {
    total: keywords?.length || 0,
    tracked: keywords?.filter(k => k.current_position !== null).length || 0,
    top3: keywords?.filter(k => k.current_position && k.current_position <= 3).length || 0,
    top10: keywords?.filter(k => k.current_position && k.current_position <= 10).length || 0,
    top20: keywords?.filter(k => k.current_position && k.current_position <= 20).length || 0,
    avgPosition: (() => {
      const positions = keywords
        ?.map(k => k.current_position)
        .filter((p): p is number => p !== null) || [];
      if (positions.length === 0) return null;
      return Math.round(positions.reduce((a, b) => a + b, 0) / positions.length * 10) / 10;
    })(),
  };

  // Prepare chart data
  const chartData = keywordHistory?.map(h => ({
    date: format(new Date(h.checked_at), "dd/MM"),
    position: h.position ?? 101, // Show 101 for not found
  }));

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-6">
        <p>פרויקט לא נמצא</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={tenantPath("/rank-tracking")}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              {project.domain}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => scanMutation.mutate(undefined)}
            disabled={scanMutation.isPending || !keywords?.length}
          >
            {scanMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            סרוק הכל
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                הוסף ביטויים
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>הוספת ביטויים</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>ביטויים (כל שורה = ביטוי אחד)</Label>
                  <Textarea
                    placeholder="הזן ביטויים, כל שורה ביטוי אחד"
                    rows={10}
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {newKeywords.split("\n").filter(k => k.trim()).length} ביטויים
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  ביטול
                </Button>
                <Button onClick={handleAddKeywords} disabled={addKeywordsMutation.isPending}>
                  {addKeywordsMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  הוסף
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">סה"כ ביטויים</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.avgPosition ?? "-"}</div>
            <p className="text-xs text-muted-foreground">ממוצע מיקום</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.top3}</div>
            <p className="text-xs text-muted-foreground">Top 3</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats.top10}</div>
            <p className="text-xs text-muted-foreground">Top 10</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">{stats.top20}</div>
            <p className="text-xs text-muted-foreground">Top 20</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.tracked}</div>
            <p className="text-xs text-muted-foreground">נמצאו</p>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <Tabs defaultValue="keywords" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keywords">
            <Search className="h-4 w-4 mr-2" />
            ביטויים
          </TabsTrigger>
          <TabsTrigger value="history" disabled={!selectedKeywordId}>
            <History className="h-4 w-4 mr-2" />
            היסטוריה
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keywords">
          {keywordsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : keywords && keywords.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ביטוי</TableHead>
                    <TableHead className="text-center w-24">מיקום</TableHead>
                    <TableHead className="text-center w-24">שינוי</TableHead>
                    <TableHead className="text-center w-20">Best</TableHead>
                    <TableHead className="text-center w-20">Worst</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="text-center w-36">נבדק</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords.map((keyword) => (
                    <TableRow 
                      key={keyword.id}
                      className={selectedKeywordId === keyword.id ? "bg-muted/50" : ""}
                      onClick={() => setSelectedKeywordId(keyword.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <TableCell className="font-medium">{keyword.keyword}</TableCell>
                      <TableCell className="text-center">
                        {getPositionBadge(keyword.current_position)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getChangeIndicator(keyword.position_change)}
                      </TableCell>
                      <TableCell className="text-center text-green-600">
                        {keyword.best_position ?? "-"}
                      </TableCell>
                      <TableCell className="text-center text-red-600">
                        {keyword.worst_position ?? "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                        {keyword.found_url || "-"}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {keyword.last_checked_at
                          ? format(new Date(keyword.last_checked_at), "dd/MM HH:mm", { locale: he })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteKeywordMutation.mutate(keyword.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">אין ביטויים עדיין</h3>
                <p className="text-muted-foreground text-center mb-4">
                  הוסף ביטויים כדי להתחיל לעקוב אחרי הדירוגים
                </p>
                <Button onClick={() => setIsAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  הוסף ביטויים
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          {selectedKeywordId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  היסטוריית מיקום
                </CardTitle>
                <CardDescription>
                  {keywords?.find(k => k.id === selectedKeywordId)?.keyword}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartData && chartData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis 
                          reversed 
                          domain={[1, Math.max(...chartData.map(d => d.position), 20)]}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            value > 100 ? "לא נמצא" : value,
                            "מיקום"
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="position"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))" }}
                        />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    אין היסטוריה עדיין. בצע סריקה כדי להתחיל לאסוף נתונים.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
