import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEXT_MODEL = 'gpt-4o-mini';
const IMAGE_MODEL = 'dall-e-3';

// Cost per 1M tokens (rough Gemini Flash pricing for usage display)
const COST_IN_PER_M = 0.075;
const COST_OUT_PER_M = 0.3;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let runId: string | null = null;
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const supaService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supaUrl, supaService);

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    const { item_id, stage_id } = await req.json();
    if (!item_id || !stage_id) {
      return new Response(JSON.stringify({ error: "item_id and stage_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify caller (optional — we use service role for inserts to bypass RLS,
    // but record auth.uid() via header if present)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supaUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data.user?.id ?? null;
    }

    // Load item, stage, agent, client
    const { data: item, error: itemErr } = await admin
      .from("marketing_work_items")
      .select("*")
      .eq("id", item_id)
      .single();
    if (itemErr || !item) throw new Error("Work item not found");

    const { data: stage, error: stageErr } = await admin
      .from("marketing_pipeline_stages")
      .select("*")
      .eq("id", stage_id)
      .single();
    if (stageErr || !stage) throw new Error("Stage not found");

    const { data: client } = await admin
      .from("clients")
      .select("id, name, website, business_description, industry")
      .eq("id", item.client_id)
      .maybeSingle();

    let agent: any = null;
    if (stage.agent_id) {
      const { data: a } = await admin
        .from("ai_agents")
        .select("id, name, system_prompt, personality, soul, talent, writing_style, response_length, language")
        .eq("id", stage.agent_id)
        .maybeSingle();
      agent = a;
    }

    // Previous assets in this item (to chain context)
    const { data: prevAssets } = await admin
      .from("marketing_assets")
      .select("type, content, url, meta, stage_id, created_at")
      .eq("item_id", item_id)
      .order("created_at", { ascending: true });

    // Insert run row
    const { data: runRow, error: runErr } = await admin
      .from("marketing_runs")
      .insert({
        tenant_id: item.tenant_id,
        item_id,
        stage_id,
        status: "running",
        model: stage.stage_type === "creative" ? IMAGE_MODEL : TEXT_MODEL,
        started_at: new Date().toISOString(),
        created_by: userId,
        input: { stage_type: stage.stage_type, item_title: item.title },
      })
      .select("id")
      .single();
    if (runErr || !runRow) throw new Error("Failed to create run: " + runErr?.message);
    runId = runRow.id;

    const cfg = (stage.configuration as any) ?? {};
    const instructions: string = cfg.instructions ?? "";
    const stageType: string = stage.stage_type;

    // Build messages
    const systemParts: string[] = [];
    if (agent?.system_prompt) systemParts.push(agent.system_prompt);
    if (agent?.personality) systemParts.push(`אישיות: ${agent.personality}`);
    if (agent?.writing_style) systemParts.push(`סגנון כתיבה: ${agent.writing_style}`);
    if (instructions) systemParts.push(instructions);
    if (client) {
      systemParts.push(
        `\nהקשר על הלקוח:\n- שם: ${client.name ?? "—"}\n- אתר: ${client.website ?? "—"}\n- תיאור: ${client.business_description ?? "—"}\n- תחום: ${client.industry ?? "—"}`,
      );
    }
    const systemPrompt = systemParts.join("\n\n");

    const userParts: string[] = [];
    userParts.push(`כותרת הפריט: ${item.title ?? "—"}`);
    if (item.payload?.notes) userParts.push(`הערות: ${item.payload.notes}`);
    if ((prevAssets ?? []).length > 0) {
      userParts.push("\nתוצרים מהשלבים הקודמים:");
      for (const a of prevAssets ?? []) {
        if (a.type === "copy" || a.type === "brief") {
          userParts.push(`- [${a.type}] ${(a.content ?? "").slice(0, 1500)}`);
        } else if (a.type === "image" && a.url) {
          userParts.push(`- [image] ${a.url}`);
        }
      }
    }

    if (stageType === "strategy") {
      userParts.push("\nהפק בריף שיווקי מובנה: קהל יעד, כאבים, הצעת ערך, מסרים מרכזיים, טון, KPIs.");
    } else if (stageType === "copy") {
      userParts.push("\nכתוב את הקופי המלא לפריט. קצר וממוקד.");
    } else if (stageType === "creative") {
      userParts.push("\nצור תמונה ויזואלית מקצועית לפריט הזה.");
    } else if (stageType === "measurement") {
      userParts.push("\nהפק סיכום ביצועים והמלצות פעולה לשיפור.");
    }

    const userPrompt = userParts.join("\n");

    let assetType = "copy";
    let assetContent: string | null = null;
    let assetUrl: string | null = null;
    let tokensIn = 0;
    let tokensOut = 0;
    let outputJson: any = {};

    if (stageType === "creative") {
      // Image generation via DALL-E 3
      // First, generate a detailed image prompt using text model
      const promptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TEXT_MODEL,
          messages: [
            { role: "system", content: systemPrompt || "You are a creative director. Generate concise DALL-E image prompts in English." },
            { role: "user", content: userPrompt + "\n\nGenerate a concise DALL-E 3 image prompt (max 200 words) in English for this marketing creative. Focus on visual elements, style, and composition." },
          ],
          max_tokens: 300,
        }),
      });
      let imagePrompt = item.title ?? "Professional marketing creative";
      if (promptRes.ok) {
        const promptData = await promptRes.json();
        imagePrompt = promptData.choices?.[0]?.message?.content ?? imagePrompt;
        tokensIn += promptData.usage?.prompt_tokens ?? 0;
        tokensOut += promptData.usage?.completion_tokens ?? 0;
      }

      // Generate image with DALL-E 3
      const aiRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          prompt: imagePrompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        }),
      });
      if (!aiRes.ok) {
        const t = await aiRes.text();
        throw new Error(`Image generation ${aiRes.status}: ${t}`);
      }
      const data = await aiRes.json();
      const b64Data = data.data?.[0]?.b64_json;
      if (!b64Data) throw new Error("No image returned from DALL-E");
      const bytes = Uint8Array.from(atob(b64Data), (c) => c.charCodeAt(0));
      const fileName = `${Date.now()}-${runRow.id}.png`;
      const filePath = `${item.tenant_id}/marketing/${item_id}/${fileName}`;
      const { error: upErr } = await admin.storage
        .from("entity-attachments")
        .upload(filePath, bytes, { contentType: "image/png", upsert: false });
      if (upErr) throw new Error("Upload failed: " + upErr.message);
      const { data: pub } = admin.storage.from("entity-attachments").getPublicUrl(filePath);
      assetUrl = pub.publicUrl;
      assetType = "image";
      outputJson = { image_url: assetUrl };
    } else {
      // Text generation
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TEXT_MODEL,
          messages: [
            { role: "system", content: systemPrompt || "You are a marketing assistant." },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!aiRes.ok) {
        const t = await aiRes.text();
        if (aiRes.status === 429)
          throw new Error("חרגת ממכסת בקשות AI. נסה שוב בעוד מספר דקות.");
        if (aiRes.status === 402)
          throw new Error("נגמרו הקרדיטים. הוסף קרדיטים בהגדרות הסביבה.");
        throw new Error(`AI gateway ${aiRes.status}: ${t}`);
      }
      const data = await aiRes.json();
      assetContent = data.choices?.[0]?.message?.content ?? "";
      tokensIn = data.usage?.prompt_tokens ?? 0;
      tokensOut = data.usage?.completion_tokens ?? 0;
      assetType = stageType === "strategy" ? "brief" : stageType === "measurement" ? "data" : "copy";
      outputJson = { text: assetContent };
    }

    // Save asset
    const { data: assetRow } = await admin
      .from("marketing_assets")
      .insert({
        tenant_id: item.tenant_id,
        item_id,
        run_id: runRow.id,
        stage_id,
        type: assetType,
        url: assetUrl,
        content: assetContent,
        meta: { stage_type: stageType },
      })
      .select("id")
      .single();

    // Update item payload with latest copy/image
    const newPayload = { ...(item.payload ?? {}) };
    if (assetType === "copy" || assetType === "brief") newPayload.copy_text = assetContent;
    if (assetType === "image") newPayload.image_url = assetUrl;
    await admin.from("marketing_work_items").update({ payload: newPayload }).eq("id", item_id);

    const cost = (tokensIn * COST_IN_PER_M + tokensOut * COST_OUT_PER_M) / 1_000_000;

    // Decide: auto-advance or wait for approval
    const approvalMode = stage.approval_mode ?? "manual";
    const finalStatus = approvalMode === "auto" ? "completed" : "awaiting_approval";

    await admin
      .from("marketing_runs")
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_usd: cost,
        output: outputJson,
      })
      .eq("id", runRow.id);

    // ── Send approval notification when stage needs approval (semi mode) ──
    if (finalStatus === "awaiting_approval") {
      try {
        // Find tenant owner/admin email + phone
        const { data: tenantOwners } = await admin
          .from("tenant_users")
          .select("user_id, role")
          .eq("tenant_id", item.tenant_id)
          .in("role", ["owner", "admin"])
          .limit(3);

        for (const owner of tenantOwners ?? []) {
          const { data: profile } = await admin
            .from("profiles")
            .select("email, phone, full_name")
            .eq("id", owner.user_id)
            .maybeSingle();

          if (!profile) continue;

          const stageName = stage.name ?? stageType;
          const itemTitle = item.title ?? "פריט תוכן";
          const approvalUrl = `https://aios.co.il/marketing`;
          const msgText = `✅ *שלב "${stageName}" הושלם*\n\nפריט: ${itemTitle}\n\nהתוכן מחכה לאישורך כדי להמשיך לשלב הבא.\n\n🔗 ${approvalUrl}`;

          // Send email
          if (profile.email) {
            await fetch(`${supaUrl}/functions/v1/send-resend-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supaService}`,
              },
              body: JSON.stringify({
                to: profile.email,
                subject: `[AIOS Marketing] שלב "${stageName}" מחכה לאישורך`,
                html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#f59e0b">✅ שלב הושלם — נדרש אישורך</h2>
  <p><strong>פריט:</strong> ${itemTitle}</p>
  <p><strong>שלב שהושלם:</strong> ${stageName}</p>
  <p>התוכן שנוצר על ידי קרמן מחכה לאישורך כדי להמשיך לשלב הבא בפייפליין.</p>
  <a href="${approvalUrl}" style="display:inline-block;background:#f59e0b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">עבור לאישור</a>
</div>`,
              }),
            }).catch((e) => console.error("Email notification failed:", e));
          }

          // Send WhatsApp if phone available
          if (profile.phone) {
            await fetch(`${supaUrl}/functions/v1/send-manus-wa-message`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supaService}`,
              },
              body: JSON.stringify({
                tenantId: item.tenant_id,
                phoneNumber: profile.phone,
                message: msgText,
                senderUserId: owner.user_id,
              }),
            }).catch((e) => console.error("WhatsApp notification failed:", e));
          }
        }
      } catch (notifErr) {
        // Notifications are best-effort — don't fail the run
        console.error("Approval notification error:", notifErr);
      }
    }

    // ── Server-side auto-advance: if mode is "auto", move to next stage ──
    let nextStageId: string | null = null;
    if (approvalMode === "auto") {
      const { data: allStages } = await admin
        .from("marketing_pipeline_stages")
        .select("id, sort_order, approval_mode")
        .eq("pipeline_id", item.pipeline_id)
        .order("sort_order");
      const stages = allStages ?? [];
      const currentIdx = stages.findIndex((s: any) => s.id === stage_id);
      if (currentIdx >= 0 && currentIdx < stages.length - 1) {
        const nextStage = stages[currentIdx + 1];
        nextStageId = nextStage.id;
        // Advance work item to next stage
        await admin
          .from("marketing_work_items")
          .update({ current_stage_id: nextStageId, status: "in_progress" })
          .eq("id", item_id);
        // If next stage is also auto, fire-and-forget to trigger it
        if (nextStage.approval_mode === "auto") {
          fetch(`${supaUrl}/functions/v1/marketing-run-stage`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supaService}`,
            },
            body: JSON.stringify({ item_id, stage_id: nextStageId }),
          }).catch(() => {/* ignore */});
        }
      } else if (currentIdx === stages.length - 1) {
        // Last stage — mark work item as completed
        await admin
          .from("marketing_work_items")
          .update({ status: "completed" })
          .eq("id", item_id);
      }
    }

    return new Response(
      JSON.stringify({
        run_id: runRow.id,
        status: finalStatus,
        asset_id: assetRow?.id,
        type: assetType,
        content: assetContent,
        url: assetUrl,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_usd: cost,
        next_stage_id: nextStageId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("marketing-run-stage error:", e);
    if (runId) {
      await admin
        .from("marketing_runs")
        .update({
          status: "failed",
          error: String(e.message ?? e),
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    return new Response(JSON.stringify({ error: String(e.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
