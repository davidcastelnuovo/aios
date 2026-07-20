import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, FileSpreadsheet, Globe2, Loader2, PlugZap, Rocket, Upload } from "lucide-react";

type PublishingSite = { id: string; site_key: string; name: string; destination_type: "pbn" | "wordpress" | "custom_api"; client_id: string | null; connection_id: string | null; base_url: string | null; categories: string[]; status: string };
type WordPressSite = { id: string; site_url: string; site_name: string | null; client_id: string | null; is_active: boolean };
type PublishingArticle = { id: string; customer_name: string | null; primary_keyword: string; proposed_topic: string | null; target_url: string | null; category: string | null; status: string; site_id: string | null; live_url: string | null; updated_at: string };
type ImportRow = { customerName: string; primaryKeyword: string; topic: string; targetUrl: string; siteKey: string; category: string; sheetName: string };

const SITE_TEMPLATES = [
  { site_key: "site-01", name: "נקודת מבט", categories: ["חדשנות", "טכנולוגיה", "תעשייה חכמה", "בטיחות ומיגון", "תחבורה ושטח", "העתיד כבר כאן"] },
  { site_key: "site-02", name: "המצפן", categories: ["חדשות", "כלכלה", "חברה", "משפט וזכויות", "בריאות", "צרכנות"] },
  { site_key: "site-03", name: "מרחב עסקי", categories: ["עסקים", "כספים ופנסיה", "יזמות וזכיינות", "שיווק ודיגיטל", "קריירה והשמה", "ניהול ותפעול"] },
  { site_key: "site-04", name: "הבית הישראלי", categories: ["אדריכלות ועיצוב", "בנייה ושיפוצים", "מטבח ורחצה", "חומרים ונגרות", "מיגון ובטיחות", "תחזוקת הבית"] },
  { site_key: "site-05", name: "עכשיו בריא", categories: ["בריאות", "רפואת שיניים", "בריאות הנפש", "טיפול ושיקום", "איכות חיים", "מחקר ורפואה"] },
  { site_key: "site-06", name: "החיים עצמם", categories: ["משפחה ויחסים", "בעלי חיים", "אופנה וטיפוח", "מתנות ואירוח", "התפתחות אישית", "פנאי"] },
  { site_key: "site-07", name: "צרכנות בגובה העיניים", categories: ["צרכנות", "כסף וחיסכון", "מדריכי קנייה", "שירותים מקצועיים", "רכב וציוד", "דיגיטל"] },
  { site_key: "site-08", name: "יוצאים לדרך", categories: ["טיולים בעולם", "טיולים בישראל", "צלילה וים", "טרקים ושטח", "תרבות ופנאי", "מדריכי מטיילים"] },
  { site_key: "site-09", name: "ישראל מקצועית", categories: ["תעשייה וציוד", "ניקיון מקצועי", "מזון ואירוח", "אריזה ומיתוג", "בנייה ותשתיות", "בטיחות בעבודה"] },
  { site_key: "site-10", name: "ידע שימושי", categories: ["איך עושים", "זכויות ומשפט", "עבודה וכסף", "בית ומשפחה", "בריאות", "מדע וטכנולוגיה"] },
];

