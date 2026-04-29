import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState, useMemo, useCallback } from "react";
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
import { Loader2, X, Calendar as CalendarIcon, Clock, CheckCircle2, Paperclip, Plus, Trash2, Users, UserPlus, Copy } from "lucide-react";
import { FolderLinksField } from "@/components/forms/FolderLinksField";
import { AttachmentsField } from "@/components/forms/AttachmentsField";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCustomFieldLabels } from "@/hooks/useCustomFieldLabels";
import { useTerminology } from "@/hooks/useTerminology";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientUpdatesTab } from "@/components/clients/ClientUpdatesTab";
import { ClientLinkedFiles } from "@/components/clients/ClientLinkedFiles";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { addMonths, format, startOfMonth } from "date-fns";
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
  tier: z.enum(["A", "B", "C"]).optional().nullable(),
  services: z.array(z.string()).default([]),
  meta_ads_account_id: z.string().optional(),
  google_ads_account_id: z.string().optional(),
});

interface EditClientDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDuplicate?: () => void;
  financeExpenseMonth?: string;
}

export function EditClientDialog({ client, open, onOpenChange, onDuplicate, financeExpenseMonth }: EditClientDialogProps) {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { getFieldLabel } = useCustomFieldLabels('client');
  const { t } = useTerminology();

  // Shared hooks
  const { folderLinks, setFolderLinks, attachments, setAttachments, filesCount } =
    useFolderLinksAndAttachments(client);

  const meetingScheduler = useMeetingScheduler(tenantId);
  const [selectedMeetingEmails, setSelectedMeetingEmails] = useState<string[]>([]);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);

  // Team members for meeting invitations - filtered by tenant
  const {
    data: teamMembers = [],
    isLoading: isLoadingTeamMembers,
    error: teamMembersError,
  } = useQuery({
    queryKey: ["team-members-for-meeting", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data: tenantUsersData, error: tenantUsersError } = await supabase
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId);

      if (tenantUsersError) throw tenantUsersError;

      const userIds = (tenantUsersData || []).map((tu) => tu.user_id).filter(Boolean);
      if (userIds.length === 0) return [];

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
        .not("email", "is", null)
        .order("full_name");

      if (profilesError) throw profilesError;

      return (profilesData || []).filter((p: any) => p.email && p.email.trim() !== "");
    },
    enabled: !!tenantId && open,
  });

  interface ClientContact {
    id?: string;
    contact_name: string;
    phone: string;
    email: string;
    role: string;
    is_primary: boolean;
  }

  const { data: clientContacts, refetch: refetchContacts } = useQuery({
    queryKey: ["client-contacts", client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!client.id && open,
  });

  const addContactMutation = useMutation({
    mutationFn: async (contact: Omit<ClientContact, 'id' | 'is_primary'>) => {
      if (!tenantId) throw new Error("Missing tenant");
      const { error } = await supabase.from("client_contacts").insert({
        client_id: client.id,
        tenant_id: tenantId,
        contact_name: contact.contact_name,
        phone: contact.phone || null,
        email: contact.email || null,
        role: contact.role || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("איש קשר נוסף בהצלחה");
      refetchContacts();
    },
    onError: () => toast.error("שגיאה בהוספת איש קשר"),
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from("client_contacts").delete().eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("איש קשר הוסר");
      refetchContacts();
    },
    onError: () => toast.error("שגיאה בהסרת איש קשר"),
  });

  const [newContact, setNewContact] = useState({ contact_name: "", phone: "", email: "", role: "" });
  const [showAddContact, setShowAddContact] = useState(false);

  const handleAddContact = () => {
    if (!newContact.contact_name.trim()) {
      toast.error("שם איש קשר נדרש");
      return;
    }
    addContactMutation.mutate(newContact);
    setNewContact({ contact_name: "", phone: "", email: "", role: "" });
    setShowAddContact(false);
  };

  // Get all contacts for meeting invitations (with or without email)
  const allContactEmails = useMemo(() => {
    const contacts: { email: string | null; name: string; source: string }[] = [];
    // Always add the primary contact
    contacts.push({ email: client.email || null, name: client.contact_name || client.name, source: "ראשי" });
    // Add all non-primary contacts
    clientContacts?.forEach((c: any) => {
      contacts.push({ email: c.email || null, name: c.contact_name, source: c.role || "נוסף" });
    });
    return contacts;
  }, [client.email, client.contact_name, client.name, clientContacts]);

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
      tier: client.tier || null,
      services: client.services || [],
      meta_ads_account_id: client.meta_ads_account_id || "",
      google_ads_account_id: client.google_ads_account_id || "",
    },
  });
  
  const { canViewFinance } = useUserPermissions();
  const showFinanceFields = canViewFinance();
  
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

  const { data: clientFinanceExpenses = [] } = useQuery({
    queryKey: ["client-finance-expenses", client?.id, tenantId, financeExpenseMonth],
    queryFn: async () => {
      if (!client?.id || !tenantId) return [];
      const monthStart = financeExpenseMonth
        ? `${financeExpenseMonth}-01`
        : format(startOfMonth(new Date()), "yyyy-MM-dd");
      const nextMonthStart = format(addMonths(new Date(monthStart), 1), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("finance")
        .select("id, amount, category, notes, date")
        .eq("client_id", client.id)
        .eq("tenant_id", tenantId)
        .eq("type", "expense")
        .gte("date", monthStart)
        .lt("date", nextMonthStart)
        .order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id && !!tenantId && open && showFinanceFields,
  });

  // Synthetic SEO ₪850 expense for SEO clients without a finance row in the
  // selected month. Mirrors the logic in AccountingIntegrations so the dialog
  // shows the recurring SEO expense even when no finance row exists yet.
  const displayedFinanceExpenses = useMemo(() => {
    const monthForLabel = financeExpenseMonth || format(startOfMonth(new Date()), "yyyy-MM");
    const isSeo = !!client?.is_seo_client || (Array.isArray(client?.services) && client.services.includes("seo"));
    const hasSeoRow = (clientFinanceExpenses || []).some(
      (e: any) => (e.category || "").toUpperCase() === "SEO"
    );
    if (!isSeo || hasSeoRow) return clientFinanceExpenses;
    return [
      ...clientFinanceExpenses,
      {
        id: `auto-seo-${client?.id}-${monthForLabel}`,
        amount: 850,
        category: "SEO",
        notes: "הוצאת SEO חודשית (אוטומטי)",
        date: `${monthForLabel}-01`,
        _auto: true,
      },
    ];
  }, [clientFinanceExpenses, client?.is_seo_client, client?.services, client?.id, financeExpenseMonth]);
  
  // Update financial fields when financialData is loaded
  // IMPORTANT: depend on stable primitives only — depending on `client` (a new
  // object reference on every parent refetch) caused form.setValue to fire on
  // every keystroke-triggered invalidation, blurring inputs (e.g. website).
  useEffect(() => {
    if (financialData) {
      form.setValue("retainer", financialData.retainer?.toString() || "");
      form.setValue("monthly_budget", financialData.monthly_budget?.toString() || "");
    } else {
      form.setValue("retainer", client.retainer?.toString() || "");
      form.setValue("monthly_budget", client.monthly_budget?.toString() || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialData?.retainer, financialData?.monthly_budget, client.id]);

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
          tier: values.tier || null,
          services: values.services || [],
          meta_ads_account_id: values.meta_ads_account_id || null,
          google_ads_account_id: values.google_ads_account_id || null,
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
  const endTimeSlots = meetingScheduler.getAvailableEndTimeSlots();

  // Wrapper for scheduling meeting with client details
  const handleScheduleMeeting = async () => {
    await meetingScheduler.scheduleMeeting({
      contactName: client.name,
      contactEmail: client.email,
      contactId: client.id,
      contactType: 'client',
      additionalEmails: [...selectedMeetingEmails, ...selectedTeamMembers],
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        setSelectedMeetingEmails([]);
        setSelectedTeamMembers([]);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl h-[95vh] max-h-[95vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <DialogTitle>עריכת לקוח: {client.name}</DialogTitle>
              <DialogDescription>
                עדכן את פרטי הלקוח, צפה במשימות והוסף הערות
              </DialogDescription>
            </div>
            {onDuplicate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDuplicate}
                className="gap-2 shrink-0"
              >
                <Copy className="h-4 w-4" />
                שכפל לקוח
              </Button>
            )}
          </div>
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

            {/* Additional Contacts Section */}
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <FormLabel className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  אנשי קשר נוספים
                  {clientContacts && clientContacts.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">{clientContacts.length}</Badge>
                  )}
                </FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddContact(!showAddContact)}
                >
                  <Plus className="h-3 w-3 ml-1" />
                  הוסף איש קשר
                </Button>
              </div>

              {showAddContact && (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="שם *"
                      value={newContact.contact_name}
                      onChange={(e) => setNewContact(prev => ({ ...prev, contact_name: e.target.value }))}
                    />
                    <Input
                      placeholder="תפקיד"
                      value={newContact.role}
                      onChange={(e) => setNewContact(prev => ({ ...prev, role: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="טלפון"
                      value={newContact.phone}
                      onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                    />
                    <Input
                      placeholder="אימייל"
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddContact(false)}>ביטול</Button>
                    <Button type="button" size="sm" onClick={handleAddContact} disabled={addContactMutation.isPending}>
                      {addContactMutation.isPending ? "מוסיף..." : "הוסף"}
                    </Button>
                  </div>
                </div>
              )}

              {clientContacts && clientContacts.length > 0 && (
                <div className="space-y-2">
                  {clientContacts.map((contact: any) => (
                    <div key={contact.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <span className="font-medium">{contact.contact_name}</span>
                        <span className="text-muted-foreground">{contact.role || "—"}</span>
                        <span className="text-muted-foreground">{contact.phone || "—"}</span>
                        <span className="text-muted-foreground">{contact.email || "—"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteContactMutation.mutate(contact.id)}
                        className="hover:bg-destructive/20 rounded-full p-1"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FormField
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
              <div className="space-y-3">
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

                {clientFinanceExpenses.length > 0 && (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <FormLabel>הוצאות החודש</FormLabel>
                    {clientFinanceExpenses.map((expense: any) => (
                      <div key={expense.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {expense.category || "הוצאה"} · {new Date(expense.date).toLocaleDateString("he-IL")}
                        </span>
                        <span className="font-medium text-destructive">
                          ₪{Number(expense.amount || 0).toLocaleString("he-IL")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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

            {/* DMM: Tier + Services */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>דרגת לקוח (Tier)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר דרגה" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background">
                        <SelectItem value="A"><span className="font-bold text-purple-700">A — עדיפות גבוהה</span></SelectItem>
                        <SelectItem value="B"><span className="font-bold text-blue-700">B — עדיפות בינונית</span></SelectItem>
                        <SelectItem value="C"><span className="font-bold text-gray-600">C — עדיפות נמוכה</span></SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="services"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שירותים פעילים</FormLabel>
                    <div className="flex flex-col gap-2 mt-1">
                      {([
                        { key: "ppc_google", label: "PPC Google" },
                        { key: "ppc_meta", label: "PPC Meta" },
                        { key: "seo", label: "SEO" },
                        { key: "social", label: "Social" },
                        { key: "full_social", label: "Full Social" },
                        { key: "social_meta", label: "Social Meta" },
                        { key: "automation", label: "Automation" },
                      ] as { key: string; label: string }[]).map((svc) => (
                        <label key={svc.key} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={field.value?.includes(svc.key)}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              field.onChange(
                                checked ? [...current, svc.key] : current.filter((s: string) => s !== svc.key)
                              );
                            }}
                          />
                          <span className="text-sm">{svc.label}</span>
                        </label>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            {/* Ads Account IDs */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="meta_ads_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>חשבון מודעות META</FormLabel>
                    <FormControl>
                      <Input placeholder="מזהה חשבון Meta Ads" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="google_ads_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>חשבון Google Ads</FormLabel>
                    <FormControl>
                      <Input placeholder="מזהה חשבון Google Ads" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div>
                <FormLabel>{t('role_campaigner', true)} משויכים</FormLabel>
                <div className="space-y-2 mt-2">
                  {assignedCampaigners && assignedCampaigners.length > 0 ? (
                    assignedCampaigners.map((assignment: any) => (
                      <div key={assignment.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                        <Badge variant="secondary" className="text-sm flex items-center gap-1">
                          {assignment.campaigners?.full_name ?? "—"}
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
                      משעה
                    </label>
                    <Select value={meetingScheduler.meetingTime} onValueChange={meetingScheduler.setMeetingTime}>
                      <SelectTrigger className="w-full text-right rounded-lg border-2 h-11">
                        <SelectValue placeholder="בחר שעה" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50 max-h-[200px]">
                        {meetingScheduler.isLoadingCalendar ? (
                          <SelectItem value="loading" disabled>טוען יומן...</SelectItem>
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
                    <label className="text-sm font-medium">עד שעה</label>
                    <Select value={meetingScheduler.meetingEndTime} onValueChange={meetingScheduler.setMeetingEndTime}>
                      <SelectTrigger className="w-full text-right rounded-lg border-2 h-11">
                        <SelectValue placeholder="בחר שעת סיום" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50 max-h-[200px]">
                        {!meetingScheduler.meetingTime ? (
                          <SelectItem value="no-start" disabled>בחר קודם שעת התחלה</SelectItem>
                        ) : meetingScheduler.isLoadingCalendar ? (
                          <SelectItem value="loading-end" disabled>טוען יומן...</SelectItem>
                        ) : endTimeSlots.length === 0 ? (
                          <SelectItem value="none-end" disabled>אין שעות סיום זמינות</SelectItem>
                        ) : (
                          endTimeSlots.map(({ time, available }) => (
                            <SelectItem
                              key={`end-${time}`}
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

                  {/* Attendee selection */}
                  {allContactEmails.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        שלח זימון ל:
                      </label>
                      <div className="space-y-1.5">
                        {allContactEmails.map((contact, idx) => (
                          <label key={contact.email || `contact-${idx}`} className={`flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm ${contact.email ? 'cursor-pointer' : 'opacity-60'}`}>
                            <Checkbox
                              checked={contact.email ? selectedMeetingEmails.includes(contact.email) : false}
                              disabled={!contact.email}
                              onCheckedChange={(checked) => {
                                if (!contact.email) return;
                                setSelectedMeetingEmails(prev =>
                                  checked
                                    ? [...prev, contact.email!]
                                    : prev.filter(e => e !== contact.email)
                                );
                              }}
                            />
                            <span className="font-medium">{contact.name}</span>
                            <span className="text-muted-foreground">({contact.source})</span>
                            <span className="text-muted-foreground mr-auto">
                              {contact.email || 'ללא אימייל'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Team members selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      הזמן משתמשים מהמערכת:
                    </label>
                    {isLoadingTeamMembers ? (
                      <p className="text-sm text-muted-foreground">טוען משתמשי צוות...</p>
                    ) : teamMembersError ? (
                      <p className="text-sm text-destructive">
                        {teamMembersError instanceof Error ? teamMembersError.message : "שגיאה בטעינת משתמשי צוות"}
                      </p>
                    ) : teamMembers.length > 0 ? (
                      <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                        {teamMembers.map((member: any) => (
                          <label key={member.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 cursor-pointer text-sm">
                            <Checkbox
                              checked={selectedTeamMembers.includes(member.email)}
                              onCheckedChange={(checked) => {
                                setSelectedTeamMembers(prev =>
                                  checked
                                    ? [...prev, member.email]
                                    : prev.filter(e => e !== member.email)
                                );
                              }}
                            />
                            <span className="font-medium">{member.full_name}</span>
                            <span className="text-muted-foreground mr-auto">{member.email}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">לא נמצאו משתמשים עם אימייל</p>
                    )}
                  </div>

                  {meetingScheduler.meetingDate && (
                    <Card className="p-4 bg-primary/5 border-primary/20">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {format(meetingScheduler.meetingDate, 'EEEE, d בMMMM yyyy', { locale: he })} {meetingScheduler.meetingTime} - {meetingScheduler.meetingEndTime}
                        </span>
                      </div>
                    </Card>
                  )}

                  <Button
                    onClick={handleScheduleMeeting}
                    disabled={!meetingScheduler.meetingDate || !meetingScheduler.meetingTime || !meetingScheduler.meetingEndTime || meetingScheduler.isSchedulingMeeting}
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
                        {(() => {
                          const totalInvitees = selectedMeetingEmails.length + selectedTeamMembers.length;
                          return totalInvitees > 0 ? `קבע פגישה ושלח זימון ל-${totalInvitees} משתתפים` : "קבע פגישה";
                        })()}
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
            {/* Files linked from team chat */}
            <div>
              <h4 className="text-sm font-medium mb-2">קבצים מצ׳אט הצוות</h4>
              <ClientLinkedFiles clientId={client.id} tenantId={tenantId || ""} />
            </div>
          </TabsContent>

          <TabsContent value="updates" className="mt-4">
            <ClientUpdatesTab 
              clientId={client.id}
              clientName={client.name}
              currentMoodStatus={(client as any).mood_status}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
