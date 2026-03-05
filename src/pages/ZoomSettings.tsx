import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Video, Copy, Save, ArrowLeft, ExternalLink, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { format } from "date-fns";

export default function ZoomSettings() {
  const { currentTenantId } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();

  const [accountId, setAccountId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [webhookSecretToken, setWebhookSecretToken] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "client" | "lead" | "unassigned">("all");

  // Fetch existing integration
  const { data: integration, isLoading } = useQuery({
    queryKey: ['zoom-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'zoom')
        .maybeSingle();
      if (data) {
        const s = data.settings as Record<string, string> | null;
        if (s) {
          setAccountId(s.account_id || "");
          setClientId(s.client_id || "");
          setClientSecret(s.client_secret || "");
          setWebhookSecretToken(s.webhook_secret_token || "");
        }
      }
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Fetch recordings
  const { data: recordings = [] } = useQuery({
    queryKey: ['zoom-recordings', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase
        .from('zoom_recordings')
        .select('*, clients(name), leads(company_name)')
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch clients & leads for assignment
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-zoom', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .eq('tenant_id', currentTenantId)
        .order('name');
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-for-zoom', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data } = await supabase
        .from('leads')
        .select('id, company_name')
        .eq('tenant_id', currentTenantId)
        .order('company_name');
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Save integration
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenantId) throw new Error("No tenant");
      const settings = {
        account_id: accountId,
        client_id: clientId,
        client_secret: clientSecret,
        webhook_secret_token: webhookSecretToken,
      };

      if (integration) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update({
            settings: settings as any,
            is_active: true,
          })
          .eq('id', integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert({
            tenant_id: currentTenantId,
            integration_type: 'zoom',
            settings: settings as any,
            is_active: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoom-integration'] });
      toast({ title: "נשמר בהצלחה", description: "הגדרות Zoom נשמרו" });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  // Assign recording to client/lead
  const assignMutation = useMutation({
    mutationFn: async ({ recordingId, clientId, leadId }: { recordingId: string; clientId?: string | null; leadId?: string | null }) => {
      const { error } = await supabase
        .from('zoom_recordings')
        .update({ client_id: clientId || null, lead_id: leadId || null })
        .eq('id', recordingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoom-recordings'] });
      toast({ title: "שויך בהצלחה" });
    },
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoom-webhook?tenant_id=${currentTenantId}`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "הועתק!", description: "ה-Webhook URL הועתק ללוח" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath("integrations"))}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="h-8 w-8" />
            הגדרות Zoom
          </h1>
          <p className="text-muted-foreground mt-1">קבלת הקלטות פגישות אוטומטית דרך Webhook</p>
        </div>
      </div>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
          <CardDescription>העתק את הכתובת הזו והגדר אותה ב-Zoom App Marketplace כ-Event Notification Endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly dir="ltr" className="font-mono text-xs" />
            <Button variant="outline" onClick={copyWebhookUrl}>
              <Copy className="h-4 w-4 ml-2" />
              העתק
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            ב-Zoom Marketplace, הפעל את האירוע <code className="bg-muted px-1 rounded">recording.completed</code>
          </p>
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle>Server-to-Server OAuth Credentials</CardTitle>
          <CardDescription>הזן את פרטי האפליקציה מ-Zoom App Marketplace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account ID</Label>
              <Input dir="ltr" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Account ID" />
            </div>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input dir="ltr" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <Input dir="ltr" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Client Secret" />
            </div>
            <div className="space-y-2">
              <Label>Webhook Secret Token</Label>
              <Input dir="ltr" type="password" value={webhookSecretToken} onChange={(e) => setWebhookSecretToken(e.target.value)} placeholder="Webhook Secret Token" />
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 ml-2" />
            {saveMutation.isPending ? "שומר..." : "שמור הגדרות"}
          </Button>
          {integration?.is_active && (
            <Badge className="mr-2 bg-primary/90">✓ מחובר</Badge>
          )}
        </CardContent>
      </Card>

      {/* Recordings table */}
      <Card>
        <CardHeader>
          <CardTitle>הקלטות שהתקבלו</CardTitle>
          <CardDescription>הקלטות שהגיעו מ-Zoom דרך ה-Webhook</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי נושא, מארח, לקוח או ליד..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={filterType} onValueChange={(val: any) => setFilterType(val)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="client">משויך ללקוח</SelectItem>
                <SelectItem value="lead">משויך לליד</SelectItem>
                <SelectItem value="unassigned">לא משויך</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(() => {
            const filtered = recordings.filter((rec: any) => {
              // Filter by type
              if (filterType === "client" && !rec.client_id) return false;
              if (filterType === "lead" && !rec.lead_id) return false;
              if (filterType === "unassigned" && (rec.client_id || rec.lead_id)) return false;

              // Filter by search
              if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const clientName = rec.clients?.name?.toLowerCase() || "";
                const leadName = rec.leads?.company_name?.toLowerCase() || "";
                const topic = (rec.meeting_topic || "").toLowerCase();
                const host = (rec.host_email || "").toLowerCase();
                return topic.includes(q) || host.includes(q) || clientName.includes(q) || leadName.includes(q);
              }
              return true;
            });

            if (recordings.length === 0) {
              return <p className="text-center text-muted-foreground py-8">עדיין לא התקבלו הקלטות</p>;
            }

            return (
              <>
                {(searchQuery || filterType !== "all") && (
                  <p className="text-sm text-muted-foreground mb-2">
                    מציג {filtered.length} מתוך {recordings.length} הקלטות
                  </p>
                )}
                {filtered.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">לא נמצאו הקלטות תואמות</p>
                ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>נושא</TableHead>
                    <TableHead>מארח</TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead>משך (דק')</TableHead>
                    <TableHead>סוג</TableHead>
                    <TableHead>שיוך ללקוח</TableHead>
                    <TableHead>שיוך לליד</TableHead>
                    <TableHead>קישור</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((rec: any) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">{rec.meeting_topic || "-"}</TableCell>
                      <TableCell>{rec.host_email || "-"}</TableCell>
                      <TableCell>{rec.start_time ? format(new Date(rec.start_time), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
                      <TableCell>{rec.duration || "-"}</TableCell>
                      <TableCell><Badge variant="secondary">{rec.recording_type || "-"}</Badge></TableCell>
                      <TableCell>
                        <Select
                          value={rec.client_id || "none"}
                          onValueChange={(val) => assignMutation.mutate({ recordingId: rec.id, clientId: val === "none" ? null : val, leadId: rec.lead_id })}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="בחר לקוח" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">ללא</SelectItem>
                            {clients.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={rec.lead_id || "none"}
                          onValueChange={(val) => assignMutation.mutate({ recordingId: rec.id, clientId: rec.client_id, leadId: val === "none" ? null : val })}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="בחר ליד" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">ללא</SelectItem>
                            {leads.map((l: any) => (
                              <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {rec.recording_url ? (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={rec.recording_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
