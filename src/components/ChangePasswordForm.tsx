import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock } from "lucide-react";

const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(8, { message: "הסיסמה חייבת להכיל לפחות 8 תווים" })
    .max(72, { message: "הסיסמה חייבת להכיל עד 72 תווים" })
    .regex(/[A-Z]/, { message: "הסיסמה חייבת להכיל לפחות אות גדולה אחת" })
    .regex(/[a-z]/, { message: "הסיסמה חייבת להכיל לפחות אות קטנה אחת" })
    .regex(/[0-9]/, { message: "הסיסמה חייבת להכיל לפחות ספרה אחת" }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "הסיסמאות אינן תואמות",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export function ChangePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showMFAChallenge, setShowMFAChallenge] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const handleMFAVerify = async () => {
    setIsLoading(true);
    try {
      // Get the current factors
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];

      if (!totpFactor) {
        throw new Error("לא נמצא גורם MFA");
      }

      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: mfaCode,
      });

      if (verifyError) throw verifyError;

      // Now update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: pendingPassword,
      });

      if (updateError) throw updateError;

      toast.success("הסיסמה עודכנה בהצלחה");
      reset();
      setShowMFAChallenge(false);
      setMfaCode("");
      setPendingPassword("");
    } catch (error: any) {
      console.error("Error in MFA verification or password update:", error);
      toast.error(error.message || "שגיאה באימות או בעדכון הסיסמה");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) {
        // Check if MFA is required
        if (error.message?.includes("AAL2") || error.message?.includes("MFA")) {
          setPendingPassword(data.newPassword);
          setShowMFAChallenge(true);
          setIsLoading(false);
          toast.info("נדרש אימות MFA לשינוי הסיסמה");
          return;
        }
        throw error;
      }

      toast.success("הסיסמה עודכנה בהצלחה");
      reset();
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "שגיאה בעדכון הסיסמה");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          שינוי סיסמה
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showMFAChallenge ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              הזן את קוד ה-MFA מהאפליקציה שלך כדי להמשיך בשינוי הסיסמה
            </p>
            <div className="space-y-2">
              <Label htmlFor="mfaCode">קוד MFA</Label>
              <Input
                id="mfaCode"
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                disabled={isLoading}
                placeholder="000000"
                maxLength={6}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleMFAVerify}
                disabled={isLoading || mfaCode.length !== 6}
                className="flex-1"
              >
                {isLoading ? "מאמת..." : "אמת וערוך סיסמה"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowMFAChallenge(false);
                  setMfaCode("");
                  setPendingPassword("");
                }}
                disabled={isLoading}
              >
                ביטול
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">סיסמה חדשה</Label>
              <Input
                id="newPassword"
                type="password"
                {...register("newPassword")}
                disabled={isLoading}
                autoComplete="new-password"
              />
              {errors.newPassword && (
                <p className="text-sm text-destructive">
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אימות סיסמה</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register("confirmPassword")}
                disabled={isLoading}
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "מעדכן..." : "עדכן סיסמה"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
