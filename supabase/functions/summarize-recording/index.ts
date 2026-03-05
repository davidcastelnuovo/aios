import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const {
      recording_id,
      transcript,
      focus_points,
      custom_focus,
      target_type,
      target_id,
      tenant_id,
    } = await req.json();

    if (!transcript || !transcript.trim()) {
      throw new Error("נא להזין תמלול או הערות מהפגישה");
    }

    if (!target_type || !target_id) {
      throw new Error("נא לבחור לקוח או ליד לשיוך הסיכום");
    }

    // Get recording info
    let recordingInfo = "";
    if (recording_id) {
      const { data: rec } = await supabase
        .from("zoom_recordings")
        .select("meeting_topic, start_time, duration, host_email")
        .eq("id", recording_id)
        .maybeSingle();
      if (rec) {
        recordingInfo = `נושא הפגישה: ${rec.meeting_topic || "לא צוין"}
תאריך: ${rec.start_time ? new Date(rec.start_time).toLocaleDateString("he-IL") : "לא צוין"}
משך: ${rec.duration ? rec.duration + " דקות" : "לא צוין"}
מארח: ${rec.host_email || "לא צוין"}`;
      }
    }

    // Build focus points prompt
    const focusLabels: Record<string, string> = {
      decisions: "החלטות שהתקבלו",
      action_items: "משימות ופעולות נדרשות",
      pain_points: "נקודות כאב של הלקוח",
      pricing: "הצעות מחיר ותמחור",
      next_steps: "שלבים הבאים",
      key_quotes: "ציטוטים מרכזיים",
    };

    let focusPrompt = "";
    if (focus_points && focus_points.length > 0) {
      const labels = focus_points.map((fp: string) => focusLabels[fp] || fp).join(", ");
      focusPrompt = `\n\nדגשים מיוחדים שיש להתמקד בהם: ${labels}`;
    }
    if (custom_focus && custom_focus.trim()) {
      focusPrompt += `\nדגשים נוספים מהמשתמש: ${custom_focus}`;
    }

    // Generate summary using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `אתה עוזר מקצועי לסיכום פגישות עסקיות. כתוב סיכומים מקצועיים, ברורים ומאורגנים בעברית.
הסיכום צריך להיות מובנה עם כותרות, נקודות מרכזיות, ופסקאות קצרות.
השתמש בפורמט Markdown.
אל תמציא מידע - סכם רק מה שמופיע בתמלול.`,
            },
            {
              role: "user",
              content: `סכם את הפגישה הבאה:

${recordingInfo ? "פרטי הפגישה:\n" + recordingInfo + "\n\n" : ""}תמלול/הערות:
${transcript}${focusPrompt}

