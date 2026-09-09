/**
 * AIOS signature stamp / certificate graphics.
 * Renders Hebrew via SVG + resvg (HarfBuzz), not pdf-lib text drawing.
 */
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm@2.6.2';

const UI_FONT_URL =
  'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf';
const UI_FONT_BOLD_URL =
  'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf';

let wasmReady: Promise<void> | null = null;
let fontRegular: Uint8Array | null = null;
let fontBold: Uint8Array | null = null;

async function ensureGraphicsRuntime() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const wasmRes = await fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm');
      if (!wasmRes.ok) throw new Error(`resvg_wasm_fetch_${wasmRes.status}`);
      await initWasm(wasmRes);
    })();
  }
  await wasmReady;

  if (!fontRegular || !fontBold) {
    const [reg, bold] = await Promise.all([
      fetch(UI_FONT_URL).then(async (r) => {
        if (!r.ok) throw new Error(`font_fetch_${r.status}`);
        return new Uint8Array(await r.arrayBuffer());
      }),
      fetch(UI_FONT_BOLD_URL).then(async (r) => {
        if (!r.ok) throw new Error(`font_bold_fetch_${r.status}`);
        return new Uint8Array(await r.arrayBuffer());
      }),
    ]);
    fontRegular = reg;
    fontBold = bold;
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Israel-local date + time for stamp display. */
export function formatStampDateTime(iso: string | null | undefined): { date: string; time: string; full: string } {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    return { date: '—', time: '—', full: '—' };
  }
  const fmt = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const date = `${parts.day}/${parts.month}/${parts.year}`;
  const time = `${parts.hour}:${parts.minute}`;
  return { date, time, full: `${date} ${time}` };
}

export function buildCertificateId(documentId: string, signedAt?: string | null): string {
  const day = (signedAt ? new Date(signedAt) : new Date()).toISOString().slice(0, 10).replace(/-/g, '');
  const short = documentId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `AIOS-SIG-${day}-${short}`;
}

function renderSvgToPng(svg: string, width: number): Uint8Array {
  if (!fontRegular || !fontBold) throw new Error('fonts_not_loaded');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      fontBuffers: [fontRegular, fontBold],
      defaultFontFamily: 'DejaVu Sans',
      loadSystemFonts: false,
    },
    background: 'rgba(0,0,0,0)',
  });
  return resvg.render().asPng();
}

export interface StampRenderInput {
  signedAt?: string | null;
  certificateId: string;
  signerName?: string;
  documentTitle?: string;
}

