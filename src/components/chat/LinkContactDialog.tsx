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
  type: z.enum(["client", "lead", "group"]),
  contact_id: z.string().min(1, "יש לבחור איש קשר"),
});

type LinkFormValues = z.infer<typeof linkSchema>;

interface LinkContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderPhone: string;
  senderName?: string | null;
  onSuccess: (id: string, type: "client" | "lead" | "group") => void;
}

export function LinkContactDialog({
  open,
  onOpenChange,
  senderPhone,
  senderName,
  onSuccess,
}: LinkContactDialogProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const { terms } = useTerminology();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<"client" | "lead" | "group">("client");

  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      type: "client",
      contact_id: "",
    },
  });

  // Fetch clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["clients-for-link", tenantId, searchTerm],
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
    queryKey: ["leads-for-link", tenantId, searchTerm],
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

  // Fetch groups
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["groups-for-link", tenantId, searchTerm],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("whatsapp_groups")
        .select("id, group_name, group_id")
        .eq("tenant_id", tenantId)
        .order("group_name");
      
      if (searchTerm) {
        query = query.ilike("group_name", `%${searchTerm}%`);
      }
      
      const { data } = await query.limit(50);
      return data || [];
    },
    enabled: !!tenantId && open && selectedType === "group",
  });

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: async (values: LinkFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase.functions.invoke("convert-unknown-contact", {
        body: {
          senderPhone,
          contactType: values.type,
          contactId: values.contact_id,
          tenantId,
        },
      });

      if (error) throw error;
      return { data, type: values.type };
    },
    onSuccess: (result) => {
      toast.success(`שויך בהצלחה ל${selectedType === 'client' ? 'לקוח' : selectedType === 'lead' ? 'ליד' : 'קבוצה'}`);
      queryClient.invalidateQueries({ queryKey: ["active-chats"] });
      queryClient.invalidateQueries({ queryKey: ["unknown-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      onSuccess(form.getValues().contact_id, result.type as "client" | "lead" | "group");
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Link error:", error);
      toast.error(error.message || "שגיאה בשיוך איש הקשר");
    },
  });

  const onSubmit = (values: LinkFormValues) => {
    linkMutation.mutate(values);
  };

  const isLoading = clientsLoading || leadsLoading || groupsLoading;
  const contactList = selectedType === "client" ? clients : selectedType === "lead" ? leads : groups;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>שיוך לאיש קשר קיים</DialogTitle>
          <DialogDescription>
            שייך את המספר {senderPhone} לאיש קשר קיים במערכת
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
                <SelectItem value="group">קבוצה</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>חיפוש</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`חפש ${selectedType === 'client' ? 'לקוח' : selectedType === 'lead' ? 'ליד' : 'קבוצה'}...`}
                className="pr-10"
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
                  <SelectValue placeholder="בחר..." />
                </SelectTrigger>
                <SelectContent>
                  {contactList.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      לא נמצאו תוצאות
                    </div>
                  ) : (
                    contactList.map((contact: any) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {selectedType === "client"
                          ? `${contact.name}${contact.phone ? ` • ${contact.phone}` : ''}${contact.agencies?.name ? ` • ${contact.agencies.name}` : ''}`
                          : selectedType === "lead"
                          ? `${contact.company_name}${contact.contact_name ? ` • ${contact.contact_name}` : ''}${contact.phone ? ` • ${contact.phone}` : ''}`
                          : contact.group_name}
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

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={linkMutation.isPending}>
              {linkMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              שייך
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
