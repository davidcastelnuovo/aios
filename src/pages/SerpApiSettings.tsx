import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Check, X, RefreshCw, ExternalLink, Key, Zap, DollarSign, Mail, Lock } from "lucide-react";

export default function SerpApiSettings() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Check connection status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["dataforseo-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serpapi-auth?action=status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) return { connected: false };
      return response.json();
    },
  });

  // Get account info
  const { data: accountInfo, refetch: refetchAccount } = useQuery({
    queryKey: ["dataforseo-account"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const accountResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serpapi-auth?action=account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!accountResponse.ok) return null;
      return accountResponse.json();
    },
    enabled: status?.connected,
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serpapi-auth?action=connect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connection failed");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`DataForSEO מחובר בהצלחה! יתרה: $${data.balance}`);
      setEmail("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["dataforseo-status"] });
      queryClient.invalidateQueries({ queryKey: ["dataforseo-account"] });
      queryClient.invalidateQueries({ queryKey: ["serpapi-status"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "שגיאה בחיבור");
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serpapi-auth?action=disconnect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Disconnection failed");
      return data;
    },
    onSuccess: () => {
      toast.success("DataForSEO נותק");
      queryClient.invalidateQueries({ queryKey: ["dataforseo-status"] });
      queryClient.invalidateQueries({ queryKey: ["dataforseo-account"] });
      queryClient.invalidateQueries({ queryKey: ["serpapi-status"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "שגיאה בניתוק");
    },
  });

  const handleConnect = () => {
    if (!email.trim() || !password.trim()) {
      toast.error("יש להזין אימייל וסיסמה");
      return;
    }
    connectMutation.mutate({ email, password });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Search className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">הגדרות DataForSEO</h1>
          <p className="text-muted-foreground">חיבור ל-DataForSEO למעקב דירוגים בזמן אמת</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Connection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              חיבור API
            </CardTitle>
            <CardDescription>
              חבר את חשבון DataForSEO שלך כדי לאפשר מעקב דירוגים
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                בודק חיבור...
              </div>
            ) : status?.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">
                    <Check className="h-3 w-3 mr-1" />
                    מחובר
                  </Badge>
                </div>

                {accountInfo && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">חשבון:</span>
                      <span>{accountInfo.login}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">יתרה:</span>
                      <span className="font-medium text-primary flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {accountInfo.balance?.toFixed(2)} {accountInfo.currency}
                      </span>
                    </div>
                    {accountInfo.provider === "serpapi" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">תוכנית:</span>
                          <span>{accountInfo.plan}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">חיפושים החודש:</span>
                          <span>
                            {accountInfo.this_month_searches} / {accountInfo.searches_per_month}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchAccount()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    רענן
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    נתק
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    <X className="h-3 w-3 mr-1" />
                    לא מחובר
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    אימייל DataForSEO
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    סיסמת API
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="הזן את סיסמת ה-API שלך"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    הסיסמה נמצאת ב-DataForSEO Dashboard → API Access
                  </p>
                </div>

                <Button
                  onClick={handleConnect}
                  disabled={connectMutation.isPending || !email.trim() || !password.trim()}
                  className="w-full"
                >
                  {connectMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  חבר
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              מה זה DataForSEO?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              DataForSEO הוא שירות מעקב דירוגים מקצועי שמאפשר לך לקבל את המיקום המדויק 
              של האתר שלך בגוגל בזמן אמת. המחיר נמוך משמעותית מ-SerpAPI ושירותים דומים.
            </p>

            <div className="space-y-2">
              <h4 className="font-medium">יתרונות:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>מיקום מדויק בזמן אמת</li>
                <li>מחיר Pay-as-you-go (~$0.0015 לחיפוש)</li>
                <li>היסטוריית מיקומים וגרפים</li>
                <li>מעקב אחרי מתחרים</li>
                <li>תמיכה בכל המדינות והשפות</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">תמחור לדוגמה:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 1,000 ביטויים: ~$1.50</li>
                <li>• 5,000 ביטויים: ~$7.50</li>
                <li>• 10,000 ביטויים: ~$15</li>
              </ul>
            </div>

            <Button variant="outline" asChild className="w-full">
              <a
                href="https://app.dataforseo.com/api-access"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                קבל גישת API ב-DataForSEO
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
