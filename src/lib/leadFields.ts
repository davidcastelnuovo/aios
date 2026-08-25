/**
 * Shared lead source / campaign / secondary-status helpers.
 *
 * `campaign_name` and `source` are separate fields. מקור הליד is the channel
 * (FB / website / …); שם הקמפיין is the campaign string. A mixed CSV
 * "סטטוס" column can contain both pipeline stages (נקבעה פגישה) and
 * secondary statuses (אין מענה) — classify per row, don't dump everything
 * into one column.
 */

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  website: "אתר",
  referral: "הפניה",
  social_media: "רשתות חברתיות",
  paid_ads: "FB",
  cold_call: "שיחה קרה",
  email_campaign: "דיוור",
  event: "אירוע",
  whatsapp: "וואטסאפ",
  other: "אחר",
  // Legacy UI values that are not on the current lead_source enum
  phone: "טלפון",
  facebook: "FB",
  google: "גוגל",
};

export const LEAD_SOURCE_SELECT_OPTIONS = [
  { value: "paid_ads", label: "FB" },
  { value: "website", label: "אתר" },
  { value: "referral", label: "הפניה" },
  { value: "social_media", label: "רשתות חברתיות" },
  { value: "cold_call", label: "שיחה קרה" },
  { value: "email_campaign", label: "דיוור" },
  { value: "event", label: "אירוע" },
  { value: "whatsapp", label: "וואטסאפ" },
  { value: "other", label: "אחר" },
] as const;

export type LeadStatusLike = {
  status_key: string;
  label: string;
  color?: string | null;
};

export type LeadSourceLike = {
  campaign_name?: string | null;
  source?: string | null;
};

const KNOWN_SOURCE_ENUMS = new Set([
  "website",
  "referral",
  "social_media",
  "paid_ads",
  "cold_call",
  "email_campaign",
  "event",
  "whatsapp",
  "other",
]);