/** Transparent ink-style circular stamp with correct Hebrew RTL. */
export async function renderAiosStampPng(input: StampRenderInput): Promise<Uint8Array> {
  await ensureGraphicsRuntime();
  const { date, time } = formatStampDateTime(input.signedAt);
  const cert = escapeXml(input.certificateId);
  const size = 640;
  const c = size / 2;
  const r = 250;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <!-- Authentic rubber-stamp ink: blotchy coverage + rough edges + slight bleed -->
    <filter id="stampInk" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="4" seed="7" result="grain"/>
      <feColorMatrix in="grain" type="matrix"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 1.55 -0.35"
        result="grainMask"/>
      <feComposite in="SourceGraphic" in2="grainMask" operator="in" result="blotched"/>
      <feTurbulence type="turbulence" baseFrequency="0.08" numOctaves="2" seed="3" result="warpNoise"/>
      <feDisplacementMap in="blotched" in2="warpNoise" scale="2.8" xChannelSelector="R" yChannelSelector="G" result="warped"/>
      <feGaussianBlur in="warped" stdDeviation="0.35" result="bleed"/>
      <feBlend in="bleed" in2="warped" mode="multiply" result="inked"/>
      <feComponentTransfer in="inked">
        <feFuncA type="linear" slope="1.15" intercept="-0.02"/>
      </feComponentTransfer>
    </filter>
    <style>
      .he {
        font-family: 'DejaVu Sans';
        direction: rtl;
        unicode-bidi: plaintext;
        fill: #8E2424;
      }
      .brand {
        font-family: 'DejaVu Sans';
        font-weight: 700;
        fill: #8E2424;
      }
      .meta {
        font-family: 'DejaVu Sans';
        fill: #7A2A2A;
      }
      .ring {
        fill: none;
        stroke: #8E2424;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    </style>
  </defs>
  <!-- Transparent canvas — ink only -->
  <g transform="rotate(-10 ${c} ${c})" opacity="0.86" filter="url(#stampInk)">
    <!-- Soft under-ink ghost for pressure unevenness -->
    <g opacity="0.28" transform="translate(1.6,1.2)">
      <circle class="ring" cx="${c}" cy="${c}" r="${r}" stroke-width="13"/>
      <text class="he" x="${c}" y="${c - 86}" text-anchor="middle" font-size="36" font-weight="700">נחתם ותועד</text>
      <text class="brand" x="${c}" y="${c + 4}" text-anchor="middle" font-size="54">aios</text>
    </g>

    <circle class="ring" cx="${c}" cy="${c}" r="${r}" stroke-width="12"/>
    <circle class="ring" cx="${c}" cy="${c}" r="${r - 16}" stroke-width="3.4"/>
    <circle class="ring" cx="${c}" cy="${c}" r="${r - 32}" stroke-width="2.1" stroke-dasharray="1.8 5.5"/>

    <text class="he" x="${c}" y="${c - 86}" text-anchor="middle" font-size="36" font-weight="700">נחתם ותועד</text>
    <text class="he" x="${c}" y="${c - 44}" text-anchor="middle" font-size="26">על ידי</text>
    <text class="brand" x="${c}" y="${c + 4}" text-anchor="middle" font-size="54">aios</text>

    <line x1="${c - 118}" y1="${c + 24}" x2="${c + 118}" y2="${c + 24}" stroke="#8E2424" stroke-width="1.7" opacity="0.8" stroke-linecap="round"/>

    <text class="he" x="${c}" y="${c + 56}" text-anchor="middle" font-size="20">תאריך: ${escapeXml(date)}</text>
    <text class="he" x="${c}" y="${c + 84}" text-anchor="middle" font-size="20">שעה: ${escapeXml(time)}</text>
    <text class="meta" x="${c}" y="${c + 120}" text-anchor="middle" font-size="13">SPEC ${cert}</text>
  </g>
</svg>`;

  return renderSvgToPng(svg, 420);
}

/** Certificate details card with Hebrew RTL (transparent-friendly white panel). */
export async function renderCertificateCardPng(input: StampRenderInput & {
  signerEmail?: string;
}): Promise<Uint8Array> {
  await ensureGraphicsRuntime();
  const { full } = formatStampDateTime(input.signedAt);
  const title = escapeXml(input.documentTitle || 'מסמך');
  const name = escapeXml(input.signerName || '—');
  const email = escapeXml(input.signerEmail || '');
  const cert = escapeXml(input.certificateId);
  const w = 900;
  const h = 320;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <style>
      .he { font-family: 'DejaVu Sans'; direction: rtl; unicode-bidi: plaintext; fill: #163A5F; }
      .muted { font-family: 'DejaVu Sans'; fill: #5A6B7A; }
      .brand { font-family: 'DejaVu Sans'; font-weight: 700; fill: #163A5F; }
    </style>
  </defs>
  <rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="14" fill="#ffffff" fill-opacity="0.92" stroke="#163A5F" stroke-width="2"/>
  <text class="he" x="${w - 36}" y="58" text-anchor="end" font-size="28" font-weight="700">אישור חתימה דיגיטלית</text>
  <text class="muted" x="36" y="54" text-anchor="start" font-size="16">Digital Signature Certificate</text>
  <line x1="36" y1="74" x2="${w - 36}" y2="74" stroke="#D0D7DE" stroke-width="1"/>

  <text class="he" x="${w - 36}" y="118" text-anchor="end" font-size="20">מסמך: ${title}</text>
  <text class="he" x="${w - 36}" y="152" text-anchor="end" font-size="20">חותם: ${name}</text>
  <text class="muted" x="36" y="152" text-anchor="start" font-size="16">${email}</text>
  <text class="he" x="${w - 36}" y="186" text-anchor="end" font-size="18">תאריך ושעת חתימה: ${escapeXml(full)}</text>
  <text class="he" x="${w - 36}" y="222" text-anchor="end" font-size="18">מפרט אישור (Specification):</text>
  <text class="brand" x="${w - 36}" y="256" text-anchor="end" font-size="18">${cert}</text>
  <text class="muted" x="36" y="256" text-anchor="start" font-size="14">aios.co.il</text>
</svg>`;

  return renderSvgToPng(svg, 520);
}

export interface BusinessStampInput {
  businessName: string;
  companyId?: string | null;
}

/** Gray rubber-style business stamp drawn under the client's handwritten signature. */
export async function renderBusinessStampPng(input: BusinessStampInput): Promise<Uint8Array | null> {
  const businessName = (input.businessName || '').trim();
  if (!businessName) return null;
  await ensureGraphicsRuntime();

  const companyId = (input.companyId || '').trim();
  const idLine = companyId
    ? (companyId.match(/^[0-9]+$/) ? `ח.פ/ע.מ ${companyId}` : companyId)
    : '';

  const w = 720;
  const h = 280;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="bizInk" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="11" result="grain"/>
      <feColorMatrix in="grain" type="matrix"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 1.4 -0.28"
        result="grainMask"/>
      <feComposite in="SourceGraphic" in2="grainMask" operator="in" result="blotched"/>
      <feTurbulence type="turbulence" baseFrequency="0.06" numOctaves="2" seed="5" result="warpNoise"/>
      <feDisplacementMap in="blotched" in2="warpNoise" scale="1.8" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <style>
      .he {
        font-family: 'DejaVu Sans';
        direction: rtl;
        unicode-bidi: plaintext;
        fill: #6B7280;
      }
    </style>
  </defs>
  <g opacity="0.72" filter="url(#bizInk)" transform="rotate(-2 ${w / 2} ${h / 2})">
    <text class="he" x="${w / 2}" y="${idLine ? 118 : 150}" text-anchor="middle" font-size="42" font-weight="700">${escapeXml(businessName)}</text>
    ${idLine ? `<text class="he" x="${w / 2}" y="178" text-anchor="middle" font-size="28">${escapeXml(idLine)}</text>` : ''}
  </g>
</svg>`;

  return renderSvgToPng(svg, 360);
}
