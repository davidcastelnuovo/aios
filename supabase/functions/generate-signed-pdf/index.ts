import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.0.0';
import { corsHeaders } from '../_shared/cors.ts';
import { saveSignedPdfToEntity } from '../_shared/signature-automation.ts';

/** DejaVu supports Hebrew + Latin (Helvetica/WinAnsi cannot encode Hebrew). */
const UI_FONT_URL =
  'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf';
const UI_FONT_BOLD_URL =
  'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf';

const AIOS_INK = rgb(0.07, 0.25, 0.45);
const AIOS_INK_SOFT = rgb(0.12, 0.35, 0.55);
const AIOS_MUTED = rgb(0.35, 0.4, 0.45);

type PdfFont = {
  widthOfTextAtSize: (t: string, s: number) => number;
};

type PdfPage = {
  drawText: (t: string, o: Record<string, unknown>) => void;
  drawCircle: (o: Record<string, unknown>) => void;
  drawRectangle: (o: Record<string, unknown>) => void;
  drawLine: (o: Record<string, unknown>) => void;
  getWidth: () => number;
  getHeight: () => number;
  getSize: () => { width: number; height: number };
};

async function embedUiFont(pdfDoc: PDFDocument, bold = false) {
  try {
    pdfDoc.registerFontkit(fontkit);
    const res = await fetch(bold ? UI_FONT_BOLD_URL : UI_FONT_URL);
    if (!res.ok) throw new Error(`font_fetch_${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    return await pdfDoc.embedFont(bytes, { subset: true });
  } catch (err) {
    console.warn('[generate-signed-pdf] hebrew font fallback', err);
    return await pdfDoc.embedFont(bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
  }
}

/** pdf-lib draws LTR; reverse Hebrew runs so they render visually correct. */
function preparePdfText(text: string): string {
  return text.replace(/[\u0590-\u05FF]+/g, (run) => Array.from(run).reverse().join(''));
}

function drawTextSafe(page: { drawText: (t: string, o: Record<string, unknown>) => void }, text: string, opts: Record<string, unknown>) {
  const prepared = preparePdfText(text);
  try {
    page.drawText(prepared, opts);
  } catch {
    const ascii = prepared.replace(/[^\x20-\x7E]/g, '?');
    page.drawText(ascii || '?', opts);
  }
}

function formatSignedAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} UTC`;
}

function centerText(
  page: PdfPage,
  text: string,
  y: number,
  size: number,
  font: PdfFont,
  color = AIOS_INK,
) {
  const prepared = preparePdfText(text);
  const width = font.widthOfTextAtSize(prepared, size);
  drawTextSafe(page, text, {
    x: (page.getWidth() - width) / 2,
    y,
    size,
    font,
    color,
  });
}

function drawAiosStamp(
  page: PdfPage,
  font: PdfFont,
  fontBold: PdfFont,
  cx: number,
  cy: number,
  radius = 72,
) {
  // Soft fill so stamp sits on top of document content cleanly
  page.drawCircle({
    x: cx,
    y: cy,
    size: radius,
    color: rgb(1, 1, 1),
    opacity: 0.96,
    borderWidth: 0,
  });

  // Classic seal rings
  page.drawCircle({
    x: cx,
    y: cy,
    size: radius,
    borderColor: AIOS_INK,
    borderWidth: 3,
    borderOpacity: 1,
  });
  page.drawCircle({
    x: cx,
    y: cy,
    size: radius - 5,
    borderColor: AIOS_INK_SOFT,
    borderWidth: 1.4,
    borderOpacity: 0.95,
  });
  page.drawCircle({
    x: cx,
    y: cy,
    size: radius - 10,
    borderColor: AIOS_INK,
    borderWidth: 0.8,
    borderOpacity: 0.65,
  });

  // Decorative tick marks around the seal
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const inner = radius - 14;
    const outer = radius - 11.2;
    page.drawLine({
      start: { x: cx + Math.cos(angle) * inner, y: cy + Math.sin(angle) * inner },
      end: { x: cx + Math.cos(angle) * outer, y: cy + Math.sin(angle) * outer },
      thickness: 0.7,
      color: AIOS_INK_SOFT,
      opacity: 0.75,
    });
  }

  const line1 = 'נחתם ותועד';
  const line2 = 'על ידי';
  const brand = 'aios';

  const s1 = Math.max(10, Math.round(radius * 0.17));
  const s2 = Math.max(9, Math.round(radius * 0.14));
  const s3 = Math.max(14, Math.round(radius * 0.24));
  const w1 = fontBold.widthOfTextAtSize(preparePdfText(line1), s1);
  const w2 = font.widthOfTextAtSize(preparePdfText(line2), s2);
  const w3 = fontBold.widthOfTextAtSize(brand, s3);

  drawTextSafe(page, line1, { x: cx - w1 / 2, y: cy + radius * 0.18, size: s1, font: fontBold, color: AIOS_INK });
  drawTextSafe(page, line2, { x: cx - w2 / 2, y: cy - radius * 0.02, size: s2, font, color: AIOS_INK_SOFT });
  drawTextSafe(page, brand, { x: cx - w3 / 2, y: cy - radius * 0.32, size: s3, font: fontBold, color: AIOS_INK });
}

function drawRtlLine(
  page: PdfPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PdfFont,
  color: ReturnType<typeof rgb>,
) {
  const prepared = preparePdfText(text);
  const width = font.widthOfTextAtSize(prepared, size);
  drawTextSafe(page, text, { x: rightX - width, y, size, font, color });
}

function drawCertificatePage(
  page: PdfPage,
  font: PdfFont,
  fontBold: PdfFont,
  doc: { id?: string; title?: string },
  signedRecipients: RecipientRow[],
) {
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 36,
    y: 36,
    width: width - 72,
    height: height - 72,
    borderColor: AIOS_INK,
    borderWidth: 1.4,
    color: rgb(0.985, 0.99, 1),
  });
  page.drawRectangle({
    x: 44,
    y: 44,
    width: width - 88,
    height: height - 88,
    borderColor: AIOS_INK_SOFT,
    borderWidth: 0.7,
    borderOpacity: 0.75,
  });

  centerText(page, 'אישור חתימה דיגיטלית', height - 88, 20, fontBold, AIOS_INK);
  centerText(page, 'Digital Signature Certificate', height - 110, 10, font, AIOS_MUTED);

  drawAiosStamp(page, font, fontBold, width / 2, height - 228, 80);

  const cardX = 70;
  const cardW = width - 140;
  let cardY = height - 360;
  const cardHeight = Math.max(78, 48 + signedRecipients.length * 56);
  page.drawRectangle({
    x: cardX,
    y: cardY + 18 - cardHeight,
    width: cardW,
    height: cardHeight,
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 0.9,
    color: rgb(1, 1, 1),
  });

  const right = cardX + cardW - 18;
  const title = doc.title?.trim() || 'מסמך';
  drawRtlLine(page, `מסמך: ${title}`, right, cardY, 11, fontBold, AIOS_INK);
  cardY -= 20;
  if (doc.id) {
    drawTextSafe(page, `Document ID: ${doc.id}`, {
      x: cardX + 16,
      y: cardY,
      size: 8,
      font,
      color: AIOS_MUTED,
    });
    cardY -= 18;
  }

  page.drawLine({
    start: { x: cardX + 16, y: cardY + 6 },
    end: { x: cardX + cardW - 16, y: cardY + 6 },
    thickness: 0.5,
    color: rgb(0.85, 0.88, 0.92),
  });
  cardY -= 14;

  for (const r of signedRecipients) {
    drawRtlLine(page, `חותם: ${r.name || '—'}`, right, cardY, 11, fontBold, AIOS_INK);
    cardY -= 16;
    drawTextSafe(page, r.email || '', {
      x: cardX + 16,
      y: cardY,
      size: 9,
      font,
      color: AIOS_MUTED,
    });
    cardY -= 14;
    drawRtlLine(page, `נחתם ב־${formatSignedAt(r.signed_at)}`, right, cardY, 9, font, AIOS_MUTED);
    cardY -= 26;
    if (cardY < 90) break;
  }

  centerText(page, 'נחתם ותועד על ידי aios', 72, 11, fontBold, AIOS_INK_SOFT);
  centerText(page, 'aios.co.il', 54, 8, font, AIOS_MUTED);
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
  font: PdfFont,
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
  id?: string;
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
  const fontBold = await embedUiFont(pdfDoc, true);

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

  // Compact stamp on the last content page (before certificate)
  const contentPages = pdfDoc.getPages();
  if (contentPages.length > 0) {
    const lastContent = contentPages[contentPages.length - 1] as unknown as PdfPage;
    const { width } = lastContent.getSize();
    drawAiosStamp(lastContent, textFont, fontBold, width - 95, 95, 52);
  }

  const summaryPage = pdfDoc.addPage([595, 842]) as unknown as PdfPage;
  drawCertificatePage(summaryPage, textFont, fontBold, doc, signedRecipients);

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
