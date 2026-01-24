import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";

interface ImportAnalyticsDialogProps {
  tenantId: string | null;
}

interface ParsedRow {
  date: string;
  sessions?: number;
  users?: number;
  pageviews?: number;
  bounceRate?: number;
  avgDuration?: number;
}

interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
}

interface TrackingConfig {
  id: string;
  client_id: string | null;
  website_domain: string | null;
}

export function ImportAnalyticsDialog({ tenantId }: ImportAnalyticsDialogProps) {
  const [open, setOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch clients for this tenant
  const clientsQuery = useQuery({
    queryKey: ["clients-import", tenantId, open],
    queryFn: async () => {
      if (!tenantId) return [] as { id: string; name: string }[];
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .match({ tenant_id: tenantId, is_active: true });
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!tenantId && open,
  });
  const clients = clientsQuery.data ?? [];

  // Fetch tracking configs
  const trackingConfigsQuery = useQuery({
    queryKey: ["tracking_configs_import", tenantId, open],
    queryFn: async () => {
      if (!tenantId) return [] as TrackingConfig[];
      const { data } = await supabase
        .from("site_tracking_configs")
        .select("id, client_id, website_domain")
        .match({ tenant_id: tenantId, is_active: true });
      return (data ?? []) as TrackingConfig[];
    },
    enabled: !!tenantId && open,
  });
  const trackingConfigs = trackingConfigsQuery.data ?? [];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: ParsedRow[] = [];
        
        results.data.forEach((row: Record<string, string>) => {
          // Try to find date column (flexible mapping)
          const dateKey = Object.keys(row).find(k => 
            k.toLowerCase().includes("date") || 
            k.toLowerCase().includes("תאריך") ||
            k.toLowerCase() === "day"
          );
          
          const sessionsKey = Object.keys(row).find(k => 
            k.toLowerCase().includes("session") || k.toLowerCase().includes("ביקורים")
          );
          
          const usersKey = Object.keys(row).find(k => 
            k.toLowerCase().includes("user") || k.toLowerCase().includes("משתמשים")
          );
          
          const pageviewsKey = Object.keys(row).find(k => 
            k.toLowerCase().includes("pageview") || k.toLowerCase().includes("צפיות")
          );
          
          const bounceKey = Object.keys(row).find(k => 
            k.toLowerCase().includes("bounce") || k.toLowerCase().includes("נטישה")
          );
          
          const durationKey = Object.keys(row).find(k => 
            k.toLowerCase().includes("duration") || k.toLowerCase().includes("זמן")
          );

          if (dateKey && row[dateKey]) {
            rows.push({
              date: row[dateKey],
              sessions: sessionsKey ? parseInt(row[sessionsKey]) || 0 : undefined,
              users: usersKey ? parseInt(row[usersKey]) || 0 : undefined,
              pageviews: pageviewsKey ? parseInt(row[pageviewsKey]) || 0 : undefined,
              bounceRate: bounceKey ? parseFloat(row[bounceKey]) || 0 : undefined,
              avgDuration: durationKey ? parseDuration(row[durationKey]) : undefined,
            });
          }
        });

        setParsedData(rows);
      },
      error: (error) => {
        toast.error("שגיאה בקריאת הקובץ: " + error.message);
      }
    });
  };

  const parseDuration = (duration: string): number => {
    // Parse duration like "02:30" or "2m 30s" to seconds
    if (!duration) return 0;
    
    const colonMatch = duration.match(/(\d+):(\d+)/);
    if (colonMatch) {
      return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
    }
    
    const minsMatch = duration.match(/(\d+)\s*m/i);
    const secsMatch = duration.match(/(\d+)\s*s/i);
    
    let seconds = 0;
    if (minsMatch) seconds += parseInt(minsMatch[1]) * 60;
    if (secsMatch) seconds += parseInt(secsMatch[1]);
    
    return seconds;
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || parsedData.length === 0) {
        throw new Error("Missing data");
      }

      // Find or create tracking config
      let trackingConfigId = trackingConfigs.find((tc: TrackingConfig) => tc.client_id === selectedClientId)?.id;
      
      if (!trackingConfigId && selectedClientId) {
        // Create a new tracking config for this client
        const { data: newConfig, error } = await supabase
          .from("site_tracking_configs")
          .insert({
            tenant_id: tenantId,
            client_id: selectedClientId,
            website_domain: "imported.data"
          })
          .select("id")
          .single();
        
        if (error) throw error;
        trackingConfigId = newConfig.id;
      }

      if (!trackingConfigId) {
        throw new Error("No tracking configuration found");
      }

      const errors: string[] = [];
      let imported = 0;

      for (const row of parsedData) {
        try {
          // Parse the date
          let parsedDate: Date;
          const dateFormats = [
            /(\d{4})-(\d{2})-(\d{2})/, // 2024-01-01
            /(\d{2})\/(\d{2})\/(\d{4})/, // 01/01/2024
            /(\d{2})\/(\d{2})\/(\d{2})/, // 01/01/24
          ];
          
          let matched = false;
          for (const fmt of dateFormats) {
            const match = row.date.match(fmt);
            if (match) {
              if (fmt === dateFormats[0]) {
                parsedDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
              } else if (fmt === dateFormats[1]) {
                parsedDate = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
              } else {
                const year = parseInt(match[3]) + 2000;
                parsedDate = new Date(year, parseInt(match[2]) - 1, parseInt(match[1]));
              }
              matched = true;
              break;
            }
          }

          if (!matched) {
            errors.push(`Invalid date format: ${row.date}`);
            continue;
          }

          // Create synthetic sessions for this day
          const sessionsToCreate = row.sessions || 1;
          const avgDuration = row.avgDuration || 120;
          const avgPages = row.pageviews ? Math.ceil(row.pageviews / sessionsToCreate) : 2;
          const bounceCount = row.bounceRate ? Math.round(sessionsToCreate * (row.bounceRate / 100)) : 0;

          // Create sessions
          for (let i = 0; i < sessionsToCreate; i++) {
            const sessionTime = new Date(parsedDate);
            sessionTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
            
            const isBounce = i < bounceCount;

            const { error: sessionError } = await supabase
              .from("site_sessions")
              .insert({
                tenant_id: tenantId,
                tracking_config_id: trackingConfigId,
                visitor_id: `imported_${row.date}_${i}`,
                started_at: sessionTime.toISOString(),
                duration_seconds: isBounce ? Math.floor(Math.random() * 10) : avgDuration + Math.floor(Math.random() * 60 - 30),
                page_count: isBounce ? 1 : avgPages,
                is_bounce: isBounce,
                utm_source: "imported",
                device_type: "desktop",
                browser: "imported"
              });

            if (sessionError) {
              errors.push(`Session error for ${row.date}: ${sessionError.message}`);
            } else {
              imported++;
            }
          }
        } catch (err) {
          errors.push(`Error processing ${row.date}: ${(err as Error).message}`);
        }
      }

      return { success: errors.length === 0, imported, errors };
    },
    onSuccess: (result) => {
      setImportResult(result);
      if (result.success) {
        toast.success(`יובאו ${result.imported} רשומות בהצלחה!`);
        queryClient.invalidateQueries({ queryKey: ["analytics_sessions"] });
      } else {
        toast.warning(`יובאו ${result.imported} רשומות עם ${result.errors.length} שגיאות`);
      }
    },
    onError: (error) => {
      toast.error("שגיאה בייבוא: " + error.message);
    }
  });

  const handleImport = async () => {
    setIsImporting(true);
    try {
      await importMutation.mutateAsync();
    } finally {
      setIsImporting(false);
    }
  };

  const resetDialog = () => {
    setParsedData([]);
    setSelectedClientId("");
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          ייבוא מ-GA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            ייבוא נתונים מ-Google Analytics
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload */}
          <div className="space-y-2">
            <Label>בחר קובץ CSV</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-muted-foreground
                file:me-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90
                cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              ייצא נתונים מ-Google Analytics כ-CSV והעלה כאן
            </p>
          </div>

          {/* Client selection */}
          {clients.length > 0 && (
            <div className="space-y-2">
              <Label>שייך ללקוח (אופציונלי)</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>תצוגה מקדימה</Label>
                <Badge variant="secondary">{parsedData.length} שורות</Badge>
              </div>
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-center">סשנים</TableHead>
                      <TableHead className="text-center">משתמשים</TableHead>
                      <TableHead className="text-center">צפיות</TableHead>
                      <TableHead className="text-center">נטישה %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 10).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell className="text-center">{row.sessions ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.users ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.pageviews ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.bounceRate ? `${row.bounceRate}%` : "-"}</TableCell>
                      </TableRow>
                    ))}
                    {parsedData.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          ... ועוד {parsedData.length - 10} שורות
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className={`p-4 rounded-lg ${importResult.success ? "bg-accent" : "bg-muted"}`}>
              <div className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="font-medium">
                  יובאו {importResult.imported} רשומות
                </span>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>שגיאות:</p>
                  <ul className="list-disc list-inside max-h-24 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>... ועוד {importResult.errors.length - 5} שגיאות</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              סגור
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={parsedData.length === 0 || isImporting}
            >
              {isImporting ? "מייבא..." : `ייבא ${parsedData.length} רשומות`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
