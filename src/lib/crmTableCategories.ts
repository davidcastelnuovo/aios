/**
 * Canonical list-category for CRM report cards under ניהול דוחות.
 *
 * Ecommerce reports (Facebook Ecommerce + Google Ads campaign_type=ecommerce)
 * always land in "איקומרס", regardless of the free-text `category` column —
 * which historically was often set to "Facebook Insights" by mistake.
 */

export const ECOMMERCE_CATEGORY = "איקומרס";

type TableLike = {
  category?: string | null;
  integration_type?: string | null;
  integration_settings?: { campaign_type?: string | null } | null;
};

export function isEcommerceCrmTable(table: TableLike): boolean {
  const type = String(table.integration_type || "");
  if (type === "facebook_ecommerce") return true;
  if (type === "google_ads") {
    return String(table.integration_settings?.campaign_type || "").toLowerCase() === "ecommerce";
  }
  return false;
}

/** Category key used for grouping cards in DynamicTables. */
export function resolveListCategory(table: TableLike): string {
  if (isEcommerceCrmTable(table)) return ECOMMERCE_CATEGORY;

  const type = String(table.integration_type || "");
  if (type === "facebook_insights") return "Facebook Insights";
  if (type === "google_ads") return "Google Ads";

  const raw = (table.category || "").trim();
  // Collapse legacy "Facebook Ecommerce" free-text into the canonical bucket
  // even if integration_type was somehow missing (shouldn't happen).
  if (/facebook/i.test(raw) && /ecom/i.test(raw)) return ECOMMERCE_CATEGORY;
  if (/^ecommerce$/i.test(raw) || raw === "איקומרס") return ECOMMERCE_CATEGORY;

  return raw || "ללא קבוצה";
}

/** Default `category` column value when creating a new table. */
export function defaultCategoryForCreate(
  integrationType: string,
  opts?: { campaignType?: string | null },
): string {
  if (integrationType === "facebook_ecommerce") return ECOMMERCE_CATEGORY;
  if (
    integrationType === "google_ads" &&
    String(opts?.campaignType || "").toLowerCase() === "ecommerce"
  ) {
    return ECOMMERCE_CATEGORY;
  }
  if (integrationType === "facebook_insights") return "Facebook Insights";
  if (integrationType === "google_ads") return "Google Ads";
  return integrationType || "ללא קבוצה";
}
