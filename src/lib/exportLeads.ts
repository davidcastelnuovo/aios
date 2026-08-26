import * as XLSX from "xlsx";
import {
  findLeadStatus,
  leadFirstSourceDisplay,
  leadSourceDisplay,
  type LeadStatusLike,
} from "./leadFields.ts";
import { leadSearchOrFilter } from "./leadPhone.ts";

export const LEAD_EXPORT_PAGE_SIZE = 1000;
const RELATED_IN_CHUNK = 200;

export type LeadExportFilters = {
  tenantId: string;
  isOwner?: boolean;
  selectedAgency?: string | null;
  agencyIds?: string[] | null;
  searchQuery?: string;
  filterSalesPersonIds?: string[];
  filterStage?: string;
  filterResponseStatus?: string[];
  filterTagIds?: string[];
  filterFollowUpToday?: boolean;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  viewAsSalesPersonId?: string | null;
  includeArchived?: boolean;
};

export type LeadExportStage = { stage_key: string; label: string };
export type LeadExportStatus = LeadStatusLike;

export type LeadExportUpdate = {
  content: string;
  created_at: string;
  author_name: string;
};

export type LeadExportRecord = {
  id: string;
  contact_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  response_status?: string | null;
  source?: string | null;
  first_source?: string | null;
  campaign_name?: string | null;
  industry?: string | null;
  products?: string | null;
  estimated_deal_value?: number | string | null;
  monthly_budget?: number | string | null;
  three_month_budget?: number | string | null;
  notes?: string | null;
  folder_link?: string | null;
  lost_reason?: string | null;
  follow_up_date?: string | null;
  created_at?: string | null;
  first_created_at?: string | null;
  updated_at?: string | null;
  proposal_date?: string | null;
  proposal_sent_date?: string | null;
  sale_date?: string | null;
  won_date?: string | null;
  closing_date?: string | null;
  meeting_date?: string | null;
  meeting_time?: string | null;
  meeting_location?: string | null;
  meeting_set_date?: string | null;
  form_qa_summary?: string | null;
  form_data?: unknown;
  archived_at?: string | null;
  agencies?: { name?: string | null } | null;
  sales_people?: { full_name?: string | null } | null;
  clients?: { name?: string | null } | null;
  tagNames?: string[];
  updates?: LeadExportUpdate[];
};

type QueryClient = {
  from: (table: string) => any;
};

const LEAD_EXPORT_SELECT = `
  id,
  tenant_id,
  contact_name,
  company_name,
  phone,
  email,
  status,
  response_status,
  source,
  first_source,
  campaign_name,
  industry,
  products,
  estimated_deal_value,
  monthly_budget,
  three_month_budget,
  proposal_date,
  proposal_sent_date,
  sale_date,
  won_date,
  closing_date,
  lost_reason,
  folder_link,
  notes,
  agency_id,
  sales_person_id,
  follow_up_date,
  created_at,
  first_created_at,
  updated_at,
  meeting_date,
  meeting_time,
  meeting_location,
  meeting_set_date,
  form_data,
  form_qa_summary,
  archived_at,
  agencies (name),
  sales_people (full_name),
  clients (name)
`;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDayIso(date: Date): string {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy.toISOString();
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function formatLeadExportDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return date.toLocaleDateString("he-IL");
  }
  return date.toLocaleString("he-IL");
}

export function formatLeadExportUpdate(update: LeadExportUpdate): string {
  const when = formatLeadExportDate(update.created_at);
  const author = update.author_name?.trim();
  const content = (update.content || "").replace(/\s+/g, " ").trim();
  return [when, author, content].filter(Boolean).join(" | ");
}

function stringifyFormValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => stringifyFormValue(item)).filter(Boolean).join(" | ");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function collectFormDataKeys(leads: LeadExportRecord[]): string[] {
  const keys = new Set<string>();
  for (const lead of leads) {
    if (!lead.form_data || typeof lead.form_data !== "object" || Array.isArray(lead.form_data)) {
      continue;
    }
    for (const key of Object.keys(lead.form_data as Record<string, unknown>)) {
      if (key.trim()) keys.add(key);
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b, "he"));
}

