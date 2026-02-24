import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState, useMemo } from "react";
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
import { Loader2, X, Calendar as CalendarIcon, Clock, CheckCircle2, Paperclip } from "lucide-react";
import { FolderLinksField } from "@/components/forms/FolderLinksField";
import { AttachmentsField } from "@/components/forms/AttachmentsField";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCustomFieldLabels } from "@/hooks/useCustomFieldLabels";
import { useTerminology } from "@/hooks/useTerminology";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientUpdatesTab } from "@/components/clients/ClientUpdatesTab";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useFolderLinksAndAttachments } from "@/hooks/useFolderLinksAndAttachments";
import { useMeetingScheduler } from "@/hooks/useMeetingScheduler";
const formSchema = z.object({
  name: z.string().min(1, "שם הלקוח נדרש"),
  contact_name: z.string().optional(),
  agency_id: z.string().min(1, "סוכנות נדרשת"),
  phone: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  folder_link: z.string().url("קישור לא תקין").optional().or(z.literal("")),
  retainer: z.string().optional(),
  monthly_budget: z.string().optional(),
  website: z.string().url("כתובת אתר לא תקינה").optional().or(z.literal("")),
  notes: z.string().optional(),
  status: z.enum(["active", "paused", "ended", "onboarding"]),
  mood_status: z.enum(["happy", "wavering", "churn_risk", "not_progressing"]).optional(),
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
  const { getFieldLabel } = useCustomFieldLabels('client');
  const { t } = useTerminology();

  // Shared hooks
  const { folderLinks, setFolderLinks, attachments, setAttachments, filesCount } =
    useFolderLinksAndAttachments(client);

  const meetingScheduler = useMeetingScheduler(tenantId);

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
    queryKey: ["campaigners", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("active", true)
        .eq("tenant_id", tenantId!)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: assignedCampaigners, refetch: refetchAssigned } = useQuery({
    queryKey: ["client-campaigners", client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_team")
        .select(`
          id,
          campaigner_id,
          campaigner_payment,
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
        toast.info(`ה${t('role_campaigner')} כבר משויך ללקוח`);
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
      toast.success(`ה${t('role_campaigner')} שויך בהצלחה`);
      refetchAssigned();
      queryClient.invalidateQueries({ queryKey: ["accounting-campaigner-payments"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
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
      queryClient.invalidateQueries({ queryKey: ["accounting-campaigner-payments"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    },
    onError: () => {
      toast.error("שגיאה בהסרת הקמפיינר");
    },
  });

  const updateCampaignerPayment = useMutation({
    mutationFn: async ({ assignmentId, payment }: { assignmentId: string; payment: number }) => {
      const { error } = await supabase
        .from("client_team")
        .update({ campaigner_payment: payment })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("עלות הקמפיינר עודכנה");
      refetchAssigned();
      queryClient.invalidateQueries({ queryKey: ["accounting-campaigner-payments"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    },
    onError: () => {
      toast.error("שגיאה בעדכון עלות הקמפיינר");
    },
  });


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: client.name || "",
      contact_name: client.contact_name || "",
      agency_id: client.agency_id || "",
      phone: client.phone || "",
      email: client.email || "",
      folder_link: client.folder_link || "",
      retainer: "",
      monthly_budget: "",
      website: client.website || "",
      notes: client.notes || "",
      status: client.status || "active",
      mood_status: client.mood_status || "happy",
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
          contact_name: values.contact_name || null,
          agency_id: values.agency_id,
          phone: values.phone || null,
          email: values.email || null,
          folder_link: folderLinks[0]?.url || values.folder_link || null,
          folder_links: folderLinks as unknown as any,
          attachments: attachments as unknown as any,
          website: values.website || null,
          notes: values.notes || null,
          status: values.status,
          mood_status: values.mood_status || "happy",
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
      queryClient.invalidateQueries({ queryKey: ["accounting-clients"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("שגיאה בעדכון הלקוח: " + error.message);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  // Get available time slots from the meeting scheduler hook
  const timeSlots = meetingScheduler.getAvailableTimeSlots();

  // Wrapper for scheduling meeting with client details
  const handleScheduleMeeting = async () => {
    await meetingScheduler.scheduleMeeting({
      contactName: client.name,
      contactEmail: client.email,
      contactId: client.id,
      contactType: 'client',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת לקוח: {client.name}</DialogTitle>
          <DialogDescription>
            עדכן את פרטי הלקוח, צפה במשימות והוסף הערות
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="details">פרטי לקוח</TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              קבצים
              {filesCount > 0 && (
                <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-xs">
                  {filesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="meeting" className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              פגישה
            </TabsTrigger>
            <TabsTrigger value="updates">עדכונים</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
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

            <div className="grid grid-cols-2 gap-4">
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
                name="mood_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מצב רוח לקוח</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "happy"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background">
                        <SelectItem value="happy">
                          <span className="flex items-center gap-2">
                            <span>😊</span>
                            <span className="text-green-600">לקוח מבסוט</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="wavering">
                          <span className="flex items-center gap-2">
                            <span>😐</span>
                            <span className="text-yellow-600">לקוח מתנדנד</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="churn_risk">
                          <span className="flex items-center gap-2">
                            <span>😟</span>
                            <span className="text-red-600">סכנת נטישה</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="not_progressing">
                          <span className="flex items-center gap-2">
                            <span>😔</span>
                            <span className="text-orange-600">לא מתקדם</span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                <FormLabel>{t('role_campaigner', true)} משויכים</FormLabel>
                <div className="space-y-2 mt-2">
                  {assignedCampaigners && assignedCampaigners.length > 0 ? (
                    assignedCampaigners.map((assignment: any) => (
                      <div key={assignment.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                        <Badge variant="secondary" className="text-sm flex items-center gap-1">
                          {assignment.campaigners.full_name}
                          <button
                            type="button"
                            onClick={() => removeCampaignerMutation.mutate(assignment.id)}
                            className="hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                        <div className="flex items-center gap-1 mr-auto">
                          <span className="text-xs text-muted-foreground">₪</span>
                          <Input
                            type="number"
                            className="h-7 w-24 text-sm"
                            placeholder="עלות"
                            defaultValue={assignment.campaigner_payment || ""}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              if (val !== (assignment.campaigner_payment || 0)) {
                                updateCampaignerPayment.mutate({ assignmentId: assignment.id, payment: val });
                              }
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">אין {t('role_campaigner', true)} משויכים</p>
                  )}
                </div>
              </div>

              <div>
                <FormLabel>הוסף {t('role_campaigner')}</FormLabel>
                <Select
                  onValueChange={(value) => assignCampaignerMutation.mutate(value)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={`בחר ${t('role_campaigner')}`} />
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
          </TabsContent>

          <TabsContent value="meeting" className="mt-4 space-y-4">
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                קביעת פגישה עם לקוח
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Calendar Side */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">בחר תאריך</label>
                  <Card className="p-2">
                    <Calendar
                      mode="single"
                      selected={meetingScheduler.meetingDate}
                      onSelect={meetingScheduler.handleDateSelect}
                      disabled={(date) => date < new Date()}
                      className="pointer-events-auto"
                      locale={he}
                    />
                  </Card>
                </div>

                {/* Details Side */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      שעה
                    </label>
                    <Select value={meetingScheduler.meetingTime} onValueChange={meetingScheduler.setMeetingTime}>
                      <SelectTrigger className="w-full text-right rounded-lg border-2 h-11">
                        <SelectValue placeholder="בחר שעה" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50 max-h-[200px]">
                        {meetingScheduler.isLoadingCalendar ? (
                          <SelectItem value="loading" disabled>טוען יומן...</SelectItem>
                        ) : meetingScheduler.calendarError ? (
                          <SelectItem value="error" disabled>{meetingScheduler.calendarError}</SelectItem>
                        ) : (
                          timeSlots.map(({ time, available }) => (
                            <SelectItem
                              key={time}
                              value={time}
                              disabled={!available}
                              className={!available ? "text-muted-foreground line-through" : ""}
                            >
                              {time} {!available && "(תפוס)"}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">נושא הפגישה</label>
                    <Input
                      value={meetingScheduler.meetingSubject}
                      onChange={(e) => meetingScheduler.setMeetingSubject(e.target.value)}
                      placeholder={`פגישה עם ${client.name}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">מיקום (אופציונלי)</label>
                    <Input
                      value={meetingScheduler.meetingLocation}
                      onChange={(e) => meetingScheduler.setMeetingLocation(e.target.value)}
                      placeholder="Google Meet / משרד / זום"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">הודעה אישית (אופציונלי)</label>
                    <Textarea
                      value={meetingScheduler.personalMessage}
                      onChange={(e) => meetingScheduler.setPersonalMessage(e.target.value)}
                      placeholder="הוסף הודעה אישית שתופיע בהזמנה..."
                      rows={3}
                    />
                  </div>

                  {!client.email && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
                      ללקוח לא מוגדר אימייל - לא תישלח הזמנה במייל
                    </div>
                  )}

                  {/* Summary Card */}
                  {meetingScheduler.meetingDate && (
                    <Card className="p-4 bg-primary/5 border-primary/20">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {format(meetingScheduler.meetingDate, 'EEEE, d בMMMM yyyy', { locale: he })} בשעה {meetingScheduler.meetingTime}
                        </span>
                      </div>
                    </Card>
                  )}

                  <Button
                    onClick={handleScheduleMeeting}
                    disabled={!meetingScheduler.meetingDate || !meetingScheduler.meetingTime || meetingScheduler.isSchedulingMeeting}
                    className="w-full"
                  >
                    {meetingScheduler.isSchedulingMeeting ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        קובע פגישה...
                      </>
                    ) : (
                      <>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {client.email ? "קבע פגישה ושלח הזמנה" : "קבע פגישה"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="files" className="mt-4 space-y-6">
            <FolderLinksField
              links={folderLinks}
              onChange={setFolderLinks}
            />
            <AttachmentsField
              attachments={attachments}
              onChange={setAttachments}
              entityType="client"
              entityId={client.id}
            />
          </TabsContent>

          <TabsContent value="updates" className="mt-4">
            <ClientUpdatesTab 
              clientId={client.id}
              clientName={client.name}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
