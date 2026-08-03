import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Work = {
  summary: string;
  onsite: Array<{ id: string; kind: string; title: string; notes?: string; url?: string }>;
  articles: Array<{ id: string; title: string; topic: string; url?: string; notes?: string }>;
  links: Array<{ id: string; url: string; anchor?: string; notes?: string }>;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function parseWork(raw: unknown, legacyNotes?: string | null): Work {
  const empty: Work = { summary: "", onsite: [], articles: [], links: [] };
  if (!raw || typeof raw !== "object") {
    return { ...empty, summary: legacyNotes || "" };
  }
  const obj = raw as Record<string, unknown>;
  const onsite = Array.isArray(obj.onsite)
    ? obj.onsite
        .map((item, i) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const title = asString(row.title).trim();
          if (!title) return null;
          return {
            id: asString(row.id) || `onsite-${i}`,
            kind: asString(row.kind) || "other",
            title,
            notes: asString(row.notes).trim() || undefined,
            url: asString(row.url).trim() || undefined,
          };
        })
        .filter(Boolean) as Work["onsite"]
    : [];
  const articles = Array.isArray(obj.articles)
    ? obj.articles
        .map((item, i) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const title = asString(row.title).trim();
          if (!title) return null;
          return {
            id: asString(row.id) || `article-${i}`,
            title,
            topic: asString(row.topic).trim(),
            url: asString(row.url).trim() || undefined,
            notes: asString(row.notes).trim() || undefined,
          };
        })
        .filter(Boolean) as Work["articles"]
    : [];
  const links = Array.isArray(obj.links)
    ? obj.links
        .map((item, i) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const url = asString(row.url).trim();
          if (!url) return null;
          return {
            id: asString(row.id) || `link-${i}`,
            url,
            anchor: asString(row.anchor).trim() || undefined,
            notes: asString(row.notes).trim() || undefined,
          };
        })
        .filter(Boolean) as Work["links"]
    : [];
  const summary = asString(obj.summary).trim() || legacyNotes || "";
  return { summary, onsite, articles, links };
}

function monthKey(value: string | null | undefined): string {
  return String(value || "").slice(0, 10);
}

function shiftMonth(yyyyMmDd: string, deltaMonths: number): string {
  const [y, m] = yyyyMmDd.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1 + deltaMonths, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-01`;
}

function monthLabelHe(yyyyMmDd: string): string {
  try {
    return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${yyyyMmDd}T12:00:00Z`));
  } catch {
    return yyyyMmDd;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shareToken = url.searchParams.get("token");

    if (!shareToken) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: share, error: shareError } = await supabase
      .from("seo_monthly_shares")
      .select("id, share_token, client_id, month, snapshot, is_active, updated_at")
      .eq("share_token", shareToken)
      .eq("is_active", true)
      .maybeSingle();

    if (shareError) {
      console.error("seo_monthly_shares lookup failed", shareError);
      return new Response(JSON.stringify({ error: "Lookup failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!share) {
      return new Response(JSON.stringify({ error: "Share not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const month = monthKey(share.month);
    const fromMonth = shiftMonth(month, -2);
    const baseSnapshot =
      share.snapshot && typeof share.snapshot === "object"
        ? (share.snapshot as Record<string, unknown>)
        : {};

    const [{ data: client }, { data: updates, error: updatesError }] = await Promise.all([
      supabase.from("clients").select("name, website").eq("id", share.client_id).maybeSingle(),
      supabase
        .from("seo_monthly_updates")
        .select("month, status, notes, work")
        .eq("client_id", share.client_id)
        .gte("month", fromMonth)
        .lte("month", month)
        .order("month", { ascending: false }),
    ]);

    if (updatesError) {
      console.error("seo_monthly_updates lookup failed", updatesError);
    }

    const rows = updates || [];
    const current =
      rows.find((row) => monthKey(row.month) === month) || null;
    const liveWork = parseWork(current?.work, current?.notes);
    const status =
      current?.status === "up" || current?.status === "down" || current?.status === "stable"
        ? current.status
        : (baseSnapshot.status as string) || "stable";

    const seen = new Set<string>();
    const recentLinks: Array<{
      id: string;
      url: string;
      anchor?: string;
      notes?: string;
      month: string;
      monthLabel: string;
    }> = [];
    for (const row of rows) {
      const rowMonth = monthKey(row.month);
      const work = rowMonth === month ? liveWork : parseWork(row.work, row.notes);
      for (const link of work.links) {
        const key = link.url.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        recentLinks.push({
          id: link.id,
          url: link.url,
          anchor: link.anchor,
          notes: link.notes,
          month: rowMonth,
          monthLabel: monthLabelHe(rowMonth),
        });
      }
    }

    const liveSnapshot = {
      ...baseSnapshot,
      version: 1,
      clientName: client?.name || asString(baseSnapshot.clientName) || "לקוח",
      domain: asString(baseSnapshot.domain) || client?.website || undefined,
      month,
      monthLabel: asString(baseSnapshot.monthLabel) || monthLabelHe(month),
      status,
      work: liveWork,
      recentLinks,
      metrics: Array.isArray(baseSnapshot.metrics) ? baseSnapshot.metrics : [],
      keywords: Array.isArray(baseSnapshot.keywords) ? baseSnapshot.keywords : [],
      search: baseSnapshot.search,
      generatedAt: new Date().toISOString(),
    };

    // Keep the stored snapshot warm so the next open / PDF export stays in sync.
    const { error: persistError } = await supabase
      .from("seo_monthly_shares")
      .update({
        snapshot: liveSnapshot,
        updated_at: new Date().toISOString(),
      })
      .eq("id", share.id);
    if (persistError) {
      console.warn("seo_monthly_shares live persist failed", persistError.message);
    }

    return new Response(
      JSON.stringify({
        token: share.share_token,
        month,
        updated_at: new Date().toISOString(),
        snapshot: liveSnapshot,
        live: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("public-seo-monthly error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
