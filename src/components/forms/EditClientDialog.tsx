import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
const formSchema = z.object({
  name: z.string().min(1, "שם הלקוח נדרש"),
  agency_id: z.string().min(1, "סוכנות נדרשת"),
  phone: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  folder_link: z.string().url("קישור לא תקין").optional().or(z.literal("")),
  retainer: z.string().optional(),
  monthly_budget: z.string().optional(),
  website: z.string().url("כתובת אתר לא תקינה").optional().or(z.literal("")),
  notes: z.string().optional(),
  status: z.enum(["active", "paused", "ended", "onboarding"]),
  is_seo_client: z.boolean().default(false),
});

interface EditClientDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  // Fetch custom field labels for client entity
  const { data: fieldLabels } = useQuery({
    queryKey: ["custom-fields", tenantId, "client"],
    queryFn: async () => {
      if (!tenantId) return {};
      
      const { data, error } = await supabase
        .from("custom_fields")
        .select("field_key, field_label")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "client");
      
      if (error) throw error;
      
      // Convert to map for easy lookup
      const labelMap: Record<string, string> = {};
      data?.forEach(field => {
        labelMap[field.field_key] = field.field_label;
      });
      return labelMap;
    },
    enabled: !!tenantId,
  });

  // Helper function to get field label with fallback
  const getFieldLabel = (fieldKey: string, fallback: string) => {
    return fieldLabels?.[fieldKey] || fallback;
  };

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
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: assignedCampaigners, refetch: refetchAssigned } = useQuery({
    queryKey: ["client-campaigners", client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_team")
        .select(`
          id,
          campaigner_id,
          campaigners (full_name)
        `)
        .eq("client_id", client.id);
      if (error) throw error;
      return data;
    },
  });

  const assignCampaignerMutation = useMutation({
    mutationFn: async (campaignerId: string) => {
      const { data: existing } = await supabase
        .from("client_team")
        .select("id")
        .eq("client_id", client.id)
        .eq("campaigner_id", campaignerId)
        .maybeSingle();

      if (existing) {
        toast.info("הקמפיינר כבר משויך ללקוח");
        return;
      }

      const { error } = await supabase
        .from("client_team")
        .insert({
          client_id: client.id,
          campaigner_id: campaignerId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הקמפיינר שויך בהצלחה");
      refetchAssigned();
    },
    onError: () => {
      toast.error("שגיאה בשיוך הקמפיינר");
    },
  });

  const removeCampaignerMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("client_team")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הקמפיינר הוסר בהצלחה");
      refetchAssigned();
    },
    onError: () => {
      toast.error("שגיאה בהסרת הקמפיינר");
    },
  });


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: client.name || "",
      agency_id: client.agency_id || "",
      phone: client.phone || "",
      email: client.email || "",
      folder_link: client.folder_link || "",
      retainer: "",
      monthly_budget: "",
      website: client.website || "",
      notes: client.notes || "",
      status: client.status || "active",
      is_seo_client: client.is_seo_client || false,
    },
  });
  
  const { canViewFinance } = useUserPermissions();
  
  // Fetch tenant-specific financial data
  const { data: financialData } = useQuery({
    queryKey: ["client-financial-data", client?.id, tenantId],
    queryFn: async () => {
      if (!client?.id || !tenantId) return null;
      const { data, error } = await supabase
        .from("client_tenant_financial_data")
        .select("*")
        .eq("client_id", client.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!client?.id && !!tenantId && open,
  });
  
  // Update financial fields when financialData is loaded
  useEffect(() => {
    if (financialData) {
      form.setValue("retainer", financialData.retainer?.toString() || "");
      form.setValue("monthly_budget", financialData.monthly_budget?.toString() || "");
    } else {
      // Fallback to client's own data if no tenant-specific data exists
      form.setValue("retainer", client.retainer?.toString() || "");
      form.setValue("monthly_budget", client.monthly_budget?.toString() || "");
    }
  }, [financialData, client, form]);

  const showFinanceFields = canViewFinance();

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!tenantId) throw new Error("Tenant ID not found");
      
      // Update client data (without financial fields)
      const { error: clientError } = await supabase
        .from("clients")
        .update({
          name: values.name,
          agency_id: values.agency_id,
          phone: values.phone || null,
          email: values.email || null,
          folder_link: values.folder_link || null,
          website: values.website || null,
          notes: values.notes || null,
          status: values.status,
          is_seo_client: values.is_seo_client,
        })
        .eq("id", client.id);

      if (clientError) throw clientError;
      
      // Update or insert tenant-specific financial data
      if (canViewFinance()) {
        const financialPayload = {
          client_id: client.id,
          tenant_id: tenantId,
          retainer: values.retainer ? parseFloat(values.retainer) : null,
          monthly_budget: values.monthly_budget ? parseFloat(values.monthly_budget) : null,
        };
        
        const { error: financialError } = await supabase
          .from("client_tenant_financial_data")
          .upsert(financialPayload, {
            onConflict: "client_id,tenant_id",
          });
        
        if (financialError) throw financialError;
      }
    },
    onSuccess: () => {
      toast.success("הלקוח עודכן בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-tenant-financial-data"] });
      queryClient.invalidateQueries({ queryKey: ["client-financial-data"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("שגיאה בעדכון הלקוח: " + error.message);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת לקוח: {client.name}</DialogTitle>
          <DialogDescription>
            עדכן את פרטי הלקוח, הוסף הערות וקישור לתיקייה
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="agency_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{getFieldLabel('agency_id', 'סוכנות')} *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוכנות" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      {agencies?.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id}>
                          {agency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{getFieldLabel('name', 'שם הלקוח')} *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{getFieldLabel('phone', 'טלפון')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{getFieldLabel('email', 'אימייל')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="folder_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>קישור לתיקייה</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://drive.google.com/..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showFinanceFields && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="retainer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{getFieldLabel('retainer', 'ריטיינר')} (₪)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="monthly_budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{getFieldLabel('monthly_budget', 'תקציב חודשי')} (₪)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
            )}

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{getFieldLabel('website', 'אתר')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סטטוס</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      <SelectItem value="active">פעיל</SelectItem>
                      <SelectItem value="onboarding">בקליטה</SelectItem>
                      <SelectItem value="paused">מושהה</SelectItem>
                      <SelectItem value="ended">הסתיים</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>הערות</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} placeholder="הוסף הערות כאן..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_seo_client"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer">
                      {getFieldLabel('is_seo_client', 'לקוח SEO')}
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="space-y-3 pt-4 border-t">
              <div>
                <FormLabel>קמפיינרים משויכים</FormLabel>
                <div className="flex flex-wrap gap-2 mt-2">
                  {assignedCampaigners && assignedCampaigners.length > 0 ? (
                    assignedCampaigners.map((assignment: any) => (
                      <Badge key={assignment.id} variant="secondary" className="text-sm flex items-center gap-1">
                        {assignment.campaigners.full_name}
                        <button
                          type="button"
                          onClick={() => removeCampaignerMutation.mutate(assignment.id)}
                          className="hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">אין קמפיינרים משויכים</p>
                  )}
                </div>
              </div>

              <div>
                <FormLabel>הוסף קמפיינר</FormLabel>
                <Select
                  onValueChange={(value) => assignCampaignerMutation.mutate(value)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="בחר קמפיינר" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {campaigners?.map((campaigner) => (
                      <SelectItem key={campaigner.id} value={campaigner.id}>
                        {campaigner.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                )}
                שמור שינויים
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
