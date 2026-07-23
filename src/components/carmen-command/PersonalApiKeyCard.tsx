import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const sb = supabase as any; // user_api_keys is not in the generated types yet

/**
 * Bring-your-own-key card (MyProfile): a user who saves a personal OpenAI key
 * gets access to the Carmen Command Center, billed on their own key.
 */
export function PersonalApiKeyCard() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: hasKey, isLoading } = useQuery({
    queryKey: ["user-api-key"],
    queryFn: async () => {
      const { data } = await sb.from("user_api_keys").select("user_id").limit(1).maybeSingle();
      return !!data;
    },
  });

  const save = async () => {
    const key = input.trim();
    if (!key.startsWith("sk-")) {
      toast({ title: "מפתח לא תקין", description: "מפתח OpenAI מתחיל ב-sk-", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      // Validate against OpenAI before saving (unbilled endpoint)
      const test = await fetch("https://api.openai.com/v1/models?limit=1", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!test.ok) throw new Error("OpenAI דחה את המפתח — בדוק שהוא נכון ופעיל");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("לא מחובר");
      const { error } = await sb.from("user_api_keys").upsert({
        user_id: user.id, provider: "openai", api_key: key, updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      setInput("");
      qc.invalidateQueries({ queryKey: ["user-api-key"] });
      toast({ title: "המפתח נשמר ✓", description: "כרמן זמינה עכשיו — כפתור כרמן יופיע ב-header (רענן אם צריך)" });
    } catch (e) {
      toast({ title: "שגיאה", description: e instanceof Error ? e.message : "שמירת המפתח נכשלה", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await sb.from("user_api_keys").delete().eq("user_id", user.id);
      qc.invalidateQueries({ queryKey: ["user-api-key"] });
      toast({ title: "המפתח הוסר", description: "הגישה לכרמן דרך המפתח האישי בוטלה" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5" />
          כרמן — מפתח API אישי
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        <p className="text-sm text-muted-foreground">
          הזן מפתח OpenAI אישי כדי להשתמש בכרמן (Command Center) — השימוש הקולי יחויב על המפתח שלך.
          המפתח נשמר מאובטח ונגיש רק לך.
        </p>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : hasKey ? (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-sm">✅ מפתח אישי מוגדר — כרמן זמינה עבורך</span>
            <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
              <Trash2 className="ml-1 h-4 w-4" />הסר
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              type="password"
              dir="ltr"
              placeholder="sk-..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="font-mono"
            />
            <Button onClick={save} disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
