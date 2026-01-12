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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Plus, CalendarIcon } from "lucide-react";
import { useAgency } from "@/contexts/AgencyContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCustomFieldLabels } from "@/hooks/useCustomFieldLabels";

const formSchema = z.object({
  company_name: z.string().optional().default(""),
  contact_name: z.string().min(1, "שם איש קשר הוא שדה חובה"),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  response_status: z.string().optional(),
  estimated_deal_value: z.string().optional(),
  monthly_budget: z.string().optional(),
  industry: z.string().optional(),
  products: z.string().optional(),
  notes: z.string().optional(),
  sales_person_id: z.string().optional(),
  agency_id: z.string().optional(),
  folder_link: z.string().optional(),
  created_at: z.date().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function AddLeadForm() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedAgency } = useAgency();
  const { tenantId } = useCurrentTenant();
  const { getFieldLabel, isFieldVisible } = useCustomFieldLabels('lead');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      source: "",
      status: "new",
      response_status: "",
      estimated_deal_value: "",
      monthly_budget: "",
      industry: "",
      products: "",
      notes: "",
      sales_person_id: "",
      agency_id: (selectedAgency && selectedAgency !== "all") ? selectedAgency : "",
      folder_link: "",
      created_at: new Date(),
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
    queryKey: ["sales-people-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_people")
        .select("*")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!tenantId) throw new Error("לא נמצא tenant_id");
      
      // Use contact_name as company_name if company_name is empty
      const companyName = values.company_name?.trim() || values.contact_name?.trim() || "ליד חדש";
      
        const submitData: any = {
          company_name: companyName,
          contact_name: values.contact_name || null,
          email: values.email || null,
          phone: values.phone || null,
          // "source" is NOT required in the UI, but the DB column is non-null.
          // When empty, we store "other" to prevent insert errors.
          source: (values.source as any) || 'other',
          status: (values.status as any) || 'new',
          response_status: (values.response_status as any) || null,
        monthly_budget: values.monthly_budget 
          ? parseFloat(values.monthly_budget) 
          : null,
        industry: values.industry || null,
        products: values.products || null,
        notes: values.notes || null,
        sales_person_id: values.sales_person_id || null,
        agency_id: values.agency_id || null,
        folder_link: values.folder_link || null,
        created_at: values.created_at || new Date(),
        tenant_id: tenantId,
      };

      const { data, error } = await supabase
        .from("leads")
        .insert([submitData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      
      // Trigger lead_created automation
      if (data && tenantId) {
        try {
          await supabase.functions.invoke('trigger-automation', {
            body: {
              trigger_type: 'lead_created',
              data: {
                id: data.id,
                lead_id: data.id,
                company_name: data.company_name,
                contact_name: data.contact_name,
                phone: data.phone,
                email: data.email,
                status: data.status,
                source: data.source,
                agency_id: data.agency_id,
              },
              tenant_id: tenantId,
            },
          });
          console.log('✅ lead_created automation triggered');
        } catch (automationError) {
          console.error('Error triggering lead_created automation:', automationError);
        }
      }
      
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
              {isFieldVisible('company_name') && (
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{getFieldLabel('company_name', 'שם העסק')} *</FormLabel>
                      <FormControl>
                        <Input {...field} className="rounded-lg border-2 h-11 px-4" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{getFieldLabel('contact_name', 'שם איש קשר')}</FormLabel>
                    <FormControl>
                      <Input {...field} className="rounded-lg border-2 h-11 px-4" />
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
                  <FormLabel className="text-sm font-medium">{getFieldLabel('agency_id', 'סוכנות')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-lg border-2 h-11">
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
                  <FormLabel className="text-sm font-medium">{getFieldLabel('sales_person_id', 'איש מכירות')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-lg border-2 h-11">
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
                    <FormLabel className="text-sm font-medium">אימייל</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} className="rounded-lg border-2 h-11 px-4" />
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
                    <FormLabel className="text-sm font-medium">טלפון</FormLabel>
                    <FormControl>
                      <Input {...field} className="rounded-lg border-2 h-11 px-4" />
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
                    <FormLabel className="text-sm font-medium">מקור הגעה</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-lg border-2 h-11">
                          <SelectValue placeholder="בחר מקור" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-[100]">
                        <SelectItem value="website">אתר</SelectItem>
                        <SelectItem value="referral">הפניה</SelectItem>
                        <SelectItem value="social_media">רשתות חברתיות</SelectItem>
                        <SelectItem value="paid_ads">פרסום ממומן</SelectItem>
                        <SelectItem value="cold_call">שיחה קרה</SelectItem>
                        <SelectItem value="email_campaign">קמפיין מייל</SelectItem>
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
                    <FormLabel className="text-sm font-medium">שלב במשפך</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-lg border-2 h-11">
                          <SelectValue placeholder="בחר שלב" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-[100]">
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
                name="response_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">סטטוס</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                       <FormControl>
                        <SelectTrigger className="rounded-lg border-2 h-11">
                          <SelectValue placeholder="בחר סטטוס" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-[100]">
                        <SelectItem value="no_answer_1">אין מענה 1</SelectItem>
                        <SelectItem value="no_answer_2">אין מענה 2</SelectItem>
                        <SelectItem value="no_answer_3">אין מענה 3</SelectItem>
                        <SelectItem value="no_answer_4">אין מענה 4</SelectItem>
                        <SelectItem value="denies_contact">מכחיש פניה</SelectItem>
                        <SelectItem value="not_relevant">לא רלוונטי</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="products"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">מוצרים/שירותים</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        const selectedProduct = products?.find(p => p.id === value);
                        if (selectedProduct) {
                          form.setValue("estimated_deal_value", selectedProduct.price.toString());
                        }
                      }} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="rounded-lg border-2 h-11">
                          <SelectValue placeholder="בחר מוצר/שירות" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-[100]">
                        {products?.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
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
                name="estimated_deal_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">שווי שירות (₪)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} placeholder="0" className="rounded-lg border-2 h-11 px-4" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthly_budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{getFieldLabel('monthly_budget', 'תקציב')} (₪)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} placeholder="0" className="rounded-lg border-2 h-11 px-4" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="created_at"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-sm font-medium">תאריך יצירת ליד</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-right font-normal rounded-lg border-2 h-11",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy")
                          ) : (
                            <span>בחר תאריך</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">תחום עיסוק</FormLabel>
                  <FormControl>
                    <Input {...field} className="rounded-lg border-2 h-11 px-4" />
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
                  <FormLabel className="text-sm font-medium">קישור לתיקייה</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." className="rounded-lg border-2 h-11 px-4" />
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
                  <FormLabel className="text-sm font-medium">הערות</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} className="rounded-lg border-2 px-4 py-3" />
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
