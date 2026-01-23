import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Check, X, RefreshCw, ExternalLink, Key, Zap } from "lucide-react";

export default function SerpApiSettings() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");

  // Check connection status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["serpapi-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("serpapi-auth", {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;
      return response.data;
    },
  });

  // Get account info
  const { data: accountInfo, refetch: refetchAccount } = useQuery({
    queryKey: ["serpapi-account"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("serpapi-auth", {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      // Need to call with action=account - using URL params
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
    mutationFn: async (key: string) => {
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
          body: JSON.stringify({ api_key: key }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connection failed");
      return data;
    },
    onSuccess: () => {
      toast.success("SerpAPI מחובר בהצלחה!");
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["serpapi-status"] });
      queryClient.invalidateQueries({ queryKey: ["serpapi-account"] });
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
      toast.success("SerpAPI נותק");
      queryClient.invalidateQueries({ queryKey: ["serpapi-status"] });
      queryClient.invalidateQueries({ queryKey: ["serpapi-account"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "שגיאה בניתוק");
    },
  });

  const handleConnect = () => {
    if (!apiKey.trim()) {
      toast.error("יש להזין מפתח API");
      return;
    }
    connectMutation.mutate(apiKey);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Search className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">הגדרות SerpAPI</h1>
          <p className="text-muted-foreground">חיבור ל-SerpAPI למעקב דירוגים בזמן אמת</p>
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
              חבר את חשבון SerpAPI שלך כדי לאפשר מעקב דירוגים
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
                      <span>{accountInfo.account_email}</span>
                    </div>
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
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">נותרו:</span>
                      <span className="font-medium text-primary">
                        {accountInfo.remaining_searches} חיפושים
                      </span>
                    </div>
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
                  <Label htmlFor="apiKey">מפתח API של SerpAPI</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="הזן את מפתח ה-API שלך"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleConnect}
                  disabled={connectMutation.isPending || !apiKey.trim()}
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
              מה זה SerpAPI?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              SerpAPI הוא שירות שמאפשר לקבל תוצאות חיפוש מגוגל בזמן אמת. 
              בניגוד ל-Google Search Console, SerpAPI נותן לך את המיקום המדויק 
              של האתר שלך ברגע זה - לא ממוצע של ימים אחרונים.
            </p>

            <div className="space-y-2">
              <h4 className="font-medium">יתרונות:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>מיקום מדויק בזמן אמת</li>
                <li>מעקב יומי אוטומטי</li>
                <li>היסטוריית מיקומים</li>
                <li>מעקב אחרי מתחרים</li>
                <li>התראות על שינויי מיקום</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">תמחור:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• חינם: 100 חיפושים/חודש</li>
                <li>• Developer: $50/חודש ל-5,000 חיפושים</li>
                <li>• Business: $150/חודש ל-15,000 חיפושים</li>
              </ul>
            </div>

            <Button variant="outline" asChild className="w-full">
              <a
                href="https://serpapi.com/manage-api-key"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                קבל מפתח API ב-SerpAPI
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
