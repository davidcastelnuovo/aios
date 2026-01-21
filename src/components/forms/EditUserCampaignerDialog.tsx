import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAutoCreateTeamMember } from "@/hooks/useAutoCreateTeamMember";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTeamRoles } from "@/hooks/useTeamRoles";
import { Checkbox } from "@/components/ui/checkbox";

interface EditUserCampaignerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  userFullName?: string;
}

export function EditUserCampaignerDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  userFullName,
}: EditUserCampaignerDialogProps) {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { createCampaigner } = useAutoCreateTeamMember();
  const { teamRoles, isLoading: rolesLoading } = useTeamRoles();

  const [selectedCampaignerId, setSelectedCampaignerId] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // טופס יצירת קמפיינר חדש
  const [newCampaignerName, setNewCampaignerName] = useState(userFullName || "");
  const [newCampaignerPhone, setNewCampaignerPhone] = useState("");
  const [newCampaignerEmail, setNewCampaignerEmail] = useState(userEmail || "");
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Fetch current user's campaigner
  const { data: currentCampaigner } = useQuery({
    queryKey: ["user-campaigner", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("campaigner_id")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data.campaigner_id;
    },
    enabled: open,
  });

  // Fetch all active campaigners
  const { data: campaigners } = useQuery({
    queryKey: ["campaigners-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch agencies for new campaigner creation
  const { data: agencies } = useQuery({
    queryKey: ["agencies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("agencies")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && showCreateForm && !!tenantId,
  });

  useEffect(() => {
    if (currentCampaigner) {
      setSelectedCampaignerId(currentCampaigner);
    } else {
      setSelectedCampaignerId("none");
    }
  }, [currentCampaigner]);

  const updateCampaignerMutation = useMutation({
    mutationFn: async (campaignerId: string | null) => {
      // Convert "none" to null
      const actualCampaignerId = campaignerId === "none" ? null : campaignerId;
      
      const { error } = await supabase
        .from("profiles")
        .update({ campaigner_id: actualCampaignerId })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      await queryClient.invalidateQueries({ queryKey: ["user-campaigner"] });
      await queryClient.refetchQueries({ queryKey: ["users-with-roles"] });
      toast.success("איש הצוות המשויך עודכן בהצלחה");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון איש צוות: " + error.message);
    },
  });

  const handleSave = () => {
    if (selectedCampaignerId === "create_new") {
      setShowCreateForm(true);
      return;
    }
    updateCampaignerMutation.mutate(selectedCampaignerId === "none" ? null : selectedCampaignerId);
  };

  const handleCreateNew = () => {
    if (!newCampaignerName.trim()) {
      toast.error("שם מלא הוא שדה חובה");
      return;
    }
    if (selectedAgencies.length === 0) {
      toast.error("יש לבחור לפחות סוכנות אחת");
      return;
    }

    createCampaigner.mutate({
      userId,
      fullName: newCampaignerName,
      email: newCampaignerEmail,
      phone: newCampaignerPhone,
      agencyIds: selectedAgencies,
      roles: selectedRoles,
      notes,
    }, {
      onSuccess: () => {
        setShowCreateForm(false);
        onOpenChange(false);
      },
    });
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setSelectedCampaignerId("");
    setNewCampaignerName(userFullName || "");
    setNewCampaignerEmail(userEmail || "");
    setNewCampaignerPhone("");
    setSelectedAgencies([]);
    setSelectedRoles([]);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showCreateForm ? "צור איש צוות חדש" : "עריכת איש צוות משויך"}
          </DialogTitle>
          <DialogDescription>
            {showCreateForm
              ? "מלא את הפרטים כדי ליצור איש צוות חדש ולשייך אותו למשתמש"
              : `משתמש: ${userEmail}`
            }
          </DialogDescription>
        </DialogHeader>

        {!showCreateForm ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="campaigner-select">איש צוות משויך</Label>
              <Select
                value={selectedCampaignerId}
                onValueChange={setSelectedCampaignerId}
              >
                <SelectTrigger id="campaigner-select">
                  <SelectValue placeholder="בחר איש צוות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא איש צוות משויך</SelectItem>
                  <SelectItem value="create_new" className="font-semibold text-primary">
                    + צור איש צוות חדש
                  </SelectItem>
                  {campaigners?.map((campaigner) => (
                    <SelectItem key={campaigner.id} value={campaigner.id}>
                      {campaigner.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                ביטול
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateCampaignerMutation.isPending}
              >
                {updateCampaignerMutation.isPending ? "שומר..." : "שמור"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">שם מלא *</Label>
              <Input
                id="full_name"
                value={newCampaignerName}
                onChange={(e) => setNewCampaignerName(e.target.value)}
                placeholder="שם מלא"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCampaignerEmail}
                  onChange={(e) => setNewCampaignerEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">טלפון</Label>
                <Input
                  id="phone"
                  value={newCampaignerPhone}
                  onChange={(e) => setNewCampaignerPhone(e.target.value)}
                  placeholder="050-1234567"
                />
              </div>
            </div>

            <div>
              <Label>סוכנויות *</Label>
              <div className="space-y-2 mt-2 border rounded-lg p-3 max-h-40 overflow-y-auto">
                {agencies?.map((agency) => (
                  <div key={agency.id} className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id={`agency-${agency.id}`}
                      checked={selectedAgencies.includes(agency.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedAgencies([...selectedAgencies, agency.id]);
                        } else {
                          setSelectedAgencies(selectedAgencies.filter(id => id !== agency.id));
                        }
                      }}
                    />
                    <label htmlFor={`agency-${agency.id}`} className="text-sm cursor-pointer">
                      {agency.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>תפקידים</Label>
              <div className="space-y-2 mt-2">
                {rolesLoading ? (
                  <p className="text-sm text-muted-foreground">טוען תפקידים...</p>
                ) : (
                  teamRoles.map((role) => (
                    <div key={role.key} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={`role-${role.key}`}
                        checked={selectedRoles.includes(role.label)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRoles([...selectedRoles, role.label]);
                          } else {
                            setSelectedRoles(selectedRoles.filter(r => r !== role.label));
                          }
                        }}
                      />
                      <label htmlFor={`role-${role.key}`} className="text-sm cursor-pointer">
                        {role.label}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelCreate}>
                ביטול
              </Button>
              <Button
                onClick={handleCreateNew}
                disabled={createCampaigner.isPending}
              >
                {createCampaigner.isPending ? "יוצר..." : "צור ושייך"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
