import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTerminology } from "@/hooks/useTerminology";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const linkSchema = z.object({
  type: z.enum(["client", "lead"]),
  contact_id: z.string().min(1, "יש לבחור איש קשר"),
});

type LinkFormValues = z.infer<typeof linkSchema>;

interface LinkPhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  contactId?: string;
  contactType?: "client" | "lead";
  onSuccess?: () => void;
}

export function LinkPhoneDialog({
  open,
  onOpenChange,
  phone,
  contactId,
  contactType,
  onSuccess,
}: LinkPhoneDialogProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const { terms } = useTerminology();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<"client" | "lead">(contactType || "client");

  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      type: contactType || "client",
      contact_id: contactId || "",
    },
  });

  // Fetch clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["clients-for-phone-link", tenantId, searchTerm],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("clients")
        .select("id, name, phone, agency_id, agencies(name)")
        .eq("tenant_id", tenantId)
        .order("name");
      
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }
      
      const { data } = await query.limit(50);
      return data || [];
    },
    enabled: !!tenantId && open && selectedType === "client",
  });

  // Fetch leads
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads-for-phone-link", tenantId, searchTerm],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("leads")
        .select("id, company_name, contact_name, phone, agency_id, agencies(name)")
        .eq("tenant_id", tenantId)
        .order("company_name");
      
      if (searchTerm) {
        query = query.or(`company_name.ilike.%${searchTerm}%,contact_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }
      
      const { data } = await query.limit(50);
      return data || [];
    },
    enabled: !!tenantId && open && selectedType === "lead",
  });

  // Link phone mutation
  const linkMutation = useMutation({
    mutationFn: async (values: LinkFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Update the phone number in the selected contact
      const table = values.type === "client" ? "clients" : "leads";
      const { error } = await supabase
        .from(table)
        .update({ phone })
        .eq("id", values.contact_id);

      if (error) throw error;
      return { type: values.type, id: values.contact_id };
    },
    onSuccess: (result) => {
      toast.success(`הטלפון עודכן בהצלחה ל${selectedType === 'client' ? 'לקוח' : 'ליד'}`);
      queryClient.invalidateQueries({ queryKey: ["active-chats"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["contact"] });
      onSuccess?.();
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Link phone error:", error);
      toast.error(error.message || "שגיאה בעדכון הטלפון");
    },
  });

  const onSubmit = (values: LinkFormValues) => {
    if (confirm(`האם אתה בטוח שברצונך לעדכן את הטלפון ל-${phone}?`)) {
      linkMutation.mutate(values);
    }
  };

  const isLoading = clientsLoading || leadsLoading;
  const contactList = selectedType === "client" ? clients : leads;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>שיוך מספר טלפון לאיש קשר</DialogTitle>
          <DialogDescription>
            עדכן את הטלפון של איש קשר קיים למספר {phone}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>סוג איש קשר</Label>
            <Select
              value={selectedType}
              onValueChange={(value: any) => {
                setSelectedType(value);
                form.setValue("type", value);
                form.setValue("contact_id", "");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">{terms?.client?.singular || 'לקוח'}</SelectItem>
                <SelectItem value="lead">{terms?.lead?.singular || 'ליד'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>חיפוש</Label>
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`חפש ${selectedType === 'client' ? 'לקוח' : 'ליד'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>בחר איש קשר</Label>
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Select
                value={form.watch("contact_id")}
                onValueChange={(value) => form.setValue("contact_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר איש קשר" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {contactList.length === 0 ? (
                    <div className="p-2 text-center text-muted-foreground">
                      לא נמצאו אנשי קשר
                    </div>
                  ) : (
                    contactList.map((contact: any) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">
                            {selectedType === "client" ? contact.name : contact.company_name}
                          </span>
                          {contact.phone && (
                            <span className="text-xs text-muted-foreground">
                              טלפון נוכחי: {contact.phone}
                            </span>
                          )}
                          {contact.agencies?.name && (
                            <span className="text-xs text-muted-foreground">
                              {contact.agencies.name}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            {form.formState.errors.contact_id && (
              <p className="text-sm text-destructive">
                {form.formState.errors.contact_id.message}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={linkMutation.isPending}
              className="flex-1"
            >
              {linkMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              עדכן טלפון
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
