import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, RefreshCw, ListTree, AlertCircle, Edit2, ExternalLink, Facebook, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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

interface FacebookPage {
  id: string;
  name: string;
  access_token?: string;
}

export function FacebookFormMappingSection({ tenantId, integrationId, accessToken, agencies }: Props) {
  const queryClient = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [manualPageId, setManualPageId] = useState<string>("");
  const [manualPageToken, setManualPageToken] = useState<string>("");
  const [showManualPageInput, setShowManualPageInput] = useState<boolean>(false);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [selectedAgency, setSelectedAgency] = useState<string>("");
  const [pageTokens, setPageTokens] = useState<Record<string, string>>({});

  // Graph API Explorer URL with permissions
  const graphExplorerUrl = `https://developers.facebook.com/tools/explorer/?permissions=pages_show_list%2Cpages_manage_metadata%2Cpages_manage_ads%2Cleads_retrieval%2Cpages_read_engagement`;

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
      
      // Store page tokens
      if (data?.pages) {
        const tokens: Record<string, string> = {};
        data.pages.forEach((page: FacebookPage) => {
          if (page.access_token) {
            tokens[page.id] = page.access_token;
          }
        });
        setPageTokens(tokens);
      }
      
      return data;
    },
    enabled: !!accessToken,
    staleTime: 0, // Always refetch when requested
  });

  // Fetch forms for selected page
  const { data: formsData, isLoading: loadingForms, refetch: refetchForms } = useQuery({
    queryKey: ['facebook-forms', selectedPageId, accessToken, manualPageToken],
    queryFn: async () => {
      if (!accessToken || !selectedPageId) return { forms: [] };
      
      // Use page-specific token if available, otherwise manual token, otherwise user token
      const pageAccessToken = pageTokens[selectedPageId] || manualPageToken || null;
      
      console.log('Fetching forms for page:', selectedPageId);
      console.log('Using page token:', pageAccessToken ? 'yes (page-specific)' : 'no (will use user token)');
      
      const { data, error } = await supabase.functions.invoke('get-facebook-forms', {
        body: { 
          tenant_id: tenantId, 
          page_id: selectedPageId, 
          access_token: accessToken,
          page_access_token: pageAccessToken,
        },
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
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowManualPageInput(!showManualPageInput)}
                title="הזן Page ID ידנית"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  console.log('Refresh pages clicked');
                  refetchPages();
                }}
                disabled={loadingPages || fetchingPages}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${(loadingPages || fetchingPages) ? 'animate-spin' : ''}`} />
                רענן עמודים
              </Button>
            </div>
          </div>
          
          {/* Pages count indicator */}
          {pages.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-green-700">נמצאו {pages.length} עמודים</span>
            </div>
          )}
          
          {showManualPageInput ? (
            <div className="space-y-2">
              <Input
                placeholder="הזן Page ID (למשל: 123456789)"
                value={manualPageId}
                onChange={(e) => setManualPageId(e.target.value)}
              />
              <Input
                placeholder="הזן Page Access Token (חובה להזנה ידנית)"
                value={manualPageToken}
                onChange={(e) => setManualPageToken(e.target.value)}
                type="password"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (manualPageId.trim() && manualPageToken.trim()) {
                      setPageTokens(prev => ({ ...prev, [manualPageId.trim()]: manualPageToken.trim() }));
                      setSelectedPageId(manualPageId.trim());
                      setSelectedFormId("");
                      setFieldMappings({});
                      setShowManualPageInput(false);
                      toast.success('Page ID הוזן בהצלחה');
                    } else {
                      toast.error('יש להזין גם Page ID וגם Page Access Token');
                    }
                  }}
                  disabled={!manualPageId.trim() || !manualPageToken.trim()}
                >
                  אשר
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowManualPageInput(false)}
                >
                  ביטול
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                לקבלת Page Access Token: לך ל-Graph Explorer, בחר את העמוד הספציפי ב-"User or Page" ולחץ "Generate Access Token"
              </p>
            </div>
          ) : (
            <Select value={selectedPageId} onValueChange={(value) => {
              setSelectedPageId(value);
              setSelectedFormId("");
              setFieldMappings({});
            }}>
              <SelectTrigger>
                <SelectValue placeholder={loadingPages ? "טוען עמודים..." : (pages.length === 0 ? "לא נמצאו עמודים - הזן ידנית" : "בחר עמוד")} />
              </SelectTrigger>
              <SelectContent>
                {pages.map((page: any) => (
                  <SelectItem key={page.id} value={page.id}>
                    {page.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {pages.length === 0 && !loadingPages && !showManualPageInput && (
            <Alert className="mt-2 bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">לא נמצאו עמודים</AlertTitle>
              <AlertDescription className="text-amber-700 space-y-2">
                <p>וודא שה-Access Token כולל את כל ההרשאות הנדרשות:</p>
                <ul className="list-disc pr-5 text-sm space-y-1">
                  <li><strong>pages_show_list</strong> - לצפייה בעמודים</li>
                  <li><strong>pages_manage_metadata</strong> - לניהול הגדרות</li>
                  <li><strong>leads_retrieval</strong> - לקבלת לידים</li>
                </ul>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => window.open(graphExplorerUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    קבל Token חדש
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowManualPageInput(true)}
                  >
                    <Edit2 className="h-4 w-4" />
                    הזן Page ID ידנית
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {selectedPageId && (
            <p className="text-xs text-muted-foreground">
              Page ID: {selectedPageId}
            </p>
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
