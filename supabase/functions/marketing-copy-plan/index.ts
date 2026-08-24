import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/security.ts";
import { buildSkillsBlockBySlug } from "../_shared/skills/registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CHANNEL_LIMITS: Record<string, { headline: number; primary: number }> = {
  Facebook: { headline: 40, primary: 125 },
  Instagram: { headline: 40, primary: 125 },
  TikTok: { headline: 90, primary: 150 },
  LinkedIn: { headline: 70, primary: 600 },
  "Google Ads": { headline: 30, primary: 90 },
  YouTube: { headline: 100, primary: 5000 },
};

const TYPE_LABELS: Record<string, string> = {
  posts: "פוסטים לרשתות",
  ads: "קופי למודעות",
  script: "תסריט",
  book: "ספר / לונג-פורם",
  social_post: "פוסטים לרשתות",
  ad_copy: "קופי למודעות",
  ad_script: "תסריט למודעה",
  video_script: "תסריט",
  email: "דיוור",
  landing_page: "דף נחיתה",
};

const toMarkdown = (variant: { headline?: string; primary?: string; cta?: string; rationale?: string }) =>
  [variant.headline && `## ${variant.headline}`, variant.primary, variant.cta && `**CTA:** ${variant.cta}`]
    .filter(Boolean)
    .join("\n\n");

function parseIPv4(host: string): number | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

function ipv4InCidr(ip: number, network: number, bits: number): boolean {
  return (ip >>> (32 - bits)) === (network >>> (32 - bits));
}

function isPrivateIPv4(ip: number): boolean {
  return (
    ipv4InCidr(ip, 0x00000000, 8) ||
    ipv4InCidr(ip, 0x0a000000, 8) ||
    ipv4InCidr(ip, 0x7f000000, 8) ||
    ipv4InCidr(ip, 0xa9fe0000, 16) ||
    ipv4InCidr(ip, 0xac100000, 12) ||
    ipv4InCidr(ip, 0xc0a80000, 16) ||
    ipv4InCidr(ip, 0x64400000, 10) ||
    ipv4InCidr(ip, 0xc0000000, 24) ||
    ipv4InCidr(ip, 0xe0000000, 4) ||
    ipv4InCidr(ip, 0xf0000000, 4)
  );
}

