import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Plus, CalendarIcon, Settings2, Tag, Settings, Search } from "lucide-react";
import { useAgency } from "@/contexts/AgencyContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCustomFieldLabels } from "@/hooks/useCustomFieldLabels";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { useLeadPipelineStages } from "@/hooks/useLeadPipelineStages";
import { ManageLeadStatusesDialog } from "./ManageLeadStatusesDialog";
import { ManagePipelineStagesDialog } from "./ManagePipelineStagesDialog";
import { ChatTagsManager } from "@/components/chat/ChatTagsManager";
import { useCurrentUser } from "@/hooks/useCurrentUser";

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
  const [responseSelectOpen, setResponseSelectOpen] = useState(false);
  const [stageSelectOpen, setStageSelectOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagsPopoverOpen, setIsTagsPopoverOpen] = useState(false);
  const [isTagsManagerOpen, setIsTagsManagerOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedAgency } = useAgency();
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { getFieldLabel, isFieldVisible } = useCustomFieldLabels('lead');
  const { activeStatuses: leadStatuses } = useLeadStatuses();
  const { activeStages: pipelineStages } = useLeadPipelineStages();

  // Fetch all available tags
  const { data: allTags = [] } = useQuery({
    queryKey: ['chat-tags', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('chat_tags')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as Array<{ id: string; name: string; color: string }>;
    },
    enabled: !!tenantId && open,
    staleTime: 60000,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      source: "",
      status: pipelineStages[0]?.stage_key || "new",
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
        response_status: values.response_status && values.response_status !== 'none' ? (values.response_status as any) : null,
        monthly_budget: values.monthly_budget 
          ? parseFloat(values.monthly_budget) 
          : null,
        industry: values.industry || null,
        products: values.products || null,
        notes: values.notes || null,
        sales_person_id: values.sales_person_id && values.sales_person_id !== 'none' ? values.sales_person_id : null,
        agency_id: values.agency_id && values.agency_id !== 'none' ? values.agency_id : null,
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
      
      // Add selected tags to the newly created lead
      if (data && selectedTags.length > 0 && userId && tenantId) {
        for (const tagId of selectedTags) {
          try {
            await supabase
              .from('chat_contact_tags')
              .insert({
                tag_id: tagId,
                user_id: userId,
                tenant_id: tenantId,
                lead_id: data.id,
              });
          } catch (tagError) {
            console.error('Error adding tag:', tagError);
          }
        }
      }
      
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
      setSelectedTags([]);
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
                name="response_status"
                render={({ field }) => {
                  const selectedStatus = leadStatuses.find(s => s.status_key === field.value);
                  return (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">סטטוס תגובה</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        open={responseSelectOpen}
                        onOpenChange={setResponseSelectOpen}
                      >
                        <FormControl>
                          <SelectTrigger 
                            className="rounded-lg border-2 h-11"
                            style={{ 
                              backgroundColor: selectedStatus?.color || undefined,
                              color: field.value ? '#fff' : undefined 
                            }}
                          >
                            <SelectValue placeholder="בחר סטטוס" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="none">ללא סטטוס</SelectItem>
                          {leadStatuses.map((status) => (
                            <SelectItem 
                              key={status.status_key} 
                              value={status.status_key}
                              style={{ backgroundColor: status.color, color: '#fff' }}
                            >
                              {status.label}
                            </SelectItem>
                          ))}
                          <div className="border-t mt-1 pt-1">
                            <ManageLeadStatusesDialog 
                              trigger={
                                <button 
                                  type="button"
                                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                                >
                                  <Settings2 className="h-4 w-4" />
                                  ניהול סטטוסים
                                </button>
                              }
                              onDialogOpen={() => setResponseSelectOpen(false)}
                            />
                          </div>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => {
                  const selectedStage = pipelineStages.find(s => s.stage_key === field.value);
                  return (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">שלב במשפך</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        open={stageSelectOpen}
                        onOpenChange={setStageSelectOpen}
                      >
                        <FormControl>
                          <SelectTrigger 
                            className="rounded-lg border-2 h-11"
                            style={{ 
                              backgroundColor: selectedStage?.color || undefined,
                              color: field.value ? '#fff' : undefined 
                            }}
                          >
                            <SelectValue placeholder="בחר שלב" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          {pipelineStages.map((stage) => (
                            <SelectItem 
                              key={stage.stage_key} 
                              value={stage.stage_key}
                              style={{ backgroundColor: stage.color, color: '#fff' }}
                            >
                              {stage.label}
                            </SelectItem>
                          ))}
                          <div className="border-t mt-1 pt-1">
                            <ManagePipelineStagesDialog 
                              trigger={
                                <button 
                                  type="button"
                                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                                >
                                  <Settings2 className="h-4 w-4" />
                                  ניהול שלבי משפך
                                </button>
                              }
                              onDialogOpen={() => setStageSelectOpen(false)}
                            />
                          </div>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

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

            {/* Tags Section */}
            <div className="space-y-2">
              <FormLabel className="text-sm font-medium">תגיות</FormLabel>
              <div className="flex flex-wrap gap-2 items-center">
                {selectedTags.length > 0 && allTags.filter(t => selectedTags.includes(t.id)).map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="cursor-pointer"
                    style={{ 
                      backgroundColor: `${tag.color}20`,
                      borderColor: tag.color,
                      color: tag.color 
                    }}
                    onClick={() => setSelectedTags(prev => prev.filter(id => id !== tag.id))}
                  >
                    {tag.name} ×
                  </Badge>
                ))}
                <Popover 
                  open={isTagsPopoverOpen} 
                  onOpenChange={(open) => {
                    setIsTagsPopoverOpen(open);
                    if (!open) setTagSearchQuery('');
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <Tag className="h-4 w-4 ml-1" />
                      הוסף תגית
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2 bg-background z-[100]" align="start" dir="rtl">
                    {allTags.length > 3 && (
                      <div className="relative mb-2">
                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="חיפוש תגית..."
                          value={tagSearchQuery}
                          onChange={(e) => setTagSearchQuery(e.target.value)}
                          className="pr-8 h-8 text-sm"
                          dir="rtl"
                        />
                      </div>
                    )}
                    <div 
                      className="space-y-1 max-h-[250px] overflow-y-auto"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {allTags.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-2">
                          אין תגיות זמינות
                        </div>
                      ) : (
                        allTags
                          .filter(tag => tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                          .map((tag) => {
                            const isSelected = selectedTags.includes(tag.id);
                            return (
                              <div
                                key={tag.id}
                                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                onClick={() => {
                                  setSelectedTags(prev => 
                                    isSelected 
                                      ? prev.filter(id => id !== tag.id)
                                      : [...prev, tag.id]
                                  );
                                }}
                              >
                                <Checkbox checked={isSelected} />
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: tag.color }}
                                />
                                <span className="text-sm flex-1">{tag.name}</span>
                              </div>
                            );
                          })
                      )}
                    </div>
                    <div className="border-t border-border mt-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setIsTagsPopoverOpen(false);
                          setIsTagsManagerOpen(true);
                        }}
                      >
                        <Settings className="h-4 w-4 ml-2" />
                        ניהול תגיות
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
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

      {/* Tags Manager Dialog */}
      <ChatTagsManager
        open={isTagsManagerOpen}
        onOpenChange={setIsTagsManagerOpen}
        showTrigger={false}
      />
    </Dialog>
  );
}