אנא כתוב סיכום מקצועי ומובנה של הפגישה.`,
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "חריגה ממגבלת בקשות, נסה שוב בעוד כמה דקות" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "נדרש תשלום - נא להוסיף קרדיטים" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("שגיאה ביצירת סיכום AI");
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content;
    if (!summary) throw new Error("לא התקבל סיכום מה-AI");

    // Get target name for the filename
    let targetName = "unknown";
    if (target_type === "client") {
      const { data } = await supabase.from("clients").select("name").eq("id", target_id).maybeSingle();
      targetName = data?.name || "client";
    } else {
      const { data } = await supabase.from("leads").select("company_name").eq("id", target_id).maybeSingle();
      targetName = data?.company_name || "lead";
    }

    // Create DOCX document
    const dateStr = new Date().toLocaleDateString("he-IL");
    const docxBytes = buildDocx(summary, targetName, dateStr, recording_id);

    // Save to storage
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const fileName = `summaries/${tenant_id}/${target_type}_${target_id}/${Date.now()}_summary.docx`;
    
    const { error: uploadError } = await admin.storage
      .from("recordings")
      .upload(fileName, docxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("שגיאה בשמירת הקובץ: " + uploadError.message);
    }

    // Get public URL
    const { data: urlData } = admin.storage.from("recordings").getPublicUrl(fileName);
    const fileUrl = urlData.publicUrl;

    // Add to client/lead attachments
    const table = target_type === "client" ? "clients" : "leads";
    const { data: targetData } = await admin
      .from(table)
      .select("attachments")
      .eq("id", target_id)
      .maybeSingle();

    const currentAttachments = (targetData?.attachments as any[]) || [];
    const newAttachment = {
      name: `סיכום פגישה - ${dateStr}.docx`,
      url: fileUrl,
      type: "meeting_summary",
      created_at: new Date().toISOString(),
      created_by: user.id,
    };

    const { error: updateError } = await admin
      .from(table)
      .update({ attachments: [...currentAttachments, newAttachment] })
      .eq("id", target_id);

    if (updateError) {
      console.error("Update attachments error:", updateError);
    }

    // Also save summary URL on the recording itself
    if (recording_id) {
      await admin
        .from("zoom_recordings")
        .update({ summary_file_url: fileUrl } as any)
        .eq("id", recording_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        file_url: fileUrl,
        file_name: newAttachment.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── DOCX Builder ───

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function markdownToDocxParagraphs(md: string): string {
  const lines = md.split("\n");
  let paragraphs = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Heading 1
    if (/^# (.+)$/.test(trimmed)) {
      const text = trimmed.replace(/^# /, "");
      paragraphs += makeParagraph(text, "Heading1");
      continue;
    }
    // Heading 2
    if (/^## (.+)$/.test(trimmed)) {
      const text = trimmed.replace(/^## /, "");
      paragraphs += makeParagraph(text, "Heading2");
      continue;
    }
    // Heading 3
    if (/^### (.+)$/.test(trimmed)) {
      const text = trimmed.replace(/^### /, "");
      paragraphs += makeParagraph(text, "Heading3");
      continue;
    }
    // Bullet list
    if (/^[-*] (.+)$/.test(trimmed)) {
      const text = trimmed.replace(/^[-*] /, "");
      paragraphs += makeListParagraph(text);
      continue;
    }
    // Numbered list
    if (/^\d+\. (.+)$/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\. /, "");
      paragraphs += makeListParagraph(text);
      continue;
    }
    // Blockquote
    if (/^> (.+)$/.test(trimmed)) {
      const text = trimmed.replace(/^> /, "");
      paragraphs += makeBlockquote(text);
      continue;
    }
    // Regular paragraph
    paragraphs += makeParagraph(trimmed, "Normal");
  }

  return paragraphs;
}

function makeRuns(text: string): string {
  // Handle **bold** and *italic* inline formatting
  let runs = "";
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  for (const part of parts) {
    if (/^\*\*(.+)\*\*$/.test(part)) {
      const inner = part.replace(/^\*\*|\*\*$/g, "");
      runs += `<w:r><w:rPr><w:b/><w:bCs/><w:rtl/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
    } else if (/^\*(.+)\*$/.test(part)) {
      const inner = part.replace(/^\*|\*$/g, "");
      runs += `<w:r><w:rPr><w:i/><w:iCs/><w:rtl/></w:rPr><w:t xml:space="preserve">${escapeXml(inner)}</w:t></w:r>`;
    } else if (part) {
      runs += `<w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`;
    }
  }
  return runs;
}

function makeParagraph(text: string, style: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:bidi/></w:pPr>${makeRuns(text)}</w:p>`;
}

function makeListParagraph(text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:bidi/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${makeRuns(text)}</w:p>`;
}

function makeBlockquote(text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="Normal"/><w:bidi/><w:ind w:right="720"/><w:pBdr><w:right w:val="single" w:sz="12" w:space="4" w:color="3B82F6"/></w:pBdr></w:pPr>${makeRuns(text)}</w:p>`;
}

function buildDocx(summary: string, targetName: string, dateStr: string, recordingId?: string): Uint8Array {
  const bodyContent = markdownToDocxParagraphs(summary);

  const metaLine = `תאריך הפקה: ${dateStr}${recordingId ? ` | מזהה הקלטה: ${recordingId}` : ""}`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  mc:Ignorable="w14 wp14">
  <w:body>
    ${makeParagraph(`סיכום פגישה - ${targetName}`, "Heading1")}
    ${makeParagraph(metaLine, "Normal")}
    ${bodyContent}
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/>
      <w:sz w:val="24"/><w:szCs w:val="24"/>
      <w:lang w:bidi="he-IL"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:bidi/><w:spacing w:before="360" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="36"/><w:szCs w:val="36"/><w:color w:val="1A1A1A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:bidi/><w:spacing w:before="240" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="30"/><w:szCs w:val="30"/><w:color w:val="2563EB"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:pPr><w:bidi/><w:spacing w:before="200" w:after="60"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/><w:color w:val="4B5563"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:pPr><w:bidi/><w:ind w:right="720"/></w:pPr>
  </w:style>
</w:styles>`;

  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="right"/>
      <w:pPr><w:ind w:right="720" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

  const enc = new TextEncoder();
  const zipped = zipSync({
    "[Content_Types].xml": enc.encode(contentTypesXml),
    "_rels/.rels": enc.encode(relsXml),
    "word/document.xml": enc.encode(documentXml),
    "word/styles.xml": enc.encode(stylesXml),
    "word/numbering.xml": enc.encode(numberingXml),
    "word/_rels/document.xml.rels": enc.encode(docRelsXml),
  });

  return zipped;
}
