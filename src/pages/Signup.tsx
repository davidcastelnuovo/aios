import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Signup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [token, setToken] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      toast({
        title: "שגיאה",
        description: "קישור הזמנה לא תקין",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
    setToken(tokenParam);
    verifyToken(tokenParam);
  }, [searchParams]);

  const verifyToken = async (tokenValue: string) => {
    try {
      const { data, error } = await supabase
        .from("invitation_tokens")
        .select("*")
        .eq("token", tokenValue)
        .eq("used", false)
        .single();

      if (error || !data) {
        setTokenValid(false);
        toast({
          title: "שגיאה",
          description: "קישור ההזמנה אינו תקף או שכבר נוצל",
          variant: "destructive",
        });
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setTokenValid(false);
        toast({
          title: "שגיאה",
          description: "קישור ההזמנה פג תוקף",
          variant: "destructive",
        });
        return;
      }

      if (data.email) {
        setEmail(data.email);
      }

      setTokenValid(true);
    } catch (error) {
      console.error("Error verifying token:", error);
      setTokenValid(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !email || !password) {
      toast({
        title: "שגיאה",
        description: "נא למלא את כל השדות",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "שגיאה",
        description: "הסיסמאות אינן תואמות",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "שגיאה",
        description: "הסיסמה חייבת להכיל לפחות 6 תווים",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("signup-with-invitation", {
        body: {
          token,
          full_name: fullName,
          email,
          password,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "הצלחה!",
        description: "ההרשמה הושלמה בהצלחה. כעת תוכל להתחבר",
      });

      // Sign in the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        toast({
          title: "שגיאה בהתחברות",
          description: "נא להתחבר באמצעות דף הכניסה",
          variant: "destructive",
        });
        navigate("/auth");
      } else {
        navigate("/my-profile");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בהרשמה",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">קישור לא תקין</CardTitle>
            <CardDescription>
              קישור ההזמנה אינו תקף, נוצל או פג תוקף
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              חזרה לדף הבית
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">הרשמה למערכת</CardTitle>
          <CardDescription>
            הזן את הפרטים שלך כדי להשלים את ההרשמה
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">שם מלא</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="הזן שם מלא"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="הזן כתובת אימייל"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="בחר סיסמה (לפחות 6 תווים)"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אימות סיסמה</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="הזן את הסיסמה שוב"
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מבצע הרשמה...
                </>
              ) : (
                "הרשם"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
