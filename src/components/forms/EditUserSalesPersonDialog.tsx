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

interface EditUserSalesPersonDialogProps {
  userId: string | null;
  userEmail: string;
  userFullName?: string;
  onClose: () => void;
}

export function EditUserSalesPersonDialog({
  userId,
  userEmail,
  userFullName,
  onClose,
}: EditUserSalesPersonDialogProps) {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { createSalesPerson } = useAutoCreateTeamMember();

  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>("none");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // טופס יצירת איש מכירות חדש
  const [newSalesPersonName, setNewSalesPersonName] = useState(userFullName || "");
  const [newSalesPersonPhone, setNewSalesPersonPhone] = useState("");
  const [newSalesPersonEmail, setNewSalesPersonEmail] = useState(userEmail || "");
  const [selectedAgency, setSelectedAgency] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch all sales people
  const { data: salesPeople } = useQuery({
    queryKey: ["sales-people-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_people")
        .select("id, full_name, active")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch agencies for new sales person creation
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
    enabled: !!userId && showCreateForm && !!tenantId,
  });

  // Fetch current sales person assignment
  const { data: currentAssignment } = useQuery({
    queryKey: ["user-sales-person", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("sales_person_id")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (currentAssignment?.sales_person_id) {
      setSelectedSalesPerson(currentAssignment.sales_person_id);
    } else {
      setSelectedSalesPerson("none");
    }
  }, [currentAssignment]);

  const updateSalesPersonMutation = useMutation({
    mutationFn: async (salesPersonId: string | null) => {
      if (!userId) return;

      const { error } = await supabase
        .from("profiles")
        .update({ sales_person_id: salesPersonId })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["user-sales-person", userId] });
      toast.success("איש מכירות עודכן בהצלחה");
      onClose();
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון איש מכירות: " + error.message);
    },
  });

  const handleSave = () => {
    if (selectedSalesPerson === "create_new") {
      setShowCreateForm(true);
      return;
    }
    const salesPersonId = selectedSalesPerson === "none" ? null : selectedSalesPerson;
    updateSalesPersonMutation.mutate(salesPersonId);
  };

  const handleCreateNew = () => {
    if (!userId) return;
    if (!newSalesPersonName.trim()) {
      toast.error("שם מלא הוא שדה חובה");
      return;
    }
    if (!selectedAgency) {
      toast.error("סוכנות היא שדה חובה");
      return;
    }

    createSalesPerson.mutate({
      userId,
      fullName: newSalesPersonName,
      email: newSalesPersonEmail,
      phone: newSalesPersonPhone,
      agencyId: selectedAgency,
      notes,
    }, {
      onSuccess: () => {
        setShowCreateForm(false);
        onClose();
      },
    });
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setSelectedSalesPerson("");
    setNewSalesPersonName(userFullName || "");
    setNewSalesPersonEmail(userEmail || "");
    setNewSalesPersonPhone("");
    setSelectedAgency("");
    setNotes("");
  };

  return (
    <Dialog open={!!userId} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showCreateForm ? "צור איש מכירות חדש" : "עריכת איש מכירות"}
          </DialogTitle>
          <DialogDescription>
            {showCreateForm
              ? "מלא את הפרטים כדי ליצור איש מכירות חדש ולשייך אותו למשתמש"
              : `משתמש: ${userEmail}`
            }
          </DialogDescription>
        </DialogHeader>

        {!showCreateForm ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="sales-person-select">איש מכירות</Label>
              <Select
                value={selectedSalesPerson}
                onValueChange={setSelectedSalesPerson}
              >
                <SelectTrigger id="sales-person-select">
                  <SelectValue placeholder="בחר איש מכירות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא שיוך</SelectItem>
                  <SelectItem value="create_new" className="font-semibold text-primary">
                    + צור איש מכירות חדש
                  </SelectItem>
                  {salesPeople?.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>
                ביטול
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateSalesPersonMutation.isPending}
              >
                {updateSalesPersonMutation.isPending ? "שומר..." : "שמור"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">שם מלא *</Label>
              <Input
                id="full_name"
                value={newSalesPersonName}
                onChange={(e) => setNewSalesPersonName(e.target.value)}
                placeholder="שם מלא"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  value={newSalesPersonEmail}
                  onChange={(e) => setNewSalesPersonEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">טלפון</Label>
                <Input
                  id="phone"
                  value={newSalesPersonPhone}
                  onChange={(e) => setNewSalesPersonPhone(e.target.value)}
                  placeholder="050-1234567"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="agency-select">סוכנות *</Label>
              <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                <SelectTrigger id="agency-select">
                  <SelectValue placeholder="בחר סוכנות" />
                </SelectTrigger>
                <SelectContent>
                  {agencies?.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                disabled={createSalesPerson.isPending}
              >
                {createSalesPerson.isPending ? "יוצר..." : "צור ושייך"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
