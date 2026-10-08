/** External Ads Manager URL for a report table, matching the client-card reports tab. */
export function getAdAccountUrl(table: {
  integration_type?: string | null;
  integration_settings?: {
    ad_account_id?: string | null;
    customer_id?: string | null;
  } | null;
} | null | undefined): string | null {
  if (!table) return null;
  const settings = table.integration_settings || {};
  const type = table.integration_type;
  if (type === "facebook_insights" || type === "facebook_ecommerce") {
    const id = String(settings.ad_account_id || "").replace(/^act_/, "");
    if (!id) return null;
    return `https://business.facebook.com/adsmanager/manage/campaigns?act=${id}`;
  }
  if (type === "google_ads") {
    const id = String(settings.customer_id || settings.ad_account_id || "").replace(/-/g, "");
    if (!id) return null;
    return `https://ads.google.com/aw/overview?__e=${id}`;
  }
  return null;
}