function expandIPv6(host: string): number[] | null {
  let ip = host.toLowerCase().replace(/^\[|\]$/g, "");
  const v4tail = ip.match(/:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4tail) {
    const n = parseIPv4(v4tail[1]);
    if (n === null) return null;
    ip = `${ip.slice(0, -v4tail[1].length)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  if (ip.includes(".")) return null;
  const sides = ip.split("::");
  if (sides.length > 2) return null;
  const parseSide = (side: string) => (side === "" ? [] : side.split(":"));
  const left = parseSide(sides[0]).map((part) => (/^[0-9a-f]{1,4}$/.test(part) ? Number.parseInt(part, 16) : NaN));
  const right = (sides.length === 2 ? parseSide(sides[1]) : []).map((part) =>
    (/^[0-9a-f]{1,4}$/.test(part) ? Number.parseInt(part, 16) : NaN));
  if (left.some(Number.isNaN) || right.some(Number.isNaN)) return null;
  if (sides.length === 2) {
    const fill = 8 - left.length - right.length;
    if (fill < 0) return null;
    return [...left, ...Array(fill).fill(0), ...right];
  }
  return left.length === 8 ? left : null;
}

function isPrivateIPv6(host: string): boolean {
  const groups = expandIPv6(host);
  if (!groups) return true;
  if (groups.every((group) => group === 0)) return true;
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true;
  if ((groups[0] & 0xffc0) === 0xfe80) return true;
  if ((groups[0] & 0xfe00) === 0xfc00) return true;
  if ((groups[0] & 0xff00) === 0xff00) return true;
  const ipv4Mapped = groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0xffff;
  if (ipv4Mapped) return isPrivateIPv4(((groups[6] << 16) | groups[7]) >>> 0);
  const ipv4Compatible = groups.slice(0, 6).every((group) => group === 0) && groups[6] !== 0 && groups[7] !== 1;
  if (ipv4Compatible) return isPrivateIPv4(((groups[6] << 16) | groups[7]) >>> 0);
  return false;
}

function isBlockedAddress(address: string): boolean {
  const host = address.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  const ipv4 = parseIPv4(host);
  if (ipv4 !== null) return isPrivateIPv4(ipv4);
  if (host.includes(":")) return isPrivateIPv6(host);
  return true;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  return (
    host === "localhost" ||
    host === "metadata" ||
    host === "metadata.google.internal" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan")
  );
}

function parsePublicHttpUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) return null;
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") return null;
  if (isBlockedHostname(parsed.hostname)) return null;
  return parsed;
}

async function lookupIps(hostname: string): Promise<string[]> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (parseIPv4(host) !== null || host.includes(":")) return [host];
  const resolveDns = (Deno as { resolveDns?: (q: string, t: string) => Promise<string[]> }).resolveDns;
  if (typeof resolveDns !== "function") return [];
  const [aRecords, aaaaRecords] = await Promise.all([
    resolveDns(host, "A").catch(() => [] as string[]),
    resolveDns(host, "AAAA").catch(() => [] as string[]),
  ]);
  return [...aRecords, ...aaaaRecords];
}

type PublicTarget = { url: URL; ip: string };

async function resolvePublicTarget(raw: string): Promise<PublicTarget | null> {
  const url = parsePublicHttpUrl(raw);
  if (!url) return null;
  const ips = await lookupIps(url.hostname);
  if (ips.length === 0) return null;
  if (ips.some((ip) => isBlockedAddress(ip))) return null;
  return { url, ip: ips[0] };
}

async function readPinnedHttp(conn: Deno.Conn, limit = 512_000): Promise<{ status: number; headers: Headers; body: string }> {
  const decoder = new TextDecoder();
  let buf = new Uint8Array(0);
  const readMore = async () => {
    const chunk = new Uint8Array(8192);
    const n = await conn.read(chunk);
    if (n === null) return false;
    const next = new Uint8Array(buf.length + n);
    next.set(buf);
    next.set(chunk.subarray(0, n), buf.length);
    buf = next;
    return true;
  };
  while (buf.length < 65_536) {
    if (decoder.decode(buf).includes("\r\n\r\n")) break;
    if (!(await readMore())) break;
  }
  const decoded = decoder.decode(buf);
  const headerEnd = decoded.indexOf("\r\n\r\n");
  if (headerEnd < 0) throw new Error("no http headers");
  const headerBlock = decoded.slice(0, headerEnd);
  const [statusLine, ...headerLines] = headerBlock.split("\r\n");
  const status = Number(statusLine.split(" ")[1]);
  const headers = new Headers();
  for (const line of headerLines) {
    const idx = line.indexOf(":");
    if (idx > 0) headers.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  while (buf.length < limit) {
    if (!(await readMore())) break;
  }
  const body = decoder.decode(buf).slice(headerEnd + 4).slice(0, limit);
  try {
    conn.close();
  } catch { /* already closed */ }
  if (!Number.isInteger(status)) throw new Error("bad http status");
  return { status, headers, body };
}

async function pinnedGet(target: PublicTarget, timeoutMs: number): Promise<{ status: number; headers: Headers; body: string }> {
  const connect = Deno.connect;
  const startTls = Deno.startTls;
  if (typeof connect !== "function" || typeof startTls !== "function") {
    throw new Error("pinned connect unavailable");
  }
  const port = target.url.port ? Number(target.url.port) : (target.url.protocol === "https:" ? 443 : 80);
  const tcp = await Promise.race([
    connect({ hostname: target.ip, port }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("connect timeout")), timeoutMs)),
  ]);
  const conn = target.url.protocol === "https:"
    ? await startTls(tcp, { hostname: target.url.hostname, alpnProtocols: ["http/1.1"] })
    : tcp;
  const path = `${target.url.pathname || "/"}${target.url.search}`;
  const request = `GET ${path} HTTP/1.1\r\nHost: ${target.url.host}\r\nUser-Agent: AIOS-CopyDepartment/1.0\r\nAccept: text/html,text/plain,*/*\r\nConnection: close\r\n\r\n`;
  await conn.write(new TextEncoder().encode(request));
  return await Promise.race([
    readPinnedHttp(conn),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("read timeout")), timeoutMs)),
  ]);
}

async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    let target = await resolvePublicTarget(url);
    if (!target) return null;
    for (let hop = 0; hop < 3; hop++) {
      const response = await pinnedGet(target, 8000);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        if (!location) return null;
        target = await resolvePublicTarget(new URL(location, target.url).toString());
        if (!target) return null;
        continue;
      }
      if (response.status < 200 || response.status >= 300) return null;
      const text = response.body
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return text.slice(0, 4000) || null;
    }
    return null;
  } catch {
    return null;
  }
}

type AttachmentRef = { name?: string; path?: string };

const asAttachments = (value: unknown): AttachmentRef[] =>
  Array.isArray(value) ? value.filter((file): file is AttachmentRef => !!file && typeof file === "object") : [];

async function readTextAttachments(
  admin: ReturnType<typeof createClient>,
  files: AttachmentRef[],
): Promise<string> {
  const chunks: string[] = [];
  for (const file of files.slice(0, 6)) {
    const name = String(file.name ?? "");
    const path = String(file.path ?? "");
    if (!path || !/\.(txt|md|markdown|csv|json|html)$/i.test(name)) continue;
    try {
      const { data } = await admin.storage.from("entity-attachments").download(path);
      if (!data) continue;
      const text = (await data.text()).replace(/\s+/g, " ").trim().slice(0, 4000);
      if (text) chunks.push(`--- ${name} ---\n${text}`);
    } catch {
      // best-effort: names still go into the prompt
    }
  }
  return chunks.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const auth = await requireAuth(req);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const { item_id, prompt = "", mode = "autopilot" } = await req.json();
    if (!item_id) return jsonResponse({ error: "item_id required" }, 400);

    const { data: item, error: itemError } = await admin
      .from("marketing_work_items")
      .select("*")
      .eq("id", item_id)
      .single();
    if (itemError || !item) return jsonResponse({ error: "Work item not found" }, 404);

    if (auth.kind === "user") {
      const { data: membership } = await admin
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", item.tenant_id)
        .eq("user_id", auth.userId)
        .maybeSingle();
      if (!membership) return jsonResponse({ error: "Forbidden" }, 403);
    }

    const payload = (item.payload ?? {}) as Record<string, unknown>;
    const recordingId = typeof payload.recording_id === "string" ? payload.recording_id : null;

    const [{ data: client }, { data: integration }, skinBlock, { data: recording }] = await Promise.all([
      item.client_id
        ? admin
            .from("clients")
            .select("name,website,industry,notes,attachments")
            .eq("id", item.client_id)
            .eq("tenant_id", item.tenant_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("tenant_integrations")
        .select("settings,shared_from_integration_id")
        .eq("tenant_id", item.tenant_id)
        .eq("integration_type", "llm")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      buildSkillsBlockBySlug(["copywriter"], item.tenant_id),
      recordingId
        ? admin
            .from("zoom_recordings")
            .select("id,meeting_topic,transcription,notes")
            .eq("id", recordingId)
            .eq("tenant_id", item.tenant_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    let settings = (integration?.settings ?? {}) as Record<string, string>;
    if (integration?.shared_from_integration_id && !settings.openai_api_key) {
      const { data: source } = await admin
        .from("tenant_integrations")
        .select("settings")
        .eq("id", integration.shared_from_integration_id)
        .maybeSingle();
      settings = (source?.settings ?? settings) as Record<string, string>;
    }
    if (!settings.openai_api_key) throw new Error("OpenAI API key חסר בהגדרות האינטגרציות");

    const website = String(client?.website ?? payload.client_website ?? "");
    const websiteText = website ? await fetchWebsiteText(website) : null;
    const clientAttachments = asAttachments(client?.attachments);
    const briefAttachments = asAttachments(payload.brief_files);
    const clientFiles = clientAttachments.map((file) => file.name).filter(Boolean) as string[];
    const briefFiles = briefAttachments.map((file) => file.name).filter(Boolean) as string[];
    const recordingRecord = recording as { notes?: string | null; transcription?: string | null; meeting_topic?: string | null } | null;
    const recordingText = String(
      payload.recording_excerpt || recordingRecord?.notes || recordingRecord?.transcription || "",
    ).slice(0, 6000);
    const briefFileBodies = await readTextAttachments(admin, [...briefAttachments, ...clientAttachments]);

    const channel = String(payload.channel ?? item.target_channel ?? "כללי");
    const contentType = String(payload.content_type ?? "posts");
    const longForm = contentType === "book" || contentType === "script" || contentType === "video_script";
    const limits = longForm ? { headline: 120, primary: 12000 } : (CHANNEL_LIMITS[channel] ?? { headline: 60, primary: 800 });
    const existingCopy = String(payload.copy_text ?? "");
    const typeLabel = TYPE_LABELS[contentType] ?? contentType;

    const sourceContext = [
      `לקוח: ${client?.name ?? "לא משויך"}`,
      `תחום: ${client?.industry ?? "—"}`,
      client?.notes && `הערות לקוח: ${client.notes}`,
      website && `אתר הלקוח: ${website}`,
      websiteText && `תוכן שנמשך מהאתר (לא להמציא מעבר לזה):\n${websiteText}`,
      clientFiles.length > 0 && `קבצים בתיק הלקוח: ${clientFiles.join(", ")}`,
      `כותרת הפרויקט: ${item.title ?? "—"}`,
      `סוג תוצר: ${typeLabel}`,
      `ערוץ: ${channel}`,
      !longForm && `מגבלות תווים: כותרת עד ${limits.headline}, גוף עד ${limits.primary}`,
      payload.brief_text && `בריף: ${payload.brief_text}`,
      briefFiles.length > 0 && `קבצים שצורפו לבריף: ${briefFiles.join(", ")}`,
      briefFileBodies && `תוכן קבצי בריף/לקוח שנקראו:\n${briefFileBodies}`,
      recordingText && `סיכום/תמלול פגישה (${recordingRecord?.meeting_topic ?? "הקלטה"}):\n${recordingText}`,
      prompt && `הודעת המשתמש בצ'אט: ${prompt}`,
      existingCopy && `קופי נוכחי בעורך:\n${existingCopy}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const taskByMode: Record<string, string> = {
      autopilot: `כתוב את ה${typeLabel} במלואו, מוכן לעריכה. קבל החלטות מקצועיות, אל תמציא עובדות עסקיות.`,
      brief: `הפוך את הבריף, האתר, הקבצים וההקלטה ל${typeLabel} מדויק. אל תוסיף הבטחות או נתונים שלא הופיעו במקורות.`,
      improve: `שפר את הקופי הקיים לפי הודעת המשתמש. שמור על המסר, חדד, והחזר מסמך מלא מוכן לעריכה.`,
    };

    const systemPrompt = `${skinBlock}

את כרמן בתפקיד קופירייטרית המרה במחלקת הקופי. את כותבת בעברית טבעית ומחזירה JSON בלבד. אל תמציאי מחירים, תוצאות או פיצ'רים. אם חסר מידע — כתבי בלי להשלים עובדות. full_copy הוא המסמך שנכנס לעורך.`;

    const userPrompt = `${taskByMode[mode] ?? taskByMode.autopilot}

${sourceContext}

החזירי אובייקט במבנה הבא בדיוק:
{
  "full_copy": "המסמך המלא בעברית, מארקדאון, מוכן לעריכה",
  "angle": "הזווית בקצרה",
  "variants": [
    { "label": "A", "headline": "", "primary": "", "cta": "", "rationale": "" }
  ]
}
הוסיפי 3 וריאציות קצרות בנוסף למסמך המלא.`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.openai_api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!aiResponse.ok) throw new Error(`AI copy planning failed: ${aiResponse.status} ${await aiResponse.text()}`);
    const aiData = await aiResponse.json();
    const plan = JSON.parse(aiData.choices?.[0]?.message?.content ?? "{}");
    const variants = (Array.isArray(plan.variants) ? plan.variants : [])
      .slice(0, 3)
      .map((variant: Record<string, unknown>, index: number) => ({
        label: String(variant.label || ["A", "B", "C"][index] || index + 1),
        headline: String(variant.headline || ""),
        primary: String(variant.primary || ""),
        cta: String(variant.cta || ""),
        rationale: String(variant.rationale || ""),
      }));
    const fullCopy = String(plan.full_copy || "").trim() || (variants[0] ? toMarkdown(variants[0]) : "");
    if (!fullCopy) throw new Error("כרמן לא החזירה קופי תקין");

    const now = new Date().toISOString();
    const chat = Array.isArray(payload.copy_chat) ? [...(payload.copy_chat as unknown[])] : [];
    if (prompt) chat.push({ role: "user", content: prompt, at: now });
    chat.push({ role: "assistant", content: fullCopy, at: now });

    const nextPayload = {
      ...payload,
      copy_text: fullCopy,
      copy_variants: variants,
      copy_angle: plan.angle ?? "",
      copy_prompt: prompt,
      copy_chat: chat.slice(-40),
      department: "copy",
      last_skin_slug: "copywriter",
      client_website: website || payload.client_website || null,
    };

    const { error: updateError } = await admin
      .from("marketing_work_items")
      .update({ payload: nextPayload, status: "draft", updated_at: now })
      .eq("id", item.id);
    if (updateError) throw updateError;

    await admin.from("marketing_assets").insert({
      tenant_id: item.tenant_id,
      item_id: item.id,
      stage_id: item.current_stage_id,
      type: "copy",
      content: fullCopy,
      meta: { source: `carmen_${mode}`, skin_slug: "copywriter", variants, prompt },
    });

    return jsonResponse({
      copy_text: fullCopy,
      variants,
      angle: plan.angle ?? "",
      skin_slug: "copywriter",
      sources: {
        website: Boolean(websiteText),
        client_files: clientFiles.length,
        recording: Boolean(recordingText),
      },
    });
  } catch (error) {
    console.error("marketing-copy-plan error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
