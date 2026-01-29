import { useState, useEffect, useRef } from "react";
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
import { Save, Key, CheckCircle2, XCircle, MessageSquare, Calendar, Play, Square, RefreshCw, Users } from "lucide-react";
import { SyncManyChatDialog } from "@/components/forms/SyncManyChatDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  isRunning: boolean;
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
  const [selectedTagId, setSelectedTagId] = useState<string>("79380109"); // Default: ליד חדש
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    processed: 0,
    failed: 0,
    remaining: 0,
    conflicts: 0,
    total: 0,
    results: [],
    isRunning: false,
  });
  const stopSyncRef = useRef(false);

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
        // Load meeting settings
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
      
      // Count conflicts separately
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
        // Update existing
        const { error } = await supabase
          .from('tenant_integrations')
          .update(integrationData)
          .eq('id', integration.id);

        if (error) throw error;
      } else {
        // Insert new
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

  const startBulkSync = async () => {
    if (!tenantId || syncProgress.isRunning) return;
    
    stopSyncRef.current = false;
    const totalLeads = leadsToSync?.count || 0;
    
    setSyncProgress({
      processed: 0,
      failed: 0,
      remaining: totalLeads,
      conflicts: 0,
      total: totalLeads,
      results: [],
      isRunning: true,
    });
    
    toast.info(`מתחיל סנכרון ${totalLeads} לידים...`);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('לא מחובר');
      setSyncProgress(prev => ({ ...prev, isRunning: false }));
      return;
    }
    
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalConflicts = 0;
    let allResults: SyncResult[] = [];
    let remaining = totalLeads;
    
    // Process one lead at a time - the function handles the delay
    while (remaining > 0 && !stopSyncRef.current) {
      try {
        const response = await supabase.functions.invoke('bulk-sync-leads-to-manychat', {
          body: {
            tenantId,
            tagId: parseInt(selectedTagId),
            delayMs: 10000,
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        
        // The function now always returns 200, check the data
        const data = response.data;
        
        if (response.error && !data) {
          console.error('Batch error:', response.error);
          toast.error(`שגיאה בסנכרון: ${response.error.message}`);
          break;
        }
        
        totalProcessed += data.processed || 0;
        totalFailed += data.failed || 0;
        totalConflicts = data.conflicts || totalConflicts;
        remaining = data.remaining >= 0 ? data.remaining : remaining - 1;
        allResults = [...allResults, ...(data.results || [])];
        
        setSyncProgress({
          processed: totalProcessed,
          failed: totalFailed,
          remaining,
          conflicts: totalConflicts,
          total: totalLeads,
          results: allResults,
          isRunning: remaining > 0 && !stopSyncRef.current,
        });
        
        // If no more leads, we're done
        if (remaining === 0) {
          break;
        }
        
      } catch (error) {
        console.error('Sync error:', error);
        // Don't break on error - try to continue
        remaining--;
      }
    }
    
    setSyncProgress(prev => ({ ...prev, isRunning: false }));
    refetchLeadsCount();
    
    if (stopSyncRef.current) {
      toast.info(`הסנכרון הופסק. סונכרנו ${totalProcessed} לידים.`);
    } else {
      toast.success(`הסנכרון הושלם! סונכרנו ${totalProcessed} לידים, ${totalFailed} נכשלו.`);
    }
  };

  const stopSync = () => {
    stopSyncRef.current = true;
    toast.info('עוצר את הסנכרון...');
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manychat-webhook`;
  const progressPercent = syncProgress.total > 0 
    ? ((syncProgress.processed + syncProgress.failed) / syncProgress.total) * 100 
    : 0;

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
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
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
              </CardTitle>
              <CardDescription>
                סנכרן את כל הלידים הקיימים ל-ManyChat והוסף להם טאג
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-2xl font-bold">{leadsToSync?.count || 0}</div>
                  <div className="text-sm text-muted-foreground">לידים לסנכרון</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-primary">{syncProgress.processed}</div>
                  <div className="text-sm text-muted-foreground">סונכרנו בהצלחה</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-destructive">{(leadsToSync?.conflicts || 0) + syncProgress.failed}</div>
                  <div className="text-sm text-muted-foreground">קונפליקטים</div>
                </Card>
              </div>
              
              {/* Tag Selection */}
              <div className="space-y-2">
                <Label>בחר טאג להוספה</Label>
                <Select value={selectedTagId} onValueChange={setSelectedTagId}>
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
              
              {/* Progress */}
              {syncProgress.isRunning && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>התקדמות</span>
                    <span>{syncProgress.processed + syncProgress.failed} / {syncProgress.total}</span>
                  </div>
                  <Progress value={progressPercent} />
                  <p className="text-xs text-muted-foreground">
                    נותרו {syncProgress.remaining} לידים • {syncProgress.failed} נכשלו
                  </p>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                {syncProgress.isRunning ? (
                  <Button onClick={stopSync} variant="destructive" className="flex-1">
                    <Square className="h-4 w-4 ml-2" />
                    עצור סנכרון
                  </Button>
                ) : (
                  <Button 
                    onClick={startBulkSync} 
                    disabled={!leadsToSync?.count}
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 ml-2" />
                    התחל סנכרון ({leadsToSync?.count || 0} לידים)
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => refetchLeadsCount()}
                  disabled={syncProgress.isRunning}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Results Log */}
              {syncProgress.results.length > 0 && (
                <div className="space-y-2">
                  <Label>לוג תוצאות</Label>
                  <ScrollArea className="h-48 rounded border p-2">
                    <div className="space-y-1 text-xs font-mono">
                      {syncProgress.results.map((result, idx) => (
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
                  הסנכרון מעבד ליד אחד בכל פעם עם מרווח של 10 שניות.
                  <br />
                  זמן משוער ל-{leadsToSync?.count || 0} לידים: כ-{Math.ceil((leadsToSync?.count || 0) * 10 / 60)} דקות.
                  <br />
                  <strong>חשוב:</strong> השאר את הטאב פתוח במהלך הסנכרון.
                </p>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
