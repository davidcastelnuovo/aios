import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import { corsHeaders } from '../_shared/cors.ts';

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

function isImageUrl(url: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

async function fetchFileBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed_to_fetch_document: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
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
  page.drawText(text.slice(0, maxChars), { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
}

async function buildSignedPdf(doc: {
  title: string;
  content: string | null;
  file_url: string | null;
  document_type: string;
  document_fields?: DocumentField[] | null;
}, recipients: RecipientRow[]): Promise<Uint8Array> {
  const signedRecipients = recipients.filter((r) => r.status === 'signed');
  let pdfDoc: PDFDocument;

  if (doc.file_url && isPdfUrl(doc.file_url)) {
    const pdfBytes = await fetchFileBytes(doc.file_url);
    pdfDoc = await PDFDocument.load(pdfBytes);
  } else if (doc.file_url && isImageUrl(doc.file_url)) {
    const imageBytes = await fetchFileBytes(doc.file_url);
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
    const scale = Math.min(width / embedded.width, height / embedded.height);
    const imgW = embedded.width * scale;
    const imgH = embedded.height * scale;
    page.drawImage(embedded, {
      x: (width - imgW) / 2,
      y: (height - imgH) / 2,
      width: imgW,
      height: imgH,
    });
  } else {
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const { width, height } = page.getSize();
    page.drawText(doc.title || 'Document', { x: 50, y: height - 60, size: 18, font, color: rgb(0, 0, 0) });
    const content = (doc.content || '').slice(0, 3000);
    const lines = content.split('\n');
    let yPos = height - 100;
    for (const line of lines) {
      if (yPos < 80) break;
      page.drawText(line.slice(0, 90), { x: 50, y: yPos, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
      yPos -= 16;
    }
  }

  let fallbackIndex = 0;
  const docFields = Array.isArray(doc.document_fields) ? doc.document_fields : [];
  const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

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
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { height } = summaryPage.getSize();
  summaryPage.drawText('Signature Certificate', { x: 50, y: height - 50, size: 16, font });
  let y = height - 80;
  for (const r of signedRecipients) {
    const line = `${r.name} <${r.email}> - ${r.signed_at || 'signed'}`;
    summaryPage.drawText(line.slice(0, 80), { x: 50, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
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
      .select('id, title, content, file_url, document_type, tenant_id, status, document_fields')
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

    const pdfBytes = await buildSignedPdf(doc, recipients as RecipientRow[]);
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
