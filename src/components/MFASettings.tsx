import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertCircle, Copy, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function MFASettings() {
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      
      setIsEnrolled(data?.currentLevel === "aal2" || data?.nextLevel === "aal2");
    } catch (error: any) {
      console.error("Error checking MFA status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const startMFAEnrollment = async () => {
    setIsEnrolling(true);
    try {
      // First check if there's already an unverified factor and remove it
      const existingFactors = await supabase.auth.mfa.listFactors();
      if (existingFactors.error) throw existingFactors.error;

      // Remove any existing unverified factors
      const unverifiedFactors = existingFactors.data?.totp || [];
      for (const factor of unverifiedFactors) {
        try {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        } catch (e) {
          // Ignore errors when removing old factors
          console.log("Could not remove old factor:", e);
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().getTime()}`
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
      }
    } catch (error: any) {
      toast({
        title: "שגיאה",
        description: error.message || "אירעה שגיאה בהפעלת אימות דו-שלבי",
        variant: "destructive",
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  const verifyAndEnableMFA = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
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
        description: "לא נמצא מזהה גורם, נסה להתחיל מחדש",
        variant: "destructive",
      });
      return;
    }

    try {
      // First create a challenge
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      // Then verify with the challenge ID
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode,
      });

      if (error) throw error;

      toast({
        title: "הצלחה!",
        description: "אימות דו-שלבי הופעל בהצלחה",
      });

      setIsEnrolled(true);
      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      setVerifyCode("");
      setIsEnrolling(false);
      await checkMFAStatus();
    } catch (error: any) {
      toast({
        title: "שגיאה",
        description: error.message || "הקוד שגוי, נסה שוב",
        variant: "destructive",
      });
    }
  };

  const disableMFA = async () => {
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) return;

      const { error } = await supabase.auth.mfa.unenroll({
        factorId: totpFactor.id,
      });

      if (error) throw error;

      toast({
        title: "הצלחה",
        description: "אימות דו-שלבי בוטל",
      });

      setIsEnrolled(false);
      checkMFAStatus();
    } catch (error: any) {
      toast({
        title: "שגיאה",
        description: error.message || "אירעה שגיאה בביטול אימות דו-שלבי",
        variant: "destructive",
      });
    }
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      toast({
        title: "הועתק!",
        description: "הסוד הועתק ללוח",
      });
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const cancelEnrollment = () => {
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setVerifyCode("");
    setIsEnrolling(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">טוען...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>אימות דו-שלבי (MFA)</CardTitle>
        </div>
        <CardDescription>
          הגבר את אבטחת החשבון שלך עם אימות דו-שלבי
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEnrolled && !qrCode && (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                אימות דו-שלבי מוסיף שכבת אבטחה נוספת לחשבון שלך. תזדקק לאפליקציית Authenticator כמו Google Authenticator או Authy.
              </AlertDescription>
            </Alert>
            <Button onClick={startMFAEnrollment} disabled={isEnrolling}>
              הפעל אימות דו-שלבי
            </Button>
          </>
        )}

        {qrCode && secret && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                סרוק את קוד ה-QR באפליקציית ה-Authenticator שלך, או הזן את הסוד ידנית
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex justify-center">
                <img src={qrCode} alt="QR Code" className="border rounded p-2" />
              </div>

              <div className="space-y-2">
                <Label>או הזן את הסוד ידנית:</Label>
                <div className="flex gap-2">
                  <Input
                    value={secret}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copySecret}
                  >
                    {copiedSecret ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verify-code">הזן את הקוד בן 6 הספרות מהאפליקציה:</Label>
                <Input
                  id="verify-code"
                  type="text"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="font-mono text-lg tracking-wider"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={verifyAndEnableMFA} disabled={verifyCode.length !== 6}>
                  אמת והפעל
                </Button>
                <Button variant="outline" onClick={cancelEnrollment}>
                  ביטול
                </Button>
              </div>
            </div>
          </div>
        )}

        {isEnrolled && (
          <div className="space-y-4">
            <Alert className="bg-success/10 border-success">
              <Shield className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                אימות דו-שלבי מופעל ופעיל
              </AlertDescription>
            </Alert>
            <Button variant="destructive" onClick={disableMFA}>
              בטל אימות דו-שלבי
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
