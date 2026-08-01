import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
  Stethoscope,
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

type MetaAsset = {
  waba_id: string;
  name: string | null;
  error?: string;
  subscribed_apps?: Array<{ id: string; name: string | null }> | null;
  phone_numbers: Array<{
    id: string;
    display_phone_number: string | null;
    verified_name: string | null;
    quality_rating: string | null;
    platform_type: string | null;
    is_on_biz_app: boolean;
  }>;
};

type FacebookLoginResponse = {
  authResponse?: { code?: string; accessToken?: string };
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

class MetaAuthError extends Error {
  code?: string;
  details?: unknown;
  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/**
 * supabase-js reports every non-2xx response as a bare "non-2xx status code"
 * error and discards the body, which hides the reason Meta rejected the
 * connection. Read the body so the operator sees the real failure.
 */
async function invokeMetaAuth(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("meta-whatsapp-auth", { body });
  if (!error) {
    if (data?.error) throw new MetaAuthError(String(data.error), data.code, data.discovery);
    return data;
  }

  const response = (error as { context?: Response }).context;
  if (response?.status === 401) {
    throw new MetaAuthError("ההתחברות למערכת פגה. רעננו את הדף, התחברו מחדש ונסו שוב.", "unauthorized");
  }
  let payload: { error?: string; code?: string; discovery?: unknown } | null = null;
  try {
    payload = await response?.clone().json();
  } catch {
    payload = null;
  }
  if (payload?.error) throw new MetaAuthError(String(payload.error), payload.code, payload.discovery);
  throw error;
}

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
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualPin, setManualPin] = useState("");
  const [manualWabaId, setManualWabaId] = useState("");
  const [manualBusinessId, setManualBusinessId] = useState("");
  const [assets, setAssets] = useState<MetaAsset[] | null>(null);
  const [metaAppId, setMetaAppId] = useState("");
  const [selectedPhone, setSelectedPhone] = useState("");
  const [discovery, setDiscovery] = useState<unknown>(null);
  const codeRef = useRef<string | null>(null);
  const sessionRef = useRef<{ data: Record<string, unknown>; event: string } | null>(null);
  const completingRef = useRef(false);
  const sessionTimerRef = useRef<number | null>(null);
  const tokenRef = useRef<string | null>(null);

  const { data: config, error: configError } = useQuery({
    queryKey: ["meta-whatsapp-config", tenantId],
    enabled: Boolean(tenantId),
    retry: false,
    queryFn: async () =>
      (await invokeMetaAuth({ action: "config", tenant_id: tenantId })) as MetaConfig,
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
    if (!tenantId || completingRef.current) return;
    if (!codeRef.current && !tokenRef.current) return;
    if (sessionTimerRef.current) {
      window.clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    completingRef.current = true;
    try {
      const data = await invokeMetaAuth({
        action: "complete",
        tenant_id: tenantId,
        code: codeRef.current,
        access_token: tokenRef.current,
        session_info: sessionRef.current?.data ?? {},
        session_event: sessionRef.current?.event ?? "",
        redirect_uris: [`${window.location.origin}/`, window.location.origin, window.location.href],
        pin,
      });
      if (!data?.success) throw new MetaAuthError(data?.error || "החיבור לא הושלם", data?.code);
      const count = data.connections?.length ?? 1;
      toast.success(`${count === 1 ? "מספר WhatsApp חובר" : `${count} מספרי WhatsApp חוברו`} בהצלחה`);
      if (data.warnings?.length) {
        toast.warning("החיבור הושלם, אך סנכרון היסטוריה חלקי. ניתן לראות סטטוס בכרטיס החיבור.");
      }
      await queryClient.invalidateQueries({ queryKey: ["meta-whatsapp-integrations", tenantId] });
    } catch (error) {
      const code = error instanceof MetaAuthError ? error.code : undefined;
      if (code === "code_exchange_failed" || code === "waba_not_granted") setShowManual(true);
      toast.error(error instanceof Error ? error.message : "שגיאה בחיבור WhatsApp", {
        duration: 12000,
      });
    } finally {
      codeRef.current = null;
      tokenRef.current = null;
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
        if (completingRef.current) return;
        if (sessionTimerRef.current) {
          window.clearTimeout(sessionTimerRef.current);
          sessionTimerRef.current = null;
        }
        codeRef.current = null;
        tokenRef.current = null;
        setConnecting(false);
        toast.info("תהליך החיבור בוטל");
        return;
      }
      if (payload.event === "ERROR") {
        if (sessionTimerRef.current) {
          window.clearTimeout(sessionTimerRef.current);
          sessionTimerRef.current = null;
        }
        codeRef.current = null;
        tokenRef.current = null;
        setConnecting(false);
        toast.error(String(payload.data?.error_message || "Meta לא הצליחה להשלים את החיבור"));
        return;
      }
      if (String(payload.event ?? "").startsWith("FINISH")) {
        sessionRef.current = { data: payload.data ?? {}, event: payload.event };
        if (codeRef.current || tokenRef.current) void finishSignup();
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  });

  useEffect(() => () => {
    if (sessionTimerRef.current) window.clearTimeout(sessionTimerRef.current);
  }, []);

  const launchSignup = async () => {
    if (!config) return;
    if (mode === "new_number" && !/^\d{6}$/.test(pin)) {
      toast.error("יש לבחור קוד PIN בן 6 ספרות עבור המספר");
      return;
    }
    setConnecting(true);
    codeRef.current = null;
    tokenRef.current = null;
    sessionRef.current = null;
    if (sessionTimerRef.current) {
      window.clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    try {
      await loadFacebookSdk(config.app_id, config.graph_version);
      // featureType must always be present; Meta treats a missing key differently
      // from an empty one and can drop back to the plain Facebook login dialog.
      const extras: Record<string, unknown> = {
        setup: {},
        featureType: mode === "coexistence" ? "whatsapp_business_app_onboarding" : "",
        sessionInfoVersion: "3",
      };
      const sdk = (window as FacebookWindow).FB;
      if (!sdk) throw new Error("Meta SDK לא נטען");
      sdk.login(
        (response: FacebookLoginResponse) => {
          const auth = response?.authResponse;
          // Depending on the configuration, Embedded Signup returns either an
          // authorization code or a short-lived user token. Accept either one.
          const returnedCode = auth?.code && !auth.code.startsWith("cb=") ? auth.code : null;
          const returnedToken = auth?.accessToken ?? null;
          if (!returnedCode && !returnedToken) {
            setConnecting(false);
            toast.error("Meta לא החזירה הרשאה. נסו שוב ואשרו את חשבון ה-WhatsApp בתהליך.");
            return;
          }
          codeRef.current = returnedCode;
          tokenRef.current = returnedToken;
          // Meta only emits the WA_EMBEDDED_SIGNUP session message for full
          // WhatsApp flows. Give it a brief moment, then complete regardless so
          // the screen can never wait forever for a message that never arrives.
          if (sessionRef.current) {
            void finishSignup();
            return;
          }
          sessionTimerRef.current = window.setTimeout(() => {
            void finishSignup();
          }, 2000);
        },
        {
          // Only the parameters Meta documents for Embedded Signup may be sent.
          // Anything else makes the dialog fall back to plain Facebook Login,
          // which returns a code this app cannot exchange.
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

  const loadAssetsMutation = useMutation({
    mutationFn: async () => {
      const data = await invokeMetaAuth({
        action: "list_assets",
        tenant_id: tenantId,
        access_token: manualToken.trim(),
        waba_id: manualWabaId.trim(),
        business_id: manualBusinessId.trim(),
      });
      if (!data?.success) {
        throw new MetaAuthError(data?.error || "לא ניתן לקרוא את הנכסים מ-Meta", data?.code);
      }
      setMetaAppId(String(data.app_id ?? ""));
      return (data.accounts ?? []) as MetaAsset[];
    },
    onSuccess: (accounts) => {
      setDiscovery(null);
      setAssets(accounts);
      const firstPhone = accounts.flatMap((account) =>
        account.phone_numbers.map((phone) => `${account.waba_id}::${phone.id}`),
      )[0];
      setSelectedPhone(firstPhone ?? "");
      const total = accounts.reduce((sum, account) => sum + account.phone_numbers.length, 0);
      if (!total) toast.warning("לא נמצאו מספרי WhatsApp תחת האסימון הזה");
      else toast.success(`נמצאו ${total} מספרים`);
    },
    onError: (error: Error) => {
      setAssets(null);
      setDiscovery(error instanceof MetaAuthError ? error.details ?? null : null);
      toast.error(error.message, { duration: 15000 });
    },
  });

  const connectManualMutation = useMutation({
    mutationFn: async () => {
      const [wabaId, phoneNumberId] = selectedPhone.split("::");
      if (!wabaId || !phoneNumberId) throw new Error("יש לבחור מספר");
      const data = await invokeMetaAuth({
        action: "connect_manual",
        tenant_id: tenantId,
        access_token: manualToken.trim(),
        waba_id: wabaId,
        phone_number_ids: [phoneNumberId],
        pin: manualPin,
      });
      if (!data?.success) throw new MetaAuthError(data?.error || "החיבור לא הושלם", data?.code);
      return data;
    },
    onSuccess: async (data) => {
      toast.success(`מספר WhatsApp חובר בהצלחה (${data.connections?.length ?? 1})`);
      if (data.warnings?.length) toast.warning("החיבור הושלם, אך סנכרון היסטוריה חלקי.");
      setManualToken("");
      setManualPin("");
      setAssets(null);
      setSelectedPhone("");
      await queryClient.invalidateQueries({ queryKey: ["meta-whatsapp-integrations", tenantId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const diagnoseMutation = useMutation({
    mutationFn: async () =>
      (await invokeMetaAuth({ action: "diagnose", tenant_id: tenantId })) as Record<string, unknown>,
    onError: (error: Error) => toast.error(error.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const data = await invokeMetaAuth({
        action: "disconnect",
        tenant_id: tenantId,
        integration_id: integrationId,
      });
      if (!data?.success) throw new MetaAuthError(data?.error || "הניתוק נכשל", data?.code);
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

            <div className="space-y-2">
              <Label htmlFor="meta-wa-pin">
                PIN לאימות דו־שלבי (6 ספרות)
                {mode === "coexistence" && <span className="text-muted-foreground"> — אופציונלי</span>}
              </Label>
              <Input
                id="meta-wa-pin"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                dir="ltr"
                placeholder="123456"
                className="max-w-48"
              />
              <p className="text-xs text-muted-foreground">
                נדרש כאשר המספר נרשם ל־Cloud API. במסלול Coexistence Meta מדלגת על הרישום.
              </p>
            </div>

            <Button onClick={launchSignup} disabled={!config || connecting} size="lg" className="w-full bg-[#1877F2] hover:bg-[#166FE5]">
              {connecting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ExternalLink className="ml-2 h-4 w-4" />}
              {connecting ? "משלים חיבור..." : "המשך לחיבור מאובטח ב־Meta"}
            </Button>
            <p className="text-xs text-muted-foreground">
              אם Meta מדלגת על מסכי ה־WhatsApp ומחזירה אתכם מיד לאתר, התצורה באפליקציה אינה זרימת
              Embedded Signup.{" "}
              <button type="button" className="underline" onClick={() => setShowManual(true)}>
                חברו את המספר במסלול הידני
              </button>
              .
            </p>
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <KeyRound className="h-5 w-5 text-emerald-600" />
                חיבור ידני עם Access Token
              </CardTitle>
              <CardDescription>
                מסלול שעובד גם בלי Embedded Signup: מדביקים אסימון System User מ־Meta Business
                Settings, בוחרים מספר ומחברים.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowManual((value) => !value)}>
              {showManual ? "הסתרה" : "פתיחה"}
            </Button>
          </div>
        </CardHeader>
        {showManual && (
          <CardContent className="space-y-5">
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>איך משיגים אסימון</AlertTitle>
              <AlertDescription className="text-sm">
                Meta Business Settings → Users → System users → יצירת משתמש מערכת → Add Assets ובחירת
                חשבון ה־WhatsApp → Generate new token עם ההרשאות{" "}
                <code>whatsapp_business_management</code> ו־<code>whatsapp_business_messaging</code>.
                האסימון נשמר מוצפן ואינו נחשף בממשק.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="meta-wa-token">Access Token</Label>
              <Input
                id="meta-wa-token"
                type="password"
                value={manualToken}
                onChange={(event) => {
                  setManualToken(event.target.value);
                  setAssets(null);
                  setSelectedPhone("");
                }}
                dir="ltr"
                autoComplete="off"
                placeholder="EAAG..."
                className="font-mono text-xs"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="meta-wa-waba-id">
                  WhatsApp Business Account ID
                  <span className="text-muted-foreground"> — אופציונלי</span>
                </Label>
                <Input
                  id="meta-wa-waba-id"
                  value={manualWabaId}
                  onChange={(event) => setManualWabaId(event.target.value.replace(/\D/g, ""))}
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="104938271625483"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-wa-business-id">
                  Business Portfolio ID
                  <span className="text-muted-foreground"> — אופציונלי</span>
                </Label>
                <Input
                  id="meta-wa-business-id"
                  value={manualBusinessId}
                  onChange={(event) => setManualBusinessId(event.target.value.replace(/\D/g, ""))}
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="1029384756102938"
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              מלאו את השדות האלה רק אם השליפה האוטומטית לא מוצאת את החשבון. את ה־WABA ID רואים
              ב־App Dashboard → WhatsApp → API Setup, או ב־Business Settings → WhatsApp accounts.
            </p>

            <Button
              variant="secondary"
              onClick={() => loadAssetsMutation.mutate()}
              disabled={!manualToken.trim() || loadAssetsMutation.isPending}
            >
              {loadAssetsMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              שליפת חשבונות ומספרים
            </Button>

            {discovery != null && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  מה Meta החזירה בכל ניסיון איתור
                </Label>
                <pre
                  dir="ltr"
                  className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-[11px]"
                >
                  {JSON.stringify(discovery, null, 2)}
                </pre>
              </div>
            )}

            {assets && (
              <div className="space-y-3">
                {assets.length === 0 && (
                  <p className="text-sm text-muted-foreground">לא נמצאו חשבונות WhatsApp Business.</p>
                )}
                {assets.map((account) => (
                  <div key={account.waba_id} className="rounded-lg border p-4">
                    <div className="mb-3">
                      <div className="font-semibold">{account.name || "WhatsApp Business Account"}</div>
                      <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                        {account.waba_id}
                      </div>
                    </div>
                    {account.error && (
                      <p className="text-sm text-destructive">{account.error}</p>
                    )}
                    {(() => {
                      const others = (account.subscribed_apps ?? []).filter(
                        (app) => app.id && app.id !== metaAppId,
                      );
                      if (!others.length) return null;
                      return (
                        <Alert className="mb-3 border-amber-500/40">
                          <ShieldCheck className="h-4 w-4" />
                          <AlertTitle>אפליקציה נוספת כבר מחוברת לחשבון הזה</AlertTitle>
                          <AlertDescription className="text-sm">
                            {`המספר כבר מחובר ל-Cloud API דרך: ${
                              others.map((app) => app.name || app.id).join(", ")
                            }. AIOS יתחבר כמאזין נוסף — המספר לא יירשם מחדש וה-PIN לא ישתנה, אבל הודעות נכנסות יגיעו גם ל-AIOS וגם לאפליקציה הקיימת. אם אינכם רוצים כפילות, הסירו את האפליקציה הישנה מה-WABA לאחר החיבור.`}
                          </AlertDescription>
                        </Alert>
                      );
                    })()}
                    {account.phone_numbers.length === 0 && !account.error && (
                      <p className="text-sm text-muted-foreground">אין מספרים בחשבון הזה.</p>
                    )}
                    <RadioGroup value={selectedPhone} onValueChange={setSelectedPhone} className="grid gap-2">
                      {account.phone_numbers.map((phone) => {
                        const value = `${account.waba_id}::${phone.id}`;
                        return (
                          <Label
                            key={phone.id}
                            htmlFor={`phone-${phone.id}`}
                            className="flex cursor-pointer items-center gap-3 rounded-md border p-3 has-[[data-state=checked]]:border-emerald-500"
                          >
                            <RadioGroupItem id={`phone-${phone.id}`} value={value} />
                            <span className="flex-1">
                              <span className="block font-medium" dir="ltr">
                                {phone.display_phone_number || phone.id}
                              </span>
                              <span className="block text-xs font-normal text-muted-foreground">
                                {phone.verified_name || "ללא שם מאומת"}
                              </span>
                            </span>
                            {phone.is_on_biz_app && <Badge variant="secondary">Coexistence</Badge>}
                          </Label>
                        );
                      })}
                    </RadioGroup>
                  </div>
                ))}

                <div className="space-y-2">
                  <Label htmlFor="meta-wa-manual-pin">PIN בן 6 ספרות (נדרש רק לרישום מספר חדש)</Label>
                  <Input
                    id="meta-wa-manual-pin"
                    value={manualPin}
                    onChange={(event) => setManualPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="123456"
                    className="max-w-48"
                  />
                </div>

                <Button
                  onClick={() => connectManualMutation.mutate()}
                  disabled={!selectedPhone || connectManualMutation.isPending}
                >
                  {connectManualMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  חיבור המספר הנבחר
                </Button>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => diagnoseMutation.mutate()}
                disabled={diagnoseMutation.isPending}
              >
                {diagnoseMutation.isPending
                  ? <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  : <Stethoscope className="ml-2 h-4 w-4" />}
                בדיקת תצורת Meta
              </Button>
              {diagnoseMutation.data && (
                <pre
                  dir="ltr"
                  className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-[11px]"
                >
                  {JSON.stringify(diagnoseMutation.data, null, 2)}
                </pre>
              )}
            </div>
          </CardContent>
        )}
      </Card>

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