export function leadMatchesTagFilter(
  tagNames: string[] | undefined,
  tagIdsOnLead: string[] | undefined,
  filterTagIds: string[],
  selectedTagIdSet: Set<string>,
): boolean {
  if (filterTagIds.length === 0) return true;
  const ids = tagIdsOnLead || [];
  const hasNone = filterTagIds.includes("none");
  const hasSpecific = filterTagIds.some((id) => id !== "none");
  const hasMatchingTag = ids.some((id) => selectedTagIdSet.has(id));
  if (hasNone && !hasSpecific) return ids.length === 0;
  if (hasNone && hasSpecific) return ids.length === 0 || hasMatchingTag;
  return hasMatchingTag;
}

function applyLeadExportFilters(query: any, filters: LeadExportFilters): any {
  const tenantId = filters.tenantId;
  const selectedAgency = filters.selectedAgency;
  const agencyIds = filters.agencyIds || [];

  if (filters.isOwner) {
    query = query.eq("tenant_id", tenantId);
    if (selectedAgency && selectedAgency !== "all") {
      query = query.eq("agency_id", selectedAgency);
    }
  } else if (selectedAgency && selectedAgency !== "all") {
    query = query.or(`tenant_id.eq.${tenantId},agency_id.eq.${selectedAgency}`);
  } else if (agencyIds.length > 0) {
    query = query.or(`tenant_id.eq.${tenantId},agency_id.in.(${agencyIds.join(",")})`);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  if (!filters.includeArchived) {
    query = query.is("archived_at", null);
  }

  if (filters.filterStage && filters.filterStage !== "all") {
    query = query.eq("status", filters.filterStage);
  }

  if (filters.viewAsSalesPersonId) {
    query = query.eq("sales_person_id", filters.viewAsSalesPersonId);
  } else if (filters.filterSalesPersonIds && filters.filterSalesPersonIds.length > 0) {
    if (filters.filterSalesPersonIds.includes("none") && filters.filterSalesPersonIds.length === 1) {
      query = query.is("sales_person_id", null);
    } else if (!filters.filterSalesPersonIds.includes("none")) {
      query = query.in("sales_person_id", filters.filterSalesPersonIds);
    }
  }

  if (filters.filterResponseStatus && filters.filterResponseStatus.length > 0) {
    if (filters.filterResponseStatus.includes("none") && filters.filterResponseStatus.length === 1) {
      query = query.is("response_status", null);
    } else if (!filters.filterResponseStatus.includes("none")) {
      query = query.in("response_status", filters.filterResponseStatus);
    }
  }

  if (filters.filterFollowUpToday) {
    const today = new Date().toISOString().split("T")[0];
    query = query.lte("follow_up_date", today);
  }

  const startDate = toDate(filters.startDate);
  if (startDate) query = query.gte("created_at", startDate.toISOString());
  const endDate = toDate(filters.endDate);
  if (endDate) query = query.lte("created_at", endOfDayIso(endDate));

  const search = filters.searchQuery?.trim();
  if (search) query = query.or(leadSearchOrFilter(search));

  return query;
}

async function paginateQuery<T>(runPage: (from: number, to: number) => Promise<T[]>): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const to = from + LEAD_EXPORT_PAGE_SIZE - 1;
    const page = await runPage(from, to);
    all.push(...page);
    if (page.length < LEAD_EXPORT_PAGE_SIZE) break;
    from += LEAD_EXPORT_PAGE_SIZE;
  }
  return all;
}

