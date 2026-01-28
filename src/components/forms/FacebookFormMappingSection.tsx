import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, RefreshCw, ListTree, AlertCircle, Edit2, ExternalLink, Facebook, CheckCircle2, Plus, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";

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
  sales_person_id: string | null; // legacy single
  sales_person_ids?: string[]; // new multi-select
  tag_id: string | null;
}

interface Props {
  tenantId: string;
  integrationId: string | null;
  accessToken: string | null;
  agencies: Array<{ id: string; name: string }>;
  salesPeople: Array<{ id: string; full_name: string }>;
  tags: Array<{ id: string; name: string; color: string }>;
  sharedFromIntegrationId?: string | null;
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

export function FacebookFormMappingSection({ tenantId, integrationId, accessToken, agencies, salesPeople, tags, sharedFromIntegrationId }: Props) {
  const queryClient = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [manualPageId, setManualPageId] = useState<string>("");
  const [manualPageToken, setManualPageToken] = useState<string>("");
  const [showManualPageInput, setShowManualPageInput] = useState<boolean>(false);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [selectedAgency, setSelectedAgency] = useState<string>("");
  const [selectedSalesPersonIds, setSelectedSalesPersonIds] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [pageTokens, setPageTokens] = useState<Record<string, string>>({});
  const [pageSearchQuery, setPageSearchQuery] = useState<string>("");
  const [isAddingNewForm, setIsAddingNewForm] = useState<boolean>(false);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);

  // Fetch source integration token if this is a shared connection
  const { data: sourceToken } = useQuery({
    queryKey: ['source-integration-token', sharedFromIntegrationId],
    queryFn: async () => {
      if (!sharedFromIntegrationId) return null;
      
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('api_key')
        .eq('id', sharedFromIntegrationId)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data?.api_key || null;
    },
    enabled: !!sharedFromIntegrationId && !accessToken,
  });

  // Use either direct token or source token
  const effectiveAccessToken = accessToken || sourceToken;

  // Graph API Explorer URL with permissions
  const graphExplorerUrl = `https://developers.facebook.com/tools/explorer/?permissions=pages_show_list%2Cpages_manage_metadata%2Cpages_manage_ads%2Cleads_retrieval%2Cpages_read_engagement`;

  // Fetch pages
  const { data: pagesData, isLoading: loadingPages, isFetching: fetchingPages, error: pagesError, refetch: refetchPages } = useQuery({
    queryKey: ['facebook-pages', tenantId, effectiveAccessToken],
    queryFn: async () => {
      if (!effectiveAccessToken) return { pages: [], pageTokens: {}, tokenExpired: false };
      
      console.log('Fetching Facebook pages with token:', effectiveAccessToken?.substring(0, 20) + '...');
      
      const { data, error } = await supabase.functions.invoke('get-facebook-forms', {
        body: { tenant_id: tenantId, access_token: effectiveAccessToken },
      });

      console.log('Facebook pages response:', data);
      
      // Check for token expiration error
      if (error || data?.error) {
        const errorDetails = data?.details || {};
        const errorMessage = data?.error || error?.message || '';
        
        // Check if it's a token expiration error (code 190, subcode 463)
        if (errorDetails.code === 190 || errorMessage.includes('Session has expired') || errorMessage.includes('access token')) {
          console.log('Facebook token has expired');
          return { pages: [], pageTokens: {}, tokenExpired: true };
        }
        
        throw new Error(errorMessage || 'Failed to fetch pages');
      }
      
      // Build page tokens map
      const tokens: Record<string, string> = {};
      if (data?.pages) {
        data.pages.forEach((page: FacebookPage) => {
          if (page.access_token) {
            tokens[page.id] = page.access_token;
          }
        });
      }
      
      return { pages: data?.pages || [], pageTokens: tokens, tokenExpired: false };
    },
    enabled: !!effectiveAccessToken,
    staleTime: 0,
    retry: false, // Don't retry on expired token errors
  });

  // Get page tokens from query data
  const pageTokensFromQuery = pagesData?.pageTokens || {};
  
