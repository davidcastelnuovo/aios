// Shared meeting-summary pipeline: AI summary → RTL DOCX → storage + attachments →
// optional auto marketing brief. Used by summarize-recording (manual, JWT) and
// ingest-extension-recording (automatic, after extension upload).
import { zipSync } from "https://esm.sh/fflate@0.8.2";

export class AiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ─── AI summary ───

export async function generateMeetingSummary(
  openaiKey: string,
  transcript: string,
  recordingInfo: string,
  focusPrompt: string,
): Promise<string> {
  const aiResponse = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: "system",
            content: `אתה עוזר מקצועי לסיכום פגישות עסקיות. כתוב סיכום מקיף, ברור ומאורגן בעברית, בפורמט Markdown.
אל תמציא מידע — סכם רק מה שמופיע בתמלול. אם סעיף מסוים לא רלוונטי לפגישה, השמט אותו לגמרי (אל תכתוב "אין").
אם התמלול כולל תוויות דוברים (שמות או "מקליט:"/"משתתפים:" עם חותמות זמן) — נצל אותן: שייך אמירות, החלטות ומשימות לאדם הנכון בשמו.

מבנה הסיכום (בסדר הזה):
## תקציר מנהלים
2–4 משפטים שמסכמים את מהות הפגישה והתוצאה שלה.

## נושאים שנדונו
לכל נושא: כותרת קצרה (###) ופסקה או נקודות שמסכמות את הדיון, כולל עמדות של דוברים שונים.

## החלטות
רשימת ההחלטות שהתקבלו, כל החלטה בשורה.

## משימות לביצוע
טבלה: | משימה | אחראי | דדליין (אם צוין) |

## נקודות חשובות
נקודות כאב, הזדמנויות, סיכונים או דגשים שעלו — במיוחד מדברי הלקוח.

## ציטוטים מרכזיים
2–4 ציטוטים חשובים, כל אחד עם שם הדובר.

## שלבים הבאים
מה קורה אחרי הפגישה, כולל פגישות המשך אם נקבעו.`,
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
      throw new AiHttpError(429, "חריגה ממגבלת בקשות, נסה שוב בעוד כמה דקות");
    }
    if (aiResponse.status === 402) {
      throw new AiHttpError(402, "נדרש תשלום - נא להוסיף קרדיטים");
    }
    const errText = await aiResponse.text();
    console.error("AI error:", aiResponse.status, errText);
    throw new Error("שגיאה ביצירת סיכום AI");
  }

  const aiData = await aiResponse.json();
  const summary = aiData.choices?.[0]?.message?.content;
  if (!summary) throw new Error("לא התקבל סיכום מה-AI");
  return summary;
}

// ─── Save summary: DOCX → storage → attachments → summary_file_url ───

export interface SaveSummaryOptions {
  tenant_id: string;
  target_type: "client" | "lead";
  target_id: string;
  target_name: string;
  summary: string;
  recording_id?: string | null;
  created_by?: string | null;
}

export async function saveSummaryForTarget(
  // deno-lint-ignore no-explicit-any
  admin: any,
  opts: SaveSummaryOptions,
): Promise<{ fileUrl: string; fileName: string }> {
  const { tenant_id, target_type, target_id, target_name, summary, recording_id, created_by } = opts;

  const dateStr = new Date().toLocaleDateString("he-IL");
  const docxBytes = buildDocx(summary, target_name, dateStr, recording_id ?? undefined);

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

  // Get signed URL (bucket is private)
  const { data: urlData, error: urlError } = await admin.storage.from("recordings").createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10);
  if (urlError || !urlData) throw new Error("Failed to sign recording URL: " + (urlError?.message ?? ""));
  const fileUrl = urlData.signedUrl;

  // Add to client/lead attachments
  const table = target_type === "client" ? "clients" : "leads";
  const { data: targetData } = await admin
    .from(table)
    .select("attachments")
    .eq("id", target_id)
    .maybeSingle();

  // deno-lint-ignore no-explicit-any
  const currentAttachments = (targetData?.attachments as any[]) || [];
  const newAttachment = {
    name: `סיכום פגישה - ${dateStr}.docx`,
    url: fileUrl,
    type: "meeting_summary",
    created_at: new Date().toISOString(),
    created_by: created_by ?? null,
  };

  const { error: updateError } = await admin
    .from(table)
    .update({ attachments: [...currentAttachments, newAttachment] })
    .eq("id", target_id);

  if (updateError) {
    console.error("Update attachments error:", updateError);
  }

  // Also persist the summary on the recording itself — the raw Markdown is
  // what the UI renders in-app; the DOCX is for download/sharing.
  if (recording_id) {
    await admin
      .from("zoom_recordings")
      // deno-lint-ignore no-explicit-any
      .update({
        summary_file_url: fileUrl,
        summary_md: summary,
        summary_generated_at: new Date().toISOString(),
      } as any)
      .eq("id", recording_id);
  }

  return { fileUrl, fileName: newAttachment.name };
}

