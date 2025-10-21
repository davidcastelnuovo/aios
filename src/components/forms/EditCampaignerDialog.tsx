import { useState, useEffect } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Pencil, X } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditCampaignerDialogProps {
  campaigner: {
    id: string;
    full_name: string;
    campaigner_agencies?: { agencies: { name: string } }[];
    role: string | null;
    phone: string | null;
    email: string | null;
    folder_link: string | null;
    notes: string | null;
    active: boolean;
  };
}

export function EditCampaignerDialog({ campaigner }: EditCampaignerDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: campaigner.full_name,
    agency_ids: [] as string[],
    role: campaigner.role || "",
    phone: campaigner.phone || "",
    email: campaigner.email || "",
    folder_link: campaigner.folder_link || "",
    notes: campaigner.notes || "",
    active: campaigner.active,
  });

  // טעינת הסוכנויות הקיימות
  useEffect(() => {
    const loadAgencies = async () => {
      const { data } = await supabase
        .from("campaigner_agencies")
        .select("agency_id")
        .eq("campaigner_id", campaigner.id);
      if (data) {
        setFormData(prev => ({ ...prev, agency_ids: data.map(ca => ca.agency_id) }));
      }
    };
    if (open) loadAgencies();
  }, [open, campaigner.id]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isOwner } = useUserRole();

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || isOwner,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // עדכון פרטי הקמפיינר הבסיסיים
      const { agency_ids, ...campaignerData } = data;
      const { error: campaignerError } = await supabase
        .from("campaigners")
        .update(campaignerData)
        .eq("id", campaigner.id);
      if (campaignerError) throw campaignerError;

      // עדכון הקשרים לסוכנויות
      if (isAdmin || isOwner) {
        // מחיקת הקשרים הישנים
        const { error: deleteError } = await supabase
          .from("campaigner_agencies")
          .delete()
          .eq("campaigner_id", campaigner.id);
        if (deleteError) throw deleteError;

        // הוספת הקשרים החדשים
        if (agency_ids.length > 0) {
          const agencyLinks = agency_ids.map(agencyId => ({
            campaigner_id: campaigner.id,
            agency_id: agencyId,
          }));
          const { error: insertError } = await supabase
            .from("campaigner_agencies")
            .insert(agencyLinks);
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "הקמפיינר עודכן בהצלחה",
      });
      queryClient.invalidateQueries({ queryKey: ["campaigners"] });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "שגיאה בעדכון קמפיינר",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="relative">
          <DialogTitle>ערוך קמפיינר</DialogTitle>
          <DialogClose className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">סגור</span>
          </DialogClose>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">שם מלא *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          {(isAdmin || isOwner) && (
            <div className="space-y-2">
              <Label>סוכנויות *</Label>
              <div className="space-y-2">
                {agencies?.map((agency) => (
                  <div key={agency.id} className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="checkbox"
                      id={`agency-${agency.id}`}
                      checked={formData.agency_ids.includes(agency.id)}
                      onChange={(e) => {
                        const newValue = e.target.checked
                          ? [...formData.agency_ids, agency.id]
                          : formData.agency_ids.filter(id => id !== agency.id);
                        setFormData({ ...formData, agency_ids: newValue });
                      }}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor={`agency-${agency.id}`} className="text-sm cursor-pointer">
                      {agency.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">תפקיד</Label>
            <Input
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">טלפון</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder_link">קישור לתיקייה</Label>
            <Input
              id="folder_link"
              value={formData.folder_link}
              onChange={(e) => setFormData({ ...formData, folder_link: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">פעיל</Label>
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "שומר..." : "שמור שינויים"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
