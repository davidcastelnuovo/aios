import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Pencil, CalendarIcon, FileText, DollarSign, MessageSquare, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const formSchema = z.object({
  company_name: z.string().min(1, "שם העסק הוא שדה חובה"),
  contact_name: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  response_status: z.string().optional(),
  estimated_deal_value: z.string().optional(),
  proposal_date: z.date().optional(),
  itai_meeting_date: z.date().optional(),
  sale_date: z.date().optional(),
  industry: z.string().optional(),
  products: z.string().optional(),
  notes: z.string().optional(),
  sales_person_id: z.string().optional(),
  agency_id: z.string().optional(),
  folder_link: z.string().optional(),
  lost_reason: z.string().optional(),
  created_at: z.date().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditLeadDialogProps {
  lead: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditLeadDialog({ lead, open: controlledOpen, onOpenChange }: EditLeadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;
  const [activeTab, setActiveTab] = useState("details");
  const [newUpdate, setNewUpdate] = useState("");
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editingUpdateContent, setEditingUpdateContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userId } = useCurrentUser();

const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: lead.company_name || "",
      contact_name: lead.contact_name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      source: lead.source || "other",
      status: lead.status || "new",
      response_status: lead.response_status || "",
      estimated_deal_value: lead.estimated_deal_value?.toString() || "",
      proposal_date: lead.proposal_date ? new Date(lead.proposal_date) : undefined,
      itai_meeting_date: lead.itai_meeting_date ? new Date(lead.itai_meeting_date) : undefined,
      sale_date: lead.sale_date ? new Date(lead.sale_date) : undefined,
      industry: lead.industry || "",
      products: lead.products || "",
      notes: lead.notes || "",
      sales_person_id: lead.sales_person_id || "",
      agency_id: lead.agency_id || "",
      folder_link: lead.folder_link || "",
      lost_reason: lead.lost_reason || "",
      created_at: lead.created_at ? new Date(lead.created_at) : new Date(),
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
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: leadUpdates, refetch: refetchUpdates } = useQuery({
    queryKey: ["lead-updates", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_updates")
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!lead.id && open,
  });

const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const submitData: any = {
        company_name: values.company_name,
        contact_name: values.contact_name || null,
        email: values.email || null,
        phone: values.phone || null,
        source: (values.source as any) || null,
        status: (values.status as any) || 'new',
        response_status: (values.response_status as any) || null,
        estimated_deal_value: values.estimated_deal_value 
          ? parseFloat(values.estimated_deal_value) 
          : null,
        proposal_date: values.proposal_date || null,
        sale_date: values.sale_date || null,
        industry: values.industry || null,
        products: values.products || null,
        notes: values.notes || null,
        sales_person_id: values.sales_person_id || null,
        agency_id: values.agency_id || null,
        folder_link: values.folder_link || null,
        lost_reason: values.lost_reason || null,
        created_at: values.created_at || new Date(),
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

  const addUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from("lead_updates")
        .insert({
          lead_id: lead.id,
          user_id: userId,
          content,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      setNewUpdate("");
      sonnerToast.success("העדכון נוסף בהצלחה");
    },
    onError: (error: Error) => {
      sonnerToast.error(`שגיאה בהוספת עדכון: ${error.message}`);
    },
  });

  const updateUpdateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("lead_updates")
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      setEditingUpdateId(null);
      setEditingUpdateContent("");
      sonnerToast.success("העדכון עודכן בהצלחה");
    },
    onError: (error: Error) => {
      sonnerToast.error(`שגיאה בעדכון: ${error.message}`);
    },
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lead_updates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      sonnerToast.success("העדכון נמחק בהצלחה");
    },
    onError: (error: Error) => {
      sonnerToast.error(`שגיאה במחיקת עדכון: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate(values);
  };

  const handleAddUpdate = () => {
    if (!newUpdate.trim()) return;
    addUpdateMutation.mutate(newUpdate);
  };

  const handleEditUpdate = (updateId: string, currentContent: string) => {
    setEditingUpdateId(updateId);
    setEditingUpdateContent(currentContent);
  };

  const handleSaveEdit = () => {
    if (!editingUpdateContent.trim() || !editingUpdateId) return;
    updateUpdateMutation.mutate({
      id: editingUpdateId,
      content: editingUpdateContent.trim(),
    });
  };

  const handleCancelEdit = () => {
    setEditingUpdateId(null);
    setEditingUpdateContent("");
  };

  const handleDeleteUpdate = (updateId: string) => {
    if (confirm("האם אתה בטוח שברצונך למחוק עדכון זה?")) {
      deleteUpdateMutation.mutate(updateId);
    }
  };

  const showLostReason = form.watch("status") === "closed";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>ערוך ליד</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg shadow-sm">
            <TabsTrigger 
              value="details" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-md transition-all"
            >
              <FileText className="h-4 w-4" />
              פרטי ליד
            </TabsTrigger>
            <TabsTrigger 
              value="proposals" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-md transition-all"
            >
              <DollarSign className="h-4 w-4" />
              הצעות מחיר
            </TabsTrigger>
            <TabsTrigger 
              value="updates" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-md transition-all"
            >
              <MessageSquare className="h-4 w-4" />
              עדכונים
              {leadUpdates && leadUpdates.length > 0 && (
                <span className="ml-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs">
                  {leadUpdates.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6">
              
              {/* Tab 1: Lead Details */}
              <TabsContent value="details" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">שם העסק *</FormLabel>
                        <FormControl>
                          <Input {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
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
                        <FormLabel className="text-sm font-medium">שם איש קשר *</FormLabel>
                        <FormControl>
                          <Input {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
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
                      <FormLabel className="text-sm font-medium">סוכנות *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-right rounded-lg border-2 h-11">
                            <SelectValue placeholder="בחר סוכנות" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-50 text-right" align="end">
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
                        <FormLabel className="text-sm font-medium">איש מכירות *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-right rounded-lg border-2 h-11">
                              <SelectValue placeholder="בחר איש מכירות" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background z-50 text-right" align="end">
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
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">טלפון</FormLabel>
                        <FormControl>
                          <Input {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
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
                        <FormLabel className="text-sm font-medium">אימייל</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="response_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">סטטוס תגובה</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-right rounded-lg border-2 h-11">
                              <SelectValue placeholder="בחר סטטוס" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background z-50 text-right" align="end">
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

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">שלב במשפך *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-right rounded-lg border-2 h-11">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background z-50 text-right" align="end">
                            <SelectItem value="new">ליד חדש</SelectItem>
                            <SelectItem value="contacted">נוצר קשר</SelectItem>
                            <SelectItem value="follow_up">תהליך פולואפ</SelectItem>
                            <SelectItem value="proposal_sent">נשלחה הצעה</SelectItem>
                            <SelectItem value="transferred_to_onboarding">הועבר לקליטה</SelectItem>
                            <SelectItem value="closed">נסגר</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">מקור הגעה</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-right rounded-lg border-2 h-11">
                              <SelectValue placeholder="בחר מקור" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background z-50 text-right" align="end">
                            <SelectItem value="phone">טלפון</SelectItem>
                            <SelectItem value="website">אתר</SelectItem>
                            <SelectItem value="facebook">פייסבוק</SelectItem>
                            <SelectItem value="google">גוגל</SelectItem>
                            <SelectItem value="referral">הפניה</SelectItem>
                            <SelectItem value="other">אחר</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <Input {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
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
                        <Input {...field} placeholder="https://..." className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
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
                        <Textarea {...field} rows={3} className="text-right rounded-lg border-2 px-4 py-3" dir="rtl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={updateMutation.isPending} className="w-full">
                  {updateMutation.isPending ? "מעדכן..." : "עדכן ליד"}
                </Button>
              </TabsContent>

              {/* Tab 2: Proposals & Pricing */}
              <TabsContent value="proposals" className="space-y-4 mt-0">
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
                          <SelectTrigger className="text-right rounded-lg border-2 h-11">
                            <SelectValue placeholder="בחר מוצר/שירות" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100] text-right" align="end">
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
                        <Input type="number" {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="proposal_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-sm font-medium">תאריך הצעה</FormLabel>
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
                    name="itai_meeting_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-sm font-medium">שיחה עם איתי</FormLabel>
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
                </div>

                <FormField
                  control={form.control}
                  name="sale_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-medium">תאריך מכירה</FormLabel>
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

                {showLostReason && (
                  <FormField
                    control={form.control}
                    name="lost_reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">פרטי סגירה / סיבת אובדן</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} placeholder="האם נסגר בהצלחה או אבד? פרטים..." className="text-right rounded-lg border-2 px-4 py-3" dir="rtl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Button type="submit" disabled={updateMutation.isPending} className="w-full">
                  {updateMutation.isPending ? "מעדכן..." : "עדכן הצעות מחיר"}
                </Button>
              </TabsContent>

              {/* Tab 3: Updates */}
              <TabsContent value="updates" className="space-y-4 mt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">היסטוריית עדכונים</h4>
                    <span className="text-xs text-muted-foreground">
                      {leadUpdates?.length || 0} עדכונים
                    </span>
                  </div>

                  {/* Updates List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {leadUpdates?.map((update: any) => (
                      <Card key={update.id} className="p-3">
                        {editingUpdateId === update.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingUpdateContent}
                              onChange={(e) => setEditingUpdateContent(e.target.value)}
                              rows={3}
                              className="w-full text-right rounded-lg border-2 px-4 py-3"
                              dir="rtl"
                            />
                            <div className="flex gap-2 justify-start">
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={!editingUpdateContent.trim() || updateUpdateMutation.isPending}
                              >
                                שמור
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                              >
                                ביטול
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {update.profiles?.full_name || update.profiles?.email || "משתמש"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(update.created_at), "d בMMMM, HH:mm", { locale: he })}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">
                                {update.content}
                              </p>
                            </div>
                            {update.user_id === userId && (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditUpdate(update.id, update.content)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => handleDeleteUpdate(update.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    ))}
                    {(!leadUpdates || leadUpdates.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        אין עדכונים עדיין
                      </p>
                    )}
                  </div>

                  {/* Add New Update */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Textarea
                      value={newUpdate}
                      onChange={(e) => setNewUpdate(e.target.value)}
                      placeholder="הוסף עדכון חדש..."
                      rows={3}
                      className="flex-1 text-right rounded-lg border-2 px-4 py-3"
                      dir="rtl"
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleAddUpdate}
                      disabled={!newUpdate.trim() || addUpdateMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
