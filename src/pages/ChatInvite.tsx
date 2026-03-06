import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Hash, Loader2, MessageSquare } from "lucide-react";

export default function ChatInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Auth form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  // Load invite details
  useEffect(() => {
    const loadInvite = async () => {
      if (!token) {
        setError("קישור לא תקין");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("team_channel_invites")
        .select("*, team_channels(name, color)")
        .eq("token", token)
        .eq("is_active", true)
        .single();

      if (fetchError || !data) {
        setError("קישור ההזמנה לא תקף או שפג תוקפו");
        setLoading(false);
        return;
      }

      setInvite(data);
      setLoading(false);
    };

    loadInvite();
  }, [token]);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-process invite when authenticated
  useEffect(() => {
    if (isAuthenticated && invite && !processing) {
      processInvite();
    }
  }, [isAuthenticated, invite]);

  const processInvite = async () => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke("process-chat-invite", {
        body: { token },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data;
      if (result.error) throw new Error(result.error);

      toast.success(`הצטרפת בהצלחה לערוץ ${result.channelName || ""}`);
      navigate(`/t/${result.tenantSlug}/team-chat`);
    } catch (err: any) {
      console.error("Process invite error:", err);
      toast.error(err.message || "שגיאה בעיבוד ההזמנה");
      setProcessing(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "שגיאה בהתחברות");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("הסיסמה חייבת לכלול לפחות 6 תווים");
      return;
    }
    setAuthLoading(true);
    setProcessing(true);
    try {
      // Use edge function to create auto-confirmed user + add to tenant + channel
      const response = await supabase.functions.invoke("process-chat-invite", {
        body: { 
          token, 
          action: "signup",
          email,
          password,
          fullName,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data;
      if (result.error) {
        if (result.error === "USER_EXISTS") {
          toast.error(result.message || "משתמש כבר קיים - נסה להתחבר");
          setActiveTab("login");
          setProcessing(false);
          return;
        }
        throw new Error(result.error);
      }

      // Now sign in the newly created user
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      toast.success(`הצטרפת בהצלחה לערוץ ${result.channelName || ""}`);
      navigate(`/t/${result.tenantSlug}/team-chat`);
    } catch (err: any) {
      console.error("Signup error:", err);
      toast.error(err.message || "שגיאה בהרשמה");
      setProcessing(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/chat-invite/${token}`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "שגיאה בהתחברות עם Google");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">שגיאה</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>חזרה לדף הבית</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <CardTitle>מצטרף לערוץ...</CardTitle>
            <CardDescription>רגע, מעבד את ההזמנה שלך</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const channelName = (invite as any)?.team_channels?.name || "ערוץ";
  const channelColor = (invite as any)?.team_channels?.color || "#3B82F6";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: channelColor }}>
            <MessageSquare className="h-8 w-8" />
          </div>
          <div>
            <CardTitle className="text-xl">הוזמנת לערוץ</CardTitle>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-lg">{channelName}</span>
            </div>
          </div>
          <CardDescription>
            התחבר או הירשם כדי להצטרף לשיחה
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Google Login */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogleLogin}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            המשך עם Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">או</span>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">התחברות</TabsTrigger>
              <TabsTrigger value="signup">הרשמה</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="login-email">אימייל</Label>
                  <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="login-password">סיסמה</Label>
                  <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={authLoading}>
                  {authLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  התחבר והצטרף
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="signup-name">שם מלא</Label>
                  <Input id="signup-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-email">אימייל</Label>
                  <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-password">סיסמה</Label>
                  <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={authLoading}>
                  {authLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  הירשם והצטרף
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
