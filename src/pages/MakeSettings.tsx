import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Check, X, Loader2, Play, RefreshCw, Zap, Link2, Workflow, Settings, ExternalLink, Eye, EyeOff, ChevronsUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface MakeConnection {
  id: string;
  name: string;
  accountName?: string;
  accountType?: string;
  type?: string;
  typeName?: string;
  scopes?: string[];
  invalid?: boolean;
}

interface MakeScenario {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  isPaused?: boolean;
  scheduling?: {
    type?: string;
    interval?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface MakeSettings {
  api_token: string;
  team_id: string;
  region: string;
  connected_at?: string;
  google_ads_template_scenario_id?: string;
  google_analytics_template_scenario_id?: string;
}

const REGIONS = [
  { value: "eu1", label: "EU1 (Europe)" },
  { value: "eu2", label: "EU2 (Europe)" },
  { value: "us1", label: "US1 (United States)" },
  { value: "us2", label: "US2 (United States)" },
];

export default function MakeSettings() {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { tenantId: currentTenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  const [apiToken, setApiToken] = useState("");
  const [teamId, setTeamId] = useState("");
  const [region, setRegion] = useState("eu1");
  const [googleAdsTemplateId, setGoogleAdsTemplateId] = useState("");
  const [googleAnalyticsTemplateId, setGoogleAnalyticsTemplateId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [gaTemplateSelectorOpen, setGaTemplateSelectorOpen] = useState(false);

  // Fetch scenarios for template selector
  const { data: templateScenarios, isLoading: isLoadingTemplateScenarios } = useQuery({
    queryKey: ["make-scenarios-template", currentTenantId, apiToken, teamId, region],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("make-api", {
        body: {
          action: "list_scenarios",
          api_token: apiToken,
          team_id: teamId,
          region,
        },
      });
      if (error) throw error;
      return (data?.scenarios || data) as MakeScenario[];
    },
    enabled: !!apiToken && !!teamId && !!region,
  });

  // Fetch existing Make integration
  const { data: makeIntegration, isLoading: isLoadingIntegration } = useQuery({
    queryKey: ["make-integration", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from("tenant_integrations")
        .select("*")
        .eq("tenant_id", currentTenantId)
        .eq("integration_type", "make_api")
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Load saved settings
  useEffect(() => {
    if (makeIntegration?.settings) {
      const settings = makeIntegration.settings as unknown as MakeSettings;
      setApiToken(settings.api_token || "");
      setTeamId(settings.team_id || "");
      setRegion(settings.region || "eu1");
      setGoogleAdsTemplateId(settings.google_ads_template_scenario_id || "");
      setGoogleAnalyticsTemplateId(settings.google_analytics_template_scenario_id || "");
    }
  }, [makeIntegration]);

  const isConnected = makeIntegration?.is_active && apiToken && teamId;

  // Test connection
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("make-api", {
        body: {
          action: "test_connection",
          api_token: apiToken,
          team_id: teamId,
          region,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Connection failed");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "החיבור הצליח!",
        description: `מחובר כ: ${data.user?.name || data.user?.email || "Unknown"}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "שגיאה בחיבור",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save settings
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenantId) throw new Error("No tenant selected");

      const settings = {
        api_token: apiToken,
        team_id: teamId,
        region,
        google_ads_template_scenario_id: googleAdsTemplateId || undefined,
        google_analytics_template_scenario_id: googleAnalyticsTemplateId || undefined,
        connected_at: new Date().toISOString(),
      };

      // Robust save: avoid 409 duplicate key by re-checking for existing integration and updating it.
      const existingId = makeIntegration?.id;

      if (existingId) {
        const { error } = await supabase
          .from("tenant_integrations")
          .update({
            settings,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingId);
        if (error) throw error;
        return;
      }

      // Try to find an existing row (in case cache/state is stale)
      const { data: existingRow, error: existingLookupError } = await supabase
        .from("tenant_integrations")
        .select("id")
        .eq("tenant_id", currentTenantId)
        .eq("integration_type", "make_api")
        .limit(1)
        .maybeSingle();

      if (existingLookupError) {
        throw existingLookupError;
      }

      if (existingRow?.id) {
        const { error } = await supabase
          .from("tenant_integrations")
          .update({
            settings,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRow.id);
        if (error) throw error;
        return;
      }

      // No existing row found -> insert new
      const { error: insertError } = await supabase.from("tenant_integrations").insert([
        {
          tenant_id: currentTenantId,
          integration_type: "make_api",
          settings,
          is_active: true,
        },
      ]);

      // If a race condition happened and the row was created between lookup and insert, fall back to update.
      if (insertError && (insertError as any)?.code === "23505") {
        const { data: rowAfterConflict, error: conflictLookupError } = await supabase
          .from("tenant_integrations")
          .select("id")
          .eq("tenant_id", currentTenantId)
          .eq("integration_type", "make_api")
          .limit(1)
          .maybeSingle();

        if (conflictLookupError) throw conflictLookupError;
        if (!rowAfterConflict?.id) throw insertError;

        const { error: updateAfterConflictError } = await supabase
          .from("tenant_integrations")
          .update({
            settings,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rowAfterConflict.id);
        if (updateAfterConflictError) throw updateAfterConflictError;
        return;
      }

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["make-integration"] });
      toast({
        title: "ההגדרות נשמרו",
        description: "החיבור ל-Make.com הוגדר בהצלחה",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "שגיאה בשמירה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Disconnect
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!makeIntegration) return;
      const { error } = await supabase
        .from("tenant_integrations")
        .update({ is_active: false })
        .eq("id", makeIntegration.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["make-integration"] });
      toast({
        title: "החיבור נותק",
        description: "האינטגרציה עם Make.com נותקה",
      });
    },
  });

  // Fetch connections
  const { data: connections, isLoading: isLoadingConnections, refetch: refetchConnections } = useQuery({
    queryKey: ["make-connections", currentTenantId, apiToken, teamId, region],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("make-api", {
        body: {
          action: "list_connections",
          api_token: apiToken,
          team_id: teamId,
          region,
        },
      });
      if (error) throw error;
      return (data?.connections || data) as MakeConnection[];
    },
    enabled: !!isConnected && activeTab === "connections",
  });

  // Fetch scenarios
  const { data: scenarios, isLoading: isLoadingScenarios, refetch: refetchScenarios } = useQuery({
    queryKey: ["make-scenarios", currentTenantId, apiToken, teamId, region],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("make-api", {
        body: {
          action: "list_scenarios",
          api_token: apiToken,
          team_id: teamId,
          region,
        },
      });
      if (error) throw error;
      return (data?.scenarios || data) as MakeScenario[];
    },
    enabled: !!isConnected && activeTab === "scenarios",
  });

  // Run scenario
  const runScenarioMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      const { data, error } = await supabase.functions.invoke("make-api", {
        body: {
          action: "run_scenario",
          api_token: apiToken,
          team_id: teamId,
          region,
          scenario_id: scenarioId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "ה-Scenario הופעל",
        description: "הפעולה נשלחה ל-Make.com בהצלחה",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "שגיאה בהפעלה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoadingIntegration) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath("/integrations"))}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-700">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Make.com API</h1>
            <p className="text-muted-foreground">חיבור ישיר לחשבון Make.com שלך</p>
          </div>
        </div>
        {isConnected && (
          <Badge variant="default" className="bg-green-500 mr-auto">
            <Check className="h-3 w-3 ml-1" />
            מחובר
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            הגדרות
          </TabsTrigger>
          <TabsTrigger value="connections" disabled={!isConnected} className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            חיבורים
          </TabsTrigger>
          <TabsTrigger value="scenarios" disabled={!isConnected} className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Scenarios
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>הגדרות חיבור</CardTitle>
              <CardDescription>
                הזן את פרטי ה-API של Make.com. ניתן למצוא אותם ב-
                <a
                  href="https://www.make.com/en/api-documentation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline mx-1"
                >
                  הגדרות API של Make
                  <ExternalLink className="h-3 w-3 inline mr-1" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-token">API Token</Label>
                <div className="relative">
                  <Input
                    id="api-token"
                    type={showToken ? "text" : "password"}
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="הזן את ה-API Token שלך"
                    className="pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ניתן ליצור API Token ב-Profile {">"} API
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-id">Team ID</Label>
                <Input
                  id="team-id"
                  type="text"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  placeholder="הזן את ה-Team ID שלך"
                />
                <p className="text-xs text-muted-foreground">
                  ניתן למצוא את ה-Team ID ב-URL של Make.com (למשל: make.com/team/123456)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger id="region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  בחר את ה-Region שבו נמצא חשבון Make שלך
                </p>
              </div>

              {/* Google Ads Template Scenario ID */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Google Ads Template Scenario</Label>
                <Popover open={templateSelectorOpen} onOpenChange={setTemplateSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={templateSelectorOpen}
                      className="w-full justify-between"
                      disabled={!apiToken || !teamId}
                    >
                      {googleAdsTemplateId
                        ? templateScenarios?.find(s => s.id.toString() === googleAdsTemplateId)?.name || `Scenario #${googleAdsTemplateId}`
                        : "בחר סנריו טמפלייט..."}
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="חפש סנריו..." />
                      <CommandList>
                        <CommandEmpty>
                          {isLoadingTemplateScenarios ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin ml-2" />
                              טוען סנריות...
                            </div>
                          ) : (
                            "לא נמצאו סנריות"
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {templateScenarios?.map((scenario) => (
                            <CommandItem
                              key={scenario.id}
                              value={`${scenario.name} ${scenario.id}`}
                              onSelect={() => {
                                setGoogleAdsTemplateId(scenario.id.toString());
                                setTemplateSelectorOpen(false);
                              }}
                            >
                              <Check
                                className={`ml-2 h-4 w-4 ${
                                  googleAdsTemplateId === scenario.id.toString() ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <div className="flex flex-col">
                                <span>{scenario.name}</span>
                                <span className="text-xs text-muted-foreground">ID: {scenario.id}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  צור Scenario ב-Make.com עם 2 מודולים: Google Ads Report → HTTP POST, ובחר אותו מהרשימה.
                  <br />
                  המערכת תשכפל אותו אוטומטית לכל טבלת Google Ads חדשה.
                </p>
              </div>

              {/* Google Analytics Template Scenario ID */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Google Analytics Template Scenario</Label>
                <Popover open={gaTemplateSelectorOpen} onOpenChange={setGaTemplateSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={gaTemplateSelectorOpen}
                      className="w-full justify-between"
                      disabled={!apiToken || !teamId}
                    >
                      {googleAnalyticsTemplateId
                        ? templateScenarios?.find(s => s.id.toString() === googleAnalyticsTemplateId)?.name || `Scenario #${googleAnalyticsTemplateId}`
                        : "בחר סנריו טמפלייט ל-GA..."}
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="חפש סנריו..." />
                      <CommandList>
                        <CommandEmpty>
                          {isLoadingTemplateScenarios ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin ml-2" />
                              טוען סנריות...
                            </div>
                          ) : (
                            "לא נמצאו סנריות"
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {templateScenarios?.map((scenario) => (
                            <CommandItem
                              key={scenario.id}
                              value={`${scenario.name} ${scenario.id}`}
                              onSelect={() => {
                                setGoogleAnalyticsTemplateId(scenario.id.toString());
                                setGaTemplateSelectorOpen(false);
                              }}
                            >
                              <Check
                                className={`ml-2 h-4 w-4 ${
                                  googleAnalyticsTemplateId === scenario.id.toString() ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <div className="flex flex-col">
                                <span>{scenario.name}</span>
                                <span className="text-xs text-muted-foreground">ID: {scenario.id}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  צור Scenario ב-Make.com עם 2 מודולים: Google Analytics Report → HTTP POST, ובחר אותו מהרשימה.
                  <br />
                  המערכת תשכפל אותו אוטומטית לכל טבלת Google Analytics חדשה.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={!apiToken || !teamId || testConnectionMutation.isPending}
                  variant="outline"
                >
                  {testConnectionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 ml-2" />
                  )}
                  בדוק חיבור
                </Button>
                <Button
                  onClick={() => saveSettingsMutation.mutate()}
                  disabled={!apiToken || !teamId || saveSettingsMutation.isPending}
                >
                  {saveSettingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <Check className="h-4 w-4 ml-2" />
                  )}
                  שמור הגדרות
                </Button>
                {isConnected && (
                  <Button
                    variant="destructive"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <X className="h-4 w-4 ml-2" />
                    )}
                    נתק
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Instructions Card */}
          <Card>
            <CardHeader>
              <CardTitle>איך להשיג API Token?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>היכנס לחשבון Make.com שלך</li>
                <li>לחץ על תמונת הפרופיל בפינה הימנית העליונה</li>
                <li>בחר "Profile"</li>
                <li>עבור ללשונית "API"</li>
                <li>לחץ על "Add token" ליצירת Token חדש</li>
                <li>העתק את ה-Token והדבק כאן</li>
              </ol>
              <div className="pt-2">
                <a
                  href="https://www.make.com/en/help/apps/api-documentation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  תיעוד API של Make.com
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>חיבורים זמינים</CardTitle>
                <CardDescription>
                  כל החיבורים שהוגדרו בחשבון Make.com שלך
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchConnections()}
                disabled={isLoadingConnections}
              >
                {isLoadingConnections ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingConnections ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : connections && connections.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>סוג</TableHead>
                      <TableHead>סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connections.map((connection) => (
                      <TableRow key={connection.id}>
                        <TableCell className="font-medium">
                          {connection.name || connection.accountName || `Connection ${connection.id}`}
                        </TableCell>
                        <TableCell>{connection.typeName || connection.type || connection.accountType || "Unknown"}</TableCell>
                        <TableCell>
                          {connection.invalid ? (
                            <Badge variant="destructive">לא תקין</Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-500">תקין</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  לא נמצאו חיבורים בחשבון Make.com שלך
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scenarios Tab */}
        <TabsContent value="scenarios" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Scenarios</CardTitle>
                <CardDescription>
                  כל ה-Scenarios בחשבון Make.com שלך
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchScenarios()}
                disabled={isLoadingScenarios}
              >
                {isLoadingScenarios ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingScenarios ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : scenarios && scenarios.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>תזמון</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scenarios.map((scenario) => (
                      <TableRow key={scenario.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{scenario.name}</div>
                            {scenario.description && (
                              <div className="text-xs text-muted-foreground">{scenario.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {scenario.isPaused ? (
                            <Badge variant="secondary">מושהה</Badge>
                          ) : scenario.isActive ? (
                            <Badge variant="default" className="bg-green-500">פעיל</Badge>
                          ) : (
                            <Badge variant="outline">לא פעיל</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {scenario.scheduling?.type === "interval" 
                            ? `כל ${scenario.scheduling.interval} דקות`
                            : scenario.scheduling?.type || "ידני"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runScenarioMutation.mutate(scenario.id)}
                            disabled={runScenarioMutation.isPending}
                          >
                            {runScenarioMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            <span className="mr-1">הפעל</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  לא נמצאו Scenarios בחשבון Make.com שלך
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
