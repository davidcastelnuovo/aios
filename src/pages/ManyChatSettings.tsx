import { useState } from "react";
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
import { Save, Key, CheckCircle2, XCircle, MessageSquare, Calendar } from "lucide-react";
import { SyncManyChatDialog } from "@/components/forms/SyncManyChatDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manychat-webhook`;

  return (
    <div className="container max-w-4xl py-8">
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
                <CheckCircle2 className="h-5 w-5 text-green-600" />
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
    </div>
  );
}
