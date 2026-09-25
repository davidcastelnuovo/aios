const XLSX = require('xlsx');
const { randomUUID } = require('crypto');
const { writeFileSync } = require('fs');

const TENANT = 'ac7f9a3e-a042-4a64-afea-53e21a544d3d';
const AGENCY = '46821b91-6bfa-45af-b71d-e2d7e9468244';
const USER = 'ac7b2493-dcfa-47d8-80cc-b3900a406c46';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const API = 'https://api.supabase.com/v1/projects/zvoijyneresvkadpprel/database/query';

function compactText(value) {
  return String(value || '').toLowerCase().replace(/[\s_\-–—'"`״׳]/g, '');
}

function sqlEscape(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
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

function parseCreatedAt(val) {
  if (val === null || val === undefined || val === '') return new Date().toISOString();
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + val * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const strVal = String(val).trim();
  if (!strVal) return new Date().toISOString();
  const d = new Date(strVal);
  if (!isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100) {
    return d.toISOString();
  }
  return new Date().toISOString();
}

function decodeAnswer(val) {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  if (!str) return null;
  if (/^\d{5}$/.test(str)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + Number(str) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return str;
}

function classifyStatus(statusRaw) {
  const status = String(statusRaw || '').trim();
  const n = compactText(status);
  let pipelineStatus = 'new';
  let responseStatus = null;
  let wonDate = false;
  const extraNotes = [];

  if (/נחתםהסכם|הסכםנחתם/.test(n)) {
    return { pipelineStatus: 'closed', responseStatus: null, extraNotes, wonDate: true };
  }
  if (/נשלחההצעה|נשלחהסכם|ניתנההצעה|נמסרההצעה|משלחההצעה/.test(n)) {
    return { pipelineStatus: 'proposal_sent', responseStatus: null, extraNotes, wonDate: false };
  }
  if (/לארלוונטי|לאלרוונטי|טעות|לאמעוניין|הסתדרכבר|לאאקטואלי|מתחזה|פקס|פרטיםשגויים|לקוחקיים|מעונייןבתפעולשלסוכן|חיפשואתגבי/.test(n)) {
    return { pipelineStatus: 'new', responseStatus: 'not_relevant', extraNotes, wonDate: false };
  }
  if (/איןמענה|ללאמענה|לאמענה/.test(n)) {
    return { pipelineStatus: 'new', responseStatus: 'no_answer_1', extraNotes, wonDate: false };
  }
  if (/בעבודה|לחזור|גןילדים|נמצאבחול|מססלולארי|מעונייןבמסלקה|מצאמישהו|פניהחוזרת/.test(n)) {
    return { pipelineStatus: 'new', responseStatus: 'in_progress', extraNotes, wonDate: false };
  }
  if (status) {
    extraNotes.push(`סטטוס מקורי: ${status}`);
    return { pipelineStatus: 'new', responseStatus: 'in_progress', extraNotes, wonDate: false };
  }
  return { pipelineStatus, responseStatus, extraNotes, wonDate };
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
  const tagRows = await runQuery(`SELECT id FROM public.chat_tags WHERE tenant_id = '${TENANT}' AND name = 'רשימת דוד' LIMIT 1`);
  const TAG_ID = tagRows[0]?.id;
  if (!TAG_ID) throw new Error('Missing tag רשימת דוד');

  const wb = XLSX.readFile('/tmp/psg_david.xlsx');
  const sheetName = wb.SheetNames.includes('לידים פייסבוק') ? 'לידים פייסבוק' : wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

  const leads = [];
  const tagLinks = [];
  let skippedTests = 0;

  for (const row of rows) {
    const fullName = String(row['שם מלא'] || '').trim();
    const email = String(row['מייל'] || '').trim() || null;
    const phone = normalizePhone(row['טלפון']);
    const formName = String(row['טופס '] || row['טופס'] || '').trim() || null;
    const answerRaw = row['תשובות '] ?? row['תשובות'] ?? '';
    const answer = decodeAnswer(answerRaw);
    const statusRaw = row['status '] ?? row.status ?? '';
    const createdAt = parseCreatedAt(row['תאריך '] ?? row['תאריך']);

    if (/^test\d*@/i.test(email || '') || /^test\d*$/i.test(fullName)) {
      skippedTests += 1;
      continue;
    }
    if (!fullName && !phone && !email && !String(answerRaw).trim()) continue;

    const { pipelineStatus, responseStatus, extraNotes, wonDate } = classifyStatus(statusRaw);
    const formData = {};
    if (answer) formData['תשובות'] = answer;
    if (formName) formData['טופס'] = formName;

    const notesParts = [...extraNotes];
    if (String(answerRaw).trim().length > 80) notesParts.unshift(String(answerRaw).trim());

    const id = randomUUID();
    const lead = {
      id,
      tenant_id: TENANT,
      agency_id: AGENCY,
      company_name: fullName || (email ? email.split('@')[0] : phone ? `ליד ${phone}` : 'ליד ללא שם'),
      contact_name: fullName || null,
      phone,
      email: email && email.includes('@') ? email : null,
      source: 'paid_ads',
      campaign_name: formName,
      status: pipelineStatus,
      response_status: responseStatus,
      notes: notesParts.length ? notesParts.join('\n') : null,
      form_data: Object.keys(formData).length ? formData : null,
      created_at: createdAt,
      first_created_at: createdAt,
      first_source: 'paid_ads',
      won_date: wonDate ? createdAt.split('T')[0] : null,
      sale_date: wonDate ? createdAt.split('T')[0] : null,
      closing_date: wonDate ? createdAt.split('T')[0] : null,
    };

    leads.push(lead);
    tagLinks.push({ tag_id: TAG_ID, lead_id: id, tenant_id: TENANT, user_id: USER });
  }

  console.log('Prepared', leads.length, 'leads, skipped tests:', skippedTests);

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
      ${sqlEscape(l.email)},
      ${sqlEscape(l.source)}::lead_source,
      ${sqlEscape(l.campaign_name)},
      ${sqlEscape(l.status)},
      ${sqlEscape(l.response_status)},
      ${sqlEscape(l.notes)},
      ${l.form_data ? sqlEscape(JSON.stringify(l.form_data)) + '::jsonb' : "'{}'::jsonb"},
      ${sqlEscape(l.created_at)}::timestamptz,
      ${sqlEscape(l.first_created_at)}::timestamptz,
      ${sqlEscape(l.first_source)}::lead_source,
      ${sqlEscape(l.won_date)}::date,
      ${sqlEscape(l.sale_date)}::date,
      ${sqlEscape(l.closing_date)}::date
    )`).join(',');

    const q = `INSERT INTO public.leads (
      id, tenant_id, agency_id, company_name, contact_name, phone, email, source,
      campaign_name, status, response_status, notes, form_data,
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
    skipped_tests: skippedTests,
    closed: leads.filter((l) => l.status === 'closed').length,
    proposal_sent: leads.filter((l) => l.status === 'proposal_sent').length,
    new: leads.filter((l) => l.status === 'new' && !l.response_status).length,
    not_relevant: leads.filter((l) => l.response_status === 'not_relevant').length,
    no_answer: leads.filter((l) => l.response_status === 'no_answer_1').length,
    in_progress: leads.filter((l) => l.response_status === 'in_progress').length,
  };
  writeFileSync('/tmp/psg-david-import-summary.json', JSON.stringify(summary, null, 2));
  console.log('DONE', summary);

  await runQuery(`INSERT INTO public.claude_carmen_audit (actor, action, target, details) VALUES (
    'claude', 'import_leads', 'פ.ד פסגות',
    ${sqlEscape(JSON.stringify({ ...summary, tag: 'רשימת דוד', sheet: '1H20uLjOUlefzQbxqMKoFJKXAb5WCEI9a6zKELVGwpE0' }))}::jsonb
  )`);

  await runQuery(`SELECT public.claude_notify_david(
    ${sqlEscape(`✅ ייבוא לידים לפ.ד פסגות (רשימת דוד) הושלם: ${summary.inserted} לידי FB. סגירות: ${summary.closed}, הצעות: ${summary.proposal_sent}, לא רלוונטי: ${summary.not_relevant}. https://aios.co.il/t/org-motn78b6/leads`)},
    '${TENANT}'::uuid
  )`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
