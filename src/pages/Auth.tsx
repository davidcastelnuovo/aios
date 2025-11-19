import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";
import { resolveTenantSlug } from "@/hooks/useResolveTenant";

// Helper function to build tenant path - requires slug
const buildTenantPath = (slug: string, path: string) => {
  return `/t/${slug}/${path}`;
};

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [updatePasswordMode, setUpdatePasswordMode] = useState(false);
  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
const [searchParams] = useSearchParams();


useEffect(() => {
  const init = async () => {
    const type = searchParams.get("type");
    const code = searchParams.get("code");

    // If we have a code param, try to exchange it for a session
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("exchangeCodeForSession error:", error);
        toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      } else if (data?.session) {
        const slug = await resolveTenantSlug(data.session.user.id);
        if (slug) {
          // Check user role to determine landing page
          const { data: roleData } = await (supabase as any)
            .from("user_roles")
            .select("role")
            .eq("user_id", data.session.user.id)
            .in("role", ["owner", "admin"])
            .maybeSingle();
          
          // Owners and admins go to dashboard, others go to my-profile
          const landingPage = roleData ? "dashboard" : "my-profile";
          navigate(buildTenantPath(slug, landingPage));
        } else {
          toast({
            title: "שגיאה",
            description: "לא נמצא tenant עבור המשתמש. נא לפנות לתמיכה.",
            variant: "destructive",
          });
        }
        return;
      }
    }

    // Check if user is already authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      const slug = await resolveTenantSlug(session.user.id);
      if (slug) {
        // Check user role to determine landing page
        const { data: roleData } = await (supabase as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .in("role", ["owner", "admin"])
          .maybeSingle();
        
        // Owners and admins go to dashboard, others go to my-profile
        const landingPage = roleData ? "dashboard" : "my-profile";
        navigate(buildTenantPath(slug, landingPage));
      } else {
        toast({
          title: "שגיאה",
          description: "לא נמצא tenant עבור המשתמש. נא לפנות לתמיכה.",
          variant: "destructive",
        });
      }
      return;
    }

    // If recovery type, show password update mode
    if (type === "recovery") {
      setUpdatePasswordMode(true);
    }
  };

  init();
}, [searchParams, navigate, toast]);

