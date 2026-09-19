const XLSX = require('xlsx');
const { randomUUID } = require('crypto');
const { writeFileSync } = require('fs');

const TENANT = 'ac7f9a3e-a042-4a64-afea-53e21a544d3d';
const AGENCY = '46821b91-6bfa-45af-b71d-e2d7e9468244';
const USER = 'ac7b2493-dcfa-47d8-80cc-b3900a406c46';
const TAG_ID = '6ff6a906-acf4-47b5-8aa9-69b56317c97c';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const API = 'https://api.supabase.com/v1/projects/zvoijyneresvkadpprel/database/query';

function compactText(value) {
  return String(value || '').toLowerCase().replace(/[\s_\-–—'"`״׳]/g, '');
}

function inferLeadSource(raw) {
  if (!raw || !String(raw).trim()) return 'other';
  const v = compactText(raw);
  if (v.includes('קמפיין') || v.includes('הלפ') || v.includes('help4u')) return 'paid_ads';
  if (v.includes('פנימי')) return 'referral';
  return 'other';
}

function parseDate(val) {
  if (!val) return null;
  const strVal = String(val).trim();
  if (!strVal) return null;
  const isValidYear = (y) => y >= 1900 && y <= 2100;

  const slashParts = strVal.split('/');
  if (slashParts.length === 3) {
    const day = parseInt(slashParts[0], 10);
    const month = parseInt(slashParts[1], 10);
    let year = parseInt(slashParts[2], 10);
    if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
    if (isValidYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime()) && d.getFullYear() === year) return d.toISOString().split('T')[0];
    }
  }

  const otherParts = strVal.split(/[-.]/).filter(Boolean);
  if (otherParts.length === 3) {
    const day = parseInt(otherParts[0], 10);
    const month = parseInt(otherParts[1], 10);
    const year = parseInt(otherParts[2], 10);
    if (isValidYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime()) && d.getFullYear() === year) return d.toISOString().split('T')[0];
    }
  }

  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + val * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
}

function normalizePhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/[^0-9]/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('972')) return d;
  if (d.startsWith('0')) return '972' + d.slice(1);
  return d.length >= 9 ? '972' + d : d;
}

function sqlEscape(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function classifyStatus(statusRaw, relevantRaw) {
  const status = String(statusRaw || '').trim();
  const relevant = String(relevantRaw || '').trim();
  const n = compactText(status);
  const relN = compactText(relevant);

  let pipelineStatus = 'new';
  let responseStatus = null;
  const extraNotes = [];

  if (status === 'V' || status === 'v' || status === 'וי' || status === 'ו') {
    return { pipelineStatus: 'closed', responseStatus: null, extraNotes, wonDate: true };
  }
  if (status === 'X' || status === 'x') {
    return { pipelineStatus: 'new', responseStatus: 'x', extraNotes, wonDate: false };
  }

  if (relN.includes('לארלוונטי') || relN.includes('לאלרוונטי')) {
    responseStatus = 'not_relevant';
  }
  if (n.includes('לארלוונטי') || n.includes('לאלרוונטי') || n.includes('לארלווטני')) {
    responseStatus = 'not_relevant';
  }
  if (n.includes('איןמענה') || n.includes('ללאמענה') || n.includes('לאמענה')) {
    responseStatus = 'no_answer_1';
  }

  if (/נשלחההצעה|נשלחההצעת|נשלחההצעתדוגמא/.test(n)) pipelineStatus = 'proposal_sent';
  else if (/נשלחהסכם|נשלחהסכםלחתימה|נשלחהסכםלדוגמא|לשלוחהסכם/.test(n)) pipelineStatus = 'proposal_sent';
  else if (/משאומתן|ממתיןלהחלטה/.test(n)) pipelineStatus = 'negotiation';
  else if (/נקבעהפגישה|בתיאום/.test(n)) pipelineStatus = 'meeting_scheduled';
  else if (/יצרנוקשר/.test(n)) pipelineStatus = 'contacted';
  else if (/עושהבעצמו/.test(n)) {
    responseStatus = responseStatus || 'not_relevant';
  }

  if (status && !['V', 'v', 'X', 'x', 'וי', 'ו'].includes(status) && !responseStatus && pipelineStatus === 'new') {
    if (!/^\d/.test(status) && status.length > 3) extraNotes.push(`סטאטוס מקורי: ${status}`);
  }

  return { pipelineStatus, responseStatus, extraNotes, wonDate: false };
}

async function runQuery(query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Query failed (${res.status}): ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return text; }
}

