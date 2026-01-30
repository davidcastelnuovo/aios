import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Key, CheckCircle2, XCircle, MessageSquare, Calendar, Play, Square, RefreshCw, Users, Cloud, RotateCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SyncManyChatDialog } from "@/components/forms/SyncManyChatDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface SyncResult {
  leadId: string;
  leadName?: string;
  success: boolean;
  error?: string;
  subscriberId?: string;
  skipped?: boolean;
}

interface SyncProgress {
  processed: number;
  failed: number;
  remaining: number;
  conflicts: number;
  total: number;
  results: SyncResult[];
}

interface SyncJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'stopped' | 'failed';
  progress: SyncProgress;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export default function ManyChatSettings() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [apiKey, setApiKey] = useState("");
  
  // Meeting notification settings
  const [meetingTriggerName, setMeetingTriggerName] = useState("meeting_scheduled");
  const [meetingDateFieldId, setMeetingDateFieldId] = useState("");
  const [meetingTimeFieldId, setMeetingTimeFieldId] = useState("");
  const [meetingLocationFieldId, setMeetingLocationFieldId] = useState("");
  const [contactNameFieldId, setContactNameFieldId] = useState("");
  const [showMeetingSettings, setShowMeetingSettings] = useState(false);
  
  // Bulk sync state
  const [selectedTagId, setSelectedTagId] = useState<string>("79380109");
  const [resetBeforeSync, setResetBeforeSync] = useState(false);
  const [currentJob, setCurrentJob] = useState<SyncJob | null>(null);

  // Fetch existing integration
  const { data: integration, isLoading } = useQuery({
    queryKey: ['manychat-integration', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'manychat')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setApiKey(data.api_key || '');
        const settings = data.settings as Record<string, any> || {};
        setMeetingTriggerName(settings.meeting_trigger_name || 'meeting_scheduled');
        const customFields = settings.meeting_custom_fields || {};
        setMeetingDateFieldId(customFields.meeting_date || '');
        setMeetingTimeFieldId(customFields.meeting_time || '');
        setMeetingLocationFieldId(customFields.meeting_location || '');
        setContactNameFieldId(customFields.contact_name || '');
      }

      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch active or recent sync job
  const { data: activeJob, refetch: refetchJob } = useQuery({
    queryKey: ['sync-job', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('job_type', 'manychat_sync')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      // Parse JSON fields with proper typing
      const progressData = data.progress as unknown as SyncProgress | null;
      return {
        ...data,
        progress: progressData || { processed: 0, failed: 0, remaining: 0, conflicts: 0, total: 0, results: [] },
      } as SyncJob;
    },
    enabled: !!tenantId && !!integration?.is_active,
  });

  // Update current job when activeJob changes
  useEffect(() => {
    if (activeJob) {
      setCurrentJob(activeJob);
    }
  }, [activeJob]);

  // Subscribe to realtime updates on sync_jobs
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`sync-jobs-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_jobs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('Sync job update:', payload);
          if (payload.new) {
            const newJob = payload.new as any;
            setCurrentJob({
              ...newJob,
              progress: (newJob.progress || { processed: 0, failed: 0, remaining: 0, conflicts: 0, total: 0, results: [] }) as SyncProgress,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  // Fetch leads count without manychat_subscriber_id
  const { data: leadsToSync, refetch: refetchLeadsCount } = useQuery({
    queryKey: ['leads-to-sync', tenantId],
    queryFn: async () => {
      if (!tenantId) return { count: 0, conflicts: 0 };
      
      const { count, error } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('manychat_subscriber_id', null)
        .not('phone', 'is', null);
      
      const { count: conflictCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('manychat_subscriber_id', 'SYNC_CONFLICT');
      
      if (error) throw error;
      return { count: count || 0, conflicts: conflictCount || 0 };
    },
    enabled: !!tenantId && !!integration?.is_active,
  });

  // Fetch ManyChat tags
  const { data: tags } = useQuery({
    queryKey: ['manychat-tags', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      
      const response = await supabase.functions.invoke('get-manychat-tags', {
        body: { tenantId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (response.error) throw response.error;
      return response.data?.tags || [];
    },
    enabled: !!tenantId && !!integration?.is_active,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');

      const integrationData = {
        tenant_id: tenantId,
        integration_type: 'manychat',
        api_key: apiKey,
        is_active: apiKey.trim().length > 0,
        auto_sync_enabled: false,
        settings: {
          meeting_trigger_name: meetingTriggerName,
          meeting_custom_fields: {
            meeting_date: meetingDateFieldId || undefined,
            meeting_time: meetingTimeFieldId || undefined,
            meeting_location: meetingLocationFieldId || undefined,
            contact_name: contactNameFieldId || undefined,
          }
        }
      };

      if (integration) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update(integrationData)
          .eq('id', integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert(integrationData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manychat-integration', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['manychat-tags', tenantId] });
      toast.success('הגדרות ManyChat נשמרו בהצלחה');
    },
    onError: (error: any) => {
      console.error('Save error:', error);
      toast.error('שגיאה בשמירת ההגדרות');
    },
  });

  // Start sync mutation
  const startSyncMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await supabase.functions.invoke('start-sync-job', {
        body: {
          tenantId,
          tagId: parseInt(selectedTagId),
          resetFirst: resetBeforeSync,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: (data) => {
      if (data.jobId) {
        toast.success('הסנכרון התחיל ברקע - אפשר לסגור את הדפדפן');
        refetchJob();
      } else {
        toast.info(data.message || 'אין לידים לסנכרון');
      }
    },
    onError: (error: any) => {
      console.error('Start sync error:', error);
      toast.error(error.message || 'שגיאה בהתחלת הסנכרון');
    },
  });

  // Stop sync mutation
  const stopSyncMutation = useMutation({
    mutationFn: async () => {
      if (!currentJob?.id) throw new Error('No active job');
      
      const { error } = await supabase
        .from('sync_jobs')
        .update({ status: 'stopped' })
        .eq('id', currentJob.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.info('עוצר את הסנכרון...');
      refetchJob();
    },
    onError: (error: any) => {
      console.error('Stop sync error:', error);
      toast.error('שגיאה בעצירת הסנכרון');
    },
  });

  const isJobRunning = currentJob?.status === 'pending' || currentJob?.status === 'running';
  const progress = currentJob?.progress || { processed: 0, failed: 0, remaining: 0, conflicts: 0, total: 0, results: [] };
  const progressPercent = progress.total > 0 
    ? ((progress.processed + progress.failed) / progress.total) * 100 
    : 0;

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manychat-webhook`;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-primary text-primary-foreground">רץ ברקע</Badge>;
      case 'pending':
        return <Badge className="bg-muted text-muted-foreground">ממתין</Badge>;
      case 'completed':
        return <Badge className="bg-primary/80 text-primary-foreground">הושלם</Badge>;
      case 'stopped':
        return <Badge variant="secondary">נעצר</Badge>;
      case 'failed':
        return <Badge variant="destructive">נכשל</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="settings">
            <Key className="h-4 w-4 ml-2" />
            הגדרות
          </TabsTrigger>
          <TabsTrigger value="sync" disabled={!integration?.is_active}>
            <Users className="h-4 w-4 ml-2" />
            סנכרון לידים
          </TabsTrigger>
        </TabsList>
        
        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                הגדרות ManyChat
              </CardTitle>
              <CardDescription>
                חבר את חשבון ה-ManyChat שלך כדי לאפשר צ'אט עם לקוחות
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              <div className="flex items-center gap-2 p-4 rounded-lg bg-muted">
                {integration?.is_active ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="font-medium">ManyChat מחובר ופעיל</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium text-muted-foreground">ManyChat לא מחובר</span>
                  </>
                )}
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="הזן את ה-API Key מ-ManyChat"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  ניתן למצוא את ה-API Key ב-ManyChat → Settings → API
                </p>
              </div>

              {/* Webhook URL */}
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
                  {webhookUrl}
                </div>
                <p className="text-sm text-muted-foreground">
                  העתק URL זה והגדר אותו ב-ManyChat → Flows → External Request
                </p>
              </div>

              {/* Instructions */}
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-base">הוראות התקנה</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <ol className="list-decimal list-inside space-y-2">
                    <li>היכנס ל-ManyChat → Settings → API וצור API Token</li>
                    <li>הדבק את ה-Token בשדה למעלה</li>
                    <li>העתק את ה-Webhook URL</li>
                    <li>ב-ManyChat → Flows, צור External Request node</li>
                    <li>הדבק את ה-Webhook URL והגדר Method: POST</li>
                    <li>הוסף Header: <code className="bg-background px-1 rounded">apikey: {import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20)}...</code></li>
                    <li>טריגר: "User Sends Message"</li>
                    <li>שמור והפעל את ה-Flow</li>
                  </ol>
                </CardContent>
              </Card>

              {/* Meeting Notification Settings */}
              <Collapsible open={showMeetingSettings} onOpenChange={setShowMeetingSettings}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      הגדרות הודעת פגישה
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {showMeetingSettings ? '▲' : '▼'}
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-4">
                  <Card className="p-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="triggerName">שם ה-Automation Trigger</Label>
                      <Input
                        id="triggerName"
                        value={meetingTriggerName}
                        onChange={(e) => setMeetingTriggerName(e.target.value)}
                        placeholder="meeting_scheduled"
                        dir="ltr"
                      />
                      <p className="text-xs text-muted-foreground">
                        שם ה-Flow ב-ManyChat שיופעל בעת קביעת פגישה
                      </p>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3">Custom Field IDs (אופציונלי)</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        הזן את ה-ID של כל Custom Field מ-ManyChat. ניתן למצוא ב-ManyChat → Settings → Custom Fields
                      </p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">meeting_date Field ID</Label>
                          <Input
                            value={meetingDateFieldId}
                            onChange={(e) => setMeetingDateFieldId(e.target.value)}
                            placeholder="1234567"
                            dir="ltr"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">meeting_time Field ID</Label>
                          <Input
                            value={meetingTimeFieldId}
                            onChange={(e) => setMeetingTimeFieldId(e.target.value)}
                            placeholder="1234568"
                            dir="ltr"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">meeting_location Field ID</Label>
                          <Input
                            value={meetingLocationFieldId}
                            onChange={(e) => setMeetingLocationFieldId(e.target.value)}
                            placeholder="1234569"
                            dir="ltr"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">contact_name Field ID</Label>
                          <Input
                            value={contactNameFieldId}
                            onChange={(e) => setContactNameFieldId(e.target.value)}
                            placeholder="1234570"
                            dir="ltr"
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              {/* Sync Button */}
              {integration?.is_active && (
                <div className="mt-4">
                  <SyncManyChatDialog />
                </div>
              )}

              {/* Navigation Button */}
              <Button
                variant="outline"
                onClick={() => navigate(buildPath('chat'))}
                className="w-full"
              >
                <MessageSquare className="h-4 w-4 ml-2" />
                חזרה לצ'אט
              </Button>

              {/* Save Button */}
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!apiKey || saveMutation.isPending || isLoading}
                className="w-full"
              >
                <Save className="h-4 w-4 ml-2" />
                שמור הגדרות
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Sync Tab */}
        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                סנכרון לידים ל-ManyChat
                {currentJob && getStatusBadge(currentJob.status)}
              </CardTitle>
              <CardDescription>
                סנכרן את כל הלידים הקיימים ל-ManyChat והוסף להם טאג
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Background sync notice */}
              {isJobRunning && (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <Cloud className="h-5 w-5 text-primary animate-pulse" />
                  <div>
                    <span className="font-medium text-foreground">הסנכרון רץ ברקע</span>
                    <p className="text-sm text-muted-foreground">
                      אפשר לסגור את הדפדפן - הסנכרון ימשיך לרוץ בשרת
                    </p>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-2xl font-bold">{leadsToSync?.count || 0}</div>
                  <div className="text-sm text-muted-foreground">לידים לסנכרון</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-primary">{progress.processed}</div>
                  <div className="text-sm text-muted-foreground">סונכרנו בהצלחה</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-destructive">{(leadsToSync?.conflicts || 0) + progress.failed}</div>
                  <div className="text-sm text-muted-foreground">קונפליקטים</div>
                </Card>
              </div>
              
              {/* Tag Selection */}
              <div className="space-y-2">
                <Label>בחר טאג להוספה</Label>
                <Select value={selectedTagId} onValueChange={setSelectedTagId} disabled={isJobRunning}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר טאג" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="79380109">ליד חדש (ברירת מחדל)</SelectItem>
                    {tags?.map((tag: any) => (
                      <SelectItem key={tag.id} value={String(tag.id)}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reset checkbox */}
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="resetBeforeSync"
                  checked={resetBeforeSync}
                  onCheckedChange={(checked) => setResetBeforeSync(checked === true)}
                  disabled={isJobRunning}
                />
                <Label htmlFor="resetBeforeSync" className="text-sm cursor-pointer">
                  <RotateCcw className="h-4 w-4 inline ml-1" />
                  איפוס כל הלידים לפני סנכרון (כולל קונפליקטים)
                </Label>
              </div>
              
              {/* Progress */}
              {(isJobRunning || progress.total > 0) && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>התקדמות</span>
                    <span>{progress.processed + progress.failed} / {progress.total}</span>
                  </div>
                  <Progress value={progressPercent} />
                  <p className="text-xs text-muted-foreground">
                    נותרו {progress.remaining} לידים • {progress.failed} נכשלו
                  </p>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                {isJobRunning ? (
                  <Button 
                    onClick={() => stopSyncMutation.mutate()} 
                    variant="destructive" 
                    className="flex-1"
                    disabled={stopSyncMutation.isPending}
                  >
                    <Square className="h-4 w-4 ml-2" />
                    עצור סנכרון
                  </Button>
                ) : (
                  <Button 
                    onClick={() => startSyncMutation.mutate()} 
                    disabled={(!leadsToSync?.count && !resetBeforeSync) || (resetBeforeSync && !leadsToSync?.conflicts && !leadsToSync?.count) || startSyncMutation.isPending}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 ml-2" />
                    {resetBeforeSync && (leadsToSync?.conflicts || 0) > 0 
                      ? `התחל סנכרון (איפוס ${leadsToSync?.conflicts || 0} קונפליקטים)`
                      : `התחל סנכרון (${leadsToSync?.count || 0} לידים)`
                    }
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => {
                    refetchLeadsCount();
                    refetchJob();
                  }}
                  disabled={isJobRunning}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Results Log */}
              {progress.results && progress.results.length > 0 && (
                <div className="space-y-2">
                  <Label>לוג תוצאות (50 אחרונים)</Label>
                  <ScrollArea className="h-48 rounded border p-2">
                    <div className="space-y-1 text-xs font-mono">
                      {progress.results.slice().reverse().map((result, idx) => (
                        <div 
                          key={idx} 
                          className={result.success ? 'text-primary' : result.skipped ? 'text-amber-600' : 'text-destructive'}
                        >
                          {result.success 
                            ? `✓ ${result.leadName || result.leadId?.slice(0, 8)} → ${result.subscriberId}`
                            : result.skipped
                              ? `⚠ ${result.leadName || result.leadId?.slice(0, 8)} - דילוג (${result.error?.slice(0, 50)}...)`
                              : `✗ ${result.leadName || result.leadId?.slice(0, 8)} - ${result.error}`
                          }
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {/* Info */}
              <Card className="bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground flex items-center gap-1">
                    <Cloud className="h-4 w-4" />
                    סנכרון ברקע
                  </strong>
                  <br />
                  הסנכרון רץ בשרת ולא דורש להשאיר את הדפדפן פתוח.
                  <br />
                  זמן משוער ל-{leadsToSync?.count || 0} לידים: כ-{Math.ceil((leadsToSync?.count || 0) / 60)} דקות (ליד לשנייה).
                </p>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
