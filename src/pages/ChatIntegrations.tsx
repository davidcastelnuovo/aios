import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageCircle, Webhook, Settings, CheckCircle2, XCircle, Users, Shield, Share2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ManageIntegrationPermissionsDialog } from "@/components/forms/ManageIntegrationPermissionsDialog";
export default function ChatIntegrations() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [permissionsDialog, setPermissionsDialog] = useState<{
    open: boolean;
    integrationId: string;
    integrationName: string;
    integrationOwnerId?: string | null;
  }>({
    open: false,
    integrationId: '',
    integrationName: '',
    integrationOwnerId: null,
  });

  // Fetch ManyChat integration (organization-level)
  const { data: manychatIntegration } = useQuery({
    queryKey: ['integration-manychat', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'manychat')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch Green API integration (user-specific)
  const { data: greenApiIntegration } = useQuery({
    queryKey: ['integration-green-api', tenantId, userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .eq('integration_type', 'green_api')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!userId,
  });

  // Fetch Green API integrations the user has permission to use (from other users)
  const { data: permittedGreenApiIntegrations = [] } = useQuery({
    queryKey: ['permitted-green-api-integrations', tenantId, userId],
    queryFn: async () => {
      if (!tenantId || !userId) return [];
      
      // First get permissions granted to the current user
      const { data: permissions, error: permError } = await supabase
        .from('integration_user_permissions')
        .select('integration_id')
        .eq('user_id', userId);
      
      if (permError) {
        console.error('Error fetching permissions:', permError);
        return [];
      }
      
      if (!permissions?.length) return [];
      
      const integrationIds = permissions.map(p => p.integration_id);
      
      // Fetch the integrations with owner profile info
      const { data: integrations, error: intError } = await supabase
        .from('tenant_integrations')
        .select('*')
        .in('id', integrationIds)
        .eq('integration_type', 'green_api');
      
      if (intError) {
        console.error('Error fetching permitted integrations:', intError);
        return [];
      }
      
      if (!integrations?.length) return [];
      
      // Get owner profiles
      const ownerIds = [...new Set(integrations.map(i => i.user_id).filter(Boolean))];
      if (ownerIds.length === 0) return integrations.map(i => ({ ...i, owner_profile: null }));
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      
      return integrations.map(i => ({
        ...i,
        owner_profile: i.user_id ? profileMap.get(i.user_id) : null,
      }));
    },
    enabled: !!tenantId && !!userId,
  });

  // Fetch WhatsApp groups
  const { data: whatsappGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['whatsapp-groups', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*, agencies(name)')
        .eq('tenant_id', tenantId)
        .order('group_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Toggle provider mutation
  const toggleProviderMutation = useMutation({
    mutationFn: async ({ providerId, isActive }: { providerId: string; isActive: boolean }) => {
      if (!tenantId) throw new Error('No tenant');

      // For Green API: user-specific connection
      if (providerId === 'green_api') {
        if (!userId) throw new Error('User not authenticated');
        
        const integration = greenApiIntegration;
        if (!integration) {
          throw new Error('אין חיבור Green API. יש להגדיר חיבור תחילה.');
        }

        const { error } = await supabase
          .from('tenant_integrations')
          .update({ is_active: isActive })
          .eq('id', integration.id)
          .eq('user_id', userId);

        if (error) throw error;
        return;
      }

      // For ManyChat: organization-level
      if (isActive) {
        // Deactivate all other organization-level providers
        await supabase
          .from('tenant_integrations')
          .update({ is_active: false })
          .eq('tenant_id', tenantId)
          .eq('integration_type', 'manychat');

        // Then activate the selected provider
        const integration = manychatIntegration;
        if (integration) {
          const { error } = await supabase
            .from('tenant_integrations')
            .update({ is_active: true })
            .eq('id', integration.id);

          if (error) throw error;
        }
      } else {
        // Deactivate the provider
        const integration = manychatIntegration;
        if (integration) {
          const { error } = await supabase
            .from('tenant_integrations')
            .update({ is_active: false })
            .eq('id', integration.id);

          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-manychat', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['integration-green-api', tenantId, userId] });
      toast.success('סטטוס חיבור עודכן');
    },
    onError: (error: any) => {
      console.error('Toggle error:', error);
      toast.error('שגיאה בעדכון סטטוס האינטגרציה');
    },
  });

  // Toggle group blocking mutation
  const toggleGroupMutation = useMutation({
    mutationFn: async ({ groupId, isBlocked }: { groupId: string; isBlocked: boolean }) => {
      const { error } = await supabase
        .from('whatsapp_groups')
        .update({ is_blocked: isBlocked })
        .eq('id', groupId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('סטטוס קבוצה עודכן בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['chat-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['unknown-contacts'] });
    },
    onError: (error) => {
      toast.error('שגיאה בעדכון סטטוס קבוצה');
      console.error('Toggle group error:', error);
    },
  });

  const providers = [
    {
      id: 'manychat',
      name: 'ManyChat',
      description: 'פלטפורמת צ\'אט והודעות עם אוטומציות מתקדמות ותמיכה ב-Facebook Messenger',
      icon: MessageCircle,
      color: 'from-blue-500 to-blue-600',
      features: [
        'אינטגרציה עם Facebook Messenger',
        'סנכרון אוטומטי של contacts',
        'תמיכה בטאגים ואוטומציות',
        'שליחת הודעות ותבניות',
      ],
      integration: manychatIntegration,
      status: manychatIntegration?.is_active ? 'active' : 'inactive',
      hasApiKey: !!manychatIntegration?.api_key,
      settingsPath: '/manychat-settings',
    },
    {
      id: 'green_api',
      name: 'Green API (אישי)',
      description: 'חבר את חשבון Green API האישי שלך. כל משתמש מחבר את החשבון שלו באופן עצמאי.',
      icon: Webhook,
      color: 'from-green-500 to-green-600',
      features: [
        'חיבור ישיר ל-WhatsApp Business',
        'שליחת הודעות ותמונות',
        'קבלת הודעות בזמן אמת',
        'תמיכה בקבוצות ורשימות שידור',
      ],
      integration: greenApiIntegration,
      status: greenApiIntegration?.is_active ? 'active' : 'inactive',
      hasApiKey: !!greenApiIntegration?.api_key,
      settingsPath: '/green-api-settings',
      badge: 'חדש',
    },
  ];

  return (
    <div className="container mx-auto p-6 max-w-6xl" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">אינטגרציות צ'אט</h1>
        <p className="text-muted-foreground">
          בחר את ספק הצ'אט שברצונך להפעיל. ניתן להפעיל רק ספק אחד בכל פעם.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {providers.map((provider) => {
          const Icon = provider.icon;
          const isActive = provider.status === 'active';

          return (
            <Card key={provider.id} className="relative overflow-hidden">
              {provider.badge && (
                <div className="absolute top-4 left-4 z-10">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {provider.badge}
                  </Badge>
                </div>
              )}

              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${provider.color}`} />

              <CardHeader>
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${provider.color} shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3 ml-1" />
                        פעיל
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-500/10">
                        <XCircle className="h-3 w-3 ml-1" />
                        לא פעיל
                      </Badge>
                    )}
                  </div>
                </div>

                <CardTitle className="text-2xl">{provider.name}</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  {provider.description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">תכונות עיקריות:</h4>
                    <ul className="space-y-2">
                      {provider.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Activation Toggle */}
                  {provider.hasApiKey && (
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">הפעלת ספק</span>
                        <span className="text-xs text-muted-foreground">
                          {isActive ? 'הספק פעיל כעת' : 'הפעל ספק זה לשליחת הודעות'}
                        </span>
                      </div>
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) => 
                          toggleProviderMutation.mutate({ providerId: provider.id, isActive: checked })
                        }
                        disabled={toggleProviderMutation.isPending}
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => navigate(buildPath(provider.settingsPath))}
                      className="flex-1"
                      variant={provider.hasApiKey ? "outline" : "default"}
                    >
                      <Settings className="h-4 w-4 ml-2" />
                      {provider.hasApiKey ? 'ניהול הגדרות' : 'הגדר עכשיו'}
                    </Button>
                    
                    {provider.hasApiKey && provider.integration && (
                      <Button
                        onClick={() => setPermissionsDialog({
                          open: true,
                          integrationId: provider.integration.id,
                          integrationName: provider.name,
                          integrationOwnerId: provider.integration.user_id,
                        })}
                        variant="outline"
                        className="flex-shrink-0"
                      >
                        <Shield className="h-4 w-4 ml-2" />
                        הרשאות
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Shared Integrations Section */}
      {permittedGreenApiIntegrations.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Share2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>אינטגרציות משותפות איתך</CardTitle>
                <CardDescription>
                  אינטגרציות שמשתמשים אחרים שיתפו איתך לשימוש באוטומציות
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {permittedGreenApiIntegrations.map((integration: any) => (
                <div 
                  key={integration.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Webhook className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Green API</span>
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          גישה משותפת
                        </Badge>
                        {integration.is_active ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3 ml-1" />
                            פעיל
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 ml-1" />
                            לא פעיל
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        שותף על ידי: {integration.owner_profile?.full_name || integration.owner_profile?.email || 'משתמש לא ידוע'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">לשימוש באוטומציות</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissions Dialog */}
      <ManageIntegrationPermissionsDialog
        open={permissionsDialog.open}
        onOpenChange={(open) => setPermissionsDialog({ ...permissionsDialog, open })}
        integrationId={permissionsDialog.integrationId}
        integrationName={permissionsDialog.integrationName}
        integrationOwnerId={permissionsDialog.integrationOwnerId}
      />

      {/* WhatsApp Groups Management */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle>ניהול קבוצות WhatsApp</CardTitle>
              <CardDescription>
                בחר אילו קבוצות יופיעו בצ'אט. קבוצות לא מסומנות לא יישמרו בדטה-בייס
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {groupsLoading ? (
            <div className="text-center py-8 text-muted-foreground">טוען קבוצות...</div>
          ) : whatsappGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>לא נמצאו קבוצות</p>
              <p className="text-sm mt-2">קבוצות יווצרו אוטומטית כאשר תגיע הודעה מקבוצה חדשה</p>
            </div>
          ) : (
            <div className="space-y-3">
              {whatsappGroups.map((group: any) => (
                <div 
                  key={group.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={!group.is_blocked}
                      onCheckedChange={(checked) =>
                        toggleGroupMutation.mutate({
                          groupId: group.id,
                          isBlocked: !checked,
                        })
                      }
                      disabled={toggleGroupMutation.isPending}
                    />
                    <label
                      htmlFor={`group-${group.id}`}
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{group.group_name}</span>
                        {!group.is_blocked ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-600 flex-shrink-0">
                            <CheckCircle2 className="h-3 w-3 ml-1" />
                            פעיל
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-red-500/10 text-red-600 flex-shrink-0">
                            <XCircle className="h-3 w-3 ml-1" />
                            חסום
                          </Badge>
                        )}
                      </div>
                      {group.agencies?.name && (
                        <p className="text-sm text-muted-foreground truncate">
                          {group.agencies.name}
                        </p>
                      )}
                      {group.description && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {group.description}
                        </p>
                      )}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8 border-dashed">
        <CardContent className="pt-6">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold mb-2">מעוניין באינטגרציות נוספות?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              נשמח לשמוע איזה ספקי צ'אט נוספים תרצה לראות במערכת
            </p>
            <Button variant="outline" size="sm">
              פנה אלינו
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