  // Merge with manually entered tokens
  const effectivePageTokens = { ...pageTokensFromQuery, ...pageTokens };

  // Fetch forms for selected page - use the token directly from the merged map
  const { data: formsData, isLoading: loadingForms, refetch: refetchForms } = useQuery({
    queryKey: ['facebook-forms', selectedPageId, effectiveAccessToken, effectivePageTokens[selectedPageId]],
    queryFn: async () => {
      if (!effectiveAccessToken || !selectedPageId) return { forms: [] };
      
      // Use page-specific token from the effective tokens map
      const pageAccessToken = effectivePageTokens[selectedPageId] || manualPageToken || null;
      
      console.log('Fetching forms for page:', selectedPageId);
      console.log('Using page token:', pageAccessToken ? `yes (${pageAccessToken.substring(0, 20)}...)` : 'no (will use user token)');
      
      const { data, error } = await supabase.functions.invoke('get-facebook-forms', {
        body: { 
          tenant_id: tenantId, 
          page_id: selectedPageId, 
          access_token: effectiveAccessToken,
          page_access_token: pageAccessToken,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveAccessToken && !!selectedPageId && !!effectivePageTokens[selectedPageId],
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
      // Support both legacy single and new multi-select
      const legacyId = mapping.sales_person_id;
      const multiIds = mapping.sales_person_ids || [];
      if (multiIds.length > 0) {
        setSelectedSalesPersonIds(multiIds);
      } else if (legacyId) {
        setSelectedSalesPersonIds([legacyId]);
      } else {
        setSelectedSalesPersonIds([]);
      }
      setSelectedTag(mapping.tag_id || "");
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
      setSelectedSalesPersonIds([]);
      setSelectedTag("");
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
        sales_person_id: selectedSalesPersonIds.length > 0 ? selectedSalesPersonIds[0] : null, // legacy compat
        sales_person_ids: selectedSalesPersonIds.length > 0 ? selectedSalesPersonIds : null,
        tag_id: selectedTag || null,
        form_name: selectedForm?.name || `טופס ${selectedFormId}`,
        page_id: selectedPageId,
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

      // Auto-subscribe the page to leadgen webhook
      if (selectedPageId) {
        console.log('Subscribing page to leadgen webhook:', selectedPageId);
        const { data: subscribeResult, error: subscribeError } = await supabase.functions.invoke('facebook-auth', {
          body: {
            action: 'subscribe_page',
            integration_id: integrationId,
            page_id: selectedPageId,
          },
        });

        if (subscribeError) {
          console.error('Error subscribing page to webhook:', subscribeError);
          // Don't throw - mapping was saved successfully, just log the webhook issue
          toast.warning('המיפוי נשמר, אך ייתכן שיש בעיה ברישום לקבלת לידים אוטומטית');
        } else {
          console.log('Page subscribed to webhook successfully:', subscribeResult);
        }
      }
    },
    onSuccess: () => {
      toast.success('מיפוי השדות נשמר והעמוד נרשם לקבלת לידים');
      setIsAddingNewForm(false);
      setEditingFormId(null);
      setSelectedFormId("");
      setFieldMappings({});
      setSelectedAgency("");
      setSelectedSalesPersonIds([]);
      setSelectedTag("");
      queryClient.invalidateQueries({ queryKey: ['facebook-integration-settings'] });
      queryClient.invalidateQueries({ queryKey: ['facebook-lead-ads-integration'] });
    },
    onError: (error) => {
      toast.error('שגיאה בשמירת המיפוי: ' + (error as Error).message);
    },
  });

  // Delete form mapping mutation
  const deleteFormMutation = useMutation({
    mutationFn: async (formIdToDelete: string) => {
      if (!integrationId) throw new Error('חסר מזהה אינטגרציה');
      
      const currentSettings = existingSettings || {};
      const formMappings = { ...(currentSettings.form_mappings || {}) };
      delete formMappings[formIdToDelete];

      const updatedSettings = {
        ...currentSettings,
        form_mappings: formMappings,
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
      toast.success('הטופס הוסר בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['facebook-integration-settings'] });
      queryClient.invalidateQueries({ queryKey: ['facebook-lead-ads-integration'] });
    },
    onError: (error) => {
      toast.error('שגיאה בהסרת הטופס: ' + (error as Error).message);
    },
  });

  // Get existing form mappings
  const existingFormMappings = (existingSettings?.form_mappings || {}) as Record<string, FormMapping & { form_name?: string; page_id?: string; tag_id?: string }>;
  const mappedFormIds = Object.keys(existingFormMappings);
  const hasMappedForms = mappedFormIds.length > 0;
  const showFormEditor = isAddingNewForm || editingFormId;

  const pages = pagesData?.pages || [];
  const forms = formsData?.forms || [];
  const hasPageToken = selectedPageId && !!effectivePageTokens[selectedPageId];
  const selectedForm = forms.find((f: FacebookForm) => f.id === selectedFormId);

  // Check if token is expired
  const tokenExpired = pagesData?.tokenExpired === true;

  if (!effectiveAccessToken) {
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
              {sharedFromIntegrationId ? 'טוען נתוני חיבור משותף...' : 'יש להזין Access Token קודם כדי לטעון את הטפסים'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Show token expired message
  if (tokenExpired) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTree className="h-5 w-5" />
            מיפוי טפסי לידים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">הטוקן של פייסבוק פג תוקף</AlertTitle>
            <AlertDescription className="text-amber-700">
              {sharedFromIntegrationId 
                ? 'יש להתחבר מחדש לפייסבוק מהארגון המקורי שממנו שותף החיבור.'
                : 'לחץ על "התחבר מחדש" למעלה כדי לחדש את החיבור לפייסבוק.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ListTree className="h-5 w-5" />
            מיפוי טפסי לידים
          </span>
          {hasMappedForms && !showFormEditor && (
            <Button 
              size="sm" 
              onClick={() => setIsAddingNewForm(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              הוסף טופס
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          מפה שדות מטפסי Facebook Lead Ads לשדות במערכת
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Display existing mapped forms */}
        {hasMappedForms && !showFormEditor && (
          <div className="space-y-3">
            <Label className="text-base font-medium">טפסים מחוברים</Label>
        {mappedFormIds.map((formId) => {
              const mapping = existingFormMappings[formId];
              const agencyName = agencies.find(a => a.id === mapping.agency_id)?.name;
              // Support both legacy single and new multi-select for display
              const spIds = mapping.sales_person_ids || (mapping.sales_person_id ? [mapping.sales_person_id] : []);
              const salesPersonNames = spIds
                .map(id => salesPeople.find(sp => sp.id === id)?.full_name)
                .filter(Boolean)
                .join(', ');
              const tagName = tags.find(t => t.id === mapping.tag_id)?.name;
              const fieldCount = Object.values(mapping.field_mappings || {}).filter(v => v !== 'skip').length;
              
              return (
                <div 
                  key={formId} 
                  className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Facebook className="h-4 w-4 text-[#1877F2]" />
                      <span className="font-medium">{mapping.form_name || `טופס ${formId}`}</span>
                      <Badge variant="secondary" className="text-xs">
                        {fieldCount} שדות ממופים
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      {agencyName && <span>סוכנות: {agencyName}</span>}
                      {agencyName && salesPersonNames && <span>•</span>}
                      {salesPersonNames && <span>אנשי מכירות: {salesPersonNames}</span>}
                      {(agencyName || salesPersonNames) && tagName && <span>•</span>}
                      {tagName && <span>תווית: {tagName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingFormId(formId);
                        setSelectedPageId(mapping.page_id || existingSettings?.page_id || '');
                        setSelectedFormId(formId);
                        setFieldMappings(mapping.field_mappings || {});
                        setSelectedAgency(mapping.agency_id || '');
                        // Support both legacy and new multi-select
                        const ids = mapping.sales_person_ids || (mapping.sales_person_id ? [mapping.sales_person_id] : []);
                        setSelectedSalesPersonIds(ids);
                      }}
                      title="ערוך מיפוי"
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('האם אתה בטוח שברצונך להסיר טופס זה?')) {
                          deleteFormMutation.mutate(formId);
                        }
                      }}
                      disabled={deleteFormMutation.isPending}
                      title="הסר טופס"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Show form editor when adding new or editing */}
        {(showFormEditor || !hasMappedForms) && (
          <>
            {showFormEditor && (
              <div className="flex items-center justify-between pb-2 border-b">
                <Label className="text-base font-medium">
                  {editingFormId ? 'עריכת טופס' : 'הוספת טופס חדש'}
                </Label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setIsAddingNewForm(false);
                    setEditingFormId(null);
                    setSelectedFormId("");
                    setFieldMappings({});
                    setSelectedAgency("");
                    setSelectedSalesPersonIds([]);
                  }}
                >
                  ביטול
                </Button>
              </div>
            )}
            
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
            <div className="space-y-2">
              <Select value={selectedPageId} onValueChange={(value) => {
                setSelectedPageId(value);
                setSelectedFormId("");
                setFieldMappings({});
                setPageSearchQuery("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingPages ? "טוען עמודים..." : (pages.length === 0 ? "לא נמצאו עמודים - הזן ידנית" : `בחר עמוד (${pages.length} עמודים)`)} />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  {/* Search input inside dropdown */}
                  {pages.length > 10 && (
                    <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                      <Input
                        placeholder="חפש עמוד לפי שם..."
                        value={pageSearchQuery}
                        onChange={(e) => {
                          e.stopPropagation();
                          setPageSearchQuery(e.target.value);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-8"
                        autoFocus
                      />
                    </div>
                  )}
                  <div className="max-h-[300px] overflow-y-auto">
                    {pages
                      .filter((page: FacebookPage) => 
                        pageSearchQuery === "" || page.name.toLowerCase().includes(pageSearchQuery.toLowerCase())
                      )
                      .map((page: FacebookPage) => (
                        <SelectItem key={page.id} value={page.id}>
                          {page.name}
                        </SelectItem>
                      ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
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
            {forms.length === 0 && !loadingForms && selectedPageId && !hasPageToken && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>חסר Page Access Token</AlertTitle>
                <AlertDescription>
                  <p>לא ניתן לטעון טפסים ללא Page Access Token.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-2"
                    onClick={() => setShowManualPageInput(true)}
                  >
                    <Edit2 className="h-4 w-4" />
                    הזן Page Token ידנית
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {forms.length === 0 && !loadingForms && selectedPageId && hasPageToken && (
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

            {/* Sales People Multi-Selection */}
            <div className="space-y-2">
              <Label>אנשי מכירות ברירת מחדל ללידים מטופס זה</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {salesPeople.length === 0 ? (
                  <p className="text-sm text-muted-foreground">אין אנשי מכירות זמינים</p>
                ) : (
                  salesPeople.map((sp) => (
                    <div key={sp.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`sp-${sp.id}`}
                        checked={selectedSalesPersonIds.includes(sp.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSalesPersonIds(prev => [...prev, sp.id]);
                          } else {
                            setSelectedSalesPersonIds(prev => prev.filter(id => id !== sp.id));
                          }
                        }}
                      />
                      <label
                        htmlFor={`sp-${sp.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {sp.full_name}
                      </label>
                    </div>
                  ))
                )}
              </div>
              {selectedSalesPersonIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedSalesPersonIds.length} נבחרו</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSalesPersonIds([])}
                    className="h-6 text-xs"
                  >
                    נקה בחירה
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                לידים מטופס זה ישויכו אוטומטית לכל אנשי המכירות שנבחרו
              </p>
            </div>

            {/* Tag Selection */}
            <div className="space-y-2">
              <Label>תווית ברירת מחדל ללידים מטופס זה</Label>
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר תווית (אופציונלי)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא תווית</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: tag.color }} 
                        />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                לידים מטופס זה יקבלו אוטומטית את התווית שנבחרה
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
