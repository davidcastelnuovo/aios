import { useState, useMemo } from "react";
import { useElementorSubmissions, ElementorSubmission } from "@/hooks/useElementorSubmissions";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface Props {
  siteId: string;
}

const SOURCE_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  google: "Google",
  facebook: "Facebook",
  organic: "אורגני",
  direct: "ישיר",
  test: "טסט",
  other: "אחר",
};

const SOURCE_COLORS: Record<string, string> = {
  google_ads: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  google: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  facebook: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  organic: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  direct: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  test: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  other: "bg-muted text-muted-foreground",
};

export function SubmissionsFullView({ siteId }: Props) {
  const qc = useQueryClient();
  const [days, setDays] = useState<number>(30);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useElementorSubmissions(siteId, days);

  const refresh = () => qc.invalidateQueries({ queryKey: ["elementor-submissions", siteId] });

  const formSubmissions: ElementorSubmission[] = useMemo(() => {
    if (!selectedFormId || !data?.submissions) return [];
    return data.submissions.filter((s) => s.form_id === selectedFormId);
  }, [selectedFormId, data]);

  const selectedFormName =
    data?.per_form?.find((f) => f.form_id === selectedFormId)?.form_name || "טופס";

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data?.error || !data?.success) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium">{data?.error || "שגיאה בטעינת Submissions"}</p>
          {data?.hint && <p className="text-xs text-muted-foreground">{data.hint}</p>}
          <Button size="sm" variant="outline" onClick={refresh} className="mt-2">
            נסה שוב
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totals = data.totals!;
  const perForm = data.per_form || [];
  const perCampaign = data.per_campaign || [];

  return (
    <div className="space-y-4" dir="rtl">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 ימים אחרונים</SelectItem>
              <SelectItem value="30">30 ימים אחרונים</SelectItem>
              <SelectItem value="90">90 ימים אחרונים</SelectItem>
              <SelectItem value="0">כל הזמן</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin me-1" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 me-1" />
          )}
          רענן
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="סה״כ Submissions" value={totals.total} tone="primary" />
        <Kpi label="Google Ads" value={totals.google_ads} tone="success" />
        <Kpi label="Facebook" value={totals.facebook} tone="info" />
        <Kpi label="טסטים" value={totals.test} tone="warning" />
      </div>

      <Tabs defaultValue="forms">
        <TabsList>
          <TabsTrigger value="forms">לפי טופס</TabsTrigger>
          <TabsTrigger value="campaigns">לפי קמפיין Google</TabsTrigger>
        </TabsList>

        <TabsContent value="forms" className="mt-3">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">טפסים ({perForm.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {perForm.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">אין נתונים בטווח הזה</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם טופס</TableHead>
                      <TableHead className="text-center">סה״כ</TableHead>
                      <TableHead className="text-center">7 ימים</TableHead>
                      <TableHead className="text-center">30 ימים</TableHead>
                      <TableHead>פילוח מקורות</TableHead>
                      <TableHead>אחרון</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perForm.map((f) => (
                      <TableRow
                        key={f.form_id || f.form_name}
                        className="cursor-pointer"
                        onClick={() => setSelectedFormId(f.form_id)}
                      >
                        <TableCell className="font-medium">{f.form_name}</TableCell>
                        <TableCell className="text-center font-bold">{f.total}</TableCell>
                        <TableCell className="text-center">{f.last_7_days}</TableCell>
                        <TableCell className="text-center">{f.last_30_days}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(f.sources)
                              .filter(([, n]) => n > 0)
                              .sort((a, b) => b[1] - a[1])
                              .map(([src, n]) => (
                                <span
                                  key={src}
                                  className={`text-xs px-2 py-0.5 rounded ${SOURCE_COLORS[src] || ""}`}
                                >
                                  {SOURCE_LABELS[src] || src} {n}
                                </span>
                              ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {f.last_submission_at
                            ? format(new Date(f.last_submission_at), "dd/MM/yyyy HH:mm", { locale: he })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-3">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">לפי קמפיין Google Ads ({perCampaign.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {perCampaign.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  לא זוהו קמפיינים — ודא ש-gad_campaignid מוזרם דרך ה-URL של עמוד הנחיתה
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign ID</TableHead>
                      <TableHead className="text-center">Submissions</TableHead>
                      <TableHead>טפסים</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perCampaign.map((c) => (
                      <TableRow key={c.gad_campaignid}>
                        <TableCell className="font-mono text-xs">{c.gad_campaignid}</TableCell>
                        <TableCell className="text-center font-bold">{c.submissions}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.forms.join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drawer with submissions detail */}
      <Sheet open={!!selectedFormId} onOpenChange={(open) => !open && setSelectedFormId(null)}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
          <SheetHeader>
            <SheetTitle>{selectedFormName} — {formSubmissions.length} Submissions</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {formSubmissions.map((s) => (
              <Card key={String(s.id)}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm" dir="ltr">
                      {s.email || "(ללא אימייל)"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${SOURCE_COLORS[s.source] || ""}`}
                    >
                      {SOURCE_LABELS[s.source] || s.source}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: he })}
                  </p>
                  {s.referer && (
                    <a
                      href={s.referer}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline break-all flex items-start gap-1"
                      dir="ltr"
                    >
                      <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{s.referer}</span>
                    </a>
                  )}
                  <div className="flex flex-wrap gap-1 text-xs">
                    {s.gclid && <Badge variant="outline">gclid</Badge>}
                    {s.gad_campaignid && (
                      <Badge variant="outline">campaign: {s.gad_campaignid}</Badge>
                    )}
                    {s.fbclid && <Badge variant="outline">fbclid</Badge>}
                    {s.utm_source && <Badge variant="outline">utm: {s.utm_source}</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "success" | "info" | "warning";
}) {
  const colorClass =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
      ? "text-green-600 dark:text-green-400"
      : tone === "info"
      ? "text-blue-600 dark:text-blue-400"
      : "text-amber-600 dark:text-amber-400";
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
