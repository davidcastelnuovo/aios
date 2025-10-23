import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { useAgency } from "@/contexts/AgencyContext";

const formSchema = z.object({
  company_name: z.string().min(1, "שם החברה הוא שדה חובה"),
  contact_name: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  estimated_deal_value: z.string().optional(),
  industry: z.string().optional(),
  notes: z.string().optional(),
  sales_person_id: z.string().optional(),
  agency_id: z.string().optional(),
  folder_link: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function AddLeadForm() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedAgency } = useAgency();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      source: "other",
      status: "new",
      estimated_deal_value: "",
      industry: "",
      notes: "",
      sales_person_id: "",
      agency_id: (selectedAgency && selectedAgency !== "all") ? selectedAgency : "",
      folder_link: "",
    },
  });

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: salesPeople } = useQuery({
    queryKey: ["sales-people-for-form", form.watch("agency_id")],
    queryFn: async () => {
      const agencyId = form.watch("agency_id");
      if (!agencyId || agencyId === "all") return [];
      
      const { data, error } = await supabase
        .from("sales_people")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!form.watch("agency_id") && form.watch("agency_id") !== "all",
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const submitData: any = {
        company_name: values.company_name,
        contact_name: values.contact_name || null,
        email: values.email || null,
        phone: values.phone || null,
        source: (values.source as any) || 'other',
        status: (values.status as any) || 'new',
        estimated_deal_value: values.estimated_deal_value 
          ? parseFloat(values.estimated_deal_value) 
          : null,
        industry: values.industry || null,
        notes: values.notes || null,
        sales_person_id: values.sales_person_id || null,
        agency_id: values.agency_id || null,
        folder_link: values.folder_link || null,
      };

      const { data, error } = await supabase
        .from("leads")
        .insert([submitData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "ליד נוסף בהצלחה",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בהוספת ליד",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="ml-2 h-4 w-4" />
          הוסף ליד
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הוסף ליד חדש</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם החברה *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם איש קשר</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="agency_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוכנות</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              name="sales_person_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>איש מכירות</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר איש מכירות" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {salesPeople?.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מקור</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר מקור" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="website">אתר</SelectItem>
                        <SelectItem value="referral">הפניה</SelectItem>
                        <SelectItem value="social_media">מדיה חברתית</SelectItem>
                        <SelectItem value="paid_ads">מודעות ממומנות</SelectItem>
                        <SelectItem value="cold_call">שיחה קרה</SelectItem>
                        <SelectItem value="email_campaign">קמפיין אימייל</SelectItem>
                        <SelectItem value="event">אירוע</SelectItem>
                        <SelectItem value="other">אחר</SelectItem>
                      </SelectContent>
                    </Select>
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
                          <SelectValue placeholder="בחר סטטוס" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new">ליד חדש</SelectItem>
                        <SelectItem value="contacted">נוצר קשר</SelectItem>
                        <SelectItem value="follow_up">תהליך פולואפ</SelectItem>
                        <SelectItem value="proposal_sent">נשלחה הצעה</SelectItem>
                        <SelectItem value="closed">נסגר</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimated_deal_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שווי עסקה משוער (₪)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תחום עיסוק</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>קישור לתיקייה</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." />
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
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? "מוסיף..." : "הוסף ליד"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
