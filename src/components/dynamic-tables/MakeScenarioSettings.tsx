import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { RefreshCw, Play, ExternalLink, Clock, Save, Calendar, Link2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, subMonths, subYears, startOfDay } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { he } from "date-fns/locale";

interface MakeScenarioSettingsProps {
  table: {
    id: string;
    name: string;
    tenant_id: string;
    integration_settings: any;
  } | null;
  onSync: () => void;
  isSyncing: boolean;
}

const scheduleOptions = [
  { value: "manual", label: "ידני בלבד" },
  { value: "hourly", label: "כל שעה" },
  { value: "daily_morning", label: "כל יום ב-08:00" },
  { value: "daily_evening", label: "כל יום ב-18:00" },
  { value: "weekly", label: "כל יום ראשון ב-08:00" },
];

const dateRangeOptions = [
  { value: "last_7_days", label: "7 ימים אחרונים" },
  { value: "last_14_days", label: "14 ימים אחרונים" },
  { value: "last_30_days", label: "30 ימים אחרונים" },
  { value: "last_90_days", label: "3 חודשים אחרונים" },
  { value: "last_6_months", label: "6 חודשים אחרונים" },
  { value: "last_year", label: "שנה אחרונה" },
  { value: "custom", label: "מותאם אישית" },
];

function getDateRangeFromPreset(preset: string): { start_date: string; end_date: string } {
  const today = startOfDay(new Date());
  const endDate = format(today, "yyyy-MM-dd");
  
  switch (preset) {
    case "last_7_days":
      return { start_date: format(subDays(today, 7), "yyyy-MM-dd"), end_date: endDate };
    case "last_14_days":
      return { start_date: format(subDays(today, 14), "yyyy-MM-dd"), end_date: endDate };
    case "last_30_days":
      return { start_date: format(subDays(today, 30), "yyyy-MM-dd"), end_date: endDate };
    case "last_90_days":
      return { start_date: format(subMonths(today, 3), "yyyy-MM-dd"), end_date: endDate };
    case "last_6_months":
      return { start_date: format(subMonths(today, 6), "yyyy-MM-dd"), end_date: endDate };
    case "last_year":
      return { start_date: format(subYears(today, 1), "yyyy-MM-dd"), end_date: endDate };
    default:
      return { start_date: format(subDays(today, 30), "yyyy-MM-dd"), end_date: endDate };
  }
}