export async function fetchAllLeadsForExport(
  supabase: QueryClient,
  filters: LeadExportFilters,
): Promise<{
  leads: LeadExportRecord[];
  stages: LeadExportStage[];
  statuses: LeadExportStatus[];
}> {
  const tenantId = filters.tenantId;
  const leads = await paginateQuery<LeadExportRecord>(async (from, to) => {
    let query = supabase
      .from("leads")
      .select(LEAD_EXPORT_SELECT)
      .order("created_at", { ascending: false });
    query = applyLeadExportFilters(query, filters);
    query = query.range(from, to);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as LeadExportRecord[];
  });

  const leadIds = leads.map((lead) => lead.id);
  const tagIdsByLead: Record<string, string[]> = {};
  const tagNamesByLead: Record<string, string[]> = {};
  const updatesByLead: Record<string, LeadExportUpdate[]> = {};

  if (leadIds.length > 0) {
    const tagRows: Array<{ lead_id: string | null; tag_id: string; chat_tags?: { name?: string | null } | null }> = [];
    for (const idChunk of chunk(leadIds, RELATED_IN_CHUNK)) {
      const chunkRows = await paginateQuery(async (from, to) => {
        const { data, error } = await supabase
          .from("chat_contact_tags")
          .select("lead_id, tag_id, chat_tags (name)")
          .eq("tenant_id", tenantId)
          .in("lead_id", idChunk)
          .range(from, to);
        if (error) throw error;
        return data || [];
      });
      tagRows.push(...chunkRows);
    }

    for (const row of tagRows) {
      if (!row.lead_id) continue;
      if (!tagIdsByLead[row.lead_id]) tagIdsByLead[row.lead_id] = [];
      if (!tagNamesByLead[row.lead_id]) tagNamesByLead[row.lead_id] = [];
      if (!tagIdsByLead[row.lead_id].includes(row.tag_id)) {
        tagIdsByLead[row.lead_id].push(row.tag_id);
      }
      const name = row.chat_tags?.name?.trim();
      if (name && !tagNamesByLead[row.lead_id].includes(name)) {
        tagNamesByLead[row.lead_id].push(name);
      }
    }

    const updateRows: Array<{
      lead_id: string;
      content: string;
      created_at: string;
      user_id: string;
      profiles?: { full_name?: string | null } | null;
    }> = [];
    for (const idChunk of chunk(leadIds, RELATED_IN_CHUNK)) {
      const chunkRows = await paginateQuery(async (from, to) => {
        const { data, error } = await supabase
          .from("lead_updates")
          .select("lead_id, content, created_at, user_id, profiles:user_id (full_name)")
          .in("lead_id", idChunk)
          .order("created_at", { ascending: true })
          .range(from, to);
        if (error) throw error;
        return data || [];
      });
      updateRows.push(...chunkRows);
    }

    for (const row of updateRows) {
      if (!updatesByLead[row.lead_id]) updatesByLead[row.lead_id] = [];
      updatesByLead[row.lead_id].push({
        content: row.content || "",
        created_at: row.created_at,
        author_name: row.profiles?.full_name || "",
      });
    }
  }

  const filterTagIds = filters.filterTagIds || [];
  const selectedTagIdSet = new Set(filterTagIds.filter((id) => id !== "none"));
  const filteredLeads = leads.filter((lead) => {
    if (filterTagIds.length === 0) return true;
    return leadMatchesTagFilter(
      tagNamesByLead[lead.id],
      tagIdsByLead[lead.id],
      filterTagIds,
      selectedTagIdSet,
    );
  });

  if (
    filters.filterResponseStatus &&
    filters.filterResponseStatus.includes("none") &&
    filters.filterResponseStatus.length > 1
  ) {
    const otherStatuses = filters.filterResponseStatus.filter((status) => status !== "none");
    for (let i = filteredLeads.length - 1; i >= 0; i -= 1) {
      const status = filteredLeads[i].response_status;
      if (status != null && !otherStatuses.includes(status)) {
        filteredLeads.splice(i, 1);
      }
    }
  }

  for (const lead of filteredLeads) {
    lead.tagNames = (tagNamesByLead[lead.id] || []).slice().sort((a, b) => a.localeCompare(b, "he"));
    lead.updates = (updatesByLead[lead.id] || []).slice().sort((a, b) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  const [{ data: stages, error: stagesError }, { data: statuses, error: statusesError }] = await Promise.all([
    supabase
      .from("lead_pipeline_stages")
      .select("stage_key, label")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    supabase
      .from("lead_statuses")
      .select("status_key, label")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
  ]);
  if (stagesError) throw stagesError;
  if (statusesError) throw statusesError;

  return {
    leads: filteredLeads,
    stages: (stages || []) as LeadExportStage[],
    statuses: (statuses || []) as LeadExportStatus[],
  };
}

export function buildLeadExportRows(
  leads: LeadExportRecord[],
  stages: LeadExportStage[],
  statuses: LeadExportStatus[],
): Record<string, string | number>[] {
  const maxUpdates = leads.reduce((max, lead) => Math.max(max, lead.updates?.length || 0), 0);
  const formKeys = collectFormDataKeys(leads);

  return leads.map((lead) => {
    const stageName = stages.find((stage) => stage.stage_key === lead.status)?.label || lead.status || "";
    const statusName = findLeadStatus(lead.response_status, statuses)?.label || lead.response_status || "";
    const row: Record<string, string | number> = {
      "שם איש קשר": lead.contact_name || "",
      "שם העסק": lead.company_name || "",
      "טלפון": lead.phone || "",
      "אימייל": lead.email || "",
      "שלב": stageName,
      "סטטוס תגובה": statusName,
      "תגיות": (lead.tagNames || []).join(", "),
      "מקור": leadSourceDisplay(lead),
      "מקור ראשוני": leadFirstSourceDisplay(lead) || "",
      "שם קמפיין": lead.campaign_name || "",
      "תעשייה": lead.industry || "",
      "מוצרים": lead.products || "",
      "שווי עסקה": lead.estimated_deal_value ?? "",
      'תקציב חד"פ': lead.monthly_budget ?? "",
      "הצעה 3 חודשים": lead.three_month_budget ?? "",
      "איש מכירות": lead.sales_people?.full_name || "",
      "סוכנות": lead.agencies?.name || "",
      "לקוח מקושר": lead.clients?.name || "",
      "הערות": lead.notes || "",
      "סיבת אובדן": lead.lost_reason || "",
      "קישור לתיקייה": lead.folder_link || "",
      "תאריך יצירה": formatLeadExportDate(lead.created_at),
      "תאריך יצירה ראשוני": formatLeadExportDate(lead.first_created_at),
      "תאריך עדכון": formatLeadExportDate(lead.updated_at),
      "תאריך לחזרה": formatLeadExportDate(lead.follow_up_date),
      "תאריך הצעה": formatLeadExportDate(lead.proposal_date),
      "תאריך שליחת הצעה": formatLeadExportDate(lead.proposal_sent_date),
      "תאריך מכירה": formatLeadExportDate(lead.sale_date),
      "תאריך סגירה": formatLeadExportDate(lead.won_date || lead.closing_date),
      "תאריך פגישה": formatLeadExportDate(lead.meeting_date),
      "שעת פגישה": lead.meeting_time || "",
      "מיקום פגישה": lead.meeting_location || "",
      "תאריך קביעת פגישה": formatLeadExportDate(lead.meeting_set_date),
      "סיכום שאלות ותשובות": lead.form_qa_summary || "",
      "בארכיון": lead.archived_at ? "כן" : "",
    };

    for (let i = 0; i < maxUpdates; i += 1) {
      const update = lead.updates?.[i];
      row[`עדכון ${i + 1}`] = update ? formatLeadExportUpdate(update) : "";
    }

    const formData =
      lead.form_data && typeof lead.form_data === "object" && !Array.isArray(lead.form_data)
        ? (lead.form_data as Record<string, unknown>)
        : {};
    for (const key of formKeys) {
      row[`טופס: ${key}`] = stringifyFormValue(formData[key]);
    }

    return row;
  });
}

export function buildLeadExportWorkbook(
  rows: Record<string, string | number>[],
  sheetName = "לידים",
): XLSX.WorkBook {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  worksheet["!views"] = [{ rightToLeft: true }];
  worksheet["!cols"] = headers.map((header) => ({
    wch: header.startsWith("עדכון") ? 48 : Math.min(36, Math.max(14, header.length + 2)),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  return workbook;
}

export function writeLeadExportFile(workbook: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(workbook, filename);
}

export function defaultLeadExportFilename(prefix = "leads_export"): string {
  return `${prefix}_${new Date().toISOString().split("T")[0]}.xlsx`;
}
