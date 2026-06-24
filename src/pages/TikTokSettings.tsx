import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Music2, CheckCircle2, AlertCircle, RefreshCw, Unplug, Users, Heart, Video } from "lucide-react";

export default function TikTokSettings() {
  const { currentTenantId } = useTenant();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: integration, isLoading } = useQuery({
    queryKey: ['tiktok-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'tiktok')
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  const account = (integration?.settings as any) || {};
  const isConnected = !!integration?.is_active;

  const connect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tiktok-connect', { method: 'POST' });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success('חשבון TikTok חובר בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['tiktok-integration'] });
      queryClient.invalidateQueries({ queryKey: ['tiktok-integration-status'] });
    },
    onError: (e: any) => toast.error('כשל בחיבור: ' + (e?.message || 'שגיאה לא ידועה')),
    onSettled: () => setBusy(null),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tiktok-disconnect', { method: 'POST' });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('החשבון נותק');
      queryClient.invalidateQueries({ queryKey: ['tiktok-integration'] });
      queryClient.invalidateQueries({ queryKey: ['tiktok-integration-status'] });
    },
    onError: (e: any) => toast.error('שגיאה בניתוק: ' + (e?.message || '')),
    onSettled: () => setBusy(null),
  });

  return (
    <div className="h-full overflow-y-auto" dir="rtl">
      <div className="container mx-auto p-6 max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-white">
            <Music2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">TikTok</h1>
            <p className="text-muted-foreground mt-1">
              חיבור חשבון TikTok לדוחות ביצועי תוכן אורגני (סרטונים, צפיות, מעורבות)
            </p>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            חיבור ישיר ל-TikTok (דורש TIKTOK_ACCESS_TOKEN).
            כרגע נתמך מידע אורגני בלבד (פרופיל וסרטונים). נתוני TikTok Ads (קמפיינים בתשלום) ידרשו אינטגרציה נפרדת.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : isConnected ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    {account.avatar_url && <AvatarImage src={account.avatar_url} alt={account.display_name} />}
                    <AvatarFallback>{(account.display_name || 'TT').slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {account.display_name || 'TikTok Account'}
                      {account.is_verified && <Badge variant="secondary">מאומת</Badge>}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      open_id: <code className="text-xs">{account.open_id}</code>
                    </CardDescription>
                  </div>
                </div>
                <Badge className="bg-green-500/90 hover:bg-green-500">
                  <CheckCircle2 className="h-3 w-3 ml-1" /> מחובר
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat icon={<Users className="h-4 w-4" />} label="עוקבים" value={account.follower_count} />
                <Stat icon={<Users className="h-4 w-4" />} label="עוקב אחרי" value={account.following_count} />
                <Stat icon={<Heart className="h-4 w-4" />} label="לייקים" value={account.likes_count} />
                <Stat icon={<Video className="h-4 w-4" />} label="סרטונים" value={account.video_count} />
              </div>

              {account.bio && (
                <p className="text-sm text-muted-foreground border-r-2 border-muted pr-3">{account.bio}</p>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="outline"
                  disabled={connect.isPending || busy === 'refresh'}
                  onClick={() => { setBusy('refresh'); connect.mutate(); }}
                >
                  {connect.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                  רענן נתוני חשבון
                </Button>
                <Button
                  variant="destructive"
                  disabled={disconnect.isPending}
                  onClick={() => { setBusy('disconnect'); disconnect.mutate(); }}
                >
                  {disconnect.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Unplug className="h-4 w-4 ml-2" />}
                  נתק חשבון
                </Button>
                {account.profile_url && (
                  <Button variant="ghost" asChild>
                    <a href={account.profile_url} target="_blank" rel="noreferrer">פתח פרופיל ב-TikTok</a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>חיבור חשבון TikTok</CardTitle>
              <CardDescription>
                לחץ על הכפתור כדי לחבר את חשבון ה-TikTok שלך. אנו נמשוך את פרטי החשבון מהקונקטור.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => { setBusy('connect'); connect.mutate(); }}
                disabled={connect.isPending}
                className="bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-white"
              >
                {connect.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Music2 className="h-4 w-4 ml-2" />}
                חבר חשבון TikTok
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-xl font-semibold mt-1">{(value ?? 0).toLocaleString('he-IL')}</div>
    </div>
  );
}
