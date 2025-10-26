import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";

export default function Setup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tenantName: "",
    contactName: "",
    contactEmail: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password.length < 6) {
      toast.error("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("הסיסמאות אינן תואמות");
      return;
    }

    setLoading(true);

    try {
      // Create tenant first
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: formData.tenantName,
          contact_name: formData.contactName,
          contact_email: formData.contactEmail,
          status: "active",
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Sign up the super admin user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.contactEmail,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: formData.contactName,
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("לא נוצר משתמש");

      // Link user to tenant
      const { error: tenantUserError } = await supabase
        .from("tenant_users")
        .insert({
          tenant_id: tenant.id,
          user_id: authData.user.id,
          role: "owner",
        });

      if (tenantUserError) throw tenantUserError;

      // Assign super_admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: "super_admin",
        });

      if (roleError) throw roleError;

      toast.success("הארגון והמשתמש נוצרו בהצלחה!");
      
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (error: any) {
      console.error("Error during setup:", error);
      toast.error("שגיאה ביצירת הארגון: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir="rtl">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">הגדרת ארגון חדש</CardTitle>
          <CardDescription>
            יצירת ארגון חדש ומשתמש Super Admin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenantName">שם הארגון</Label>
              <Input
                id="tenantName"
                type="text"
                value={formData.tenantName}
                onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                placeholder="שם החברה / הארגון"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contactName">שם איש קשר</Label>
              <Input
                id="contactName"
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="שם מלא"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail">אימייל</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="email@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="לפחות 6 תווים"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אימות סיסמה</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
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
                  יוצר ארגון...
                </>
              ) : (
                "צור ארגון והתחבר"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
