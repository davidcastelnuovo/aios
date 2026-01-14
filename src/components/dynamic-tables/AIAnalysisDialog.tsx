import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Copy, TrendingUp, BarChart3, Lightbulb, Table as TableIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AIAnalysisDialogProps {
  tableId: string;
  tableName: string;
  campaignFilter?: string;
}

interface EventPeriod {
  eventDate: string;
  startDate: string;
  endDate: string;
  metrics: {
    totalSpend: number;
    totalLeads: number;
    avgCostPerLead: number;
    avgCtr: number;
    avgCpm: number;
    totalClicks: number;
    totalImpressions: number;
    campaigns: string[];
  };
}

interface CampaignPeriodData {
  campaignName: string;
  eventDate: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  costPerLead: number;
  lpViews: number;
  lpConversionRate: number;
  spend: number;
}

interface AnalysisResult {
  periods: EventPeriod[];
  analysis?: string;
  campaignData?: CampaignPeriodData[];
  analysisType: string;
  daysBeforeEvent: number;
}

export function AIAnalysisDialog({ tableId, tableName, campaignFilter }: AIAnalysisDialogProps) {
  const [open, setOpen] = useState(false);
  const [eventDates, setEventDates] = useState("");
  const [daysBeforeEvent, setDaysBeforeEvent] = useState("7");
  const [analysisType, setAnalysisType] = useState("comparison");
  const [customInstructions, setCustomInstructions] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!eventDates.trim()) {
      toast.error("יש להזין תאריכי אירועים");
      return;
    }

    const dates = eventDates.split(/[,،\/\s]+/).map(d => d.trim()).filter(Boolean);
    if (dates.length === 0) {
      toast.error("לא זוהו תאריכים תקינים");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-campaign-data', {
        body: {
          tableId,
          eventDates: dates,
          daysBeforeEvent: parseInt(daysBeforeEvent),
          campaignFilter: campaignFilter || undefined,
          analysisType,
          customInstructions: customInstructions.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      toast.success(analysisType === 'raw_table' ? "הטבלה הופקה בהצלחה!" : "הניתוח הושלם בהצלחה!");
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error instanceof Error ? error.message : "שגיאה בביצוע הניתוח");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    
    if (result.analysisType === 'raw_table' && result.campaignData) {
      // Copy table as TSV for Excel compatibility
      const headers = ['קמפיין', 'תקופה', 'חשיפות', 'קליקים', 'CTR %', 'CPC ₪', 'CPM ₪', 'לידים', 'עלות לליד ₪', 'צפיות LP', 'המרה LP %', 'הוצאה ₪'];
      const rows = result.campaignData.map(row => [
        row.campaignName,
        row.eventDate,
        row.impressions,
        row.clicks,
        row.ctr,
        row.cpc,
        row.cpm,
        row.leads,
        row.costPerLead,
        row.lpViews,
        row.lpConversionRate,
        row.spend
      ].join('\t'));
      
      const text = [headers.join('\t'), ...rows].join('\n');
      navigator.clipboard.writeText(text);
      toast.success("הטבלה הועתקה (ניתן להדביק באקסל)");
    } else {
      const text = `ניתוח AI - ${tableName}\n\n${result.analysis}`;
      navigator.clipboard.writeText(text);
      toast.success("הועתק ללוח");
    }
  };

  const getAnalysisTypeIcon = (type: string) => {
    switch (type) {
      case 'comparison': return <BarChart3 className="h-4 w-4" />;
      case 'trends': return <TrendingUp className="h-4 w-4" />;
      case 'recommendations': return <Lightbulb className="h-4 w-4" />;
      case 'raw_table': return <TableIcon className="h-4 w-4" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  const getAnalysisTypeLabel = (type: string) => {
    switch (type) {
      case 'comparison': return 'השוואה בין תקופות';
      case 'trends': return 'מגמות וטרנדים';
      case 'recommendations': return 'המלצות לשיפור';
      case 'raw_table': return 'טבלת נתונים גולמיים';
      default: return type;
    }
  };

  // Group campaign data by event date for better display
  const groupedCampaignData = result?.campaignData?.reduce((acc, item) => {
    if (!acc[item.eventDate]) {
      acc[item.eventDate] = [];
    }
    acc[item.eventDate].push(item);
    return acc;
  }, {} as Record<string, CampaignPeriodData[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          ניתוח AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            ניתוח AI של הקמפיינים
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 pr-4">
            {/* Input Section */}
            <div className="grid gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label>תאריכי אירועים (וובינרים, השקות וכו')</Label>
                <Input
                  placeholder="לדוגמה: 6.1, 23.12, 9.12, 23.11, 9.11"
                  value={eventDates}
                  onChange={(e) => setEventDates(e.target.value)}
                  dir="ltr"
                  className="text-left"
                />
                <p className="text-xs text-muted-foreground">
                  הזן תאריכים בפורמט יום.חודש, מופרדים בפסיק
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ימים לפני האירוע</Label>
                  <Select value={daysBeforeEvent} onValueChange={setDaysBeforeEvent}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 ימים</SelectItem>
                      <SelectItem value="7">7 ימים</SelectItem>
                      <SelectItem value="14">14 ימים</SelectItem>
                      <SelectItem value="30">30 ימים</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>סוג ניתוח</Label>
                  <Select value={analysisType} onValueChange={setAnalysisType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw_table">
                        <div className="flex items-center gap-2">
                          <TableIcon className="h-4 w-4" />
                          טבלת נתונים (ללא ניתוח)
                        </div>
                      </SelectItem>
                      <SelectItem value="comparison">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          השוואה בין תקופות
                        </div>
                      </SelectItem>
                      <SelectItem value="trends">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          מגמות וטרנדים
                        </div>
                      </SelectItem>
                      <SelectItem value="recommendations">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="h-4 w-4" />
                          המלצות לשיפור
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {analysisType !== 'raw_table' && (
                <div className="space-y-2">
                  <Label>הנחיות נוספות (אופציונלי)</Label>
                  <Textarea
                    placeholder="לדוגמה: התמקד בהשוואת עלות לליד, שים לב שהוובינר ב-23.12 היה על נושא אחר, תן דגש על המלצות תקציב..."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    הוסף הנחיות ספציפיות לניתוח - שאלות, נקודות להתמקד בהן, או הקשר נוסף
                  </p>
                </div>
              )}

              {campaignFilter && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>סינון פעיל:</span>
                  <Badge variant="secondary">{campaignFilter}</Badge>
                </div>
              )}

              <Button onClick={handleAnalyze} disabled={isLoading} className="w-full gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {analysisType === 'raw_table' ? 'מייצר טבלה...' : 'מנתח נתונים...'}
                  </>
                ) : (
                  <>
                    {analysisType === 'raw_table' ? <TableIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    {analysisType === 'raw_table' ? 'הפק טבלה' : 'הפק דוח'}
                  </>
                )}
              </Button>
            </div>

            {/* Results Section */}
            {result && (
              <div className="space-y-4">
                {/* Period Summary Cards - show for AI analysis types */}
                {result.analysisType !== 'raw_table' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {result.periods.map((period) => (
                      <Card key={period.eventDate} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">📅 {period.eventDate}</span>
                          <Badge variant="outline" className="text-xs">
                            {period.metrics.totalLeads} לידים
                          </Badge>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">הוצאה:</span>
                            <span className="font-medium">₪{period.metrics.totalSpend.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">עלות לליד:</span>
                            <span className="font-medium">₪{period.metrics.avgCostPerLead}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">CTR:</span>
                            <span className="font-medium">{period.metrics.avgCtr}%</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Raw Table Display */}
                {result.analysisType === 'raw_table' && result.campaignData && (
                  <Card>
                    <CardHeader className="pb-2 flex-shrink-0">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TableIcon className="h-4 w-4" />
                          טבלת נתונים גולמיים
                        </div>
                        <Button variant="ghost" size="sm" onClick={copyToClipboard} className="gap-2">
                          <Copy className="h-4 w-4" />
                          העתק לאקסל
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right min-w-[200px]">קמפיין</TableHead>
                              <TableHead className="text-center">תקופה</TableHead>
                              <TableHead className="text-center">חשיפות</TableHead>
                              <TableHead className="text-center">קליקים</TableHead>
                              <TableHead className="text-center">CTR</TableHead>
                              <TableHead className="text-center">CPC</TableHead>
                              <TableHead className="text-center">CPM</TableHead>
                              <TableHead className="text-center">לידים</TableHead>
                              <TableHead className="text-center">עלות לליד</TableHead>
                              <TableHead className="text-center">צפיות LP</TableHead>
                              <TableHead className="text-center">המרה LP</TableHead>
                              <TableHead className="text-center">הוצאה</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.campaignData.map((row, index) => (
                              <TableRow key={`${row.campaignName}-${row.eventDate}-${index}`}>
                                <TableCell className="font-medium text-right">{row.campaignName}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline">{row.eventDate}</Badge>
                                </TableCell>
                                <TableCell className="text-center">{row.impressions.toLocaleString()}</TableCell>
                                <TableCell className="text-center">{row.clicks.toLocaleString()}</TableCell>
                                <TableCell className="text-center">{row.ctr}%</TableCell>
                                <TableCell className="text-center">₪{row.cpc}</TableCell>
                                <TableCell className="text-center">₪{row.cpm}</TableCell>
                                <TableCell className="text-center font-medium">{row.leads}</TableCell>
                                <TableCell className="text-center font-medium">₪{row.costPerLead}</TableCell>
                                <TableCell className="text-center">{row.lpViews || '-'}</TableCell>
                                <TableCell className="text-center">{row.lpConversionRate ? `${row.lpConversionRate}%` : '-'}</TableCell>
                                <TableCell className="text-center font-medium">₪{row.spend.toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      
                      {/* Summary row per period */}
                      {groupedCampaignData && Object.keys(groupedCampaignData).length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="text-sm font-medium mb-2">סיכום לפי תקופה:</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                            {Object.entries(groupedCampaignData).map(([eventDate, campaigns]) => {
                              const totals = campaigns.reduce((acc, c) => ({
                                impressions: acc.impressions + c.impressions,
                                clicks: acc.clicks + c.clicks,
                                leads: acc.leads + c.leads,
                                spend: acc.spend + c.spend,
                              }), { impressions: 0, clicks: 0, leads: 0, spend: 0 });
                              
                              return (
                                <Card key={eventDate} className="p-3 bg-muted/30">
                                  <div className="text-sm font-medium mb-1">📅 {eventDate}</div>
                                  <div className="space-y-0.5 text-xs">
                                    <div>חשיפות: {totals.impressions.toLocaleString()}</div>
                                    <div>לידים: {totals.leads}</div>
                                    <div>הוצאה: ₪{totals.spend.toLocaleString()}</div>
                                    <div>עלות לליד: ₪{totals.leads > 0 ? Math.round(totals.spend / totals.leads) : 0}</div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* AI Analysis */}
                {result.analysis && result.analysisType !== 'raw_table' && (
                  <Card className="flex flex-col">
                    <CardHeader className="pb-2 flex-shrink-0">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getAnalysisTypeIcon(result.analysisType)}
                          {getAnalysisTypeLabel(result.analysisType)}
                        </div>
                        <Button variant="ghost" size="icon" onClick={copyToClipboard}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0">
                      <ScrollArea className="h-[300px]">
                        <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm leading-relaxed pr-4">
                          {result.analysis}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
