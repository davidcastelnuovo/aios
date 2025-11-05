import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "שם חייב להכיל לפחות 2 תווים").max(100, "שם ארוך מדי"),
  phone: z.string().trim().min(9, "מספר טלפון לא תקין").max(15, "מספר טלפון לא תקין"),
  email: z.string().trim().email("כתובת אימייל לא תקינה").max(255, "כתובת אימייל ארוכה מדי"),
  organizationName: z.string().trim().min(2, "שם ארגון חייב להכיל לפחות 2 תווים").max(100, "שם ארגון ארוך מדי"),
  password: z.string().min(6, "סיסמה חייבת להכיל לפחות 6 תווים").max(100, "סיסמה ארוכה מדי"),
  confirmPassword: z.string().min(6, "סיסמה חייבת להכיל לפחות 6 תווים"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "הסיסמאות אינן תואמות",
  path: ["confirmPassword"],
});

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (formData: SignUpFormData) => {
    setIsLoading(true);

    try {
      // Call edge function to create tenant and user
      const { data, error } = await supabase.functions.invoke("signup-tenant", {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone,
          organizationName: formData.organizationName,
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "שגיאה ביצירת החשבון");
      }

      if (!data?.success) {
        throw new Error(data?.error || "שגיאה ביצירת החשבון");
      }

      toast.success("הארגון נוצר בהצלחה! מיד תועבר למערכת");
      
      // Sign in the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        throw new Error("נוצר חשבון אך התחברות נכשלה. נסה להתחבר מחדש.");
      }

      // Redirect to dashboard
      navigate("/");
    } catch (error: any) {
      console.error("Signup error:", error);
      toast.error(error.message || "שגיאה ביצירת החשבון");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <img src={logo} alt="AfterLead" className="h-16 w-16 mx-auto mb-4" />
          <CardTitle className="text-2xl md:text-3xl font-bold">
            AfterLead
          </CardTitle>
          <CardDescription className="text-base font-medium">
            מערכת לניהול סוכנויות שיווק ופרסום
          </CardDescription>
          <div className="pt-2">
            <CardTitle className="text-xl flex items-center justify-center gap-2">
              <Building2 className="h-5 w-5" />
              הרשמה לארגון חדש
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              צור ארגון חדש והתחל לנהל את העסק שלך
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">שם מלא *</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="שם מלא"
                {...register("fullName")}
                disabled={isLoading}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">טלפון *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="050-1234567"
                dir="ltr"
                {...register("phone")}
                disabled={isLoading}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">אימייל *</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                dir="ltr"
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationName">שם ארגון *</Label>
              <Input
                id="organizationName"
                type="text"
                placeholder="שם הארגון שלך"
                {...register("organizationName")}
                disabled={isLoading}
              />
              {errors.organizationName && (
                <p className="text-sm text-destructive">{errors.organizationName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">סיסמה *</Label>
              <Input
                id="password"
                type="password"
                placeholder="לפחות 6 תווים"
                {...register("password")}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אימות סיסמה *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="הזן סיסמה שוב"
                {...register("confirmPassword")}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  יוצר ארגון...
                </>
              ) : (
                "צור ארגון והירשם"
              )}
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">כבר יש לך חשבון? </span>
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={() => navigate("/auth")}
                disabled={isLoading}
              >
                התחבר כאן
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
