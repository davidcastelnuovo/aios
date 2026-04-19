import { useElementorSubmissions } from "@/hooks/useElementorSubmissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, FileText, ArrowLeft, AlertCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";

interface Props {
  siteId: string;
  siteName?: string;
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

export function SubmissionsSummaryCard({ siteId, siteName }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useElementorSubmissions(siteId);

  const refresh = () => qc.invalidateQueries({ queryKey: ["elementor-submissions", siteId] });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (data?.error || !data?.success) {
    return (
      <Card>
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Submissions בעמודי נחיתה
          </CardTitle>
          <Button size="sm" variant="outline" onClick={refresh} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </CardHeader>
        <CardContent className="py-6 text-center space-y-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">
            {data?.hint || data?.error || "לא ניתן לשלוף Submissions מהאתר"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const totals = data.totals!;
  const perForm = data.per_form || [];

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Submissions בעמודי נחיתה
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={refresh} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin me-1" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 me-1" />
            )}
            רענן
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to={`/t/${tenantSlug}/landing-page-submissions?site=${siteId}`}>
              דף מלא
              <ArrowLeft className="h-3.5 w-3.5 ms-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="סה״כ Submissions" value={totals.total} tone="primary" />
          <Kpi label="מ-Google Ads" value={totals.google_ads} tone="success" />
          <Kpi label="טסטים שזוהו" value={totals.test} tone="muted" />
        </div>

        {/* Forms table */}
        {perForm.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">אין Submissions עדיין</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>טופס</TableHead>
                <TableHead className="text-center">7 ימים</TableHead>
                <TableHead className="text-center">30 ימים</TableHead>
                <TableHead>מקור עיקרי</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perForm.slice(0, 5).map((f) => {
                const topSource = Object.entries(f.sources)
                  .sort((a, b) => b[1] - a[1])
                  .find(([, n]) => n > 0);
                return (
                  <TableRow key={f.form_id || f.form_name}>
                    <TableCell className="font-medium text-sm">{f.form_name}</TableCell>
                    <TableCell className="text-center">{f.last_7_days}</TableCell>
                    <TableCell className="text-center">{f.last_30_days}</TableCell>
                    <TableCell>
                      {topSource ? (
                        <Badge variant="secondary" className="text-xs">
                          {SOURCE_LABELS[topSource[0]] || topSource[0]} ({topSource[1]})
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {perForm.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">
            מציג 5 מתוך {perForm.length} טפסים — פתח דף מלא לצפייה בכולם
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: "primary" | "success" | "muted" }) {
  const colorClass =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
      ? "text-green-600 dark:text-green-400"
      : "text-muted-foreground";
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