export function MakeScenarioSettings({ table, onSync, isSyncing }: MakeScenarioSettingsProps) {
  const queryClient = useQueryClient();
  const settings = table?.integration_settings || {};
  
  const [scenarioId, setScenarioId] = useState(settings.make_scenario_id || "");
  const [syncSchedule, setSyncSchedule] = useState(settings.sync_schedule || "manual");
  const [webhookUrl, setWebhookUrl] = useState(settings.make_webhook_url || "");
  const [syncDateRange, setSyncDateRange] = useState(settings.default_sync_range || "last_30_days");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenarioSearch, setScenarioSearch] = useState("");

  // Check for changes
  useEffect(() => {
    const currentScenarioId = settings.make_scenario_id || "";
    const currentSchedule = settings.sync_schedule || "manual";
    const currentWebhookUrl = settings.make_webhook_url || "";
    const currentSyncRange = settings.default_sync_range || "last_30_days";
    
    setHasChanges(
      scenarioId !== currentScenarioId || 
      syncSchedule !== currentSchedule ||
      webhookUrl !== currentWebhookUrl ||
      syncDateRange !== currentSyncRange
    );
  }, [scenarioId, syncSchedule, webhookUrl, syncDateRange, settings]);

  // Fetch Make API settings
  const { data: makeSettings } = useQuery({
    queryKey: ['make-settings', table?.tenant_id],
    queryFn: async () => {
      if (!table?.tenant_id) return null;
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', table.tenant_id)
        .eq('integration_type', 'make_api')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!table?.tenant_id,
  });

  const makeApiSettings = makeSettings?.settings as { 
    api_token?: string; 
    team_id?: string; 
    region?: string;
  } | null;

  // Fetch scenarios from Make.com
  const { data: scenarios = [], isLoading: loadingScenarios } = useQuery({
    queryKey: ['make-scenarios', table?.tenant_id],
    queryFn: async () => {
      if (!makeApiSettings?.api_token || !makeApiSettings?.team_id) return [];
      
      const { data, error } = await supabase.functions.invoke('make-api', {
        body: {
          action: 'list_scenarios',
          api_token: makeApiSettings.api_token,
          team_id: makeApiSettings.team_id,
          region: makeApiSettings.region || 'eu1',
        },
      });

      if (error || data?.error) {
        console.error('Error fetching scenarios:', error || data?.error);
        return [];
      }

      return data?.scenarios || [];
    },
    enabled: !!makeApiSettings?.api_token && !!makeApiSettings?.team_id,
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!table?.id) throw new Error('No table');
      
      const { error } = await supabase
        .from('crm_tables')
        .update({
          integration_settings: {
            ...settings,
            make_scenario_id: scenarioId || null,
            sync_schedule: syncSchedule,
            make_webhook_url: webhookUrl || null,
            default_sync_range: syncDateRange,
          },
        })
        .eq('id', table.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success('ההגדרות נשמרו בהצלחה');
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error('שגיאה בשמירת ההגדרות: ' + error.message);
    },
  });

  // Trigger webhook with date range
  const triggerWebhookMutation = useMutation({
    mutationFn: async () => {
      if (!webhookUrl) {
        throw new Error('לא הוגדר Webhook URL');
      }

      let dateRange: { start_date: string; end_date: string };
      
      if (syncDateRange === "custom" && customStartDate && customEndDate) {
        dateRange = {
          start_date: format(customStartDate, "yyyy-MM-dd"),
          end_date: format(customEndDate, "yyyy-MM-dd"),
        };
      } else {
        dateRange = getDateRangeFromPreset(syncDateRange);
      }

      console.log('Triggering webhook with date range:', dateRange);

      // Send POST request to the webhook URL
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_id: table?.id,
          start_date: dateRange.start_date,
          end_date: dateRange.end_date,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Webhook error: ${response.status} - ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('הסנכרון הופעל! הנתונים יתעדכנו בקרוב.');
      // Refetch records after a delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
        queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      }, 5000);
    },
    onError: (error: any) => {
      toast.error('שגיאה בהפעלת הסנכרון: ' + error.message);
    },
  });

  // Run scenario directly (legacy method)
  const runScenarioMutation = useMutation({
    mutationFn: async () => {
      if (!scenarioId || !makeApiSettings?.api_token) {
        throw new Error('חסרים פרטי סנריו או הגדרות Make');
      }
      
      const { data, error } = await supabase.functions.invoke('make-api', {
        body: {
          action: 'run_scenario',
          api_token: makeApiSettings.api_token,
          team_id: makeApiSettings.team_id,
          region: makeApiSettings.region || 'eu1',
          scenario_id: scenarioId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('הסנריו הורץ בהצלחה! הנתונים יתעדכנו בקרוב.');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
        queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      }, 5000);
    },
    onError: (error: any) => {
      toast.error('שגיאה בהרצת הסנריו: ' + error.message);
    },
  });

  const ourWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-google-ads-sync`;

  // Determine which sync method to use
  const canUseWebhookSync = !!webhookUrl;
  const syncLabel = canUseWebhookSync ? "סנכרן עם תאריכים" : "סנכרן עכשיו";

  return (
    <div className="space-y-4">
      {/* Connection Info */}
      <div className="bg-muted p-4 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">חיבור Make.com:</span>
          <span className="font-medium">{settings.make_connection_name || 'לא מוגדר'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Customer ID:</span>
          <span className="font-mono text-sm">{settings.customer_id || 'לא מוגדר'}</span>
        </div>
      </div>

      {/* Scenario Selection */}
      <div className="space-y-2">
        <Label>Scenario ID</Label>
        <div className="flex gap-2">
          {loadingScenarios ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              טוען סנריואים...
            </div>
          ) : scenarios.length > 0 ? (
            <Popover open={scenarioOpen} onOpenChange={setScenarioOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={scenarioOpen}
                  className="flex-1 justify-between"
                >
                  {scenarioId
                    ? scenarios.find((s: any) => String(s.id) === scenarioId)?.name || `סנריו #${scenarioId}`
                    : "בחר סנריו מ-Make.com"}
                  <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="חפש לפי שם..." 
                    value={scenarioSearch}
                    onValueChange={setScenarioSearch}
                  />
                  <CommandList>
                    <CommandEmpty>לא נמצאו סנריואים</CommandEmpty>
                    <CommandGroup>
                      {scenarios
                        .filter((scenario: any) => 
                          scenario.name.toLowerCase().includes(scenarioSearch.toLowerCase()) ||
                          String(scenario.id).includes(scenarioSearch)
                        )
                        .map((scenario: any) => (
                          <CommandItem
                            key={scenario.id}
                            value={`${scenario.name} ${scenario.id}`}
                            onSelect={() => {
                              setScenarioId(String(scenario.id));
                              setScenarioOpen(false);
                              setScenarioSearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "ml-2 h-4 w-4",
                                scenarioId === String(scenario.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {scenario.name} (#{scenario.id})
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <Input
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              placeholder="הזן את ה-Scenario ID מ-Make.com"
              className="flex-1"
            />
          )}
        </div>
      </div>

      {/* Make Webhook URL (for receiving date parameters) */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Webhook URL של הסנריו (לשליחת תאריכים)
        </Label>
        <Input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hook.eu1.make.com/..."
          className="font-mono text-xs"
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground">
          העתק את ה-Webhook URL מהסנריו ב-Make.com (מופיע ב-Custom Webhook module)
        </p>
      </div>

      {/* Sync Date Range Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          טווח תאריכים לסנכרון
        </Label>
        <Select value={syncDateRange} onValueChange={setSyncDateRange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dateRangeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {syncDateRange === "custom" && (
          <div className="flex gap-2 mt-2">
            <Popover open={showStartDatePicker} onOpenChange={setShowStartDatePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start">
                  <Calendar className="ml-2 h-4 w-4" />
                  {customStartDate ? format(customStartDate, "dd/MM/yyyy") : "מתאריך"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customStartDate}
                  onSelect={(date) => {
                    setCustomStartDate(date);
                    setShowStartDatePicker(false);
                  }}
                  locale={he}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
            
            <Popover open={showEndDatePicker} onOpenChange={setShowEndDatePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start">
                  <Calendar className="ml-2 h-4 w-4" />
                  {customEndDate ? format(customEndDate, "dd/MM/yyyy") : "עד תאריך"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customEndDate}
                  onSelect={(date) => {
                    setCustomEndDate(date);
                    setShowEndDatePicker(false);
                  }}
                  locale={he}
                  disabled={(date) => date > new Date() || (customStartDate ? date < customStartDate : false)}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Sync Schedule */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          תזמון סנכרון אוטומטי
        </Label>
        <Select value={syncSchedule} onValueChange={setSyncSchedule}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scheduleOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {syncSchedule !== "manual" && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              לתזמון אוטומטי יש להגדיר את ה-Scheduling בתוך Make.com עצמו.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Our Webhook URL Info (for Make.com to send data back) */}
      <div className="space-y-2">
        <Label>Webhook URL לקבלת נתונים (HTTP Module)</Label>
        <div className="flex gap-2">
          <Input
            value={ourWebhookUrl}
            readOnly
            className="font-mono text-xs"
            dir="ltr"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(ourWebhookUrl);
              toast.success('הכתובת הועתקה');
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          הגדר את ה-HTTP module בסנריו לשלוח POST לכתובת זו עם table_id: "{table?.id}"
        </p>
      </div>

      {/* Setup Instructions */}
      {!webhookUrl && (
        <Alert>
          <Link2 className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p className="font-medium">איך להגדיר סנכרון עם תאריכים:</p>
            <ol className="text-xs list-decimal list-inside space-y-1">
              <li>פתח את הסנריו ב-Make.com</li>
              <li>הוסף Webhook → Custom Webhook בהתחלת הסנריו</li>
              <li>העתק את ה-Webhook URL והדבק אותו למעלה</li>
              <li>ב-Google Ads module, השתמש ב-<code className="bg-muted px-1 rounded">{"{{start_date}}"}</code> ו-<code className="bg-muted px-1 rounded">{"{{end_date}}"}</code></li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {/* Sync Status */}
      {table?.integration_settings?.last_sync_at && (
        <div className="flex items-center justify-between text-sm p-3 bg-muted/50 rounded-lg">
          <span className="text-muted-foreground">סנכרון אחרון:</span>
          <span className="font-medium">
            {new Date(table.integration_settings.last_sync_at).toLocaleString('he-IL')}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between gap-2 pt-4 border-t">
        {hasChanges && (
          <Button
            variant="outline"
            onClick={() => saveSettingsMutation.mutate()}
            disabled={saveSettingsMutation.isPending}
          >
            {saveSettingsMutation.isPending ? (
              <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ml-2 h-4 w-4" />
            )}
            שמור הגדרות
          </Button>
        )}
        
        <div className="flex gap-2 mr-auto">
          {scenarioId && !webhookUrl && (
            <Button
              variant="outline"
              onClick={() => runScenarioMutation.mutate()}
              disabled={runScenarioMutation.isPending}
            >
              {runScenarioMutation.isPending ? (
                <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="ml-2 h-4 w-4" />
              )}
              הרץ סנריו
            </Button>
          )}
          
          {webhookUrl ? (
            <Button 
              onClick={() => triggerWebhookMutation.mutate()}
              disabled={triggerWebhookMutation.isPending || (syncDateRange === "custom" && (!customStartDate || !customEndDate))}
            >
              {triggerWebhookMutation.isPending ? (
                <>
                  <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                  מסנכרן...
                </>
              ) : (
                <>
                  <RefreshCw className="ml-2 h-4 w-4" />
                  {syncLabel}
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={onSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                  מסנכרן...
                </>
              ) : (
                <>
                  <RefreshCw className="ml-2 h-4 w-4" />
                  סנכרן עכשיו
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