const normalize = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
const normalizeHeader = (value: unknown) => normalize(value).replace(/["'׳״]/g, "").toLowerCase();

function suggestDestination(row: Pick<ImportRow, "customerName" | "primaryKeyword" | "topic">) {
  const text = `${row.customerName} ${row.primaryKeyword} ${row.topic}`.toLowerCase();
  const includes = (...terms: string[]) => terms.some((term) => text.includes(term));
  if (includes("שיניים", "חניכיים", "רופא", "רפוא", "טיפולית", "שיקום")) return { siteKey: "site-05", category: includes("שיניים", "חניכיים") ? "רפואת שיניים" : "טיפול ושיקום" };
  if (includes("טיול", "טרק", "צלילה", "אילת", "יפן", "סין")) return { siteKey: "site-08", category: includes("צלילה") ? "צלילה וים" : "טיולים בעולם" };
  if (includes("אדריכ", "קרמיקה", "מטבח", "עץ", "ממד", "מיגונית", "מיגון חדר", "מעלית")) return { siteKey: "site-04", category: includes("מיגון", "ממד", "מיגונית") ? "מיגון ובטיחות" : "בנייה ושיפוצים" };
  if (includes("מכונת", "תעשיית", "אריז", "חד פעמי", "תאורה", "ניקוי", "כביסה")) return { siteKey: "site-09", category: includes("אריז") ? "אריזה ומיתוג" : "תעשייה וציוד" };
  if (includes("רואה חשבון", "פנסי", "זכיינ", "השמה", "שיווק", "עסק", "כספים")) return { siteKey: "site-03", category: includes("שיווק") ? "שיווק ודיגיטל" : includes("השמה") ? "קריירה והשמה" : "עסקים" };
  if (includes("כלב", "פאות", "כיסוי ראש", "מטפחת", "מתנות", "העצמה", "סטרס")) return { siteKey: "site-06", category: includes("כלב") ? "בעלי חיים" : includes("פאה", "כיסוי", "מטפחת") ? "אופנה וטיפוח" : "התפתחות אישית" };
  if (includes("עורך דין", "עו\"ד", "גישור", "חקיר", "ביטוח לאומי")) return { siteKey: "site-02", category: "משפט וזכויות" };
  if (includes("טכנולוג", "שליטה ובקרה", "בטיחות", "רכב שטח")) return { siteKey: "site-01", category: "טכנולוגיה" };
  if (includes("זהב", "קנייה", "קונה", "צרכנ")) return { siteKey: "site-07", category: "כסף וחיסכון" };
  return { siteKey: "site-10", category: "איך עושים" };
}

function readCell(record: Record<string, unknown>, aliases: string[]) {
  const entry = Object.entries(record).find(([key]) => aliases.some((alias) => normalizeHeader(key).includes(alias)));
  return normalize(entry?.[1]);
}

export function PublishingStudio({ tenantId, clientId }: { tenantId: string; clientId?: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [sheetCount, setSheetCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [testingConnections, setTestingConnections] = useState(false);
  const [connectingDomain, setConnectingDomain] = useState(false);
  // The generated Supabase types will include these tables after the migration is applied.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

  const { data: sites = [], isLoading: loadingSites } = useQuery({
    queryKey: ["publishing-sites", tenantId],
    queryFn: async () => {
      const { data, error } = await db.from("publishing_sites").select("id,site_key,name,destination_type,client_id,connection_id,base_url,categories,status").eq("tenant_id", tenantId).order("site_key");
      if (error) throw error;
      return (data ?? []) as PublishingSite[];
    },
  });

  const { data: wordpressSites = [] } = useQuery({
    queryKey: ["publishing-wordpress-sites", tenantId],
    queryFn: async () => {
      const { data, error } = await db.from("social_media_wordpress_sites").select("id,site_url,site_name,client_id,is_active").eq("tenant_id", tenantId).eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as WordPressSite[];
    },
  });

  const { data: articles = [], isLoading: loadingArticles } = useQuery({
    queryKey: ["publishing-articles", tenantId],
    queryFn: async () => {
      const { data, error } = await db.from("publishing_articles").select("id,customer_name,primary_keyword,proposed_topic,target_url,category,status,site_id,live_url,updated_at").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as PublishingArticle[];
    },
  });

  const siteByKey = useMemo(() => new Map(sites.map((site) => [site.site_key, site])), [sites]);
  const siteById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);

  const createDefaultSites = async () => {
    setBusy(true);
    try {
      const rows = SITE_TEMPLATES.map((site) => ({ ...site, tenant_id: tenantId, destination_type: "pbn", status: "draft" }));
      const { error } = await db.from("publishing_sites").upsert(rows, { onConflict: "tenant_id,site_key" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["publishing-sites", tenantId] });
      toast.success("עשרת המגזינים נוצרו במערכת");
    } catch (error: unknown) { toast.error(errorMessage(error, "יצירת האתרים נכשלה")); } finally { setBusy(false); }
  };

  const syncWordPressSites = async () => {
    if (!wordpressSites.length) return toast.error("לא נמצאו אתרי WordPress מחוברים");
    setBusy(true);
    try {
      const rows = wordpressSites.map((site) => ({
        tenant_id: tenantId,
        client_id: site.client_id ?? clientId ?? null,
        site_key: `wordpress-${site.id}`,
        name: site.site_name || new URL(site.site_url).hostname,
        destination_type: "wordpress",
        connection_id: site.id,
        base_url: site.site_url,
        categories: [],
        status: "active",
      }));
      const { error } = await db.from("publishing_sites").upsert(rows, { onConflict: "tenant_id,site_key" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["publishing-sites", tenantId] });
      toast.success(`${rows.length} אתרי WordPress נוספו כיעדי פרסום`);
    } catch (error: unknown) { toast.error(errorMessage(error, "סנכרון אתרי WordPress נכשל")); } finally { setBusy(false); }
  };

  const testDomainConnections = async () => {
    setTestingConnections(true);
    try {
      const { data, error } = await supabase.functions.invoke("domain-connections", { body: { tenant_id: tenantId, action: "test" } });
      if (error) throw error;
      if (!data?.ionos?.connected) throw new Error(`IONOS לא התחבר (HTTP ${data?.ionos?.status ?? "?"})${data?.ionos?.error ? `: ${data.ionos.error}` : ""}`);
      if (!data?.vercel?.connected || !data?.vercel?.project_access) throw new Error("Vercel מחובר אך אין גישה לפרויקט האתר");
      toast.success(data?.ionos?.paperlief_found ? "IONOS ו-Vercel מחוברים; paperlief.com זוהה" : "IONOS ו-Vercel מחוברים; paperlief.com לא נמצא באזורי ה-DNS");
    } catch (error: unknown) { toast.error(errorMessage(error, "בדיקת החיבורים נכשלה")); } finally { setTestingConnections(false); }
  };

  const connectPaperlief = async () => {
    setConnectingDomain(true);
    try {
      const { data, error } = await supabase.functions.invoke("domain-connections", { body: { tenant_id: tenantId, action: "connect" } });
      if (error) throw error;
      if (!data?.success || !data?.connected) throw new Error(data?.detail || data?.error || "חיבור הדומיין נכשל");
      toast.success("paperlief.com חובר ל-Vercel ורשומת ה-DNS עודכנה ב-IONOS");
    } catch (error: unknown) {
      let detail = errorMessage(error, "חיבור paperlief.com נכשל");
      const context = (error as { context?: Response })?.context;
      if (context) {
        try {
          const payload = await context.clone().json();
          detail = payload?.detail || payload?.error || detail;
        } catch { /* Keep the original client error. */ }
      }
      toast.error(detail);
    } finally {
      setConnectingDomain(false);
    }
  };

  const parseWorkbook = async (file: File) => {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const parsed: ImportRow[] = [];
      for (const sheetName of workbook.SheetNames) {
        const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
        for (const record of records) {
          const customerName = readCell(record, ["לקוח", "customer", "client"]);
          const primaryKeyword = readCell(record, ["ביטוי", "keyword", "anchor"]);
          const topic = readCell(record, ["נושא", "topic", "title"]);
          const targetUrl = readCell(record, ["url", "קישור", "כתובת"]);
          if (!primaryKeyword || !targetUrl) continue;
          const suggestion = suggestDestination({ customerName, primaryKeyword, topic });
          parsed.push({ customerName, primaryKeyword, topic, targetUrl, sheetName, ...suggestion });
        }
      }
      setPreviewRows(parsed); setFileName(file.name); setSheetCount(workbook.SheetNames.length);
      toast.success(`נקלטו ${parsed.length} שורות מתוך ${workbook.SheetNames.length} גיליונות`);
    } catch (error: unknown) { toast.error(errorMessage(error, "קריאת קובץ האקסל נכשלה")); } finally { setBusy(false); }
  };

  const updatePreview = (index: number, patch: Partial<ImportRow>) => setPreviewRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));

  const importRows = async () => {
    if (!previewRows.length || !sites.length) return;
    setBusy(true);
    try {
      const { data: importRecord, error: importError } = await db.from("publishing_imports").insert({ tenant_id: tenantId, file_name: fileName, sheet_count: sheetCount, row_count: previewRows.length, status: "processing" }).select("id").single();
      if (importError) throw importError;
      const payload = previewRows.map((row) => ({
        tenant_id: tenantId, import_id: importRecord.id, site_id: siteByKey.get(row.siteKey)?.id ?? null,
        customer_name: row.customerName || null, primary_keyword: row.primaryKeyword, proposed_topic: row.topic || null,
        target_url: row.targetUrl, anchor_text: row.primaryKeyword, category: row.category, status: "imported",
      }));
      const { data: inserted, error } = await db.from("publishing_articles").upsert(payload, { onConflict: "tenant_id,target_url,primary_keyword,proposed_topic", ignoreDuplicates: true }).select("id");
      if (error) throw error;
      const importedCount = inserted?.length ?? 0;
      await db.from("publishing_imports").update({ status: "completed", imported_count: importedCount, duplicate_count: previewRows.length - importedCount }).eq("id", importRecord.id);
      setPreviewRows([]); setFileName("");
      await queryClient.invalidateQueries({ queryKey: ["publishing-articles", tenantId] });
      toast.success(`${importedCount} משימות מאמר נשמרו; ${previewRows.length - importedCount} כפילויות דולגו`);
    } catch (error: unknown) { toast.error(errorMessage(error, "ייבוא המשימות נכשל")); } finally { setBusy(false); }
  };

  const updateStatus = async (article: PublishingArticle, status: string) => {
    const { error } = await db.from("publishing_articles").update({ status, updated_at: new Date().toISOString(), ...(status === "published" ? { published_at: new Date().toISOString() } : {}) }).eq("id", article.id);
    if (error) return toast.error(error.message || "עדכון הסטטוס נכשל");
    await queryClient.invalidateQueries({ queryKey: ["publishing-articles", tenantId] });
    toast.success(status === "published" ? "המאמר אושר ל-Feed הפרסום" : "הסטטוס עודכן");
  };

  return <div className="flex min-h-0 flex-1 flex-col bg-muted/10" dir="rtl">
    <div className="flex items-center gap-3 border-b bg-card/70 px-5 py-3"><Globe2 className="h-5 w-5 text-emerald-600" /><div className="flex-1"><h2 className="text-sm font-bold">ניהול PBN ומאמרים</h2><p className="text-[11px] text-muted-foreground">Excel → כתיבה ועריכה → בחירת יעד → אישור → פרסום</p></div><Badge variant="outline">{sites.length} יעדי פרסום</Badge><Badge variant="outline">{articles.length} משימות</Badge></div>
    <Tabs defaultValue="imports" className="flex min-h-0 flex-1 flex-col"><div className="border-b bg-background px-5 pt-2"><TabsList><TabsTrigger value="imports">ייבוא Excel</TabsTrigger><TabsTrigger value="articles">מאמרים ({articles.length})</TabsTrigger><TabsTrigger value="sites">אתרים ({sites.length})</TabsTrigger></TabsList></div>
      <TabsContent value="imports" className="min-h-0 flex-1 mt-0"><ScrollArea className="h-full"><div className="space-y-4 p-5">
        {!sites.some((site) => site.destination_type === "pbn") && !loadingSites && <Card className="flex items-center gap-4 border-amber-300 bg-amber-50 p-4"><Globe2 className="h-8 w-8 text-amber-600" /><div className="flex-1"><h3 className="font-bold">הוספת רשת המגזינים</h3><p className="text-xs text-muted-foreground">הפעולה יוצרת עשרה יעדי PBN במצב טיוטה. היא לא פורסת דומיינים.</p></div><Button onClick={createDefaultSites} disabled={busy}>{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}יצירת 10 מגזינים</Button></Card>}
        <Card className="p-5"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-100"><FileSpreadsheet className="h-6 w-6 text-emerald-700" /></div><div className="flex-1"><h3 className="font-bold">העלאת טבלת קישורים</h3><p className="text-xs text-muted-foreground">המערכת קוראת את כל הגיליונות ומזהה לקוח, ביטוי, נושא ו-URL.</p></div><Input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={(event) => event.target.files?.[0] && parseWorkbook(event.target.files[0])} /><Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}><Upload className="ml-2 h-4 w-4" />בחר Excel</Button></div></Card>
        {previewRows.length > 0 && <Card className="overflow-hidden"><div className="flex items-center border-b p-4"><div className="flex-1"><h3 className="font-bold">תצוגה מקדימה — {fileName}</h3><p className="text-xs text-muted-foreground">{previewRows.length} שורות · {sheetCount} גיליונות · אפשר לשנות יעד וקטגוריה לפני השמירה</p></div><Button onClick={importRows} disabled={busy || !sites.length}>{busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ml-2 h-4 w-4" />}ייבא משימות</Button></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted/50"><tr><th className="p-3 text-right">לקוח</th><th className="p-3 text-right">ביטוי</th><th className="p-3 text-right">נושא</th><th className="p-3 text-right">יעד פרסום</th><th className="p-3 text-right">קטגוריה</th></tr></thead><tbody>{previewRows.slice(0, 200).map((row, index) => { const destination = siteByKey.get(row.siteKey); const categories = destination?.categories.length ? destination.categories : SITE_TEMPLATES.find((site) => site.site_key === row.siteKey)?.categories ?? [row.category]; return <tr key={`${row.sheetName}-${index}`} className="border-t"><td className="p-3 font-medium">{row.customerName || "—"}</td><td className="p-3">{row.primaryKeyword}</td><td className="max-w-sm p-3">{row.topic || "—"}</td><td className="p-3"><Select value={row.siteKey} onValueChange={(siteKey) => { const next = siteByKey.get(siteKey); updatePreview(index, { siteKey, category: next?.categories[0] ?? row.category }); }}><SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger><SelectContent>{sites.map((site) => <SelectItem key={site.site_key} value={site.site_key}>{site.destination_type === "pbn" ? "PBN" : "לקוח"} · {site.name}</SelectItem>)}</SelectContent></Select></td><td className="p-3"><Select value={row.category} onValueChange={(category) => updatePreview(index, { category })}><SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></td></tr>})}</tbody></table>{previewRows.length > 200 && <div className="p-3 text-center text-xs text-muted-foreground">מוצגות 200 השורות הראשונות מתוך {previewRows.length}</div>}</div></Card>}
      </div></ScrollArea></TabsContent>
      <TabsContent value="articles" className="min-h-0 flex-1 mt-0"><ScrollArea className="h-full"><div className="p-5"><Card className="overflow-hidden">{loadingArticles ? <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin" /> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted/50"><tr><th className="p-3 text-right">לקוח</th><th className="p-3 text-right">ביטוי ונושא</th><th className="p-3 text-right">אתר</th><th className="p-3 text-right">סטטוס</th><th className="p-3 text-right">פעולה</th></tr></thead><tbody>{articles.map((article) => <tr key={article.id} className="border-t"><td className="p-3 font-medium">{article.customer_name || "מערכתי"}</td><td className="p-3"><div className="font-medium">{article.primary_keyword}</div><div className="max-w-md truncate text-muted-foreground">{article.proposed_topic}</div></td><td className="p-3">{siteById.get(article.site_id ?? "")?.name ?? "לא משויך"}<div className="text-[10px] text-muted-foreground">{article.category}</div></td><td className="p-3"><Badge variant="outline">{article.status}</Badge></td><td className="p-3"><Select value={article.status} onValueChange={(status) => updateStatus(article, status)}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent>{["imported","draft","review","approved","published","failed"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></td></tr>)}</tbody></table></div>}</Card></div></ScrollArea></TabsContent>
      <TabsContent value="sites" className="min-h-0 flex-1 mt-0"><ScrollArea className="h-full"><div className="p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold">יעדי פרסום</h3><p className="text-xs text-muted-foreground">מגזיני PBN, אתרי WordPress של לקוחות ובהמשך חיבורי API נוספים</p></div><div className="flex gap-2"><Button onClick={connectPaperlief} disabled={connectingDomain}>{connectingDomain ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Rocket className="ml-2 h-4 w-4" />}חבר paperlief.com</Button><Button variant="outline" onClick={testDomainConnections} disabled={testingConnections}>{testingConnections ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <PlugZap className="ml-2 h-4 w-4" />}בדיקת IONOS ו-Vercel</Button><Button variant="outline" onClick={syncWordPressSites} disabled={busy || !wordpressSites.length}><Globe2 className="ml-2 h-4 w-4" />סנכרון WordPress ({wordpressSites.length})</Button></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{loadingSites ? <Loader2 className="h-6 w-6 animate-spin" /> : sites.map((site) => <Card key={site.id} className="p-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100"><Globe2 className="h-5 w-5 text-emerald-700" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-bold">{site.name}</h3><Badge variant="outline">{site.destination_type === "pbn" ? "PBN" : site.destination_type === "wordpress" ? "WordPress" : "API"}</Badge><Badge variant="outline">{site.status}</Badge></div><p className="truncate text-xs text-muted-foreground">{site.base_url || site.site_key}</p></div>{site.status === "active" && <Rocket className="h-4 w-4 text-emerald-600" />}</div><div className="mt-4 flex flex-wrap gap-1">{site.categories.map((category) => <Badge key={category} variant="secondary" className="text-[10px]">{category}</Badge>)}</div></Card>)}</div></div></ScrollArea></TabsContent>
    </Tabs>
  </div>;
}
