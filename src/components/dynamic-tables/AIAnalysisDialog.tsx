import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Download, Copy, TrendingUp, BarChart3, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

interface AnalysisResult {
  periods: EventPeriod[];
  analysis: string;
  analysisType: string;
  daysBeforeEvent: number;
}

export function AIAnalysisDialog({ tableId, tableName, campaignFilter }: AIAnalysisDialogProps) {
  const [open, setOpen] = useState(false);
  const [eventDates, setEventDates] = useState("");
  const [daysBeforeEvent, setDaysBeforeEvent] = useState("7");
  const [analysisType, setAnalysisType] = useState("comparison");
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
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      toast.success("הניתוח הושלם בהצלחה!");
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error instanceof Error ? error.message : "שגיאה בביצוע הניתוח");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    
    const text = `ניתוח AI - ${tableName}\n\n${result.analysis}`;
    navigator.clipboard.writeText(text);
    toast.success("הועתק ללוח");
  };

  const getAnalysisTypeIcon = (type: string) => {
    switch (type) {
      case 'comparison': return <BarChart3 className="h-4 w-4" />;
      case 'trends': return <TrendingUp className="h-4 w-4" />;
      case 'recommendations': return <Lightbulb className="h-4 w-4" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  const getAnalysisTypeLabel = (type: string) => {
    switch (type) {
      case 'comparison': return 'השוואה בין תקופות';
      case 'trends': return 'מגמות וטרנדים';
      case 'recommendations': return 'המלצות לשיפור';
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          ניתוח AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
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
                    מנתח נתונים...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    הפק דוח
                  </>
                )}
              </Button>
            </div>

            {/* Results Section */}
            {result && (
              <div className="space-y-4">
                {/* Period Summary Cards */}
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

                {/* AI Analysis */}
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
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
