import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Bot, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useTenant } from "@/contexts/TenantContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function TelegramSettings() {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { currentTenantId } = useTenant();
  const queryClient = useQueryClient();
  const [botToken, setBotToken] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: botState, isLoading } = useQuery({
    queryKey: ["telegram-bot-state", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from("telegram_bot_state")
        .select("*")
        .eq("tenant_id", currentTenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  const { data: messageCount } = useQuery({
    queryKey: ["telegram-message-count", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return 0;
      const { count } = await supabase
        .from("telegram_messages")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", currentTenantId);
      return count || 0;
    },
    enabled: !!currentTenantId,
  });

  const connectBot = useMutation({
    mutationFn: async () => {
      if (!currentTenantId || !botToken.trim()) throw new Error("Missing data");
      
      setIsVerifying(true);
      
      // Verify bot token via edge function
      const { data, error } = await supabase.functions.invoke("telegram-verify-bot", {
        body: { bot_token: botToken.trim(), tenant_id: currentTenantId },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to verify bot");

      return data;
    },
    onSuccess: (data) => {
      toast.success(`בוט ${data.bot_name} חובר בהצלחה!`);
      setBotToken("");
      queryClient.invalidateQueries({ queryKey: ["telegram-bot-state"] });
    },
    onError: (error: Error) => {
      toast.error(`שגיאה: ${error.message}`);
    },
    onSettled: () => setIsVerifying(false),
  });

  const disconnectBot = useMutation({
    mutationFn: async () => {
      if (!currentTenantId) throw new Error("Missing tenant");
      const { error } = await supabase
        .from("telegram_bot_state")
        .update({ is_active: false })
        .eq("tenant_id", currentTenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הבוט נותק בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["telegram-bot-state"] });
    },
    onError: () => toast.error("שגיאה בניתוק הבוט"),
  });

  const isConnected = botState?.is_active;

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto p-6 space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(buildPath("integrations"))}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Send className="h-6 w-6 text-sky-500" />
              Telegram
            </h1>
            <p className="text-muted-foreground">חיבור בוט טלגרם לשליחה וקבלה של הודעות</p>
          </div>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>סטטוס חיבור</span>
              <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-green-500" : ""}>
                {isConnected ? (
                  <><CheckCircle className="h-3 w-3 ml-1" /> מחובר</>
                ) : (
                  <><XCircle className="h-3 w-3 ml-1" /> לא מחובר</>
                )}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isConnected && botState ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">שם הבוט:</span>
                    <p className="font-medium">{botState.bot_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Username:</span>
                    <p className="font-medium" dir="ltr">@{botState.bot_username}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">הודעות:</span>
                    <p className="font-medium">{messageCount}</p>
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => disconnectBot.mutate()}>
                  נתק בוט
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  כדי לחבר בוט טלגרם, צור בוט דרך{" "}
                  <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="text-primary underline">
                    @BotFather
                  </a>{" "}
                  והכנס את ה-Token שקיבלת.
                </p>
                <div className="space-y-2">
                  <Label>Bot Token</Label>
                  <Input
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    dir="ltr"
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  onClick={() => connectBot.mutate()}
                  disabled={!botToken.trim() || isVerifying}
                >
                  {isVerifying ? (
                    <><Loader2 className="h-4 w-4 ml-2 animate-spin" /> מאמת...</>
                  ) : (
                    <><Bot className="h-4 w-4 ml-2" /> חבר בוט</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle>איך זה עובד?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. צור בוט חדש דרך @BotFather בטלגרם</p>
            <p>2. העתק את ה-Bot Token שקיבלת והדבק כאן</p>
            <p>3. המערכת תאמת את הבוט ותתחיל לקלוט הודעות</p>
            <p>4. הודעות נכנסות יופיעו בזמן אמת במערכת</p>
            <p>5. ניתן לשלוח הודעות חזרה דרך הבוט</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