// Ensure we auto-redirect when a session becomes available (e.g., after Google OAuth)
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    // Only handle SIGNED_IN events to avoid duplicate navigations
    if (event === 'SIGNED_IN' && session?.user) {
      console.log("🔐 User signed in, resolving tenant...");
      
      // Try to process invitation if exists
      try {
        const { data, error } = await supabase.functions.invoke("process-user-invitation", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        
        if (error) {
          console.error("Error processing invitation:", error);
        } else if (data?.error === "NO_INVITATION") {
          console.info("No invitation found, continuing regular login flow.");
        }
      } catch (e) {
        console.error("Exception processing invitation:", e);
      }
      
      // Resolve tenant with retries
      const slug = await resolveTenantSlug(session.user.id, 5);
      if (slug) {
        // Check user role to determine landing page
        const { data: roleData } = await (supabase as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .in("role", ["owner", "admin"])
          .maybeSingle();
        
        // Owners and admins go to dashboard, others go to my-profile
        const landingPage = roleData ? "dashboard" : "my-profile";
        console.log("✅ Navigating to:", landingPage, "for tenant:", slug);
        navigate(`/t/${slug}/${landingPage}`, { replace: true });
      } else {
        toast({
          title: "שגיאה",
          description: "לא נמצא ארגון עבור המשתמש. נא לפנות לתמיכה.",
          variant: "destructive",
        });
      }
    }
  });
  return () => subscription.unsubscribe();
}, [navigate, toast]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    
    // Process invitation if exists
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session) {
        const { data: invData, error: invError } = await supabase.functions.invoke("process-user-invitation", {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });
        
        if (invError) {
          console.error("Error processing invitation:", invError);
        } else if (invData?.error === "NO_INVITATION") {
          console.info("No invitation found after sign up; proceeding without invitation.");
        }
      }
    } catch (e) {
      console.error("Exception processing invitation:", e);
    }

    toast({
      title: "ברוך הבא!",
      description: "החשבון נוצר בהצלחה",
    });
    
    // Session established - onAuthStateChange will handle navigation
    // Keep loading state to prevent UI flash during navigation
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Check if MFA is required
    const { data: { currentLevel, nextLevel } } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    
    if (nextLevel === 'aal2' && currentLevel !== 'aal2') {
      // MFA is required
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.data?.totp && factors.data.totp.length > 0) {
        setFactorId(factors.data.totp[0].id);
        setMfaRequired(true);
        setLoading(false);
        return;
      }
    }

    // Process invitation if exists
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session) {
        const { data: invData, error: invError } = await supabase.functions.invoke("process-user-invitation", {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });
        
        if (invError) {
          console.error("Error processing invitation:", invError);
        } else if (invData?.error === "NO_INVITATION") {
          console.info("No invitation found at sign in; continuing regular flow.");
        }
      }
    } catch (e) {
      console.error("Exception processing invitation:", e);
    }

    // Session established - onAuthStateChange will handle navigation
    // Keep loading state to prevent UI flash during navigation
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
      // Create a challenge
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      // Verify the code
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: mfaCode,
      });

      if (error) throw error;

      toast({
        title: "הצלחה!",
        description: "התחברת בהצלחה",
      });

      const { data: session } = await supabase.auth.getSession();
      if (session?.session) {
        const slug = await resolveTenantSlug(session.session.user.id);
        if (slug) {
          navigate(buildTenantPath(slug, "dashboard"));
        } else {
          toast({
            title: "שגיאה",
            description: "לא נמצא tenant עבור המשתמש. נא לפנות לתמיכה.",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "שגיאה",
        description: error.message || "הקוד שגוי, נסה שוב",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "נשלח מייל",
        description: "בדוק את תיבת המייל שלך לאיפוס הסיסמה",
      });
      setResetMode(false);
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בהתחברות עם Google",
        variant: "destructive",
      });
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
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Process invitation if exists
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session) {
        const { data: invData, error: invError } = await supabase.functions.invoke("process-user-invitation", {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });
        
        if (invError) {
          console.error("Error processing invitation:", invError);
        } else if (invData?.error === "NO_INVITATION") {
          console.info("No invitation found after password update; continuing.");
        }
      }
    } catch (e) {
      console.error("Exception processing invitation:", e);
    }

    toast({
      title: "הסיסמה עודכנה",
      description: "הסיסמה שלך עודכנה בהצלחה",
    });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const slug = await resolveTenantSlug(user.id);
      if (slug) {
        navigate(buildTenantPath(slug, "dashboard"));
      } else {
        toast({
          title: "שגיאה",
          description: "לא נמצא tenant עבור המשתמש. נא לפנות לתמיכה.",
          variant: "destructive",
        });
      }
    }
    setLoading(false);
  };

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
          {updatePasswordMode ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
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
          ) : (
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">התחברות</TabsTrigger>
              <TabsTrigger value="signup">הרשמה</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              {mfaRequired ? (
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

                  <div className="flex flex-col gap-2 mt-4">
                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-sm"
                      onClick={() => setResetMode(true)}
                    >
                      שכחתי סיסמה
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-sm text-muted-foreground"
                      onClick={() => {
                        setResetMode(true);
                        toast({
                          title: "משתמש קיים?",
                          description: "הכנס את המייל שלך ונשלח לך קישור ליצירת סיסמה",
                        });
                      }}
                    >
                      משתמש קיים? צור סיסמה
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-signup">אימייל</Label>
                  <Input
                    id="email-signup"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup">סיסמה</Label>
                  <Input
                    id="password-signup"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "נרשם..." : "הרשם"}
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
                  הרשם עם Google
                </Button>
                
                <div className="text-center text-sm mt-4">
                  <span className="text-muted-foreground">רוצה לפתוח ארגון חדש? </span>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto font-normal"
                    onClick={() => navigate("/signup")}
                    disabled={loading}
                  >
                    הירשם כאן
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}