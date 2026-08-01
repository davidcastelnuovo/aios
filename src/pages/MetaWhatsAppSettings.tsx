import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTenantPath } from "@/hooks/useTenantPath";
import { IntegrationVisibilitySelector } from "@/components/forms/IntegrationVisibilitySelector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

type SignupMode = "new_number" | "coexistence";

type MetaConfig = {
  app_id: string;
  configuration_id: string;
  graph_version: string;
};

type FacebookLoginResponse = {
  authResponse?: { code?: string };
};

type FacebookSdk = {
  init: (options: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options: Record<string, unknown>,
  ) => void;
};

type FacebookWindow = Window & {
  FB?: FacebookSdk;
  fbAsyncInit?: () => void;
};

type Integration = {
  id: string;
  user_id: string | null;
  display_name: string | null;
  is_active: boolean;
  connection_visibility?: string | null;
  settings: {
    waba_id?: string;
    phone_number_id?: string;
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    platform_type?: string;
    coexistence_enabled?: boolean;
    history_sync_progress?: number;
    history_sync_error?: string | null;
  } | null;
};

const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const webhookUrl = `https://${PROJECT_REF}.supabase.co/functions/v1/meta-whatsapp-webhook`;

function loadFacebookSdk(appId: string, version: string) {
  return new Promise<void>((resolve, reject) => {
    const win = window as FacebookWindow;
    if (win.FB) {
      win.FB.init({ appId, cookie: true, xfbml: false, version });
      resolve();
      return;
    }
    win.fbAsyncInit = () => {
      win.FB.init({ appId, cookie: true, xfbml: false, version });
      resolve();
    };
    const existing = document.getElementById("facebook-jssdk");
    if (existing) return;
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onerror = () => reject(new Error("לא ניתן לטעון את Meta SDK"));
    document.body.appendChild(script);
  });
}

