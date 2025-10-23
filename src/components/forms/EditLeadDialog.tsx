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
import { Pencil } from "lucide-react";

const formSchema = z.object({
  company_name: z.string().min(1, "שם החברה הוא שדה חובה"),
  contact_name: z.string().min(1, "שם איש קשר הוא שדה חובה"),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  phone: z.string().optional(),
  source: z.string().min(1, "מקור הליד הוא שדה חובה"),
  status: z.string().min(1, "סטטוס הוא שדה חובה"),
  estimated_deal_value: z.string().optional(),
  industry: z.string().optional(),
  notes: z.string().optional(),
  sales_person_id: z.string().min(1, "איש מכירות הוא שדה חובה"),
  agency_id: z.string().min(1, "סוכנות היא שדה חובה"),
  folder_link: z.string().optional(),
  lost_reason: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditLeadDialogProps {
  lead: any;
}

export function EditLeadDialog({ lead }: EditLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: lead.company_name || "",
      contact_name: lead.contact_name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      source: lead.source || "other",
      status: lead.status || "new",
      estimated_deal_value: lead.estimated_deal_value?.toString() || "",
      industry: lead.industry || "",
      notes: lead.notes || "",
      sales_person_id: lead.sales_person_id || "",
      agency_id: lead.agency_id || "",
      folder_link: lead.folder_link || "",
      lost_reason: lead.lost_reason || "",
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
      if (!agencyId) return [];
      
      const { data, error } = await supabase
        .from("sales_people")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!form.watch("agency_id"),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const submitData: any = {
        company_name: values.company_name,
        contact_name: values.contact_name,
        email: values.email || null,
        phone: values.phone || null,
        source: values.source as any,
        status: values.status as any,
        estimated_deal_value: values.estimated_deal_value 
          ? parseFloat(values.estimated_deal_value) 
          : null,
        industry: values.industry || null,
        notes: values.notes || null,
        sales_person_id: values.sales_person_id,
        agency_id: values.agency_id,
        folder_link: values.folder_link || null,
        lost_reason: values.lost_reason || null,
      };

      const { data, error } = await supabase
        .from("leads")
        .update(submitData)
        .eq("id", lead.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "ליד עודכן בהצלחה",
      });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון ליד",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate(values);
  };

  const showLostReason = form.watch("status") === "lost";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1">
          <Pencil className="h-4 w-4 ml-2" />
          ערוך
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ערוך ליד</DialogTitle>
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
                    <FormLabel>שם איש קשר *</FormLabel>
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
                  <FormLabel>סוכנות *</FormLabel>
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
                  <FormLabel>איש מכירות *</FormLabel>
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
                    <FormLabel>מקור *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
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
                    <FormLabel>סטטוס *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new">חדש</SelectItem>
                        <SelectItem value="contacted">יצירת קשר</SelectItem>
                        <SelectItem value="meeting_scheduled">פגישה מתוכננת</SelectItem>
                        <SelectItem value="proposal_sent">הצעה נשלחה</SelectItem>
                        <SelectItem value="negotiation">משא ומתן</SelectItem>
                        <SelectItem value="won">נסגר</SelectItem>
                        <SelectItem value="lost">אבד</SelectItem>
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

            {showLostReason && (
              <FormField
                control={form.control}
                name="lost_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>סיבת אובדן</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

            <Button type="submit" disabled={updateMutation.isPending} className="w-full">
              {updateMutation.isPending ? "מעדכן..." : "עדכן ליד"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
