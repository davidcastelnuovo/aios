import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, FileSpreadsheet, Globe2, Loader2, Pencil, Plus, Rocket, Save, Sparkles, Upload } from "lucide-react";

type PublishingSite = { id: string; site_key: string; name: string; destination_type: "pbn" | "wordpress" | "custom_api"; client_id: string | null; connection_id: string | null; base_url: string | null; categories: string[]; status: string; is_hidden: boolean };
type WordPressSite = { id: string; site_url: string; site_name: string | null; client_id: string | null; is_active: boolean };
type PublishingArticle = { id: string; client_id: string | null; customer_name: string | null; primary_keyword: string; proposed_topic: string | null; target_url: string | null; anchor_text: string | null; category: string | null; status: string; site_id: string | null; slug: string | null; live_url: string | null; published_at: string | null; source_month: string | null; source_sheet: string | null; source_row: number | null; title: string | null; excerpt: string | null; content: string[]; updated_at: string };
type ImportRow = { customerName: string; primaryKeyword: string; topic: string; targetUrl: string; siteKey: string; category: string; sheetName: string; rowNumber: number; sourceMonth: string; errors: string[] };
type ClientOption = { id: string; name: string };
type VercelProject = { id: string; name: string; framework: string | null; updated_at?: number; domains: Array<{ name: string; verified: boolean }>; deployment: { id: string; url: string; state: string; created_at: number } | null };

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
const normalizeClientName = (value: unknown) => normalize(value).replace(/["'׳״.,()-]/g, "").toLowerCase();

function sourceMonthFromSheet(sheetName: string) {
  const match = sheetName.match(/חודש\s*0?([1-9]|1[0-2])/);
  if (!match) return "";
  const month = Number(match[1]);
  const year = new Date().getFullYear();
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function formatSourceMonth(value: string | null) {
  if (!value) return "ללא תאריך";
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

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

function isValidHttpUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
}

function createArticleSlug(title: string, articleId: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/['"׳״]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return `${normalized || "article"}-${articleId.slice(0, 8)}`;
}

function articleLiveUrl(site: PublishingSite | undefined, slug: string) {
  const baseUrl = site?.base_url?.replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}/articles/${encodeURIComponent(slug)}` : null;
}

export function PublishingStudio({ tenantId, clientId }: { tenantId: string; clientId?: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const correlationSynced = useRef(false);
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [sheetCount, setSheetCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [testingConnections, setTestingConnections] = useState(false);
  const [connectingDomain, setConnectingDomain] = useState(false);
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<VercelProject | null>(null);
  const [newSiteName, setNewSiteName] = useState("");
  const [domainName, setDomainName] = useState("");
  const [editingArticle, setEditingArticle] = useState<PublishingArticle | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorExcerpt, setEditorExcerpt] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [savingArticle, setSavingArticle] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [generatingArticleIds, setGeneratingArticleIds] = useState<string[]>([]);
  const [publishingSelected, setPublishingSelected] = useState(false);
  const [networkProgress, setNetworkProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  // The generated Supabase types will include these tables after the migration is applied.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

  const { data: sites = [], isLoading: loadingSites } = useQuery({
    queryKey: ["publishing-sites", tenantId],
    queryFn: async () => {
      const { data, error } = await db.from("publishing_sites").select("id,site_key,name,destination_type,client_id,connection_id,base_url,categories,status,is_hidden").eq("tenant_id", tenantId).order("site_key");
      if (error) throw error;
      return (data ?? []) as PublishingSite[];
    },
  });

  const { data: vercelProjects = [], isLoading: loadingVercel, refetch: refetchVercel } = useQuery({
    queryKey: ["vercel-publishing-projects", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("domain-connections", { body: { tenant_id: tenantId, action: "list_projects" } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.detail || data?.error || "טעינת האתרים נכשלה");
      return (data.projects ?? []) as VercelProject[];
    },
    refetchInterval: 15000,
  });

  const { data: wordpressSites = [] } = useQuery({
    queryKey: ["publishing-wordpress-sites", tenantId],
    queryFn: async () => {
      const { data, error } = await db.from("social_media_wordpress_sites").select("id,site_url,site_name,client_id,is_active").eq("tenant_id", tenantId).eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as WordPressSite[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["publishing-clients", tenantId],
    queryFn: async () => {
      const { data, error } = await db.from("clients").select("id,name").eq("tenant_id", tenantId).order("name");
      if (error) throw error;
      return (data ?? []) as ClientOption[];
    },
  });

  const { data: articles = [], isLoading: loadingArticles } = useQuery({
    queryKey: ["publishing-articles", tenantId],
    queryFn: async () => {
      const { data, error } = await db.from("publishing_articles").select("id,client_id,customer_name,primary_keyword,proposed_topic,target_url,anchor_text,category,status,site_id,slug,live_url,published_at,source_month,source_sheet,source_row,title,excerpt,content,updated_at").eq("tenant_id", tenantId).order("source_month", { ascending: false, nullsFirst: false }).order("customer_name").limit(500);
      if (error) throw error;
      return (data ?? []) as PublishingArticle[];
    },
  });

  const siteByKey = useMemo(() => new Map(sites.map((site) => [site.site_key, site])), [sites]);
  const siteById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);
  const clientByName = useMemo(() => new Map(clients.map((client) => [normalizeClientName(client.name), client])), [clients]);
  const correlatedSites = useMemo(() => vercelProjects.map((project) => {
    const numberedKey = project.name.match(/site-(\d+)$/i)?.[0]?.toLowerCase();
    const domainNames = project.domains.map((domain) => domain.name.toLowerCase());
    const site = sites.find((candidate) => candidate.connection_id === project.id || (!!numberedKey && candidate.site_key === numberedKey) || (!!candidate.base_url && domainNames.includes(candidate.base_url.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase())));
    const primaryDomain = project.domains.find((domain) => domain.verified)?.name ?? project.domains[0]?.name ?? null;
    return { project, site, primaryDomain };
  }), [sites, vercelProjects]);
  const visiblePbnSites = useMemo(() => sites.filter((site) => site.destination_type === "pbn" && !site.is_hidden), [sites]);
  const publishedArticles = useMemo(() => articles.filter((article) => article.status === "published"), [articles]);
  const pbnRows = useMemo(() => visiblePbnSites.map((site) => {
    const project = vercelProjects.find((candidate) => candidate.id === site.connection_id || candidate.name.toLowerCase().endsWith(site.site_key.toLowerCase()));
    const primaryDomain = project?.domains.find((domain) => domain.verified)?.name ?? project?.domains[0]?.name ?? null;
    return { site, project: project ?? null, primaryDomain };
  }), [vercelProjects, visiblePbnSites]);
  const unrelatedProjects = useMemo(() => correlatedSites.filter(({ project, site }) => !site && !sites.some((candidate) => candidate.connection_id === project.id && candidate.is_hidden)), [correlatedSites, sites]);

  useEffect(() => {
    if (correlationSynced.current || !correlatedSites.length) return;
    const updates = correlatedSites.filter(({ site, project, primaryDomain }) => {
      const liveUrl = primaryDomain ? `https://${primaryDomain}` : project.deployment?.state === "READY" && project.deployment.url ? `https://${project.deployment.url}` : null;
      return site && (site.connection_id !== project.id || (!!liveUrl && site.base_url !== liveUrl) || (project.deployment?.state === "READY" && site.status !== "active"));
    });
    if (!updates.length) { correlationSynced.current = true; return; }
    correlationSynced.current = true;
    Promise.all(updates.map(({ site, project, primaryDomain }) => { const liveUrl = primaryDomain ? `https://${primaryDomain}` : project.deployment?.state === "READY" && project.deployment.url ? `https://${project.deployment.url}` : null; return db.from("publishing_sites").update({ connection_id: project.id, ...(liveUrl ? { base_url: liveUrl, status: "active" } : { status: "draft" }) }).eq("id", site.id); })).then(() => queryClient.invalidateQueries({ queryKey: ["publishing-sites", tenantId] }));
  }, [correlatedSites, db, queryClient, tenantId]);

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

  const createVercelSite = async () => {
    if (!newSiteName.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("domain-connections", { body: { tenant_id: tenantId, action: "create_site", name: newSiteName } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.detail || data?.error || "יצירת האתר נכשלה");
      await db.from("publishing_sites").upsert({ tenant_id: tenantId, site_key: `vercel-${data.project.id}`, name: data.project.name, destination_type: "pbn", connection_id: data.project.id, base_url: data.deployment?.url ? `https://${data.deployment.url}` : null, categories: SITE_TEMPLATES[0].categories, status: "active" }, { onConflict: "tenant_id,site_key" });
      setSiteDialogOpen(false); setNewSiteName("");
      await Promise.all([refetchVercel(), queryClient.invalidateQueries({ queryKey: ["publishing-sites", tenantId] })]);
      toast.success("האתר נוצר ונשלח לפריסה");
    } catch (error: unknown) { toast.error(errorMessage(error, "יצירת האתר נכשלה")); } finally { setBusy(false); }
  };

  const createMissingPbnSites = async () => {
    const missing = pbnRows.filter((row) => row.project?.deployment?.state !== "READY");
    if (!missing.length) return toast.success("כל אתרי ה-PBN כבר קיימים ב-Vercel");
    setBusy(true);
    const failed: string[] = [];
    try {
      for (let index = 0; index < missing.length; index += 1) {
        const { site } = missing[index];
        const projectName = `aios-magazine-${site.site_key}`;
        setNetworkProgress({ current: index + 1, total: missing.length, name: site.name });
        try {
          const { data, error } = await supabase.functions.invoke("domain-connections", { body: { tenant_id: tenantId, action: "create_site", name: projectName } });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.detail || data?.error || "יצירת האתר נכשלה");
          const { error: updateError } = await db.from("publishing_sites").update({ connection_id: data.project.id, base_url: null, status: "draft" }).eq("id", site.id);
          if (updateError) throw updateError;
        } catch { failed.push(site.name); }
      }
      correlationSynced.current = false;
      await Promise.all([refetchVercel(), queryClient.invalidateQueries({ queryKey: ["publishing-sites", tenantId] })]);
      if (failed.length) toast.error(`${failed.length} אתרים לא נוצרו: ${failed.join(", ")}`);
      else { toast.success(`${missing.length} אתרים נוצרו ב-Vercel ונקשרו ל-AIOS`); setSiteDialogOpen(false); }
    } finally { setBusy(false); setNetworkProgress(null); }
  };

  const refreshPbnDesign = async () => {
    if (!pbnRows.length) return;
    setBusy(true);
    const failed: string[] = [];
    try {
      for (let index = 0; index < pbnRows.length; index += 1) {
        const { site, project } = pbnRows[index];
        const projectName = project?.name || `aios-magazine-${site.site_key}`;
        setNetworkProgress({ current: index + 1, total: pbnRows.length, name: site.name });
        try {
          const { data, error } = await supabase.functions.invoke("domain-connections", {
            body: { tenant_id: tenantId, action: "create_site", name: projectName },
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.detail || data?.error || "שדרוג האתר נכשל");
        } catch {
          failed.push(site.name);
        }
      }
      await refetchVercel();
      if (failed.length) toast.error(`${failed.length} אתרים לא שודרגו: ${failed.join(", ")}`);
      else {
        toast.success("העיצוב החדש נפרס בכל אתרי ה-PBN");
        setSiteDialogOpen(false);
      }
    } finally {
      setBusy(false);
      setNetworkProgress(null);
    }
  };

  const hideVercelProject = async (project: VercelProject, site?: PublishingSite) => {
    setBusy(true);
    try {
      if (site) {
        const { error } = await db.from("publishing_sites").update({ is_hidden: true }).eq("id", site.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("publishing_sites").upsert({ tenant_id: tenantId, site_key: `hidden-${project.id}`, name: project.name, destination_type: "custom_api", connection_id: project.id, categories: [], status: "paused", is_hidden: true }, { onConflict: "tenant_id,site_key" });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["publishing-sites", tenantId] });
      toast.success(`${project.name} הוסתר מרשימת ה-PBN`);
    } catch (error: unknown) { toast.error(errorMessage(error, "הסתרת האתר נכשלה")); } finally { setBusy(false); }
  };

  const assignDomain = async () => {
    if (!selectedProject || !domainName.trim()) return;
    setConnectingDomain(true);
    try {
      const { data, error } = await supabase.functions.invoke("domain-connections", { body: { tenant_id: tenantId, action: "connect", project_id: selectedProject.id, domain: domainName } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.detail || data?.error || "שיוך הדומיין נכשל");
      await db.from("publishing_sites").update({ base_url: `https://${data.domain}`, status: "active" }).eq("tenant_id", tenantId).eq("connection_id", selectedProject.id);
      setDomainDialogOpen(false); setDomainName("");
      await queryClient.invalidateQueries({ queryKey: ["publishing-sites", tenantId] });
      toast.success(`${data.domain} שויך לאתר`);
    } catch (error: unknown) { toast.error(errorMessage(error, "שיוך הדומיין נכשל")); } finally { setConnectingDomain(false); }
  };

  const parseWorkbook = async (file: File) => {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const parsed: ImportRow[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sourceMonth = sourceMonthFromSheet(sheetName);
        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
        const headerIndex = rows.findIndex((row) => {
          const headers = row.map(normalizeHeader);
          return headers.some((value) => value.includes("לקוח")) && headers.some((value) => value.includes("ביטוי")) && headers.some((value) => value.includes("url") || value.includes("קישור"));
        });
        if (headerIndex < 0) continue;
        const headers = rows[headerIndex].map((value) => normalize(value));
        for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
          const record = Object.fromEntries(headers.map((header, index) => [header || `column_${index}`, rows[rowIndex]?.[index] ?? ""]));
          const customerName = readCell(record, ["לקוח", "customer", "client"]);
          const primaryKeyword = readCell(record, ["ביטוי שרוצים לחזק", "ביטוי", "keyword", "anchor"]);
          const topic = readCell(record, ["נושא", "topic", "title"]);
          const targetUrl = readCell(record, ["url", "קישור", "כתובת"]);
          if (!customerName && !primaryKeyword && !topic && !targetUrl) continue;
          const errors = [!primaryKeyword && "חסר ביטוי עוגן", !targetUrl && "חסר קישור חיצוני", !!targetUrl && !isValidHttpUrl(targetUrl) && "כתובת URL לא תקינה", !sourceMonth && "לא זוהה חודש בשם הגיליון"].filter(Boolean) as string[];
          const suggestion = suggestDestination({ customerName, primaryKeyword, topic });
          parsed.push({ customerName, primaryKeyword, topic, targetUrl, sheetName, rowNumber: rowIndex + 1, sourceMonth, errors, ...suggestion });
        }
      }
      const seen = new Set<string>();
      const unique = parsed.filter((row) => { const key = `${row.targetUrl}|${row.primaryKeyword}|${row.topic}`.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
      unique.sort((a, b) => b.sourceMonth.localeCompare(a.sourceMonth));
      setPreviewRows(unique); setFileName(file.name); setSheetCount(workbook.SheetNames.length);
      const invalid = unique.filter((row) => row.errors.length).length;
      toast.success(`נקלטו ${unique.length} משימות מתוך ${workbook.SheetNames.length} גיליונות${invalid ? ` · ${invalid} דורשות תיקון` : ""}`);
    } catch (error: unknown) { toast.error(errorMessage(error, "קריאת קובץ האקסל נכשלה")); } finally { setBusy(false); }
  };

  const updatePreview = (index: number, patch: Partial<ImportRow>) => setPreviewRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));

  const importRows = async () => {
    if (!previewRows.length || !sites.length) return;
    const invalidRows = previewRows.filter((row) => row.errors.length);
    if (invalidRows.length) return toast.error(`יש ${invalidRows.length} שורות עם שדות חסרים או URL לא תקין`);
    setBusy(true);
    try {
      const { data: importRecord, error: importError } = await db.from("publishing_imports").insert({ tenant_id: tenantId, file_name: fileName, sheet_count: sheetCount, row_count: previewRows.length, status: "processing" }).select("id").single();
      if (importError) throw importError;
      const payload = previewRows.map((row) => ({
        tenant_id: tenantId, import_id: importRecord.id, site_id: siteByKey.get(row.siteKey)?.id ?? null,
        client_id: clientByName.get(normalizeClientName(row.customerName))?.id ?? null,
        customer_name: row.customerName || null, primary_keyword: row.primaryKeyword, proposed_topic: row.topic || null,
        target_url: row.targetUrl, anchor_text: row.primaryKeyword, category: row.category, status: "imported",
        source_month: row.sourceMonth, source_sheet: row.sheetName, source_row: row.rowNumber,
        row_fingerprint: `${row.sourceMonth}|${normalizeClientName(row.customerName)}|${normalize(row.primaryKeyword).toLowerCase()}|${normalize(row.targetUrl).toLowerCase()}|${normalize(row.topic).toLowerCase()}`,
      }));
      const { data: inserted, error } = await db.from("publishing_articles").upsert(payload, { onConflict: "tenant_id,target_url,primary_keyword,proposed_topic" }).select("id");
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

  const updateArticleClient = async (article: PublishingArticle, nextClientId: string) => {
    const { error } = await db.from("publishing_articles").update({ client_id: nextClientId === "none" ? null : nextClientId, updated_at: new Date().toISOString() }).eq("id", article.id);
    if (error) return toast.error(error.message || "שיוך הלקוח נכשל");
    await queryClient.invalidateQueries({ queryKey: ["publishing-articles", tenantId] });
    toast.success("שיוך הלקוח עודכן");
  };

  const openArticleEditor = (article: PublishingArticle) => {
    setEditingArticle(article);
    setEditorTitle(article.title || article.proposed_topic || "");
    setEditorExcerpt(article.excerpt || "");
    setEditorContent(Array.isArray(article.content) ? article.content.join("\n\n") : "");
  };

  const saveArticle = async () => {
    if (!editingArticle || !editorTitle.trim()) return;
    setSavingArticle(true);
    try {
      const paragraphs = editorContent.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
      const { error } = await db.from("publishing_articles").update({
        title: editorTitle.trim(),
        excerpt: editorExcerpt.trim() || null,
        content: paragraphs,
        status: paragraphs.length ? "draft" : editingArticle.status,
        updated_at: new Date().toISOString(),
      }).eq("id", editingArticle.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["publishing-articles", tenantId] });
      setEditingArticle(null);
      toast.success("המאמר נשמר");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "שמירת המאמר נכשלה"));
    } finally {
      setSavingArticle(false);
    }
  };

  const toggleArticle = (articleId: string, checked: boolean) => {
    setSelectedArticleIds((current) => checked ? [...new Set([...current, articleId])] : current.filter((id) => id !== articleId));
  };

  const generateArticles = async (articleIds: string[]) => {
    const ids = articleIds.slice(0, 10);
    if (!ids.length) return;
    setGeneratingArticleIds(ids);
    try {
      // A rich article performs two LLM passes and creates two images. Sending
      // ten articles through one Edge invocation makes the whole batch depend
      // on a single request timeout. Keep each invocation independently
      // retryable and limit concurrency so image generation is not flooded.
      const results: Array<{ generated: number; failed: number; error?: string }> = [];
      for (let index = 0; index < ids.length; index += 2) {
        const pair = ids.slice(index, index + 2);
        const pairResults = await Promise.all(pair.map(async (articleId) => {
          const { data, error } = await supabase.functions.invoke("generate-publishing-articles", {
            body: { article_ids: [articleId] },
          });
          if (error) return { generated: 0, failed: 1, error: error.message };
          if (data?.error) return { generated: 0, failed: 1, error: String(data.error) };
          return {
            generated: Number(data?.generated ?? 0),
            failed: Number(data?.failed ?? 0),
            error: data?.results?.[0]?.error ? String(data.results[0].error) : undefined,
          };
        }));
        results.push(...pairResults);
      }
      await queryClient.invalidateQueries({ queryKey: ["publishing-articles", tenantId] });
      const generated = results.reduce((total, result) => total + result.generated, 0);
      const failed = results.reduce((total, result) => total + result.failed, 0);
      const firstError = results.find((result) => result.error)?.error;
      if (failed) toast.warning(`${generated} מאמרים נכתבו, ${failed} נכשלו${firstError ? ` · ${firstError}` : ""}`);
      else toast.success(generated === 1 ? "כרמן כתבה את המאמר והוא ממתין לבדיקה" : `כרמן כתבה ${generated} מאמרים והם ממתינים לבדיקה`);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "כתיבת המאמרים נכשלה"));
    } finally {
      setGeneratingArticleIds([]);
    }
  };

  const approveAndPublishSelected = async () => {
    const selected = articles.filter((article) => selectedArticleIds.includes(article.id));
    const invalid = selected.filter((article) => !article.title || !article.content?.length || !article.site_id || !article.target_url);
    if (!selected.length) return;
    if (invalid.length) return toast.error(`${invalid.length} מאמרים חסרים תוכן, אתר או קישור יעד`);
    setPublishingSelected(true);
    try {
      const publishedAt = new Date().toISOString();
      const results = await Promise.all(selected.map((article) => {
        const slug = article.slug || createArticleSlug(article.title!, article.id);
        const liveUrl = articleLiveUrl(siteById.get(article.site_id!), slug);
        if (!liveUrl) throw new Error(`לאתר של המאמר "${article.title}" אין כתובת פעילה`);
        return db.from("publishing_articles").update({
          status: "published",
          slug,
          live_url: liveUrl,
          published_at: publishedAt,
          updated_at: publishedAt,
        }).eq("id", article.id).eq("tenant_id", tenantId);
      }));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      const checks = await Promise.all(selected.map(async (article) => {
        const slug = article.slug || createArticleSlug(article.title!, article.id);
        const liveUrl = articleLiveUrl(siteById.get(article.site_id!), slug)!;
        const response = await fetch(liveUrl, { cache: "no-store" });
        const html = await response.text();
        return response.ok && Boolean(article.target_url) && html.includes(`href="${article.target_url}"`);
      }));
      if (checks.some((check) => !check)) {
        await db.from("publishing_articles").update({
          status: "review", live_url: null, published_at: null, updated_at: new Date().toISOString(),
        }).in("id", selected.map((article) => article.id)).eq("tenant_id", tenantId);
        throw new Error("הפרסום לא אומת: לפחות עמוד אחד או קישור פנימי אחד אינו נגיש");
      }
      await queryClient.invalidateQueries({ queryKey: ["publishing-articles", tenantId] });
      setSelectedArticleIds([]);
      toast.success(`${selected.length} מאמרים פורסמו; הקישורים זמינים בלשונית "פורסמו"`);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "אישור המאמרים נכשל"));
    } finally {
      setPublishingSelected(false);
    }
  };

  return <div className="flex min-h-0 flex-1 flex-col bg-muted/10" dir="rtl">
    <div className="flex items-center gap-3 border-b bg-card/70 px-5 py-3"><Globe2 className="h-5 w-5 text-emerald-600" /><div className="flex-1"><h2 className="text-sm font-bold">ניהול PBN ומאמרים</h2><p className="text-[11px] text-muted-foreground">Excel → כתיבה ועריכה → בחירת יעד → אישור → פרסום</p></div><Badge variant="outline">{visiblePbnSites.length} אתרי PBN</Badge><Badge variant="outline">{articles.length} משימות</Badge></div>
    <div className="flex items-center gap-3 border-b bg-background px-5 py-3">
      <Pencil className="h-4 w-4 text-emerald-600" />
      <div className="min-w-48"><div className="text-xs font-bold">צפייה ועריכת מאמר</div><div className="text-[10px] text-muted-foreground">בחר מאמר כדי לפתוח את העורך המלא</div></div>
      <Select onValueChange={(articleId) => { const article = articles.find((item) => item.id === articleId); if (article) openArticleEditor(article); }}>
        <SelectTrigger className="max-w-xl flex-1"><SelectValue placeholder="בחר לקוח, חודש או נושא..." /></SelectTrigger>
        <SelectContent>{articles.map((article) => <SelectItem key={article.id} value={article.id}>{formatSourceMonth(article.source_month)} · {article.customer_name || "מערכתי"} · {article.title || article.proposed_topic || article.primary_keyword}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <Tabs defaultValue="imports" className="flex min-h-0 flex-1 flex-col"><div className="border-b bg-background px-5 pt-2"><TabsList><TabsTrigger value="imports">ייבוא Excel</TabsTrigger><TabsTrigger value="articles">מאמרים ({articles.length})</TabsTrigger><TabsTrigger value="published">פורסמו ({publishedArticles.length})</TabsTrigger><TabsTrigger value="sites">אתרים ({visiblePbnSites.length})</TabsTrigger></TabsList></div>
      <TabsContent value="imports" className="min-h-0 flex-1 mt-0"><ScrollArea className="h-full"><div className="space-y-4 p-5">
        {!sites.some((site) => site.destination_type === "pbn") && !loadingSites && <Card className="flex items-center gap-4 border-amber-300 bg-amber-50 p-4"><Globe2 className="h-8 w-8 text-amber-600" /><div className="flex-1"><h3 className="font-bold">הוספת רשת המגזינים</h3><p className="text-xs text-muted-foreground">הפעולה יוצרת עשרה יעדי PBN במצב טיוטה. היא לא פורסת דומיינים.</p></div><Button onClick={createDefaultSites} disabled={busy}>{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}יצירת 10 מגזינים</Button></Card>}
        <Card className="p-5"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-100"><FileSpreadsheet className="h-6 w-6 text-emerald-700" /></div><div className="flex-1"><h3 className="font-bold">העלאת טבלת קישורים</h3><p className="text-xs text-muted-foreground">המערכת קוראת את כל הגיליונות ומזהה לקוח, ביטוי, נושא ו-URL.</p></div><Input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={(event) => event.target.files?.[0] && parseWorkbook(event.target.files[0])} /><Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}><Upload className="ml-2 h-4 w-4" />בחר Excel</Button></div></Card>
        {previewRows.length > 0 && <Card className="overflow-hidden"><div className="flex items-center border-b p-4"><div className="flex-1"><h3 className="font-bold">תצוגה מקדימה — {fileName}</h3><p className="text-xs text-muted-foreground">{previewRows.length} שורות · {sheetCount} גיליונות · מסודר מיוני אחורה</p></div><Button onClick={importRows} disabled={busy || !sites.length || previewRows.some((row) => row.errors.length > 0)}>{busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ml-2 h-4 w-4" />}ייבא משימות</Button></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted/50"><tr><th className="p-3 text-right">חודש שיוך</th><th className="p-3 text-right">לקוח</th><th className="p-3 text-right">ביטוי עוגן וקישור חיצוני</th><th className="p-3 text-right">נושא ומקור</th><th className="p-3 text-right">יעד פרסום</th><th className="p-3 text-right">קטגוריה</th></tr></thead><tbody>{previewRows.sort((a, b) => b.sourceMonth.localeCompare(a.sourceMonth)).slice(0, 200).map((row, index) => { const destination = siteByKey.get(row.siteKey); const categories = destination?.categories.length ? destination.categories : SITE_TEMPLATES.find((site) => site.site_key === row.siteKey)?.categories ?? [row.category]; return <tr key={`${row.sheetName}-${row.rowNumber}`} className="border-t"><td className="whitespace-nowrap p-3 font-medium">{formatSourceMonth(row.sourceMonth)}</td><td className="p-3"><div className="font-medium">{row.customerName || "—"}</div><div className="text-[10px] text-muted-foreground">{clientByName.has(normalizeClientName(row.customerName)) ? "משויך ללקוח במערכת" : "דורש שיוך ללקוח"}</div></td><td className="max-w-xs p-3"><div className="font-medium">{row.primaryKeyword || "—"}</div><a className="mt-1 block truncate text-[10px] text-blue-600 hover:underline" href={row.targetUrl} target="_blank" rel="noreferrer">{row.targetUrl || "ללא קישור"}</a>{row.errors.length > 0 && <div className="mt-1 text-[10px] font-medium text-red-600">{row.errors.join(" · ")}</div>}</td><td className="max-w-sm p-3"><div>{row.topic || "—"}</div><div className="mt-1 text-[10px] text-muted-foreground">{row.sheetName} · שורה {row.rowNumber}</div></td><td className="p-3"><Select value={row.siteKey} onValueChange={(siteKey) => { const next = siteByKey.get(siteKey); updatePreview(index, { siteKey, category: next?.categories[0] ?? row.category }); }}><SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger><SelectContent>{sites.map((site) => <SelectItem key={site.site_key} value={site.site_key}>{site.destination_type === "pbn" ? "PBN" : "לקוח"} · {site.name}</SelectItem>)}</SelectContent></Select></td><td className="p-3"><Select value={row.category} onValueChange={(category) => updatePreview(index, { category })}><SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></td></tr>})}</tbody></table>{previewRows.length > 200 && <div className="p-3 text-center text-xs text-muted-foreground">מוצגות 200 השורות הראשונות מתוך {previewRows.length}</div>}</div></Card>}
      </div></ScrollArea></TabsContent>
      <TabsContent value="articles" className="min-h-0 flex-1 mt-0">
        <ScrollArea className="h-full">
          <div className="space-y-3 p-5">
            <Card className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex-1 text-xs text-muted-foreground">{selectedArticleIds.length} מאמרים נבחרו · כתיבה מרובה מוגבלת ל־10 בכל הרצה</div>
              <Button variant="outline" onClick={() => generateArticles(selectedArticleIds)} disabled={!selectedArticleIds.length || Boolean(generatingArticleIds.length)}>
                {generatingArticleIds.length ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}כתיבת נבחרים
              </Button>
              <Button onClick={approveAndPublishSelected} disabled={!selectedArticleIds.length || publishingSelected}>
                {publishingSelected ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Rocket className="ml-2 h-4 w-4" />}אשר ופרסם נבחרים
              </Button>
            </Card>
            <Card className="overflow-hidden">
              {loadingArticles ? <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin" /> : <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50"><tr>
                    <th className="p-3"><Checkbox checked={articles.length > 0 && selectedArticleIds.length === articles.length} onCheckedChange={(checked) => setSelectedArticleIds(checked ? articles.map((article) => article.id) : [])} /></th>
                    <th className="p-3 text-right">חודש שיוך</th><th className="p-3 text-right">לקוח</th><th className="p-3 text-right">ביטוי וקישור</th><th className="p-3 text-right">נושא</th><th className="p-3 text-right">אתר</th><th className="p-3 text-right">סטטוס</th><th className="p-3 text-right">פעולות</th>
                  </tr></thead>
                  <tbody>{articles.map((article) => {
                    const isGenerating = generatingArticleIds.includes(article.id);
                    return <tr key={article.id} className="border-t">
                      <td className="p-3"><Checkbox checked={selectedArticleIds.includes(article.id)} onCheckedChange={(checked) => toggleArticle(article.id, Boolean(checked))} /></td>
                      <td className="whitespace-nowrap p-3 font-medium">{formatSourceMonth(article.source_month)}</td>
                      <td className="p-3"><div className="font-medium">{article.customer_name || "מערכתי"}</div><div className={`text-[10px] ${article.client_id ? "text-emerald-700" : "text-amber-700"}`}>{article.client_id ? "משויך" : "לא משויך"}</div></td>
                      <td className="max-w-xs p-3"><div className="font-medium">{article.primary_keyword}</div>{article.target_url && <a className="block max-w-56 truncate text-[10px] text-blue-600 hover:underline" href={article.target_url} target="_blank" rel="noreferrer">{article.target_url}</a>}</td>
                      <td className="max-w-sm p-3"><div className="truncate">{article.title || article.proposed_topic}</div><div className="text-[10px] text-muted-foreground">{article.source_sheet}{article.source_row ? ` · שורה ${article.source_row}` : ""}</div></td>
                      <td className="p-3">{siteById.get(article.site_id ?? "")?.name ?? "לא משויך"}<div className="text-[10px] text-muted-foreground">{article.category}</div></td>
                      <td className="p-3"><Badge variant="outline">{article.status}</Badge></td>
                      <td className="p-3"><div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => generateArticles([article.id])} disabled={Boolean(generatingArticleIds.length)}>{isGenerating ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="ml-1 h-3.5 w-3.5" />}כתיבה</Button>
                        <Button size="sm" variant="outline" onClick={() => openArticleEditor(article)}><Pencil className="ml-1 h-3.5 w-3.5" />צפייה ועריכה</Button>
                      </div></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>}
            </Card>
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="published" className="min-h-0 flex-1 mt-0">
        <ScrollArea className="h-full">
          <div className="p-5">
            <Card className="overflow-hidden">
              {publishedArticles.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">עדיין אין מאמרים שפורסמו בפועל.</div> : <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50"><tr><th className="p-3 text-right">תאריך שיוך</th><th className="p-3 text-right">לקוח</th><th className="p-3 text-right">מאמר</th><th className="p-3 text-right">האתר שבו פורסם</th><th className="p-3 text-right">קישור המאמר</th><th className="p-3 text-right">הקישור במאמר</th></tr></thead>
                  <tbody>{publishedArticles.map((article) => {
                    const site = siteById.get(article.site_id ?? "");
                    return <tr key={article.id} className="border-t">
                      <td className="whitespace-nowrap p-3">{formatSourceMonth(article.source_month)}</td>
                      <td className="p-3 font-medium">{article.customer_name || "מערכתי"}</td>
                      <td className="max-w-sm p-3"><div className="font-medium">{article.title || article.proposed_topic}</div><div className="mt-1 text-[10px] text-muted-foreground">{article.primary_keyword}</div></td>
                      <td className="p-3"><div className="font-medium">{site?.name ?? "אתר לא ידוע"}</div><div className="max-w-52 truncate text-[10px] text-muted-foreground" dir="ltr">{site?.base_url ?? ""}</div></td>
                      <td className="p-3">{article.live_url ? <Button size="sm" variant="outline" asChild><a href={article.live_url} target="_blank" rel="noreferrer"><ExternalLink className="ml-1 h-3.5 w-3.5" />למאמר באתר</a></Button> : <Badge variant="outline" className="border-amber-300 text-amber-700">חסר קישור חי</Badge>}</td>
                      <td className="max-w-xs p-3"><div className="font-medium">{article.anchor_text || article.primary_keyword}</div>{article.target_url ? <a className="block max-w-64 truncate text-[10px] text-blue-600 hover:underline" href={article.target_url} target="_blank" rel="noreferrer">{article.target_url}</a> : "—"}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>}
            </Card>
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="sites" className="min-h-0 flex-1 mt-0"><ScrollArea className="h-full"><div className="p-5"><div className="mb-5 flex items-center justify-between"><div><h3 className="font-bold">אתרי PBN</h3><p className="text-xs text-muted-foreground">כל אתר במערכת מול פרויקט ה־Vercel, הבילד והדומיין שלו.</p></div><Button onClick={() => setSiteDialogOpen(true)}><Plus className="ml-2 h-4 w-4" />יצירת אתרים</Button></div>{loadingVercel || loadingSites ? <Loader2 className="mx-auto mt-12 h-6 w-6 animate-spin" /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-3 text-right">אתר PBN</th><th className="p-3 text-right">פרויקט Vercel</th><th className="p-3 text-right">בילד אחרון</th><th className="p-3 text-right">דומיין</th><th className="p-3 text-right">פעולות</th></tr></thead><tbody>{pbnRows.map(({ site, project, primaryDomain }) => <tr key={site.id} className="border-t"><td className="p-3"><div className="font-semibold">{site.name}</div><div className="text-[11px] text-muted-foreground">{site.site_key}</div></td><td className="p-3">{project ? <><div className="font-medium" dir="ltr">{project.name}</div><div className="text-[10px] text-muted-foreground" dir="ltr">{project.id}</div></> : <Badge variant="outline" className="border-amber-300 text-amber-700">טרם נוצר ב-Vercel</Badge>}</td><td className="p-3"><Badge variant="outline" className={project?.deployment?.state === "READY" ? "border-emerald-300 text-emerald-700" : ""}>{project ? project.deployment?.state ?? "טרם פורסם" : "—"}</Badge>{project?.deployment?.url && <div className="mt-1 max-w-52 truncate text-[10px] text-muted-foreground" dir="ltr">{project.deployment.url}</div>}</td><td className="p-3">{primaryDomain && project?.deployment?.state === "READY" ? <a href={`https://${primaryDomain}`} target="_blank" rel="noreferrer" className="font-medium text-emerald-700 hover:underline" dir="ltr">{primaryDomain}</a> : <span className="text-muted-foreground">{project?.deployment ? "ללא דומיין" : "ממתין לפרסום"}</span>}</td><td className="p-3">{project?.deployment?.state === "READY" ? <Button size="sm" variant="outline" onClick={() => { setSelectedProject(project); setDomainName(primaryDomain ?? ""); setDomainDialogOpen(true); }}>דומיין</Button> : <span className="text-xs text-muted-foreground">נדרש פרסום</span>}</td></tr>)}{unrelatedProjects.map(({ project }) => <tr key={project.id} className="border-t bg-muted/20"><td className="p-3 text-muted-foreground">לא שויך ל-PBN</td><td className="p-3 font-medium" dir="ltr">{project.name}</td><td className="p-3"><Badge variant="outline">{project.deployment?.state ?? "—"}</Badge></td><td className="p-3 text-muted-foreground">—</td><td className="p-3"><Button size="sm" variant="ghost" onClick={() => hideVercelProject(project)}>הסתר</Button></td></tr>)}</tbody></table></div></Card>}</div></ScrollArea></TabsContent>
    </Tabs>
    <Dialog open={Boolean(editingArticle)} onOpenChange={(open) => !open && setEditingArticle(null)}>
      <DialogContent dir="rtl" className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>צפייה ועריכת מאמר</DialogTitle></DialogHeader>
        {editingArticle && <div className="space-y-5">
          <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 md:grid-cols-3">
            <div><div className="text-[10px] text-muted-foreground">חודש שיוך מהאקסל</div><div className="font-semibold">{formatSourceMonth(editingArticle.source_month)}</div></div>
            <div><div className="text-[10px] text-muted-foreground">ביטוי לקידום</div><div className="font-semibold">{editingArticle.primary_keyword}</div></div>
            <div><div className="text-[10px] text-muted-foreground">אתר פרסום</div><div className="font-semibold">{siteById.get(editingArticle.site_id ?? "")?.name ?? "לא משויך"}</div></div>
            <div className="md:col-span-3"><div className="text-[10px] text-muted-foreground">עמוד יעד</div>{editingArticle.target_url ? <a href={editingArticle.target_url} target="_blank" rel="noreferrer" className="break-all text-sm text-blue-600 hover:underline">{editingArticle.target_url}</a> : <span>—</span>}</div>
          </div>
          <div><Label>שיוך ללקוח במערכת</Label><Select value={editingArticle.client_id ?? "none"} onValueChange={async (value) => { await updateArticleClient(editingArticle, value); setEditingArticle({ ...editingArticle, client_id: value === "none" ? null : value }); }}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">לא משויך</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>כותרת המאמר</Label><Input className="mt-1" value={editorTitle} onChange={(event) => setEditorTitle(event.target.value)} placeholder="כותרת המאמר" /></div>
          <div><Label>תקציר</Label><Textarea className="mt-1 min-h-24" value={editorExcerpt} onChange={(event) => setEditorExcerpt(event.target.value)} placeholder="תקציר קצר שיופיע בכרטיס המאמר" /></div>
          <div><Label>גוף המאמר</Label><Textarea className="mt-1 min-h-[360px] leading-7" value={editorContent} onChange={(event) => setEditorContent(event.target.value)} placeholder="המאמר עדיין לא נכתב. לאחר יצירת התוכן הוא יופיע כאן ויהיה ניתן לערוך אותו לפני אישור." /><div className="mt-1 text-[10px] text-muted-foreground">הפרד פסקאות באמצעות שורה ריקה. הקישור לביטוי העוגן יתווסף בפרסום.</div></div>
          <div className="flex items-center justify-between"><Badge variant="outline">{editingArticle.status}</Badge><Button onClick={saveArticle} disabled={savingArticle || !editorTitle.trim()}>{savingArticle ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}שמור מאמר</Button></div>
        </div>}
      </DialogContent>
    </Dialog>
    <Dialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen}><DialogContent dir="rtl" className="max-w-md"><DialogHeader><DialogTitle>ניהול פריסת האתרים</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="font-semibold">רשת אתרי ה־PBN</div><p className="mt-1 text-xs text-muted-foreground">אפשר להשלים אתרים חסרים או לפרוס מחדש את עיצוב המגזין בכל האתרים הקיימים.</p>{networkProgress && <div className="mt-3 text-xs font-medium">{networkProgress.current} מתוך {networkProgress.total} · {networkProgress.name}</div>}<Button className="mt-3 w-full" onClick={createMissingPbnSites} disabled={busy || !pbnRows.some((row) => row.project?.deployment?.state !== "READY")}>{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}פרסם {pbnRows.filter((row) => row.project?.deployment?.state !== "READY").length} אתרים חסרים</Button><Button className="mt-2 w-full" variant="outline" onClick={refreshPbnDesign} disabled={busy || !pbnRows.length}>{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}שדרג עיצוב בכל {pbnRows.length} האתרים</Button></div><div className="border-t pt-4"><Label>או צור אתר בודד</Label><div className="mt-2"><Label>שם האתר</Label><Input className="mt-1" value={newSiteName} onChange={(event) => setNewSiteName(event.target.value)} placeholder="לדוגמה: מגזין חדשנות" /></div></div><p className="text-xs text-muted-foreground">האתר ישוכפל מתבנית המגזין ויופיע אוטומטית ב־Vercel.</p><Button className="w-full" onClick={createVercelSite} disabled={busy || !newSiteName.trim()}>{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}צור אתר</Button></div></DialogContent></Dialog>
    <Dialog open={domainDialogOpen} onOpenChange={setDomainDialogOpen}><DialogContent dir="rtl" className="max-w-md"><DialogHeader><DialogTitle>דומיין עבור {selectedProject?.name}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>שם הדומיין</Label><Input dir="ltr" className="mt-1 text-left" value={domainName} onChange={(event) => setDomainName(event.target.value)} placeholder="example.com" /></div><p className="text-xs text-muted-foreground">המערכת תחבר את הדומיין ל־Vercel ותעדכן את ה־DNS ב־IONOS.</p><Button className="w-full" onClick={assignDomain} disabled={connectingDomain || !domainName.trim()}>{connectingDomain && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}שייך דומיין</Button></div></DialogContent></Dialog>
  </div>;
}
