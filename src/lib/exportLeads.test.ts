import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLeadExportRows,
  collectFormDataKeys,
  formatLeadExportUpdate,
  leadMatchesTagFilter,
  type LeadExportRecord,
} from "./exportLeads.ts";

const stages = [
  { stage_key: "new", label: "חדש" },
  { stage_key: "closed", label: "נסגר" },
];

const statuses = [
  { status_key: "no_answer_1", label: "אין מענה 1" },
  { status_key: "in_progress", label: "בעבודה" },
];

test("leadMatchesTagFilter keeps all leads when no tag filter is set", () => {
  assert.equal(leadMatchesTagFilter(["FB"], ["t1"], [], new Set()), true);
});

test("leadMatchesTagFilter none shows only untagged leads", () => {
  assert.equal(leadMatchesTagFilter([], [], ["none"], new Set()), true);
  assert.equal(leadMatchesTagFilter(["FB"], ["t1"], ["none"], new Set(["t1"])), false);
});

test("leadMatchesTagFilter selected tags keep matching leads", () => {
  assert.equal(leadMatchesTagFilter(["FB"], ["t1"], ["t1"], new Set(["t1"])), true);
  assert.equal(leadMatchesTagFilter(["אתר"], ["t2"], ["t1"], new Set(["t1"])), false);
});

test("buildLeadExportRows maps fields, tags, statuses and numbered updates", () => {
  const leads: LeadExportRecord[] = [
    {
      id: "1",
      contact_name: "יוסי",
      company_name: "חברה",
      phone: "0501234567",
      email: "a@b.com",
      status: "new",
      response_status: "no_answer_1",
      source: "paid_ads",
      campaign_name: "קיץ",
      tagNames: ["FB", "חם"],
      updates: [
        { content: "התקשרתי", created_at: "2026-08-01T08:00:00.000Z", author_name: "דוד" },
        { content: "אין מענה", created_at: "2026-08-02T09:30:00.000Z", author_name: "צחי" },
      ],
      agencies: { name: "צחי קווטנסקי" },
      sales_people: { full_name: "נציג" },
      form_data: { city: "תל אביב" },
    },
    {
      id: "2",
      contact_name: "רק אחד",
      status: "closed",
      response_status: "in_progress",
      source: "website",
      tagNames: [],
      updates: [{ content: "נסגר", created_at: "2026-08-03T10:00:00.000Z", author_name: "" }],
    },
  ];

  const rows = buildLeadExportRows(leads, stages, statuses);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]["שם איש קשר"], "יוסי");
  assert.equal(rows[0]["שלב"], "חדש");
  assert.equal(rows[0]["סטטוס תגובה"], "אין מענה 1");
  assert.equal(rows[0]["תגיות"], "FB, חם");
  assert.equal(rows[0]["מקור"], "FB");
  assert.equal(rows[0]["שם קמפיין"], "קיץ");
  assert.equal(rows[0]["סוכנות"], "צחי קווטנסקי");
  assert.match(String(rows[0]["עדכון 1"]), /התקשרתי/);
  assert.match(String(rows[0]["עדכון 2"]), /אין מענה/);
  assert.equal(rows[0]["טופס: city"], "תל אביב");
  assert.equal(rows[1]["שלב"], "נסגר");
  assert.equal(rows[1]["עדכון 2"], "");
  assert.ok("עדכון 1" in rows[1]);
  assert.ok("עדכון 2" in rows[1]);
});

test("collectFormDataKeys gathers unique form fields", () => {
  assert.deepEqual(
    collectFormDataKeys([
      { id: "1", form_data: { b: "2", a: "1" } },
      { id: "2", form_data: { a: "3" } },
    ]),
    ["a", "b"],
  );
});

test("formatLeadExportUpdate joins date, author and content", () => {
  const text = formatLeadExportUpdate({
    content: "  חזרתי  אליו  ",
    created_at: "2026-08-01",
    author_name: "דוד",
  });
  assert.match(text, /דוד/);
  assert.match(text, /חזרתי אליו/);
});

function makeClient(tables: Record<string, any[]>) {
  return {
    from(table: string) {
      const rows = tables[table] || [];
      const state = { from: 0, to: Math.max(rows.length - 1, 0), usedRange: false };
      const api: any = {
        select: () => api,
        eq: () => api,
        is: () => api,
        in: () => api,
        or: () => api,
        gte: () => api,
        lte: () => api,
        order: () => api,
        range: (from: number, to: number) => {
          state.from = from;
          state.to = to;
          state.usedRange = true;
          return api;
        },
        then: (resolve: any, reject: any) => {
          const slice = state.usedRange ? rows.slice(state.from, state.to + 1) : rows;
          return Promise.resolve({ data: slice, error: null }).then(resolve, reject);
        },
      };
      return api;
    },
  };
}

test("fetchAllLeadsForExport pages past the loaded UI window", async () => {
  const { fetchAllLeadsForExport } = await import("./exportLeads.ts");
  const leadRows = Array.from({ length: 1205 }, (_, i) => ({
    id: `lead-${i}`,
    contact_name: `n${i}`,
    created_at: "2026-08-01T00:00:00.000Z",
    status: "new",
    source: "website",
  }));
  const supabase = makeClient({
    leads: leadRows,
    chat_contact_tags: [],
    lead_updates: [],
    lead_pipeline_stages: [{ stage_key: "new", label: "חדש" }],
    lead_statuses: [],
  });
  const { leads } = await fetchAllLeadsForExport(supabase, { tenantId: "tenant-1", isOwner: true });
  assert.equal(leads.length, 1205);
});
