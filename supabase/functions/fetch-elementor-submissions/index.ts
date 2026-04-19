import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedSubmission {
  id: string | number;
  form_id: string;
  form_name: string;
  email: string | null;
  created_at: string;
  referer: string | null;
  slug: string;
  source: "google_ads" | "google" | "facebook" | "organic" | "direct" | "test" | "other";
  gclid: string | null;
  gad_campaignid: string | null;
  fbclid: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  ip: string | null;
  raw_fields: Record<string, any>;
}

function extractSlug(referer: string | null): string {
  if (!referer) return "";
  try {
    const u = new URL(referer);
    const seg = u.pathname.split("/").filter(Boolean)[0] || "";
    return decodeURIComponent(seg).toLowerCase();
  } catch {
    return "";
  }
}

function stringifyFormName(name: any, fallback: string): string {
  if (!name) return fallback;
  if (typeof name === "string") return name;
  if (typeof name === "object") {
    // Elementor sometimes returns { rendered: "..." } or similar
    return (
      name.rendered ||
      name.name ||
      name.label ||
      name.title ||
      name.value ||
      fallback
    );
  }
  return String(name);
}

function getQueryParam(url: string | null, key: string): string | null {
  if (!url) return null;
  try {
    // Search anywhere in the URL string (handles odd Elementor referer formats)
    const re = new RegExp(`[?&]${key}=([^&#]*)`, "i");
    const m = url.match(re);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function classifySource(referer: string | null): ParsedSubmission["source"] {
  if (!referer) return "direct";
  const r = referer.toLowerCase();
  if (r.includes("gtm_debug") || r.includes("localhost") || r.includes("?preview=") || r.includes("elementor-preview")) {
    return "test";
  }
  if (r.includes("gclid=") || r.includes("gad_campaignid=") || r.includes("?ref=google")) {
    return "google_ads";
  }
  if (r.includes("fbclid=") || r.includes("facebook.com") || r.includes("instagram.com")) {
    return "facebook";
  }
  if (r.includes("google.com") || r.includes("google.co")) {
    return "organic";
  }
  if (r.includes("utm_source=")) {
    const utm = getQueryParam(referer, "utm_source")?.toLowerCase() || "";
    if (utm.includes("google")) return "google";
    if (utm.includes("facebook") || utm.includes("fb")) return "facebook";
    return "other";
  }
  return "direct";
}

function extractEmail(fields: any): string | null {
  if (!fields) return null;
  // Elementor submissions API returns "values" as an array of {key, value, type, ...}
  if (Array.isArray(fields)) {
    for (const f of fields) {
      const key = (f.key || f.id || "").toString().toLowerCase();
      const type = (f.type || "").toString().toLowerCase();
      const val = f.value;
      if ((type === "email" || key.includes("email") || key.includes("מייל") || key.includes("אימייל")) && typeof val === "string" && val.includes("@")) {
        return val;
      }
    }
  } else if (typeof fields === "object") {
    for (const [k, v] of Object.entries(fields)) {
      if ((k.toLowerCase().includes("email") || k.includes("מייל")) && typeof v === "string" && v.includes("@")) {
        return v;
      }
    }
  }
  return null;
}

function fieldsToRecord(fields: any): Record<string, any> {
  if (!fields) return {};
  if (Array.isArray(fields)) {
    const out: Record<string, any> = {};
    for (const f of fields) {
      const k = f.key || f.id || f.label;
      if (k) out[k] = f.value;
    }
    return out;
  }
  return fields;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { site_id, days } = await req.json();
    if (!site_id) {
      return new Response(JSON.stringify({ error: "site_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: site, error: siteError } = await supabase
      .from("social_media_wordpress_sites")
      .select("*")
      .eq("id", site_id)
      .single();

    if (siteError || !site) {
      return new Response(JSON.stringify({ error: "Site not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const credentials = btoa(`${site.username}:${site.app_password}`);
    const authHeaders = { Authorization: `Basic ${credentials}` };
    const baseUrl = site.site_url.replace(/\/$/, "");

    // 1) Fetch forms list (so we have nice names)
    const formsMap = new Map<string, string>();
      try {
      const formsResp = await fetch(`${baseUrl}/wp-json/elementor/v1/forms?per_page=100`, {
        headers: authHeaders,
      });
      if (formsResp.ok) {
        const formsData = await formsResp.json();
        const list = Array.isArray(formsData) ? formsData : formsData?.data || [];
        for (const f of list) {
          const id = String(f.id || f.form_id || f.ID || "");
          const name = stringifyFormName(f.name || f.label || f.title || f.form_name, id);
          if (id) formsMap.set(id, name);
        }
      }
    } catch (e) {
      console.warn("forms fetch failed:", e);
    }

    // 2) Fetch submissions with pagination
    const allSubmissions: any[] = [];
    let page = 1;
    const perPage = 100;
    const maxPages = 10;
    let totalAvailable = 0;

    while (page <= maxPages) {
      const url = `${baseUrl}/wp-json/elementor/v1/form-submissions?per_page=${perPage}&page=${page}`;
      const resp = await fetch(url, { headers: authHeaders });

      if (!resp.ok) {
        if (page === 1) {
          const errText = await resp.text();
          return new Response(
            JSON.stringify({
              error: "Elementor Pro Submissions endpoint unavailable",
              status: resp.status,
              details: errText.slice(0, 500),
              hint:
                resp.status === 404
                  ? "Elementor Pro Submissions feature may not be enabled, or the user lacks permissions."
                  : "Check WordPress credentials.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      }

      const totalHeader = resp.headers.get("x-wp-total");
      if (totalHeader) totalAvailable = parseInt(totalHeader, 10);

      const data = await resp.json();
      const items = Array.isArray(data) ? data : data?.data || [];
      if (items.length === 0) break;
      allSubmissions.push(...items);
      if (items.length < perPage) break;
      page++;
    }

    // 3) Parse + filter by date if requested
    const cutoff = days && Number(days) > 0 ? Date.now() - Number(days) * 86400000 : 0;

    // Debug: log the structure of the first submission so we can see what fields exist
    if (allSubmissions.length > 0) {
      console.log("Sample submission keys:", Object.keys(allSubmissions[0]));
      console.log("Sample submission (first 1000 chars):", JSON.stringify(allSubmissions[0]).slice(0, 1000));
    }

    const parsed: ParsedSubmission[] = [];
    for (const s of allSubmissions) {
      const createdAt = s.created_at || s.date || s.created || new Date().toISOString();
      if (cutoff > 0 && new Date(createdAt).getTime() < cutoff) continue;

      const fields = s.values || s.fields || s.form_data || [];
      const referer = s.referer || s.referrer || s.url || s.user_url || null;

      // Robust form_id extraction — Elementor returns various shapes:
      //  - s.form_id (string)
      //  - s.form = { id, name } (object)
      //  - s.form (string id)
      //  - s.element_id / s.post_id (fallbacks)
      let formIdRaw: any =
        s.form_id ??
        (s.form && typeof s.form === "object" ? (s.form.id ?? s.form.form_id ?? s.form.ID) : s.form) ??
        s.formId ??
        s.element_id ??
        s.post_id ??
        "";
      // If still object somehow, stringify cleanly
      if (formIdRaw && typeof formIdRaw === "object") {
        formIdRaw = formIdRaw.id || formIdRaw.value || JSON.stringify(formIdRaw);
      }
      const formId = String(formIdRaw || "").trim();

      // Robust form_name extraction
      let rawFormName: any =
        s.form_name ??
        (s.form && typeof s.form === "object" ? (s.form.name ?? s.form.title ?? s.form.label) : null) ??
        s.form_label ??
        s.post_title ??
        formsMap.get(formId) ??
        formId ??
        "טופס לא ידוע";
      const formName = stringifyFormName(rawFormName, formId || "טופס לא ידוע");
      const slug = extractSlug(referer);

      parsed.push({
        id: s.id,
        form_id: formId,
        form_name: formName,
        email: extractEmail(fields),
        created_at: createdAt,
        referer,
        slug,
        source: classifySource(referer),
        gclid: getQueryParam(referer, "gclid"),
        gad_campaignid: getQueryParam(referer, "gad_campaignid"),
        fbclid: getQueryParam(referer, "fbclid"),
        utm_source: getQueryParam(referer, "utm_source"),
        utm_campaign: getQueryParam(referer, "utm_campaign"),
        ip: s.user_ip || s.ip || null,
        raw_fields: fieldsToRecord(fields),
      });
    }

    // 4) Aggregate per_form — group by form_id when available, else by slug-based key
    const perFormMap = new Map<string, any>();
    for (const sub of parsed) {
      // If we don't have a form_id, fall back to slug+form_name so different forms on different pages don't merge
      const key = sub.form_id
        ? `id:${sub.form_id}`
        : `name:${sub.form_name}|slug:${sub.slug || "_"}`;
      if (!perFormMap.has(key)) {
        perFormMap.set(key, {
          form_id: sub.form_id,
          form_name: sub.form_name,
          total: 0,
          last_7_days: 0,
          last_30_days: 0,
          sources: { google_ads: 0, google: 0, facebook: 0, organic: 0, direct: 0, test: 0, other: 0 },
          last_submission_at: null as string | null,
          slugs: new Set<string>(),
          sample_referer: null as string | null,
        });
      }
      const entry = perFormMap.get(key);
      entry.total++;
      entry.sources[sub.source]++;
      if (sub.slug) entry.slugs.add(sub.slug);
      if (!entry.sample_referer && sub.referer) entry.sample_referer = sub.referer;
      const ts = new Date(sub.created_at).getTime();
      const now = Date.now();
      if (ts >= now - 7 * 86400000) entry.last_7_days++;
      if (ts >= now - 30 * 86400000) entry.last_30_days++;
      if (!entry.last_submission_at || new Date(entry.last_submission_at).getTime() < ts) {
        entry.last_submission_at = sub.created_at;
      }
    }

    // 5) Aggregate per Google Ads campaign
    const perCampaignMap = new Map<string, any>();
    for (const sub of parsed) {
      if (!sub.gad_campaignid) continue;
      if (!perCampaignMap.has(sub.gad_campaignid)) {
        perCampaignMap.set(sub.gad_campaignid, {
          gad_campaignid: sub.gad_campaignid,
          submissions: 0,
          forms: new Set<string>(),
        });
      }
      const c = perCampaignMap.get(sub.gad_campaignid);
      c.submissions++;
      c.forms.add(sub.form_name);
    }

    // 6) Aggregate per slug (URL path) - useful for slug-based campaign mapping
    const perSlugMap = new Map<string, any>();
    for (const sub of parsed) {
      if (!sub.slug) continue;
      if (!perSlugMap.has(sub.slug)) {
        perSlugMap.set(sub.slug, {
          slug: sub.slug,
          submissions: 0,
          google_ads_submissions: 0,
          last_submission_at: null as string | null,
          sample_gad_campaignids: new Set<string>(),
        });
      }
      const e = perSlugMap.get(sub.slug);
      e.submissions++;
      if (sub.source === "google_ads" || sub.source === "google") e.google_ads_submissions++;
      if (sub.gad_campaignid) e.sample_gad_campaignids.add(sub.gad_campaignid);
      const ts = new Date(sub.created_at).getTime();
      if (!e.last_submission_at || new Date(e.last_submission_at).getTime() < ts) {
        e.last_submission_at = sub.created_at;
      }
    }

    const totals = {
      total: parsed.length,
      google_ads: parsed.filter((s) => s.source === "google_ads").length,
      facebook: parsed.filter((s) => s.source === "facebook").length,
      organic: parsed.filter((s) => s.source === "organic" || s.source === "google").length,
      direct: parsed.filter((s) => s.source === "direct").length,
      test: parsed.filter((s) => s.source === "test").length,
    };

    return new Response(
      JSON.stringify({
        success: true,
        site: { id: site.id, name: site.site_name, url: site.site_url },
        total_available: totalAvailable,
        totals,
        per_form: Array.from(perFormMap.values()).sort((a, b) => b.total - a.total),
        per_campaign: Array.from(perCampaignMap.values()).map((c) => ({
          ...c,
          forms: Array.from(c.forms),
        })).sort((a, b) => b.submissions - a.submissions),
        per_slug: Array.from(perSlugMap.values()).map((e) => ({
          ...e,
          sample_gad_campaignids: Array.from(e.sample_gad_campaignids),
        })).sort((a, b) => b.submissions - a.submissions),
        submissions: parsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("fetch-elementor-submissions error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
