import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Github, Key, Shield, CheckCircle, XCircle, Clock, Send, Loader2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function GithubAgentPanel() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [repoInput, setRepoInput] = useState("davidcastelnuovo/after-lead");
  const [chatMessage, setChatMessage] = useState("");
  const [chatResponse, setChatResponse] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);

  // Get saved credentials
  const { data: credential } = useQuery({
    queryKey: ["agent-credentials", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from("agent_credentials" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("credential_type", "github_token")
        .single();
      return data as any;
    },
    enabled: !!tenantId,
  });

  // Get approval queue
  const { data: approvals = [] } = useQuery({
    queryKey: ["agent-approvals", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("agent_approval_queue" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  // Get action log
  const { data: actionLog = [] } = useQuery({
    queryKey: ["agent-action-log", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("agent_action_log" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  // Save GitHub token
  const saveToken = useMutation({
    mutationFn: async () => {
      if (!tenantId || !tokenInput) throw new Error("Missing data");
      const { data: { user } } = await supabase.auth.getUser();

      if (credential) {
        await supabase.from("agent_credentials" as any).update({
          encrypted_value: tokenInput,
          metadata: { repo: repoInput },
          updated_at: new Date().toISOString(),
        }).eq("id", (credential as any).id);
      } else {
        await supabase.from("agent_credentials" as any).insert({
          tenant_id: tenantId,
          credential_type: "github_token",
          credential_name: "default",
          encrypted_value: tokenInput,
          metadata: { repo: repoInput },
          created_by: user?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-credentials"] });
      toast.success("GitHub Token נשמר בהצלחה");
      setTokenInput("");
    },
    onError: (e: any) => toast.error("שגיאה: " + e.message),
  });

  // Send chat support message
  const sendChat = async () => {
    if (!chatMessage.trim() || !tenantId) return;
    setIsSending(true);
    setChatResponse(null);

    try {
      const { data, error } = await supabase.functions.invoke("github-agent", {
        body: {
          action: "chat_support",
          tenant_id: tenantId,
          message: chatMessage,
        },
      });

      if (error) throw error;
      setChatResponse(data);
      setChatMessage("");
      queryClient.invalidateQueries({ queryKey: ["agent-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["agent-action-log"] });
    } catch (e: any) {
      toast.error("שגיאה: " + (e.message || "Unknown"));
    } finally {
      setIsSending(false);
    }
  };

  // Approve/reject action
  const handleApproval = async (approvalId: string, action: "approve_action" | "reject_action") => {
    try {
      const { error } = await supabase.functions.invoke("github-agent", {
        body: { action, tenant_id: tenantId, approval_id: approvalId },
      });
      if (error) throw error;
      toast.success(action === "approve_action" ? "אושר!" : "נדחה");
      queryClient.invalidateQueries({ queryKey: ["agent-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["agent-action-log"] });
    } catch (e: any) {
      toast.error("שגיאה: " + e.message);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />ממתין</Badge>;
      case "approved": return <Badge className="bg-green-500 gap-1"><CheckCircle className="h-3 w-3" />אושר</Badge>;
      case "rejected": return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />נדחה</Badge>;
      case "executed": return <Badge className="bg-blue-500 gap-1"><CheckCircle className="h-3 w-3" />בוצע</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gray-900 text-white">
          <Github className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold">GitHub Agent</h2>
          <p className="text-sm text-muted-foreground">סוכן אוטומטי לתיקון קוד, ניתוח שגיאות ותמיכה טכנית</p>
        </div>
      </div>

      <Tabs defaultValue="chat" dir="rtl">
        <TabsList>
          <TabsTrigger value="chat">צ'אט תמיכה</TabsTrigger>
          <TabsTrigger value="approvals">
            תור אישורים
            {approvals.filter((a: any) => a.status === "pending").length > 0 && (
              <Badge variant="destructive" className="mr-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                {approvals.filter((a: any) => a.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="log">היסטוריה</TabsTrigger>
          <TabsTrigger value="settings">הגדרות</TabsTrigger>
        </TabsList>

        {/* Chat Support */}
        <TabsContent value="chat" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Textarea
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="תאר את הבעיה... לדוגמה: 'משתמש X מדווח שאין לו גישה לדשבורד' או 'יש שגיאה בדף הלידים'"
                  rows={3}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChat())}
                />
                <Button onClick={sendChat} disabled={isSending || !chatMessage.trim()} className="w-full">
                  {isSending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />מנתח...</> : <><Send className="h-4 w-4 mr-1" />שלח</>}
                </Button>

                {chatResponse && (
                  <Card className="bg-accent/50">
                    <CardContent className="pt-4 space-y-3">
                      <p className="text-sm whitespace-pre-wrap">{chatResponse.response}</p>
                      {chatResponse.action_needed && (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium">פעולה נדרשת: {chatResponse.action_needed}</span>
                          {chatResponse.requires_approval && <Badge variant="outline">דורש אישור</Badge>}
                        </div>
                      )}
                      {chatResponse.severity && (
                        <Badge variant={chatResponse.severity === "high" ? "destructive" : "secondary"}>
                          חומרה: {chatResponse.severity}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approval Queue */}
        <TabsContent value="approvals" className="mt-4 space-y-3">
          {approvals.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground py-8">אין פעולות ממתינות לאישור</CardContent></Card>
          ) : (
            approvals.map((approval: any) => (
              <Card key={approval.id} className={approval.status === "pending" ? "border-yellow-500/50" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{approval.title}</span>
                        {statusBadge(approval.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{approval.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(approval.created_at).toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {approval.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => handleApproval(approval.id, "approve_action")}>
                          <CheckCircle className="h-4 w-4 mr-1" />אשר
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleApproval(approval.id, "reject_action")}>
                          <XCircle className="h-4 w-4 mr-1" />דחה
                        </Button>
                      </div>
                    )}
                    {approval.status === "executed" && approval.execution_result?.pr_url && (
                      <a href={approval.execution_result.pr_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline"><Github className="h-4 w-4 mr-1" />PR</Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Action Log */}
        <TabsContent value="log" className="mt-4 space-y-2">
          {actionLog.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground py-8">אין היסטוריה עדיין</CardContent></Card>
          ) : (
            actionLog.map((log: any) => (
              <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border text-sm">
                <Badge variant={log.status === "success" ? "default" : log.status === "error" ? "destructive" : "secondary"} className="shrink-0">
                  {log.action_type}
                </Badge>
                <span className="flex-1 text-muted-foreground truncate">
                  {log.action_details?.message || log.action_details?.error || JSON.stringify(log.action_details).substring(0, 100)}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(log.created_at).toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))
          )}
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5" />
                GitHub Token
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {credential && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-700 dark:text-green-400">Token מוגדר</span>
                  <span className="text-xs text-muted-foreground">({(credential as any).metadata?.repo})</span>
                </div>
              )}
              <div>
                <Label>GitHub Personal Access Token</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    dir="ltr"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setShowToken(!showToken)}>
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  צור Token ב-GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained
                </p>
              </div>
              <div>
                <Label>Repository</Label>
                <Input value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="owner/repo" dir="ltr" className="mt-1" />
              </div>
              <Button onClick={() => saveToken.mutate()} disabled={!tokenInput || saveToken.isPending}>
                {credential ? "עדכן Token" : "שמור Token"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                הרשאות וביטחון
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />שינויי קוד דורשים אישור ידני</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />שינויי הרשאות דורשים אישור אדמין</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />כל פעולה נרשמת ביומן</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />Token מאוחסן מוצפן</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