(async () => {
  const wb = XLSX.readFile('/tmp/psg_leads.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { defval: '' });

  const leads = [];
  const tagLinks = [];

  for (const row of rows) {
    const company = String(row['שם מעסיק'] || '').trim();
    const contact = String(row['איש קשר'] || '').trim();
    const phone = normalizePhone(row['טלפון '] || row['טלפון']);
    const note1 = String(row['הערה '] || row['הערה'] || '').trim();
    const note2 = String(row['הערות נוספות'] || '').trim();
    const sourceRaw = String(row['מקור ליד'] || '').trim();
    const companyId = String(row['ח.פ.'] || '').trim();
    const employeeCount = String(row['מספר עובדים'] || '').trim();
    const handler = String(row['מטפל'] || '').trim();
    const followUp = parseDate(row['ת.עדכון']);
    const { pipelineStatus, responseStatus, extraNotes, wonDate } = classifyStatus(row['סטאטוס'], row['רלוונטי']);

    if (!company && !contact && !phone && !note1 && !note2) continue;

    const notesParts = [note1, note2, ...extraNotes].filter(Boolean);
    const formData = {};
    if (companyId) formData['ח.פ.'] = companyId;
    if (employeeCount) formData['מספר עובדים'] = employeeCount;
    if (handler) formData['מטפל'] = handler;

    const id = randomUUID();
    const lead = {
      id,
      tenant_id: TENANT,
      agency_id: AGENCY,
      company_name: company || contact || (phone ? `ליד ${phone}` : 'ליד ללא שם'),
      contact_name: contact || null,
      phone,
      source: inferLeadSource(sourceRaw),
      campaign_name: sourceRaw || null,
      status: pipelineStatus,
      response_status: responseStatus,
      notes: notesParts.length ? notesParts.join('\n') : null,
      follow_up_date: followUp,
      form_data: Object.keys(formData).length ? formData : null,
      created_at: followUp ? `${followUp}T08:00:00Z` : new Date().toISOString(),
      first_created_at: followUp ? `${followUp}T08:00:00Z` : new Date().toISOString(),
      first_source: inferLeadSource(sourceRaw),
      won_date: wonDate ? followUp : null,
      sale_date: wonDate ? followUp : null,
      closing_date: wonDate ? followUp : null,
    };

    leads.push(lead);
    tagLinks.push({ tag_id: TAG_ID, lead_id: id, tenant_id: TENANT, user_id: USER });
  }

  console.log('Prepared', leads.length, 'leads');

  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);
    const values = batch.map((l) => `(
      ${sqlEscape(l.id)}::uuid,
      ${sqlEscape(l.tenant_id)}::uuid,
      ${sqlEscape(l.agency_id)}::uuid,
      ${sqlEscape(l.company_name)},
      ${sqlEscape(l.contact_name)},
      ${sqlEscape(l.phone)},
      ${sqlEscape(l.source)}::lead_source,
      ${sqlEscape(l.campaign_name)},
      ${sqlEscape(l.status)},
      ${sqlEscape(l.response_status)},
      ${sqlEscape(l.notes)},
      ${sqlEscape(l.follow_up_date)}::date,
      ${l.form_data ? sqlEscape(JSON.stringify(l.form_data)) + '::jsonb' : "'{}'::jsonb"},
      ${sqlEscape(l.created_at)}::timestamptz,
      ${sqlEscape(l.first_created_at)}::timestamptz,
      ${sqlEscape(l.first_source)}::lead_source,
      ${sqlEscape(l.won_date)}::date,
      ${sqlEscape(l.sale_date)}::date,
      ${sqlEscape(l.closing_date)}::date
    )`).join(',');

    const q = `INSERT INTO public.leads (
      id, tenant_id, agency_id, company_name, contact_name, phone, source,
      campaign_name, status, response_status, notes, follow_up_date, form_data,
      created_at, first_created_at, first_source, won_date, sale_date, closing_date
    ) VALUES ${values}`;
    await runQuery(q);
    inserted += batch.length;
    console.log('Inserted leads', inserted, '/', leads.length);
  }

  for (let i = 0; i < tagLinks.length; i += BATCH) {
    const batch = tagLinks.slice(i, i + BATCH);
    const values = batch.map((t) => `(
      ${sqlEscape(randomUUID())}::uuid,
      ${sqlEscape(t.tag_id)}::uuid,
      ${sqlEscape(t.lead_id)}::uuid,
      ${sqlEscape(t.tenant_id)}::uuid,
      ${sqlEscape(t.user_id)}::uuid
    )`).join(',');
    const q = `INSERT INTO public.chat_contact_tags (id, tag_id, lead_id, tenant_id, user_id) VALUES ${values} ON CONFLICT DO NOTHING`;
    await runQuery(q);
    console.log('Tagged', Math.min(i + BATCH, tagLinks.length), '/', tagLinks.length);
  }

  const summary = {
    inserted: leads.length,
    closed: leads.filter((l) => l.status === 'closed').length,
    proposal_sent: leads.filter((l) => l.status === 'proposal_sent').length,
    response_x: leads.filter((l) => l.response_status === 'x').length,
    not_relevant: leads.filter((l) => l.response_status === 'not_relevant').length,
  };
  writeFileSync('/tmp/psg-import-summary.json', JSON.stringify(summary, null, 2));
  console.log('DONE', summary);

  await runQuery(`INSERT INTO public.claude_carmen_audit (actor, action, target, details) VALUES (
    'claude', 'import_leads', 'פ.ד פסגות',
    ${sqlEscape(JSON.stringify({ ...summary, tag: 'רשימת גבי', sheet: '1KBXdEUXqyjZuRuFv0XTJ-s8zdyXGikLo' }))}::jsonb
  )`);

  await runQuery(`SELECT public.claude_notify_david(
    ${sqlEscape(`✅ ייבוא לידים לפ.ד פסגות הושלם: ${summary.inserted} לידים (רשימת גבי). סגירות: ${summary.closed}, הצעות: ${summary.proposal_sent}, X: ${summary.response_x}. https://aios.co.il/t/org-motn78b6/leads`)},
    '${TENANT}'::uuid
  )`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