function compactText(value: string): string {
  return value.toLowerCase().replace(/[\s_\-–—'"`״׳]/g, "");
}

export function inferLeadSource(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "other";
  const v = compactText(raw);
  if (KNOWN_SOURCE_ENUMS.has(raw.trim().toLowerCase())) return raw.trim().toLowerCase();
  if (v.includes("אתר") || v.includes("website")) return "website";
  if (v.includes("שיחה") || v.includes("טלפון") || v.includes("coldcall") || v === "phone") {
    return "cold_call";
  }
  if (v.includes("המלצה") || v.includes("referral") || v.includes("הפניה")) return "referral";
  if (
    v === "fb" ||
    v.includes("facebook") ||
    v.includes("פייסבוק") ||
    v.includes("google") ||
    v.includes("גוגל") ||
    v.includes("paidads") ||
    v.includes("ppc")
  ) {
    return "paid_ads";
  }
  if (
    v.includes("instagram") ||
    v.includes("אינסטגרם") ||
    v.includes("linkedin") ||
    v.includes("לינקדאין") ||
    v.includes("socialmedia") ||
    v.includes("רשתותחברתיות") ||
    v.includes("tiktok") ||
    v.includes("טיקטוק")
  ) {
    return "social_media";
  }
  if (v.includes("אימייל") || v.includes("email") || v.includes("מייל") || v.includes("newsletter")) {
    return "email_campaign";
  }
  if (v.includes("אירוע") || v.includes("event") || v.includes("כנס") || v.includes("תערוכה")) {
    return "event";
  }
  if (v.includes("whatsapp") || v.includes("ווטסאפ") || v.includes("וואטסאפ")) return "whatsapp";
  return "other";
}

export function leadSourceDisplay(lead: LeadSourceLike | null | undefined): string {
  const source = lead?.source?.trim();
  if (!source) return "";
  if (source === "paid_ads" || source === "facebook" || compactText(source) === "fb") return "FB";
  return LEAD_SOURCE_LABELS[source] || source;
}

export function looksLikeResponseStatusLabel(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return false;
  const n = compactText(value);
  return (
    /איןמענה|איןעמנה|ללאמענה|לאענה|noanswer|מכחיש|לארלוונטי|לאלרוונטי|לארלווטני|בעבודה|inprogress|deniescontact|notrelevant|תפוס|לאזמין|לאמעוניין|כפול/.test(
      n,
    )
  );
}

export function looksLikePipelineStatusLabel(value: string | null | undefined): boolean {
  return matchPipelineStatus(value) != null;
}

function matchPipelineStatus(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const n = compactText(value);
  if (/נקבעה?פגישה|meetingscheduled|^meeting$|בתיאום/.test(n)) return "meeting_scheduled";
  if (/נשלחההצעה|הצעתמחיר|אחריהצעה|ממתיןלהצעה|proposalsent|^proposal$/.test(n)) {
    return "proposal_sent";
  }
  if (/משאומתן|ממתיןלהחלטה|^negotiation$/.test(n)) return "negotiation";
  if (/יצרנוקשר|^contacted$|^contact$/.test(n)) return "contacted";
  if (/^פולואפ$|^followup$|^follow_up$|לתאממחדש/.test(n)) return "follow_up";
  if (/^נסגר$|^closed$|^won$|^lost$/.test(n)) return "closed";
  if (/^חדש$|^new$/.test(n)) return "new";
  return null;
}

export type ClassifiedLeadStatus = {
  pipelineStatus: string | null;
  responseStatus: string | null;
};

/** Split a mixed CSV "סטטוס" value into pipeline stage vs secondary status. */
export function classifyLeadImportStatus(
  value: string | null | undefined,
  statuses: LeadStatusLike[] = [],
): ClassifiedLeadStatus {
  const pipelineStatus = matchPipelineStatus(value);
  const responseStatus = resolveResponseStatusKey(value, statuses);
  if (pipelineStatus && pipelineStatus !== "new") {
    return { pipelineStatus, responseStatus: responseStatus && responseStatus !== pipelineStatus ? responseStatus : null };
  }
  if (responseStatus) {
    return { pipelineStatus: pipelineStatus === "new" ? "new" : null, responseStatus };
  }
  if (pipelineStatus === "new") return { pipelineStatus: "new", responseStatus: null };
  return { pipelineStatus: null, responseStatus: null };
}

function aliasResponseStatusKey(normalized: string): string | null {
  if (/איןמענה4|noanswer4/.test(normalized)) return "no_answer_4";
  if (/איןמענה3|noanswer3/.test(normalized)) return "no_answer_3";
  if (/איןמענה2|noanswer2/.test(normalized)) return "no_answer_2";
  if (/איןמענה|איןעמנה|ללאמענה|לאענה|noanswer/.test(normalized)) return "no_answer_1";
  if (/מכחיש/.test(normalized) || normalized === "deniescontact") return "denies_contact";
  if (/לארלוונטי|לאלרוונטי|לארלווטני/.test(normalized) || normalized === "notrelevant") {
    return "not_relevant";
  }
  if (/בעבודה/.test(normalized) || normalized === "inprogress") return "in_progress";
  return null;
}

export function resolveResponseStatusKey(
  value: string | null | undefined,
  statuses: LeadStatusLike[] = [],
): string | null {
  if (!value || !value.trim() || value === "none") return null;
  const trimmed = value.trim();
  const normalized = compactText(trimmed);

  const byKey = statuses.find(
    (s) => s.status_key === trimmed || compactText(s.status_key) === normalized,
  );
  if (byKey) return byKey.status_key;

  const byLabel = statuses.find((s) => compactText(s.label) === normalized);
  if (byLabel) return byLabel.status_key;

  const aliased = aliasResponseStatusKey(normalized);
  if (aliased) {
    const exact = statuses.find((s) => s.status_key === aliased);
    if (exact) return exact.status_key;
    if (aliased.startsWith("no_answer")) {
      const numbered = statuses.find((s) => s.status_key === aliased);
      if (numbered) return numbered.status_key;
      const anyNoAnswer =
        statuses.find((s) => s.status_key.startsWith("no_answer")) ||
        statuses.find((s) => /אין.?מענה|ללא.?מענה|no.?answer/i.test(s.label));
      if (anyNoAnswer) return anyNoAnswer.status_key;
    }
    return aliased;
  }

  return null;
}

export function findLeadStatus(
  value: string | null | undefined,
  statuses: LeadStatusLike[],
): LeadStatusLike | undefined {
  const key = resolveResponseStatusKey(value, statuses);
  if (!key) return undefined;
  return statuses.find((s) => s.status_key === key);
}

export function responseStatusSelectValue(
  value: string | null | undefined,
  statuses: LeadStatusLike[],
): string {
  if (!value || value === "none") return "none";
  return resolveResponseStatusKey(value, statuses) || value;
}

/** Raw stored value to render as a SelectItem when it isn't in `statuses`. */
export function unmatchedResponseStatusValue(
  value: string | null | undefined,
  statuses: LeadStatusLike[],
): string | null {
  if (!value || value === "none") return null;
  const resolved = resolveResponseStatusKey(value, statuses);
  if (resolved && statuses.some((s) => s.status_key === resolved)) return null;
  return value;
}

export const LEAD_IMPORT_HEADER_MAP: Record<string, string> = {
  'שם העסק': 'company_name',
  'שם החברה': 'company_name',
  'חברה': 'company_name',
  'עסק': 'company_name',
  'שם עסק': 'company_name',
  'שם העסק/חברה': 'company_name',
  'שם איש קשר': 'contact_name',
  'איש קשר': 'contact_name',
  'שם': 'contact_name',
  'שם הלקוח': 'company_name',
  'לקוח': 'company_name',
  'טלפון': 'phone',
  'נייד': 'phone',
  'מייל': 'email',
  'אימייל': 'email',
  'מקור': 'source',
  'מקור הגעה': 'source',
  'מקור הליד': 'source',
  'סטטוס': 'status',
  'סטטוס תגובה': 'response_status',
  'סטטוס משני': 'response_status',
  'סטטוס שני': 'response_status',
  'סטטוס 2': 'response_status',
  'סטטוס2': 'response_status',
  'מענה': 'response_status',
  'תגיות': 'tags',
  'תג': 'tags',
  'במה מתעניין': 'tags',
  'מתעניין ב': 'tags',
  'קטגוריה': 'tags',
  'הערות': 'notes',
  'תקציב': 'monthly_budget',
  'הצעה חד"פ': 'monthly_budget',
  'הצעה חד״פ': 'monthly_budget',
  'הצעה 3 חודשים': 'three_month_budget',
  'מוצרים': 'products',
  'תעשייה': 'industry',
  'פרסום': 'industry',
  'תחום': 'industry',
  'נסיון בקמפיינים': 'industry',
  'ניסיון בקמפיינים': 'industry',
  'קמפיין': 'campaign_name',
  'שם קמפיין': 'campaign_name',
  'שם הקמפיין': 'campaign_name',
  'שם-קמפיין': 'campaign_name',
  'תאריך לחזרה': 'follow_up_date',
  'תאריך חזרה': 'follow_up_date',
  'לחזרה': 'follow_up_date',
  'פולו אפ': 'follow_up_date',
  'follow up': 'follow_up_date',
  'תאריך יצירה': 'created_at',
  'תאריך': 'created_at',
  'תאריך פגישה': 'meeting_date',
  'תאריך הצעה': 'proposal_date',
  'נסגר': 'won_date',
  'תאריך סגירה': 'won_date',
  'שווי הצעות/הסכמים': 'estimated_deal_value',
  'שווי עסקה': 'estimated_deal_value',
  'קישור': 'folder_link',
  'קישור לתיקייה': 'folder_link',
  company: 'company_name',
  'company name': 'company_name',
  company_name: 'company_name',
  business: 'company_name',
  contact: 'contact_name',
  'contact name': 'contact_name',
  contact_name: 'contact_name',
  name: 'contact_name',
  phone: 'phone',
  mobile: 'phone',
  email: 'email',
  source: 'source',
  'lead source': 'source',
  status: 'status',
  response_status: 'response_status',
  'response status': 'response_status',
  'secondary status': 'response_status',
  secondary_status: 'response_status',
  tags: 'tags',
  tag: 'tags',
  notes: 'notes',
  budget: 'monthly_budget',
  monthly_budget: 'monthly_budget',
  products: 'products',
  industry: 'industry',
  campaign: 'campaign_name',
  campaign_name: 'campaign_name',
  'campaign name': 'campaign_name',
  created_at: 'created_at',
  created: 'created_at',
  meeting_date: 'meeting_date',
  'meeting date': 'meeting_date',
  follow_up_date: 'follow_up_date',
  follow_up: 'follow_up_date',
  'follow up date': 'follow_up_date',
  proposal_date: 'proposal_date',
  won_date: 'won_date',
  deal_value: 'estimated_deal_value',
  folder_link: 'folder_link',
};

export function autoDetectLeadImportField(
  columnName: string,
  sampleValues: string[] = [],
): string | null {
  const trimmed = columnName.replace(/^\uFEFF/, "").trim();
  const normalized = trimmed.toLowerCase();
  const detected =
    LEAD_IMPORT_HEADER_MAP[columnName] ||
    LEAD_IMPORT_HEADER_MAP[trimmed] ||
    LEAD_IMPORT_HEADER_MAP[normalized] ||
    null;

  if (detected === "status") {
    const samples = sampleValues.map((s) => String(s).trim()).filter(Boolean);
    if (samples.length > 0) {
      const pipelineHits = samples.filter((s) => looksLikePipelineStatusLabel(s)).length;
      const responseHits = samples.filter((s) => looksLikeResponseStatusLabel(s)).length;
      // Only remap the whole column when it is purely secondary statuses.
      if (responseHits > samples.length / 2 && pipelineHits === 0) return "response_status";
    }
  }

  return detected;
}