export default function MetaWhatsAppSettings() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<SignupMode>("coexistence");
  const [pin, setPin] = useState("");
  const [connecting, setConnecting] = useState(false);
  const codeRef = useRef<string | null>(null);
  const sessionRef = useRef<{ data: Record<string, unknown>; event: string } | null>(null);
  const completingRef = useRef(false);

  const { data: config, error: configError } = useQuery({
    queryKey: ["meta-whatsapp-config", tenantId],
    enabled: Boolean(tenantId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-auth", {
        body: { action: "config", tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as MetaConfig;
    },
  });

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["meta-whatsapp-integrations", tenantId, userId],
    enabled: Boolean(tenantId && userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id,user_id,display_name,is_active,connection_visibility,settings")
        .eq("tenant_id", tenantId!)
        .eq("integration_type", "meta_whatsapp")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Integration[];
    },
  });

  const finishSignup = async () => {
    if (!tenantId || !codeRef.current || !sessionRef.current || completingRef.current) return;
    completingRef.current = true;
    try {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-auth", {
        body: {
          action: "complete",
          tenant_id: tenantId,
          code: codeRef.current,
          session_info: sessionRef.current.data,
          session_event: sessionRef.current.event,
          coexistence: mode === "coexistence",
          pin,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "החיבור לא הושלם");
      const count = data.connections?.length ?? 1;
      toast.success(`${count === 1 ? "מספר WhatsApp חובר" : `${count} מספרי WhatsApp חוברו`} בהצלחה`);
      if (data.warnings?.length) {
        toast.warning("החיבור הושלם, אך סנכרון היסטוריה חלקי. ניתן לראות סטטוס בכרטיס החיבור.");
      }
      await queryClient.invalidateQueries({ queryKey: ["meta-whatsapp-integrations", tenantId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שגיאה בחיבור WhatsApp");
    } finally {
      codeRef.current = null;
      sessionRef.current = null;
      completingRef.current = false;
      setConnecting(false);
    }
  };

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (!event.origin.endsWith("facebook.com")) return;
      let parsed: unknown;
      try {
        parsed = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") return;
      const payload = parsed as {
        type?: string;
        event?: string;
        data?: Record<string, unknown>;
      };
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (payload.event === "CANCEL") {
        setConnecting(false);
        toast.info("תהליך החיבור בוטל");
        return;
      }
      if (payload.event === "ERROR") {
        setConnecting(false);
        toast.error(String(payload.data?.error_message || "Meta לא הצליחה להשלים את החיבור"));
        return;
      }
      if (String(payload.event ?? "").startsWith("FINISH")) {
        sessionRef.current = { data: payload.data ?? {}, event: payload.event };
        void finishSignup();
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  });

  const launchSignup = async () => {
    if (!config) return;
    if (mode === "new_number" && !/^\d{6}$/.test(pin)) {
      toast.error("יש לבחור קוד PIN בן 6 ספרות עבור המספר");
      return;
    }
    setConnecting(true);
    codeRef.current = null;
    sessionRef.current = null;
    try {
      await loadFacebookSdk(config.app_id, config.graph_version);
      const extras: Record<string, unknown> = { setup: {}, sessionInfoVersion: "3" };
      if (mode === "coexistence") extras.featureType = "whatsapp_business_app_onboarding";
      const sdk = (window as FacebookWindow).FB;
      if (!sdk) throw new Error("Meta SDK לא נטען");
      sdk.login(
        (response: FacebookLoginResponse) => {
          if (!response?.authResponse?.code) {
            setConnecting(false);
            toast.error("Meta לא החזירה קוד הרשאה");
            return;
          }
          codeRef.current = response.authResponse.code;
          void finishSignup();
        },
        {
          config_id: config.configuration_id,
          response_type: "code",
          override_default_response_type: true,
          extras,
        },
      );
    } catch (error) {
      setConnecting(false);
      toast.error(error instanceof Error ? error.message : "לא ניתן לפתוח את Meta");
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-auth", {
        body: { action: "disconnect", tenant_id: tenantId, integration_id: integrationId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "הניתוק נכשל");
    },
    onSuccess: () => {
      toast.success("החיבור הוסר מ-AIOS");
      queryClient.invalidateQueries({ queryKey: ["meta-whatsapp-integrations", tenantId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    toast.success("כתובת ה-Webhook הועתקה");
  };

  return (
    <div className="container mx-auto max-w-5xl p-6" dir="rtl">
      <Button variant="ghost" onClick={() => navigate(buildPath("/integrations"))} className="mb-6">
        <ArrowRight className="ml-2 h-4 w-4" />
        חזרה לאינטגרציות
      </Button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 p-2.5">
              <MessageCircle className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">WhatsApp Business הרשמי</h1>
              <p className="text-muted-foreground">חיבור ישיר ל־Meta WhatsApp Cloud API</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-700">
          <ShieldCheck className="h-4 w-4" />
          API רשמי של Meta
        </Badge>
      </div>

      {configError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>האינטגרציה עדיין לא הוגדרה בשרת</AlertTitle>
          <AlertDescription>
            יש להגדיר את הסודות <code>FACEBOOK_APP_ID</code>, <code>META_APP_SECRET</code>,{" "}
            <code>META_WHATSAPP_CONFIG_ID</code> ו־<code>META_WHATSAPP_WEBHOOK_VERIFY_TOKEN</code>.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>חיבור מספר WhatsApp</CardTitle>
            <CardDescription>בחרו אם לחבר מספר חדש או מספר שכבר פעיל באפליקציית WhatsApp Business.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <RadioGroup value={mode} onValueChange={(value) => setMode(value as SignupMode)} className="grid gap-3">
              <Label
                htmlFor="coexistence"
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-emerald-500"
              >
                <RadioGroupItem id="coexistence" value="coexistence" className="mt-1" />
                <span>
                  <span className="block font-semibold">מספר קיים ב־WhatsApp Business</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    Coexistence: ממשיכים להשתמש באפליקציה בטלפון, ובמקביל מחברים את AIOS ל־Cloud API.
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="new_number"
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-emerald-500"
              >
                <RadioGroupItem id="new_number" value="new_number" className="mt-1" />
                <span className="w-full">
                  <span className="block font-semibold">מספר חדש ל־Cloud API</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    מספר שאינו מחובר כרגע ל־WhatsApp רגיל. Meta תבצע אימות SMS או שיחה.
                  </span>
                </span>
              </Label>
            </RadioGroup>

            {mode === "new_number" && (
              <div className="space-y-2">
                <Label htmlFor="meta-wa-pin">PIN לאימות דו־שלבי (6 ספרות)</Label>
                <Input
                  id="meta-wa-pin"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="123456"
                  className="max-w-48"
                />
              </div>
            )}

            <Button onClick={launchSignup} disabled={!config || connecting} size="lg" className="w-full bg-[#1877F2] hover:bg-[#166FE5]">
              {connecting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ExternalLink className="ml-2 h-4 w-4" />}
              {connecting ? "משלים חיבור..." : "המשך לחיבור מאובטח ב־Meta"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              מה קורה בחיבור?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Meta מציגה את מסך ההרשאה הרשמי ובוחרת Business Portfolio, חשבון WABA ומספר.</p>
            <p>AIOS נרשמת ל־webhooks ושומרת את החיבור תחת הארגון הנוכחי בלבד.</p>
            <p>ב־Coexistence מתבקש מיד סנכרון אנשי קשר והיסטוריה, ועותקי הודעות מהטלפון נשמרים בצ׳אט.</p>
            <Separator />
            <p className="font-medium text-foreground">מגבלות Meta: אין קבוצות; מחוץ לחלון 24 שעות יש לשלוח תבנית מאושרת.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Webhook לאפליקציית Meta</CardTitle>
          <CardDescription>כתובת אחת לכל הארגונים; AIOS מנתבת כל אירוע לפי Phone Number ID.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input value={webhookUrl} readOnly dir="ltr" className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={copyWebhook}>
            <Copy className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">מספרים מחוברים</h2>
        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">טוען...</div>
        ) : integrations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">עדיין לא חובר מספר WhatsApp רשמי.</CardContent>
          </Card>
        ) : (
          integrations.map((integration) => {
            const settings = integration.settings ?? {};
            const progress = settings.history_sync_progress;
            return (
              <Card key={integration.id} className="border-emerald-500/20">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <div>
                        <CardTitle className="text-lg">{settings.verified_name || integration.display_name}</CardTitle>
                        <CardDescription dir="ltr" className="text-right">
                          {settings.display_phone_number || settings.phone_number_id}
                        </CardDescription>
                      </div>
                      {settings.coexistence_enabled && <Badge variant="secondary">Coexistence</Badge>}
                      <Badge variant="outline">{settings.quality_rating || "מחובר"}</Badge>
                    </div>
                    {integration.user_id === userId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("להסיר את החיבור מ־AIOS? המספר לא יימחק מ־Meta.")) {
                            disconnectMutation.mutate(integration.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">WABA ID</Label>
                      <div className="font-mono text-xs" dir="ltr">{settings.waba_id || "—"}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone Number ID</Label>
                      <div className="font-mono text-xs" dir="ltr">{settings.phone_number_id || "—"}</div>
                    </div>
                  </div>
                  {settings.coexistence_enabled && typeof progress === "number" && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>סנכרון היסטוריית WhatsApp</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  )}
                  {settings.history_sync_error && (
                    <Alert>
                      <Phone className="h-4 w-4" />
                      <AlertDescription>{settings.history_sync_error}</AlertDescription>
                    </Alert>
                  )}
                  <Separator />
                  <IntegrationVisibilitySelector
                    integrationId={integration.id}
                    integrationName={integration.display_name || "Meta WhatsApp"}
                    ownerId={integration.user_id}
                    tenantId={tenantId!}
                  />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
