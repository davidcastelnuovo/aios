import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCustomFieldLabels } from "@/hooks/useCustomFieldLabels";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
  name: z.string().min(1, "שם הלקוח הוא שדה חובה"),
  contact_name: z.string().optional(),
  agency_id: z.string().min(1, "סוכנות היא שדה חובה"),
  phone: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  folder_link: z.string().url("קישור לא תקין").optional().or(z.literal("")),
  retainer: z.string().optional(),
  monthly_budget: z.string().optional(),
  website: z.string().url("כתובת אתר לא תקינה").optional().or(z.literal("")),
  notes: z.string().optional(),
  is_seo_client: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

export function AddClientForm() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { getFieldLabel } = useCustomFieldLabels('client');

  const { data: agencies } = useQuery({
    queryKey: ["agencies-for-client", tenantId],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      
      // Get owned agencies
      const { data: ownedAgencies, error: ownedError } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      
      if (ownedError) throw ownedError;
      
      // Get shared agencies via agency_tenant_access
      const { data: sharedAccess, error: sharedError } = await supabase
        .from("agency_tenant_access")
        .select(`
          agency_id,
          agencies (
            id,
            name
          )
        `)
        .eq("accessing_tenant_id", tenantId);
      
      if (sharedError) throw sharedError;
      
      // Extract shared agencies
      const shared = (sharedAccess || [])
        .map(s => s.agencies)
        .filter(Boolean);
      
      // Combine and remove duplicates
      const combined = [...(ownedAgencies || []), ...shared];
      const uniqueMap = new Map();
      combined.forEach(agency => {
        if (agency && agency.id && !uniqueMap.has(agency.id)) {
          uniqueMap.set(agency.id, agency);
        }
      });
      
      return Array.from(uniqueMap.values()).sort((a: any, b: any) => 
        a.name.localeCompare(b.name, 'he')
      );
    },
    enabled: !!tenantId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      contact_name: "",
      agency_id: "",
      phone: "",
      email: "",
      folder_link: "",
      retainer: "",
      monthly_budget: "",
      website: "",
      notes: "",
      is_seo_client: false,
    },
  });

  // Auto-select agency if there's only one
  useEffect(() => {
    if (agencies && agencies.length === 1 && !form.getValues("agency_id")) {
      form.setValue("agency_id", agencies[0].id);
    }
  }, [agencies, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!tenantId) {
        throw new Error("לא נמצא tenant_id למשתמש");
      }
      const { error } = await supabase.from("clients").insert({
        name: values.name,
        contact_name: values.contact_name || null,
        agency_id: values.agency_id,
        tenant_id: tenantId,
        phone: values.phone || null,
        email: values.email || null,
        folder_link: values.folder_link || null,
        retainer: values.retainer ? parseFloat(values.retainer) : null,
        monthly_budget: values.monthly_budget ? parseFloat(values.monthly_budget) : null,
        website: values.website || null,
        notes: values.notes || null,
        is_seo_client: values.is_seo_client,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הלקוח נוסף בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      toast.error("שגיאה בהוספת לקוח: " + error.message);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="ml-2 h-4 w-4" />
          הוסף לקוח
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הוסף לקוח חדש</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{getFieldLabel('name', 'שם הלקוח')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="agency_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{getFieldLabel('agency_id', 'סוכנות')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוכנות" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="folder_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{getFieldLabel('folder_link', 'קישור לתיקיה')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="retainer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{getFieldLabel('retainer', 'ריטיינר')} (₪)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
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
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{getFieldLabel('website', 'אתר')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                    <Textarea {...field} />
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

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "מוסיף..." : "הוסף לקוח"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
