import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Loader2, Link2, ExternalLink, TrendingUp, Search, Link as LinkIcon, BarChart3 } from "lucide-react";

export default function AhrefsSettings() {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: connectionStatus, isLoading } = useQuery({
    queryKey: ['ahrefs-status'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { connected: false };

      const statusResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ahrefs-auth?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!statusResponse.ok) return { connected: false };
      return statusResponse.json();
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ahrefs-auth?action=connect`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to connect');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success('התחברת בהצלחה ל-Ahrefs');
      queryClient.invalidateQueries({ queryKey: ['ahrefs-status'] });
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בהתחברות: ${error.message}`);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ahrefs-auth?action=disconnect`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to disconnect');
      return response.json();
    },
    onSuccess: () => {
      toast.success('התנתקת מ-Ahrefs');
      queryClient.invalidateQueries({ queryKey: ['ahrefs-status'] });
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בהתנתקות: ${error.message}`);
    },
  });

  const features = [
    { icon: TrendingUp, title: 'Rank Tracker', description: 'מעקב דירוגים יומי למילות מפתח ספציפיות' },
    { icon: Search, title: 'Site Explorer', description: 'ניתוח תנועה אורגנית ובקלינקים' },
    { icon: BarChart3, title: 'Keywords Explorer', description: 'נפח חיפוש, קושי ורעיונות למילות מפתח' },
    { icon: LinkIcon, title: 'Backlinks', description: 'ניתוח קישורים נכנסים ודומיינים מפנים' },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ahrefs</h1>
          <p className="text-muted-foreground">חבר את חשבון ה-Ahrefs שלך לקבלת נתוני SEO מתקדמים</p>
        </div>
        <a
          href="https://app.ahrefs.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          פתח Ahrefs <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                סטטוס חיבור
              </CardTitle>
              <CardDescription>
                {connectionStatus?.connected 
                  ? 'החשבון מחובר ומוכן לשימוש'
                  : 'חבר את חשבון ה-Ahrefs שלך'}
              </CardDescription>
            </div>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : connectionStatus?.connected ? (
              <Badge variant="default" className="bg-green-500">
                <Check className="h-3 w-3 ml-1" />
                מחובר
              </Badge>
            ) : (
              <Badge variant="secondary">
                <X className="h-3 w-3 ml-1" />
                לא מחובר
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {connectionStatus?.connected ? (
            <div className="space-y-4">
              {connectionStatus.integration?.settings?.subscription && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">פרטי מנוי</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">יחידות API נותרו:</span>
                      <span className="mr-2 font-medium">
                        {connectionStatus.integration.settings.subscription.units_left?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">יחידות שימוש:</span>
                      <span className="mr-2 font-medium">
                        {connectionStatus.integration.settings.subscription.units_used?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <Button 
                variant="destructive" 
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                התנתק מ-Ahrefs
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                מפתח ה-API מוגדר במערכת. לחץ על "התחבר" כדי לבדוק את החיבור ולהפעיל את האינטגרציה.
              </p>
              <Button 
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                {connectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                התחבר ל-Ahrefs
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>איך להשתמש</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>1. התחבר ל-Ahrefs באמצעות הכפתור למעלה</p>
          <p>2. עבור לדף "טבלאות" וצור טבלה חדשה</p>
          <p>3. בחר "Ahrefs" כמקור נתונים</p>
          <p>4. הזן את הדומיין לניתוח ובחר את סוג הדוח</p>
          <p>5. לחץ על "סנכרן" לשליפת הנתונים</p>
        </CardContent>
      </Card>
    </div>
  );
}
