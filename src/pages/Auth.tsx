import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";
import { resolveTenantSlug } from "@/hooks/useResolveTenant";

const buildTenantPath = (slug: string, path: string) => `/t/${slug}/${path}`;

const AUTH_REDIRECT = `${window.location.origin}/auth`;

async function processPendingInvitation(accessToken: string) {
  try {
    const { error } = await supabase.functions.invoke("process-user-invitation", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error) console.error("Error processing invitation:", error);
  } catch (e) {
    console.error("Exception processing invitation:", e);
  }
}

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [updatePasswordMode, setUpdatePasswordMode] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [inviteBanner, setInviteBanner] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const authType = searchParams.get("type");
  const needsPasswordSetup = authType === "recovery" || authType === "invite";
  const inviteToken = searchParams.get("token");

  const navigateToApp = useCallback(
    async (userId: string, accessToken?: string) => {
      if (accessToken) {
        await processPendingInvitation(accessToken);
      }

      const slug = await resolveTenantSlug(userId, 5);
      if (slug) {
        navigate(buildTenantPath(slug, "tasks"), { replace: true });
        return true;
      }

      toast({
        title: "שגיאה",
        description: "לא נמצא ארגון עבור המשתמש. נא לפנות לתמיכה.",
        variant: "destructive",
      });
      return false;
    },
    [navigate, toast],
  );

  // Load invitation context from ?token= for pre-fill and banner
  useEffect(() => {
    if (!inviteToken) return;

    (async () => {
      const { data, error } = await supabase
        .from("invitation_tokens")
        .select("email, metadata, tenants(name)")
        .eq("token", inviteToken)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error || !data) return;

      if (data.email) setEmail(data.email);

      const orgName =
        (data.tenants as { name?: string } | null)?.name ||
        (data.metadata as { tenant_name?: string } | null)?.tenant_name;
      const invitedName = (data.metadata as { fullName?: string } | null)?.fullName;

      if (orgName) {
        setInviteBanner(
          invitedName
            ? `שלום ${invitedName}, הוזמנת להצטרף ל${orgName}. בדוק את המייל שלך לקישור ההתחברות, או התחבר אם כבר הגדרת סיסמה.`
            : `הוזמנת להצטרף ל${orgName}. בדוק את המייל שלך לקישור ההתחברות, או התחבר אם כבר הגדרת סיסמה.`,
        );
      }
    })();
  }, [inviteToken]);

  useEffect(() => {
    const hasOAuthCode = !!searchParams.get("code");
    let navigated = false;

    const spinnerTimeout = setTimeout(() => setCheckingSession(false), 4000);

    const goToApp = async (session: { user: { id: string }; access_token: string }) => {
      if (navigated || needsPasswordSetup) return;
      navigated = true;
      setCheckingSession(true);
      const ok = await navigateToApp(session.user.id, session.access_token);
      if (!ok) {
        navigated = false;
        setCheckingSession(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || needsPasswordSetup) {
        setUpdatePasswordMode(true);
        setCheckingSession(false);
        return;
      }
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        goToApp(session);
      } else if ((event === "INITIAL_SESSION" && !hasOAuthCode) || event === "SIGNED_OUT") {
        setCheckingSession(false);
      }
    });

    (async () => {
      if (needsPasswordSetup) {
        setUpdatePasswordMode(true);
        setCheckingSession(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        goToApp(session);
      } else if (!hasOAuthCode) {
        setCheckingSession(false);
      }
    })();

    return () => {
      clearTimeout(spinnerTimeout);
      subscription.unsubscribe();
    };
  }, [searchParams, needsPasswordSetup, navigateToApp]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { data: { currentLevel, nextLevel } } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (nextLevel === "aal2" && currentLevel !== "aal2") {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.data?.totp && factors.data.totp.length > 0) {
        setFactorId(factors.data.totp[0].id);
        setMfaRequired(true);
        setLoading(false);
        return;
      }
    }

    const { data: session } = await supabase.auth.getSession();
    if (session?.session) {
      await navigateToApp(session.session.user.id, session.session.access_token);
    }
    setLoading(false);
  };

  const handleMFAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode || mfaCode.length !== 6) {
      toast({
        title: "שגיאה",
        description: "נא להזין קוד בן 6 ספרות",
        variant: "destructive",
      });
      return;
    }

    if (!factorId) {
      toast({
        title: "שגיאה",
        description: "לא נמצא מזהה גורם",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: mfaCode,
      });
      if (error) throw error;

      toast({ title: "הצלחה!", description: "התחברת בהצלחה" });

      const { data: session } = await supabase.auth.getSession();
      if (session?.session) {
        await navigateToApp(session.session.user.id, session.session.access_token);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "הקוד שגוי, נסה שוב";
      toast({ title: "שגיאה", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${AUTH_REDIRECT}?type=recovery`,
      });
      if (error) throw error;

      toast({
        title: "נשלח קישור לאיפוס סיסמה",
        description: "בדוק את תיבת המייל שלך ולחץ על הקישור כדי להגדיר סיסמה חדשה.",
      });
      setResetMode(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "שגיאה בשליחת קישור איפוס";
      toast({ title: "שגיאה", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: AUTH_REDIRECT },
      });
      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "שגיאה בהתחברות עם Google";
      toast({ title: "שגיאה", description: message, variant: "destructive" });
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "שגיאה",
        description: "הסיסמאות אינן תואמות",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "שגיאה",
        description: "הסיסמה חייבת להכיל לפחות 6 תווים",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({ title: "הסיסמה עודכנה", description: "הסיסמה שלך עודכנה בהצלחה" });

    const { data: { user, session } } = await supabase.auth.getUser();
    if (user) {
      await navigateToApp(user.id, session?.access_token);
    }
    setLoading(false);
  };

  if (checkingSession && !updatePasswordMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl">מערכת ניהול סוכנויות</CardTitle>
            <CardDescription>
              ניהול מקצועי של סוכנויות, לקוחות וקמפיינרים
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {inviteBanner && !updatePasswordMode && (
            <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">
              {inviteBanner}
            </p>
          )}

          {updatePasswordMode ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {authType === "invite"
                  ? "ברוך הבא! הגדר סיסמה כדי להשלים את ההצטרפות."
                  : "הגדר סיסמה חדשה לחשבון שלך."}
              </p>
              <div className="space-y-2">
                <Label htmlFor="new-password">סיסמה חדשה</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  placeholder="לפחות 6 תווים"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">אימות סיסמה</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  placeholder="הקלד שוב את הסיסמה"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "מעדכן..." : "הגדר סיסמה"}
              </Button>
            </form>
          ) : mfaRequired ? (
            <form onSubmit={handleMFAVerify} className="space-y-4">
              <div className="space-y-2 text-center">
                <h3 className="text-lg font-semibold">אימות דו-שלבי</h3>
                <p className="text-sm text-muted-foreground">
                  הזן את הקוד בן 6 הספרות מאפליקציית ה-Authenticator שלך
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfa-code">קוד אימות</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="font-mono text-lg tracking-wider text-center"
                  autoComplete="off"
                  autoFocus
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || mfaCode.length !== 6}>
                {loading ? "מאמת..." : "אמת"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setMfaRequired(false);
                  setMfaCode("");
                  setFactorId(null);
                }}
              >
                חזור להתחברות
              </Button>
            </form>
          ) : resetMode ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  נשלח לך קישור לאיפוס סיסמה למייל. לחץ על הקישור כדי להגדיר סיסמה חדשה.
                </p>
                <Label htmlFor="email-reset">אימייל</Label>
                <Input
                  id="email-reset"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="הכנס את כתובת המייל שלך"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "שולח..." : "שלח קישור לאיפוס סיסמה"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setResetMode(false)}
              >
                חזור להתחברות
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-signin">אימייל</Label>
                <Input
                  id="email-signin"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-signin">סיסמה</Label>
                <Input
                  id="password-signin"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "מתחבר..." : "התחבר"}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">או</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="ml-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                התחבר עם Google
              </Button>

              <Button
                type="button"
                variant="link"
                className="w-full text-sm"
                onClick={() => setResetMode(true)}
              >
                שכחתי סיסמה
              </Button>

              <p className="text-center text-sm text-muted-foreground pt-2">
                רוצה לפתוח ארגון חדש?{" "}
                <Link to="/signup" className="text-primary underline-offset-4 hover:underline">
                  הירשם כאן
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
