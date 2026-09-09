import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.0.0';
import { corsHeaders } from '../_shared/cors.ts';
import { saveSignedPdfToEntity } from '../_shared/signature-automation.ts';

/** DejaVu supports Hebrew + Latin (Helvetica/WinAnsi cannot encode Hebrew). */
const UI_FONT_URL =
  'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf';

async function embedUiFont(pdfDoc: PDFDocument) {
  try {
    pdfDoc.registerFontkit(fontkit);
    const res = await fetch(UI_FONT_URL);
    if (!res.ok) throw new Error(`font_fetch_${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    return await pdfDoc.embedFont(bytes, { subset: true });
  } catch (err) {
    console.warn('[generate-signed-pdf] hebrew font fallback', err);
    return await pdfDoc.embedFont(StandardFonts.Helvetica);
  }
}

function drawTextSafe(page: { drawText: (t: string, o: Record<string, unknown>) => void }, text: string, opts: Record<string, unknown>) {
  try {
    page.drawText(text, opts);
  } catch {
    const ascii = text.replace(/[^\x20-\x7E]/g, '?');
    page.drawText(ascii || '?', opts);
  }
}

interface SignaturePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

interface DocumentField {
  id: string;
  type: string;
  label: string;
  position: SignaturePosition;
  required?: boolean;
  recipient_index?: number;
}

interface RecipientRow {
  id: string;
  name: string;
  email: string;
  signature_data: string | null;
  signature_position: SignaturePosition | null;
  signed_at: string | null;
  status: string;
  sign_order: number | null;
  field_values: Record<string, string> | null;
}

function decodeBase64Png(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function fetchFileBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed_to_fetch_document: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function fetchDocumentBytes(
  supabase: ReturnType<typeof createClient>,
  fileUrl: string,
): Promise<Uint8Array> {
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fetchFileBytes(fileUrl);
  }

  const { data, error } = await supabase.storage.from('signature-documents').download(fileUrl);
  if (error || !data) throw error || new Error('failed_to_download_document');
  return new Uint8Array(await data.arrayBuffer());
}

function isPdfFile(fileUrl: string): boolean {
  return /\.pdf(\?|$)/i.test(fileUrl);
}

function isImageFile(fileUrl: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(fileUrl);
}

async function drawSignatureOnPage(
  pdfDoc: PDFDocument,
  pageIndex: number,
  pngBytes: Uint8Array,
  position: SignaturePosition | null,
  fallbackYOffset: number,
): Promise<void> {
  const pages = pdfDoc.getPages();
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const pngImage = await pdfDoc.embedPng(pngBytes);

  let x: number;
  let y: number;
  let sigWidth: number;
  let sigHeight: number;

  if (position) {
    sigWidth = (position.width / 100) * pageWidth;
    sigHeight = (position.height / 100) * pageHeight;
    x = (position.x / 100) * pageWidth;
    y = pageHeight - (position.y / 100) * pageHeight - sigHeight;
  } else {
    sigWidth = pageWidth * 0.3;
    sigHeight = pageHeight * 0.08;
    x = pageWidth * 0.1;
    y = pageHeight * 0.1 + fallbackYOffset * (sigHeight + 10);
  }

  page.drawImage(pngImage, { x, y, width: sigWidth, height: sigHeight });
}

async function drawTextOnPage(
  pdfDoc: PDFDocument,
  pageIndex: number,
  text: string,
  position: SignaturePosition,
  font: any,
): Promise<void> {
  const pages = pdfDoc.getPages();
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const boxWidth = (position.width / 100) * pageWidth;
  const boxHeight = (position.height / 100) * pageHeight;
  const x = (position.x / 100) * pageWidth;
  const y = pageHeight - (position.y / 100) * pageHeight - boxHeight * 0.7;
  const fontSize = Math.min(12, Math.max(7, boxHeight * 0.55));
  const maxChars = Math.floor(boxWidth / (fontSize * 0.5));
  drawTextSafe(page, text.slice(0, maxChars), { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
}

async function buildSignedPdf(doc: {
  title: string;
  content: string | null;
  file_url: string | null;
  document_type: string;
  document_fields?: DocumentField[] | null;
}, recipients: RecipientRow[], supabase: ReturnType<typeof createClient>): Promise<Uint8Array> {
  const signedRecipients = recipients.filter((r) => r.status === 'signed');
  let pdfDoc: PDFDocument;

  if (doc.file_url && isPdfFile(doc.file_url)) {
    const pdfBytes = await fetchDocumentBytes(supabase, doc.file_url);
    pdfDoc = await PDFDocument.load(pdfBytes);
  } else if (doc.file_url && isImageFile(doc.file_url)) {
    const imageBytes = await fetchDocumentBytes(supabase, doc.file_url);
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    const lower = doc.file_url.toLowerCase();
    let embedded;
    if (lower.includes('.png')) {
      embedded = await pdfDoc.embedPng(imageBytes);
    } else if (lower.includes('.jpg') || lower.includes('.jpeg')) {
      embedded = await pdfDoc.embedJpg(imageBytes);
    } else {
      try {
        embedded = await pdfDoc.embedPng(imageBytes);
      } catch {
        embedded = await pdfDoc.embedJpg(imageBytes);
      }
    }
    const scale = width / embedded.width;
    const imgW = width;
    const imgH = embedded.height * scale;
    page.drawImage(embedded, {
      x: 0,
      y: height - imgH,
      width: imgW,
      height: imgH,
    });
  } else {
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await embedUiFont(pdfDoc);
    const { height } = page.getSize();
    drawTextSafe(page, doc.title || 'Document', { x: 50, y: height - 60, size: 18, font, color: rgb(0, 0, 0) });
    const content = (doc.content || '').slice(0, 3000);
    const lines = content.split('\n');
    let yPos = height - 100;
    for (const line of lines) {
      if (yPos < 80) break;
      drawTextSafe(page, line.slice(0, 90), { x: 50, y: yPos, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
      yPos -= 16;
    }
  }

  let fallbackIndex = 0;
  const docFields = Array.isArray(doc.document_fields) ? doc.document_fields : [];
  const textFont = await embedUiFont(pdfDoc);

  for (const recipient of signedRecipients) {
    const recipientIndex = Math.max(0, (recipient.sign_order ?? 1) - 1);
    const values = recipient.field_values ?? {};

    if (docFields.length > 0) {
      for (const field of docFields) {
        if ((field.recipient_index ?? 0) !== recipientIndex) continue;
        const value = values[field.id];
        if (!value) continue;
        const pageIndex = Math.max(0, (field.position?.page ?? 1) - 1);

        if (field.type === 'signature') {
          const pngBytes = decodeBase64Png(value);
          await drawSignatureOnPage(pdfDoc, pageIndex, pngBytes, field.position, fallbackIndex);
        } else {
          await drawTextOnPage(pdfDoc, pageIndex, value, field.position, textFont);
        }
      }
    } else if (recipient.signature_data) {
      const pngBytes = decodeBase64Png(recipient.signature_data);
      const pageIndex = Math.max(0, (recipient.signature_position?.page ?? 1) - 1);
      await drawSignatureOnPage(pdfDoc, pageIndex, pngBytes, recipient.signature_position, fallbackIndex);
      fallbackIndex++;
    }
  }

  // Audit summary page
  const summaryPage = pdfDoc.addPage([595, 842]);
  const font = await embedUiFont(pdfDoc);
  const { height } = summaryPage.getSize();
  drawTextSafe(summaryPage, 'Signature Certificate', { x: 50, y: height - 50, size: 16, font });
  let y = height - 80;
  for (const r of signedRecipients) {
    const line = `${r.name} <${r.email}> - ${r.signed_at || 'signed'}`;
    drawTextSafe(summaryPage, line.slice(0, 80), { x: 50, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 18;
    if (y < 50) break;
  }

  return await pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!serviceKey || bearer !== serviceKey) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'missing_document_id' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey,
    );

    const { data: doc, error: docError } = await supabase
      .from('signature_documents')
      .select('id, title, content, file_url, document_type, tenant_id, status, document_fields, lead_id, client_id, saved_to_entity_at')
      .eq('id', documentId)
      .maybeSingle();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'document_not_found' }), { status: 404, headers: corsHeaders });
    }

    if (doc.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'document_not_completed' }), { status: 400, headers: corsHeaders });
    }

    const { data: recipients, error: recError } = await supabase
      .from('signature_recipients')
      .select('id, name, email, signature_data, signature_position, signed_at, status, sign_order, field_values')
      .eq('document_id', documentId)
      .order('sign_order');

    if (recError) throw recError;

    const pdfBytes = await buildSignedPdf(doc, recipients as RecipientRow[], supabase);
    const storagePath = `${doc.tenant_id}/signed/${documentId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('signature-documents')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from('signature_documents')
      .update({ signed_file_url: storagePath, updated_at: new Date().toISOString() })
      .eq('id', documentId);

    if (updateError) throw updateError;

    await supabase.rpc('log_signature_event', {
      _document_id: documentId,
      _recipient_id: null,
      _event_type: 'pdf_generated',
      _ip: null,
      _metadata: { path: storagePath },
    });

    if (!doc.saved_to_entity_at && (doc.lead_id || doc.client_id)) {
      try {
        await saveSignedPdfToEntity(supabase, {
          documentId,
          tenantId: doc.tenant_id,
          signedStoragePath: storagePath,
          title: doc.title,
          leadId: doc.lead_id,
          clientId: doc.client_id,
        });
      } catch (saveErr) {
        console.error('[generate-signed-pdf] entity save failed', saveErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, path: storagePath }),
      { status: 200, headers: corsHeaders },
    );
  } catch (e: unknown) {
    console.error('[generate-signed-pdf]', e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
