import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Brain, Key, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

// LLM providers the user can connect their own API keys for.
const PROVIDERS = [
  {
    key: "openai_api_key",
    name: "OpenAI (GPT)",
    placeholder: "sk-...",
    help: "platform.openai.com/api-keys",
    helpUrl: "https://platform.openai.com/api-keys",
    color: "from-emerald-500 to-teal-600",
  },
  {
    key: "anthropic_api_key",
    name: "Anthropic (Claude)",
    placeholder: "sk-ant-...",
    help: "console.anthropic.com",
    helpUrl: "https://console.anthropic.com/settings/keys",
    color: "from-orange-500 to-amber-600",
  },
  {
    key: "google_api_key",
    name: "Google (Gemini)",
    placeholder: "AIza...",
    help: "aistudio.google.com/app/apikey",
    helpUrl: "https://aistudio.google.com/app/apikey",
    color: "from-blue-500 to-indigo-600",
  },
] as const;

type ProviderKey = (typeof PROVIDERS)[number]["key"];

export default function LLMSettings() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Existing 'llm' integration for this tenant (last 4 of each saved key, for display only).
  const { data: integration, isLoading } = useQuery({
    queryKey: ["llm-integration", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id, user_id, settings, is_active")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "llm")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const savedSettings = (integration?.settings as Record<string, string>) || {};

  // Inputs hold NEW values only. An empty input means "keep the existing key".
  const [form, setForm] = useState<Record<ProviderKey, string>>({
    openai_api_key: "",
    anthropic_api_key: "",
    google_api_key: "",
  });

  useEffect(() => {
    // Reset inputs whenever the saved record loads/changes.
    setForm({ openai_api_key: "", anthropic_api_key: "", google_api_key: "" });
  }, [integration?.id]);

  const hasKey = (key: ProviderKey) =>
    typeof savedSettings[key] === "string" && savedSettings[key].length > 0;

  const last4 = (key: ProviderKey) =>
    hasKey(key) ? savedSettings[key].slice(-4) : null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) throw new Error("משתמש לא מחובר");

      // Merge: only overwrite a provider's key when a new value was typed.
      const mergedSettings: Record<string, string> = { ...savedSettings };
      let changed = false;
      for (const p of PROVIDERS) {
        const v = form[p.key].trim();
        if (v) {
          mergedSettings[p.key] = v;
          changed = true;
        }
      }
      if (!changed && integration) {
        return integration.id; // nothing new typed
      }

      const payload: any = {
        tenant_id: tenantId,
        user_id: userId,
        integration_type: "llm",
        is_active: true,
        display_name: "מודלי AI (LLMs)",
        settings: mergedSettings,
      };

      if (integration) {
        const { error } = await supabase
          .from("tenant_integrations")
          .update(payload)
          .eq("id", integration.id);
        if (error) throw error;
        return integration.id;
      }
      const { data, error } = await supabase
        .from("tenant_integrations")
        .insert([payload])
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      toast({ title: "נשמר בהצלחה", description: "מפתחות ה-AI עודכנו" });
      setForm({ openai_api_key: "", anthropic_api_key: "", google_api_key: "" });
      queryClient.invalidateQueries({ queryKey: ["llm-integration", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["llm-connected-providers", tenantId] });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "שגיאה", description: e.message }),
  });

  const connectedCount = PROVIDERS.filter((p) => hasKey(p.key)).length;

  return (
    <div className="container mx-auto p-6 max-w-3xl" dir="rtl">
      <Button
        variant="ghost"
        onClick={() => navigate(buildPath("/integrations"))}
        className="mb-6"
      >
        <ArrowRight className="h-4 w-4 ml-2" />
        חזרה לאינטגרציות
      </Button>

      <div className="mb-8 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
          <Brain className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">מודלי AI (LLMs)</h1>
          <p className="text-muted-foreground">
            חבר את מפתחות ה-API שלך ל-GPT, Claude ו-Gemini. הסוכנים (כולל כרמן) ישתמשו במפתחות אלה כ"מוח".
          </p>
        </div>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          המפתחות נשמרים ב-Supabase של הארגון שלך ומשמשים את הסוכנים בלבד. מספיק לחבר ספק אחד כדי להתחיל
          {connectedCount > 0 && (
            <> — כרגע מחוברים <strong>{connectedCount}</strong> מתוך {PROVIDERS.length}.</>
          )}
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">טוען...</p>
      ) : (
        <div className="grid gap-4">
          {PROVIDERS.map((p) => (
            <Card key={p.key}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${p.color}`}>
                      <Key className="h-4 w-4 text-white" />
                    </div>
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    {hasKey(p.key) ? (
                      <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3 ml-1" />
                        מחובר
                      </Badge>
                    ) : (
                      <Badge variant="secondary">לא מוגדר</Badge>
                    )}
                  </div>
                  <a
                    href={p.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {p.help} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor={p.key}>מפתח API</Label>
                  <Input
                    id={p.key}
                    type="password"
                    dir="ltr"
                    placeholder={hasKey(p.key) ? `מחובר • מסתיים ב-${last4(p.key)} (השאר ריק כדי לא לשנות)` : p.placeholder}
                    value={form[p.key]}
                    onChange={(e) => setForm({ ...form, [p.key]: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Key className="h-4 w-4 ml-2" />
              {saveMutation.isPending ? "שומר..." : "שמור מפתחות"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
