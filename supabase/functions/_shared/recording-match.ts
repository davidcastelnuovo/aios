// AI matching of a recording to a client (or to internal campaigners),
// suggest-first: only HIGH-confidence matches auto-assign; anything else is
// stored as a suggestion for a human to confirm in the recordings feed.
// Never sends anything anywhere — assignment only.

export interface MatchResult {
  matchType: "client" | "internal" | "unknown";
  clientId: string | null;
  autoAssign: boolean; // true only on high confidence
  campaignerIds: string[];
}

// deno-lint-ignore no-explicit-any
export async function matchRecordingToClient(admin: any, openaiKey: string, opts: {
  tenant_id: string;
  meeting_topic: string | null;
  transcription: string;
  host_email: string | null;
}): Promise<MatchResult> {
  const none: MatchResult = { matchType: "unknown", clientId: null, autoAssign: false, campaignerIds: [] };

  const [{ data: clients }, { data: campaigners }] = await Promise.all([
    admin.from("clients").select("id, name").eq("tenant_id", opts.tenant_id),
    admin.from("campaigners").select("id, full_name, email").eq("tenant_id", opts.tenant_id).eq("active", true),
  ]);
  if (!clients?.length) return none;

  const transcriptHead = opts.transcription.split(/\s+/).slice(0, 600).join(" ");
  const clientList = clients.map((c: { id: string; name: string }) => `${c.id} | ${c.name}`).join("\n");
  const campaignerList = (campaigners || [])
    .map((c: { id: string; full_name: string }) => `${c.id} | ${c.full_name}`)
    .join("\n");

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `אתה מסווג הקלטות פגישה של סוכנות שיווק. עליך לקבוע האם הפגישה היא עם לקוח (ואיזה), פגישה פנימית של הצוות, או שאי אפשר לדעת.
כללים:
- "client" רק אם יש התאמה ברורה בין שם הפגישה/תוכן/שמות הדוברים לבין לקוח מהרשימה. השתמש ב-id המדויק מהרשימה.
- confidence "high" רק כששם הלקוח מופיע מפורשות בשם הפגישה או שהדוברים מזכירים אותו חד-משמעית. אחרת "medium"/"low".
- "internal" אם זו פגישת צוות פנימית (ללא לקוח חיצוני). זהה אילו קמפיינרים מהרשימה השתתפו לפי שמות הדוברים.
- אם ספק — "unknown". לעולם אל תמציא id.
החזר JSON: {"match_type":"client"|"internal"|"unknown","client_id":string|null,"confidence":"high"|"medium"|"low","campaigner_ids":string[]}`,
          },
          {
            role: "user",
            content: `שם הפגישה: ${opts.meeting_topic || "לא ידוע"}
מארח: ${opts.host_email || "לא ידוע"}

רשימת לקוחות (id | שם):
${clientList}

רשימת קמפיינרים (id | שם):
${campaignerList || "(אין)"}

תחילת התמלול:
${transcriptHead}`,
          },
        ],
      }),
    });
    if (!r.ok) {
      console.error("[recording-match] AI error", r.status, (await r.text()).slice(0, 200));
      return none;
    }
    const j = await r.json();
    const parsed = JSON.parse(j?.choices?.[0]?.message?.content ?? "{}");

    // Validate ids against the real lists — never trust generated ids blindly.
    const clientIds = new Set(clients.map((c: { id: string }) => c.id));
    const campaignerIdSet = new Set((campaigners || []).map((c: { id: string }) => c.id));

    if (parsed.match_type === "client" && parsed.client_id && clientIds.has(parsed.client_id)) {
      return {
        matchType: "client",
        clientId: parsed.client_id,
        autoAssign: parsed.confidence === "high",
        campaignerIds: [],
      };
    }

    if (parsed.match_type === "internal") {
      const ids: string[] = Array.isArray(parsed.campaigner_ids)
        ? parsed.campaigner_ids.filter((id: string) => campaignerIdSet.has(id))
        : [];
      // Deterministic extra signal: the host's email matched to a campaigner.
      const hostMatch = (campaigners || []).find(
        (c: { id: string; email: string | null }) =>
          c.email && opts.host_email && c.email.toLowerCase() === opts.host_email.toLowerCase(),
      );
      if (hostMatch && !ids.includes(hostMatch.id)) ids.push(hostMatch.id);
      return { matchType: "internal", clientId: null, autoAssign: false, campaignerIds: ids };
    }
  } catch (e) {
    console.error("[recording-match] failed", e);
  }
  return none;
}
