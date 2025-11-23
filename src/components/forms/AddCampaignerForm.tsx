import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

const formSchema = z.object({
  full_name: z.string().min(1, "שם מלא הוא שדה חובה"),
  agency_ids: z.array(z.string()).min(1, "יש לבחור לפחות סוכנות אחת"),
  roles: z.array(z.string()).optional(),
  phone: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  folder_link: z.string().url("קישור לא תקין").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function AddCampaignerForm() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  const { data: agencies } = useQuery({
    queryKey: ["agencies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      // Get owned agencies
      const { data: ownedAgencies, error: ownedError } = await supabase
        .from("agencies")
        .select("*")
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
            name,
            status,
            contact_name,
            phone,
            email,
            start_date,
            notes,
            created_at,
            tenant_id
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
      full_name: "",
      agency_ids: [],
      roles: [],
      phone: "",
      email: "",
      folder_link: "",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!tenantId) throw new Error("לא נמצא tenant_id");
      
      // יצירת הקמפיינר
      const { data: campaigner, error: campaignerError } = await supabase
        .from("campaigners")
        .insert({
          full_name: values.full_name,
          role: values.roles && values.roles.length > 0 ? values.roles : null,
          phone: values.phone || null,
          email: values.email || null,
          folder_link: values.folder_link || null,
          notes: values.notes || null,
          active: true,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (campaignerError) throw campaignerError;

      // קישור הקמפיינר לסוכנויות
      const agencyLinks = values.agency_ids.map(agencyId => ({
        campaigner_id: campaigner.id,
        agency_id: agencyId,
      }));

      const { error: linksError } = await supabase
        .from("campaigner_agencies")
        .insert(agencyLinks);

      if (linksError) throw linksError;
    },
    onSuccess: () => {
      toast.success("איש הצוות נוסף בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["campaigners"] });
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      toast.error("שגיאה בהוספת איש צוות: " + error.message);
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
          הוסף איש צוות
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הוסף איש צוות חדש</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם מלא</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="agency_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוכנויות</FormLabel>
                  <div className="space-y-2">
                    {agencies?.map((agency) => (
                      <div key={agency.id} className="flex items-center space-x-2 space-x-reverse">
                        <input
                          type="checkbox"
                          id={agency.id}
                          checked={field.value?.includes(agency.id)}
                          onChange={(e) => {
                            const newValue = e.target.checked
                              ? [...(field.value || []), agency.id]
                              : (field.value || []).filter(id => id !== agency.id);
                            field.onChange(newValue);
                          }}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor={agency.id} className="text-sm cursor-pointer">
                          {agency.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תפקידים</FormLabel>
                  <div className="space-y-2">
                    {["קמפיינר", "SEO", "מנהל צוות"].map((role) => (
                      <div key={role} className="flex items-center space-x-2 space-x-reverse">
                        <input
                          type="checkbox"
                          id={`role-${role}`}
                          checked={field.value?.includes(role)}
                          onChange={(e) => {
                            const newValue = e.target.checked
                              ? [...(field.value || []), role]
                              : (field.value || []).filter(r => r !== role);
                            field.onChange(newValue);
                          }}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor={`role-${role}`} className="text-sm cursor-pointer">
                          {role}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>טלפון</FormLabel>
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
                  <FormLabel>אימייל</FormLabel>
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
                  <FormLabel>קישור לתיקיה</FormLabel>
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

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "מוסיף..." : "הוסף איש צוות"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