// ─── Auto-detect marketing needs and create a brief work item ───

export interface MarketingBriefOptions {
  summary: string;
  tenant_id: string;
  client_id: string;
  recording_id?: string | null;
  fileUrl: string;
  source: string; // e.g. 'zoom_meeting' | 'chrome_extension'
}

export async function maybeCreateMarketingBrief(
  // deno-lint-ignore no-explicit-any
  admin: any,
  openaiKey: string,
  opts: MarketingBriefOptions,
): Promise<{ created: boolean; workItemId: string | null }> {
  const { summary, tenant_id, client_id, recording_id, fileUrl, source } = opts;
  try {
    const briefDetectRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `אתה מנתח פגישות שיווקיות. קרא את סיכום הפגישה וזהה אם יש צרכי שיווק (קמפיינים, תוכן, SEO, סושיאל, קופי, גרפיקה, מודעות). אם יש — החזר JSON בפורמט: {"has_marketing_needs": true, "brief_title": "כותרת", "brief_content": "תיאור צרכים", "tracks": ["campaigns","social_organic","seo_geo"]}. אם אין — {"has_marketing_needs": false}.`,
          },
          { role: "user", content: `סיכום הפגישה:\n${summary}` },
        ],
      }),
    });
    if (briefDetectRes.ok) {
      const briefData = await briefDetectRes.json();
      const briefJson = JSON.parse(briefData.choices?.[0]?.message?.content ?? "{}");
      if (briefJson.has_marketing_needs && briefJson.brief_title) {
        const validTracks = new Set(["campaigns", "social_organic", "seo_geo"]);
        const detectedTracks = Array.from(
          new Set(
            (Array.isArray(briefJson.tracks) ? briefJson.tracks : ["campaigns"])
              .map((track: unknown) => String(track))
              .filter((track: string) => validTracks.has(track)),
          ),
        ) as string[];
        const tracks = detectedTracks.length > 0 ? detectedTracks : ["campaigns"];
        let firstWorkItemId: string | null = null;

        for (const track of tracks) {
          // A summarizer retry must not create the same brief twice.
          if (recording_id) {
            const { data: existing } = await admin
              .from("marketing_work_items")
              .select("id")
              .eq("tenant_id", tenant_id)
              .eq("client_id", client_id)
              .contains("payload", { source_recording_id: recording_id, source_track: track })
              .maybeSingle();
            if (existing?.id) {
              firstWorkItemId ??= existing.id;
              continue;
            }
          }

          const { data: pipeline } = await admin
            .from("marketing_pipelines")
            .select("id")
            .eq("client_id", client_id)
            .eq("tenant_id", tenant_id)
            .eq("track", track)
            .maybeSingle();
          if (!pipeline) {
            console.warn(`[MARKETING] No ${track} pipeline for client ${client_id}`);
            continue;
          }

          const { data: briefStage } = await admin
            .from("marketing_pipeline_stages")
            .select("id")
            .eq("pipeline_id", pipeline.id)
            .eq("stage_type", "strategy")
            .maybeSingle();
          if (!briefStage) continue;

          const { data: workItem } = await admin
            .from("marketing_work_items")
            .insert({
              pipeline_id: pipeline.id,
              tenant_id,
              client_id,
              current_stage_id: briefStage.id,
              title: briefJson.brief_title,
              status: "draft",
              payload: {
                brief_text: briefJson.brief_content ?? "",
                source,
                source_recording_id: recording_id ?? null,
                source_summary_url: fileUrl,
                source_track: track,
                tracks,
                meeting_date: new Date().toISOString(),
              },
            })
            .select("id")
            .single();

          if (workItem?.id) {
            firstWorkItemId ??= workItem.id;
            console.log(`[MARKETING] Auto-brief created for ${track}: ${workItem.id}`);
          }
        }

        if (firstWorkItemId) {
          return { created: true, workItemId: firstWorkItemId };
        }
      }
    }
  } catch (briefErr) {
    console.error("[MARKETING] Auto-brief failed (non-fatal):", briefErr);
  }
  return { created: false, workItemId: null };
}

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

export function buildDocx(summary: string, targetName: string, dateStr: string, recordingId?: string): Uint8Array {
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
