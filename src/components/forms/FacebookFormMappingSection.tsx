import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, RefreshCw, ListTree, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface FormField {
  key: string;
  label: string;
  type: string;
}

interface FacebookForm {
  id: string;
  name: string;
  status: string;
  fields: FormField[];
}

interface FormMapping {
  field_mappings: Record<string, string>;
  agency_id: string | null;
}

interface Props {
  tenantId: string;
  integrationId: string | null;
  accessToken: string | null;
  agencies: Array<{ id: string; name: string }>;
}

const SYSTEM_FIELDS = [
  { value: 'skip', label: 'דלג על שדה זה' },
  { value: 'contact_name', label: 'שם איש קשר' },
  { value: 'company_name', label: 'שם חברה' },
  { value: 'email', label: 'אימייל' },
  { value: 'phone', label: 'טלפון' },
  { value: 'notes', label: 'הערות' },
  { value: 'industry', label: 'תעשייה' },
  { value: 'products', label: 'מוצרים' },
  { value: 'campaign_name', label: 'שם קמפיין' },
];

const DEFAULT_MAPPINGS: Record<string, string> = {
  'full_name': 'contact_name',
  'email': 'email',
  'phone_number': 'phone',
  'company_name': 'company_name',
};

export function FacebookFormMappingSection({ tenantId, integrationId, accessToken, agencies }: Props) {
  const queryClient = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [selectedAgency, setSelectedAgency] = useState<string>("");

  // Fetch pages
  const { data: pagesData, isLoading: loadingPages, isFetching: fetchingPages, refetch: refetchPages } = useQuery({
    queryKey: ['facebook-pages', tenantId, accessToken],
    queryFn: async () => {
      if (!accessToken) return { pages: [] };
      
      console.log('Fetching Facebook pages with token:', accessToken?.substring(0, 20) + '...');
      
      const { data, error } = await supabase.functions.invoke('get-facebook-forms', {
        body: { tenant_id: tenantId, access_token: accessToken },
      });

      console.log('Facebook pages response:', data);
      if (error) {
        console.error('Facebook pages error:', error);
        throw error;
      }
      return data;
    },
    enabled: !!accessToken,
    staleTime: 0, // Always refetch when requested
  });

  // Fetch forms for selected page
  const { data: formsData, isLoading: loadingForms, refetch: refetchForms } = useQuery({
    queryKey: ['facebook-forms', selectedPageId, accessToken],
    queryFn: async () => {
      if (!accessToken || !selectedPageId) return { forms: [] };
      
      const { data, error } = await supabase.functions.invoke('get-facebook-forms', {
        body: { tenant_id: tenantId, page_id: selectedPageId, access_token: accessToken },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!accessToken && !!selectedPageId,
  });

  // Fetch existing mappings from integration settings
  const { data: existingSettings } = useQuery({
    queryKey: ['facebook-integration-settings', integrationId],
    queryFn: async () => {
      if (!integrationId) return null;
      
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('settings')
        .eq('id', integrationId)
        .single();

      if (error) throw error;
      return data?.settings as any;
    },
    enabled: !!integrationId,
  });

  // Load existing mappings when form is selected
  useEffect(() => {
    if (selectedFormId && existingSettings?.form_mappings?.[selectedFormId]) {
      const mapping = existingSettings.form_mappings[selectedFormId] as FormMapping;
      setFieldMappings(mapping.field_mappings || {});
      setSelectedAgency(mapping.agency_id || "");
    } else if (selectedFormId) {
      // Set default mappings for new form
      const form = formsData?.forms?.find((f: FacebookForm) => f.id === selectedFormId);
      if (form) {
        const defaultMappings: Record<string, string> = {};
        form.fields.forEach((field: FormField) => {
          if (DEFAULT_MAPPINGS[field.key]) {
            defaultMappings[field.key] = DEFAULT_MAPPINGS[field.key];
          }
        });
        setFieldMappings(defaultMappings);
      }
    }
  }, [selectedFormId, existingSettings, formsData]);

  // Load existing page_id from settings
  useEffect(() => {
    if (existingSettings?.page_id) {
      setSelectedPageId(existingSettings.page_id);
    }
  }, [existingSettings]);

  // Save mappings mutation
  const saveMappingsMutation = useMutation({
    mutationFn: async () => {
      if (!integrationId || !selectedFormId) {
        throw new Error('חסרים פרטי אינטגרציה או טופס');
      }

      const currentSettings = existingSettings || {};
      const formMappings = currentSettings.form_mappings || {};

      formMappings[selectedFormId] = {
        field_mappings: fieldMappings,
        agency_id: selectedAgency || null,
      };

      const updatedSettings = {
        ...currentSettings,
        form_mappings: formMappings,
        page_id: selectedPageId,
      };

      const { error } = await supabase
        .from('tenant_integrations')
        .update({ 
          settings: updatedSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('מיפוי השדות נשמר בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['facebook-integration-settings'] });
      queryClient.invalidateQueries({ queryKey: ['facebook-lead-ads-integration'] });
    },
    onError: (error) => {
      toast.error('שגיאה בשמירת המיפוי: ' + (error as Error).message);
    },
  });

  const pages = pagesData?.pages || [];
  const forms = formsData?.forms || [];
  const selectedForm = forms.find((f: FacebookForm) => f.id === selectedFormId);

  if (!accessToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTree className="h-5 w-5" />
            מיפוי טפסי לידים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              יש להזין Access Token קודם כדי לטעון את הטפסים
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTree className="h-5 w-5" />
          מיפוי טפסי לידים
        </CardTitle>
        <CardDescription>
          מפה שדות מטפסי Facebook Lead Ads לשדות במערכת
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Page Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>בחר עמוד פייסבוק</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                console.log('Refresh pages clicked');
                refetchPages();
              }}
              disabled={loadingPages || fetchingPages}
            >
              <RefreshCw className={`h-4 w-4 ${(loadingPages || fetchingPages) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <Select value={selectedPageId} onValueChange={(value) => {
            setSelectedPageId(value);
            setSelectedFormId("");
            setFieldMappings({});
          }}>
            <SelectTrigger>
              <SelectValue placeholder={loadingPages ? "טוען עמודים..." : "בחר עמוד"} />
            </SelectTrigger>
            <SelectContent>
              {pages.map((page: any) => (
                <SelectItem key={page.id} value={page.id}>
                  {page.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pages.length === 0 && !loadingPages && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                לא נמצאו עמודים. וודא שה-Access Token כולל הרשאות: <strong>pages_show_list</strong>, <strong>pages_manage_metadata</strong> ו-<strong>leads_retrieval</strong>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Form Selection */}
        {selectedPageId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>בחר טופס</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => refetchForms()}
                disabled={loadingForms}
              >
                <RefreshCw className={`h-4 w-4 ${loadingForms ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <Select value={selectedFormId} onValueChange={setSelectedFormId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingForms ? "טוען טפסים..." : "בחר טופס"} />
              </SelectTrigger>
              <SelectContent>
                {forms.map((form: FacebookForm) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name} ({form.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {forms.length === 0 && !loadingForms && selectedPageId && (
              <p className="text-xs text-muted-foreground">
                לא נמצאו טפסי Lead Ads בעמוד זה.
              </p>
            )}
          </div>
        )}

        {/* Field Mappings */}
        {selectedForm && (
          <div className="space-y-4 border-t pt-4">
            <Label className="text-base font-medium">מיפוי שדות</Label>
            <div className="grid gap-3">
              {selectedForm.fields.map((field: FormField) => (
                <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                  <div className="text-sm">
                    <span className="font-medium">{field.label}</span>
                    <span className="text-muted-foreground text-xs mr-2">({field.key})</span>
                  </div>
                  <Select 
                    value={fieldMappings[field.key] || 'skip'} 
                    onValueChange={(value) => {
                      setFieldMappings(prev => ({
                        ...prev,
                        [field.key]: value,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר שדה" />
                    </SelectTrigger>
                    <SelectContent>
                      {SYSTEM_FIELDS.map((sysField) => (
                        <SelectItem key={sysField.value} value={sysField.value}>
                          {sysField.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Agency Selection */}
            <div className="space-y-2 border-t pt-4">
              <Label>סוכנות ברירת מחדל ללידים מטופס זה</Label>
              <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוכנות (אופציונלי)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא סוכנות</SelectItem>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                לידים מטופס זה ישויכו אוטומטית לסוכנות שנבחרה
              </p>
            </div>

            {/* Save Button */}
            <Button
              onClick={() => saveMappingsMutation.mutate()}
              disabled={saveMappingsMutation.isPending}
              className="w-full gap-2"
            >
              {saveMappingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              שמור מיפוי
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
