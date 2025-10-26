import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddTenantFormProps {
  onSuccess?: () => void;
}

export function AddTenantForm({ onSuccess }: AddTenantFormProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    contact_name: "",
    contact_email: "",
    notes: "",
  });

  const addTenantMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: tenant, error } = await supabase
        .from("tenants")
        .insert({
          name: data.name,
          contact_name: data.contact_name,
          contact_email: data.contact_email,
          notes: data.notes,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;
      return tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("הארגון נוסף בהצלחה");
      setFormData({
        name: "",
        contact_name: "",
        contact_email: "",
        notes: "",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error("שגיאה בהוספת ארגון: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTenantMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      <div className="space-y-2">
        <Label htmlFor="name">שם הארגון *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="שם החברה / הארגון"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact_name">שם איש קשר</Label>
        <Input
          id="contact_name"
          value={formData.contact_name}
          onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
          placeholder="שם מלא"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact_email">אימייל איש קשר</Label>
        <Input
          id="contact_email"
          type="email"
          value={formData.contact_email}
          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
          placeholder="email@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">הערות</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="הערות נוספות..."
          rows={3}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={addTenantMutation.isPending}
      >
        {addTenantMutation.isPending ? (
          <>
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            מוסיף...
          </>
        ) : (
          "הוסף ארגון"
        )}
      </Button>
    </form>
  );
}
