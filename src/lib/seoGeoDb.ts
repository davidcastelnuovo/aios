import { supabase } from "@/integrations/supabase/client";

export type SeoGeoApprovalStatus = "pending" | "approved" | "auto_approved";
export type SeoGeoGenerationStatus = "planned" | "generating" | "draft" | "published" | "failed";

export type SeoGeoProgram = {
  id: string;
  tenant_id: string;
  client_id: string;
  work_item_id: string;
  wordpress_site_id: string | null;
  auto_approve: boolean;
  horizon_months: number;
};

export type SeoGeoKeyword = {
  id: string;
  keyword: string;
  intent: string | null;
  priority: string | null;
  source: string;
  promoted: boolean;
  evidence: string | null;
  metadata: Record<string, unknown>;
  sort_order: number;
};

export type SeoGeoCalendarEntry = {
  id: string;
  scheduled_date: string;
  title: string;
  primary_keyword: string | null;
  content_type: string | null;
  approval_status: SeoGeoApprovalStatus;
  approved_by_carmen: boolean;
  generation_status: SeoGeoGenerationStatus;
  title_draft: string | null;
  excerpt: string | null;
  content_html: string | null;
  meta_description: string | null;
  live_url: string | null;
  publish_error: string | null;
  angle: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const seoGeoDb = supabase as any;
