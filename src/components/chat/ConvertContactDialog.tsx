import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  convertClientSchema,
  convertLeadSchema,
  convertGroupSchema,
  type ConvertClientFormValues,
  type ConvertLeadFormValues,
  type ConvertGroupFormValues,
} from "@/lib/formSchemas";

type ClientFormValues = ConvertClientFormValues;
type LeadFormValues = ConvertLeadFormValues;
type GroupFormValues = ConvertGroupFormValues;

interface ConvertContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderPhone: string;
  senderName?: string | null;
  type: "client" | "lead" | "group";
  onSuccess: (id: string, type: "client" | "lead" | "group") => void;
}

export function ConvertContactDialog({
  open,
  onOpenChange,
  senderPhone,
  senderName,
  type,
  onSuccess,
}: ConvertContactDialogProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const { terms } = useTerminology();
  const [isConverting, setIsConverting] = useState(false);

  const form = useForm<ClientFormValues | LeadFormValues | GroupFormValues>({
    resolver: zodResolver(
      type === "client" ? convertClientSchema : type === "lead" ? convertLeadSchema : convertGroupSchema
    ),
    defaultValues: {
      phone: senderPhone,
      ...(type === "client"
        ? { name: senderName || "" }
        : type === "lead"
        ? { company_name: senderName || "", contact_name: "" }
        : { group_name: senderName || "" }),
    },
  });

  // Fetch agencies for select
  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Fetch active chat provider for the tenant
  const { data: activeChatProvider } = useQuery({
    queryKey: ["active-chat-provider-for-convert", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("integration_type")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .in("integration_type", ["manychat", "green_api"])
        .single();
      if (error) {
        console.error("Error fetching active provider:", error);
        return null;
      }
      return data?.integration_type as "manychat" | "green_api" | null;
    },
    enabled: !!tenantId && open,
  });

  const createMutation = useMutation({
    mutationFn: async (values: ClientFormValues | LeadFormValues | GroupFormValues) => {
      if (type === "group") {
        const groupData = values as GroupFormValues;
        const { data, error } = await supabase
          .from("whatsapp_groups")
          .insert({
            tenant_id: tenantId,
            group_chat_id: senderPhone, // Use sender_phone as temporary group_chat_id
            group_name: groupData.group_name,
            description: groupData.description,
            agency_id: groupData.agency_id || null,
          })
          .select()
          .single();

        if (error) throw error;
        return { data, type: "group" as const };
      } else if (type === "client") {
        const clientData = values as ClientFormValues;
        const { data, error } = await supabase
          .from("clients")
          .insert({
            name: clientData.name,
            agency_id: clientData.agency_id,
            phone: clientData.phone,
            email: clientData.email,
            notes: clientData.notes,
            active_chat_provider: activeChatProvider,
          })
          .select()
          .single();
        if (error) throw error;
        
        return { id: data.id, type: "client" as const };
      } else {
        const leadData = values as LeadFormValues;
        const { data, error } = await supabase
          .from("leads")
          .insert({
            company_name: leadData.company_name,
            contact_name: leadData.contact_name,
            agency_id: leadData.agency_id,
            phone: leadData.phone,
            email: leadData.email,
            notes: leadData.notes,
            active_chat_provider: activeChatProvider,
          })
          .select()
          .single();
        if (error) throw error;
        
        return { id: data.id, type: "lead" as const };
      }
    },
    onSuccess: async (result) => {
      setIsConverting(true);
      
      // Call edge function to update all messages
      const { error } = await supabase.functions.invoke("convert-unknown-contact", {
        body: {
          senderPhone,
          contactId: result.id,
          contactType: result.type,
          tenantId,
        },
      });

      setIsConverting(false);

      if (error) {
        console.error("Failed to update messages:", error);
        toast.error("נוצר איש קשר אבל ההודעות לא עודכנו");
      } else {
        toast.success(
          type === "client"
            ? `${terms?.client?.singular || "לקוח"} נוצר בהצלחה!`
            : `${terms?.lead?.singular || "ליד"} נוצר בהצלחה!`
        );
      }

      queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      queryClient.invalidateQueries({ queryKey: ["unknown-contacts"] });
      onOpenChange(false);
      onSuccess(result.id, result.type);
    },
    onError: (error: any) => {
      console.error("Failed to create contact:", error);
      toast.error(
        error.message || `שגיאה ביצירת ${type === "client" ? terms?.client?.singular || "לקוח" : terms?.lead?.singular || "ליד"}`
      );
    },
  });

  const onSubmit = (values: ClientFormValues | LeadFormValues) => {
    createMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === "client" ? `המר ל${terms?.client?.singular || "לקוח"}` : `המר ל${terms?.lead?.singular || "ליד"}`}
          </DialogTitle>
          <DialogDescription>
            מלא את הפרטים כדי להמיר את איש הקשר ל{type === "client" ? terms?.client?.singular || "לקוח" : type === "lead" ? terms?.lead?.singular || "ליד" : "קבוצה"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {type === "group" ? (
            <>
              <div>
                <Label htmlFor="group_name">שם הקבוצה *</Label>
                <Input id="group_name" {...form.register("group_name")} />
                {(form.formState.errors as any).group_name && (
                  <p className="text-sm text-destructive mt-1">
                    {(form.formState.errors as any).group_name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="agency_id">סוכנות</Label>
                <Select
                  value={form.watch("agency_id") || ""}
                  onValueChange={(value) => form.setValue("agency_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוכנות (אופציונלי)" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((agency) => (
                      <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">תיאור</Label>
                <Textarea id="description" {...form.register("description")} />
              </div>
            </>
          ) : type === "client" ? (
            <>
              <div>
                <Label htmlFor="name">שם *</Label>
                <Input id="name" {...form.register("name")} />
                {(form.formState.errors as any).name && (
                  <p className="text-sm text-destructive mt-1">
                    {(form.formState.errors as any).name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="agency_id">סוכנות *</Label>
                <Select
                  value={form.watch("agency_id")}
                  onValueChange={(value) => form.setValue("agency_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוכנות" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((agency) => (
                      <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(form.formState.errors as any).agency_id && (
                  <p className="text-sm text-destructive mt-1">
                    {(form.formState.errors as any).agency_id.message}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="company_name">שם החברה *</Label>
                <Input id="company_name" {...form.register("company_name")} />
                {(form.formState.errors as any).company_name && (
                  <p className="text-sm text-destructive mt-1">
                    {(form.formState.errors as any).company_name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="contact_name">שם איש קשר</Label>
                <Input id="contact_name" {...form.register("contact_name")} />
              </div>

              <div>
                <Label htmlFor="agency_id">סוכנות</Label>
                <Select
                  value={form.watch("agency_id") || ""}
                  onValueChange={(value) => form.setValue("agency_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוכנות (אופציונלי)" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((agency) => (
                      <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {type !== "group" && (
            <>
              <div>
                <Label htmlFor="phone">טלפון</Label>
                <Input id="phone" {...form.register("phone")} />
              </div>

              <div>
                <Label htmlFor="email">אימייל</Label>
                <Input id="email" type="email" {...form.register("email")} />
              </div>

              <div>
                <Label htmlFor="notes">הערות</Label>
                <Textarea id="notes" {...form.register("notes")} />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={createMutation.isPending || isConverting}>
              {createMutation.isPending || isConverting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  {isConverting ? "מעדכן הודעות..." : "יוצר..."}
                </>
              ) : (
                "המר"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
