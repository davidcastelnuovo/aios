import { useState } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Switch } from "@/components/ui/switch";

interface AddTenantFormProps {
  onSuccess?: () => void;
  asDialog?: boolean;
  parentTenantId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddTenantForm({ 
  onSuccess, 
  asDialog = true, 
  parentTenantId,
  open: controlledOpen,
  onOpenChange 
}: AddTenantFormProps) {
  const queryClient = useQueryClient();
  const { userId } = useCurrentUser();
  const [internalOpen, setInternalOpen] = useState(false);
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [newTenantId, setNewTenantId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contact_name: "",
    contact_email: "",
    notes: "",
    allow_super_admin_access: true,
  });

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };

  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const [selectedParentTenant, setSelectedParentTenant] = useState<string>(parentTenantId || "");

  const addTenantMutation = useMutation({
    mutationFn: async (data: typeof formData & { parent_tenant_id?: string }) => {
      // Call edge function to create tenant with owner invitation
      const { data: result, error } = await supabase.functions.invoke(
        "create-tenant-with-owner",
        {
          body: {
            tenant_name: data.name,
            contact_name: data.contact_name,
            contact_email: data.contact_email,
            notes: data.notes,
            parent_tenant_id: data.parent_tenant_id || null,
            allow_super_admin_access: data.allow_super_admin_access,
          },
        }
      );

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      // Invalidate all user-tenants queries (with any suffix)
      queryClient.invalidateQueries({ queryKey: ["user-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      
      // Store new tenant ID for switch dialog
      if (result?.tenant?.id) {
        setNewTenantId(result.tenant.id);
      }
      
      // Show invitation URL to admin
      if (result?.invitation?.invitation_url) {
        toast.success(
          <div className="space-y-2">
            <p>הארגון נוסף בהצלחה!</p>
            <p className="text-xs">קישור הזמנה ל-owner נשלח ל: {formData.contact_email}</p>
            <a 
              href={result.invitation.invitation_url} 
              target="_blank" 
              className="text-xs underline block"
            >
              {result.invitation.invitation_url}
            </a>
          </div>,
          { duration: 10000 }
        );
      } else {
        toast.success("הארגון נוסף בהצלחה!");
      }
      
      setFormData({
        name: "",
        contact_name: "",
        contact_email: "",
        notes: "",
        allow_super_admin_access: true,
      });
      setSelectedParentTenant("");
      setOpen(false);
      
      // Show switch dialog
      setShowSwitchDialog(true);
      
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error("שגיאה בהוספת ארגון: " + error.message);
    },
  });

  const handleSwitchToNewTenant = async () => {
    if (!newTenantId || !userId) return;
    
    try {
      await supabase
        .from("user_active_tenant")
        .upsert({
          user_id: userId,
          tenant_id: newTenantId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      
      localStorage.setItem("selectedTenantId", newTenantId);
      window.location.href = "/";
    } catch (error) {
      console.error("Error switching to new tenant:", error);
      toast.error("שגיאה במעבר לארגון החדש");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTenantMutation.mutate({
      ...formData,
      parent_tenant_id: selectedParentTenant || undefined,
    });
  };

  const formContent = (
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
        <Label htmlFor="contact_name">שם איש קשר *</Label>
        <Input
          id="contact_name"
          value={formData.contact_name}
          onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
          placeholder="שם מלא"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact_email">אימייל איש קשר (owner) *</Label>
        <Input
          id="contact_email"
          type="email"
          value={formData.contact_email}
          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
          placeholder="email@example.com"
          required
        />
        <p className="text-xs text-muted-foreground">
          משתמש זה יקבל הרשאות owner מלאות לארגון
        </p>
      </div>

      {!parentTenantId && tenants && tenants.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="parent_tenant">ארגון אב (אופציונלי)</Label>
          <Select value={selectedParentTenant} onValueChange={setSelectedParentTenant}>
            <SelectTrigger id="parent_tenant">
              <SelectValue placeholder="בחר ארגון אב אם זה תת-ארגון" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">ללא ארגון אב (ארגון עצמאי)</SelectItem>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            תת-ארגון יקבל העתק של כל המבנה והטבלאות של הארגון האב
          </p>
        </div>
      )}

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

      <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-2 flex-1">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="allow_super_admin_access" className="text-base font-semibold cursor-pointer">
                אפשר גישת Super Admin
              </Label>
              <p className="text-xs text-muted-foreground">
                קבע האם Super Admin יוכל לצפות ולערוך נתונים בארגון זה. ברירת מחדל: מופעל
              </p>
            </div>
          </div>
          <Switch
            id="allow_super_admin_access"
            checked={formData.allow_super_admin_access}
            onCheckedChange={(checked) => 
              setFormData({ ...formData, allow_super_admin_access: checked })
            }
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        {asDialog && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={addTenantMutation.isPending}
          >
            ביטול
          </Button>
        )}
        <Button
          type="submit"
          disabled={addTenantMutation.isPending}
          className={asDialog ? "" : "w-full"}
        >
          {addTenantMutation.isPending ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              יוצר ושולח הזמנה...
            </>
          ) : (
            "צור ארגון ושלח הזמנה"
          )}
        </Button>
      </div>
    </form>
  );

  if (!asDialog) {
    return (
      <>
        {formContent}
        <AlertDialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>הארגון נוצר בהצלחה!</AlertDialogTitle>
              <AlertDialogDescription>
                האם תרצה לעבור לארגון החדש עכשיו?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowSwitchDialog(false)}>
                הישאר בארגון הנוכחי
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleSwitchToNewTenant}>
                עבור לארגון החדש
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full md:w-auto">
            <Plus className="h-4 w-4 ml-2" />
            ארגון חדש
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>הוספת ארגון חדש</DialogTitle>
            <DialogDescription>
              צור ארגון חדש והזמן owner לניהול הארגון. ה-owner יקבל גישה מלאה לכל המודולים.
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>הארגון נוצר בהצלחה!</AlertDialogTitle>
            <AlertDialogDescription>
              האם תרצה לעבור לארגון החדש עכשיו?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSwitchDialog(false)}>
              הישאר בארגון הנוכחי
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSwitchToNewTenant}>
              עבור לארגון החדש
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
