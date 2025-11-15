import { useNavigate } from "react-router-dom";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MessageCircle, Webhook, Settings, CheckCircle2, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ChatIntegrations() {
  const { tenantId } = useCurrentTenant();
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch integration status
  const { data: integrations } = useQuery({
    queryKey: ['chat-integrations', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('integration_type', ['manychat', 'green_api']);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Toggle provider mutation
  const toggleProviderMutation = useMutation({
    mutationFn: async ({ providerId, isActive }: { providerId: string; isActive: boolean }) => {
      if (!tenantId) throw new Error('No tenant');

      if (isActive) {
        // First, deactivate all other providers
        await supabase
          .from('tenant_integrations')
          .update({ is_active: false })
          .eq('tenant_id', tenantId)
          .neq('integration_type', providerId);

        // Then activate the selected provider
        const { error } = await supabase
          .from('tenant_integrations')
          .update({ is_active: true })
          .eq('tenant_id', tenantId)
          .eq('integration_type', providerId);

        if (error) throw error;
      } else {
        // Deactivate the provider
        const { error } = await supabase
          .from('tenant_integrations')
          .update({ is_active: false })
          .eq('tenant_id', tenantId)
          .eq('integration_type', providerId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-integrations', tenantId] });
      toast.success('סטטוס אינטגרציה עודכן');
    },
    onError: (error: any) => {
      console.error('Toggle error:', error);
      toast.error('שגיאה בעדכון סטטוס האינטגרציה');
    },
  });

  const manychatIntegration = integrations?.find(i => i.integration_type === 'manychat');
  const greenApiIntegration = integrations?.find(i => i.integration_type === 'green_api');

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
      name: 'Green API',
      description: 'אינטגרציה ישירה ל-WhatsApp Business עם API פשוט ומהיר',
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

                  <Button
                    onClick={() => navigate(buildPath(provider.settingsPath))}
                    className="w-full"
                    variant={provider.hasApiKey ? "outline" : "default"}
                  >
                    <Settings className="h-4 w-4 ml-2" />
                    {provider.hasApiKey ? 'ניהול הגדרות' : 'הגדר עכשיו'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
