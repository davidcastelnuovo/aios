import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Setup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        // 1) Handle hash-based tokens (#access_token=...&refresh_token=...)
        const hash = window.location.hash;
        if (hash) {
          const hashParams = new URLSearchParams(hash.replace('#', ''));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { data, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setSessionError) {
              console.error('setSession error:', setSessionError);
              toast.error('שגיאה באימות הקישור');
              return setTimeout(() => navigate('/auth'), 1500);
            }
            setEmail(data.user?.email || '');
            setVerifying(false);
            return;
          }
        }

        // 2) Handle PKCE code in query (?code=...)
        const code = searchParams.get('code');
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('exchangeCodeForSession error:', exchangeError);
            toast.error(exchangeError.message || 'שגיאה באימות הקישור');
            return setTimeout(() => navigate('/auth'), 1500);
          }
          setEmail(data.user?.email || '');
          setVerifying(false);
          return;
        }

        // 3) Handle token_hash + type (e.g. type=invite|recovery&token_hash=...)
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const explicitError = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (tokenHash && type) {
          const verifyType = type === 'invite' ? 'signup' : (type as any);
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            type: verifyType,
            token_hash: tokenHash,
          } as any);
          if (verifyError) {
            console.error('verifyOtp error:', verifyError);
            toast.error(errorDescription || verifyError.message || 'שגיאה באימות הקישור');
            return setTimeout(() => navigate('/auth'), 1500);
          }
          setEmail(data.user?.email || '');
          setVerifying(false);
          return;
        }

        // 4) Already authenticated? If came from invite/recovery keep on setup
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (type === 'invite' || type === 'recovery') {
            setEmail(session.user.email || '');
            setVerifying(false);
          } else {
            navigate('/my-profile');
          }
          return;
        }

        // 5) Explicit errors from redirect
        if (explicitError) {
          toast.error(errorDescription || 'הקישור אינו תקף או שפג תוקפו');
          return setTimeout(() => navigate('/auth'), 1500);
        }

        // 6) Fallback
        toast.error('לא נמצא טוקן תקף. אנא השתמשו בקישור שנשלח במייל');
        setTimeout(() => navigate('/auth'), 1500);
      } catch (err: any) {
        console.error('Error verifying token:', err);
        toast.error('שגיאה באימות הקישור');
        setTimeout(() => navigate('/auth'), 1500);
      }
    };

    handleRedirect();
  }, [searchParams, navigate]);

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("הסיסמאות אינן תואמות");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      toast.success("הסיסמה הוגדרה בהצלחה! מעביר אותך למערכת...");
      
      // Wait a bit then redirect to personal profile
      setTimeout(() => {
        navigate("/my-profile");
      }, 1500);
    } catch (error: any) {
      console.error("Error setting password:", error);
      toast.error("שגיאה בהגדרת סיסמה: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">מאמת את הקישור...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-6 w-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl">הגדרת סיסמה</CardTitle>
          <CardDescription>
            ברוכים הבאים! אנא הגדירו סיסמה לחשבון שלכם
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetupPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה חדשה</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="לפחות 6 תווים"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">אימות סיסמה</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="הזינו את הסיסמה שוב"
                required
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מגדיר סיסמה...
                </>
              ) : (
                "הגדר סיסמה והתחבר"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
