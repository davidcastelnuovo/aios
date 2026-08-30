import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractWooOrderAttribution } from "../_shared/wooAttribution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 100;
const UPSERT_CHUNK = 50;
const FUNCTION_VERSION = "1.3.0"; // 2026-08-16: order attribution from WC meta_data
const USER_AGENT = `AIOS-WooSync/${FUNCTION_VERSION}`;
const ATTRIBUTION_BACKFILL_DAYS = 90;

// ---- WooCommerce API helper ----
async function wooFetch(
  siteUrl: string,
  consumerKey: string,
  consumerSecret: string,
  endpoint: string,
  params: Record<string, string | number> = {}
) {
  const url = new URL(`${siteUrl.replace(/\/$/, "")}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.set("consumer_key", consumerKey);
  url.searchParams.set("consumer_secret", consumerSecret);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WooCommerce API error ${resp.status}: ${text}`);
  }
  return resp.json();
}

// Fetch all pages of a WooCommerce resource
async function fetchAllPages(
  siteUrl: string,
  key: string,
  secret: string,
  endpoint: string,
  extraParams: Record<string, string | number> = {},
  maxPages = 200
) {
  const results: any[] = [];
  let page = 1;
  while (page <= maxPages) {
    const data = await wooFetch(siteUrl, key, secret, endpoint, {
      per_page: PAGE_SIZE,
      page,
      ...extraParams,
    });
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return results;
}

async function upsertChunks(
  supabase: any,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
) {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw error;
  }
}

function mapOrderRow(tenant_id: string, siteId: string, order: any) {
  return {
    tenant_id,
    site_id: siteId,
    woo_order_id: order.id,
    order_number: String(order.number || order.id),
    status: order.status,
    currency: order.currency,
    total: parseFloat(order.total) || 0,
    subtotal: parseFloat(order.subtotal) || 0,
    total_tax: parseFloat(order.total_tax) || 0,
    shipping_total: parseFloat(order.shipping_total) || 0,
    discount_total: parseFloat(order.discount_total) || 0,
    customer_id: order.customer_id || null,
    customer_email: order.billing?.email || null,
    customer_first_name: order.billing?.first_name || null,
    customer_last_name: order.billing?.last_name || null,
    customer_phone: order.billing?.phone || null,
    billing: order.billing || {},
    shipping: order.shipping || {},
    line_items: order.line_items || [],
    payment_method: order.payment_method || null,
    payment_method_title: order.payment_method_title || null,
    date_created: order.date_created || null,
    date_modified: order.date_modified || null,
    date_completed: order.date_completed || null,
    date_paid: order.date_paid || null,
    attribution: extractWooOrderAttribution(order.meta_data),
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Merge orders by woo_order_id — later rows win (backfill can refresh attribution on older orders). */
function mergeOrdersById(orders: any[]) {
  const map = new Map<number, any>();
  orders.forEach((order) => map.set(order.id, order));
  return Array.from(map.values());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { site_id, tenant_id: bodyTenantId, backfill_attribution_days } = body || {};
    const manualSiteSync = !!site_id && !bodyTenantId;
    const attributionBackfillDays = backfill_attribution_days != null
      ? Number(backfill_attribution_days)
      : (manualSiteSync ? ATTRIBUTION_BACKFILL_DAYS : 0);

    // Build query — either by site_id or by tenant_id (for cron)
    let sitesQuery = supabase
      .from("social_media_wordpress_sites")
      .select("*")
      .eq("is_active", true)
      .eq("woocommerce_enabled", true);

    if (site_id) {
      sitesQuery = sitesQuery.eq("id", site_id);
    } else if (bodyTenantId) {
      sitesQuery = sitesQuery.eq("tenant_id", bodyTenantId);
    } else {
      // Cron: sync all sites with woo_sync_enabled
      sitesQuery = sitesQuery.eq("woo_sync_enabled", true);
    }

    const { data: sites, error: sitesError } = await sitesQuery;
    if (sitesError) throw sitesError;
    if (!sites || sites.length === 0) {
      return new Response(
        JSON.stringify({ message: "No WooCommerce sites found", sites_processed: 0, version: FUNCTION_VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const summaries: any[] = [];

    for (const site of sites) {
      const { id: siteId, tenant_id, site_url } = site;
      // Support both legacy (woo_consumer_*) and current (woocommerce_consumer_*) column names
      const woo_consumer_key = site.woocommerce_consumer_key || site.woo_consumer_key;
      const woo_consumer_secret = site.woocommerce_consumer_secret || site.woo_consumer_secret;

      if (!woo_consumer_key || !woo_consumer_secret) {
        summaries.push({ site_id: siteId, error: "Missing WooCommerce credentials" });
        continue;
      }

      // Create sync log entry (schema has no sync_type in prod — do not send it)
      const { data: logEntry, error: logErr } = await supabase
        .from("woocommerce_sync_log")
        .insert({
          tenant_id,
          site_id: siteId,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (logErr) {
        console.warn(`[woo-sync] sync_log insert failed for ${siteId}:`, logErr.message);
      }

      const logId = logEntry?.id;
      let ordersCount = 0;
      let productsCount = 0;
      let customersCount = 0;

      try {
        // ---- Determine incremental window ----
        // Use modified_after = last successful sync minus 1h overlap (safety),
        // fallback to last 30 days if no previous sync.
        const lastSyncAt: string | null = site.woo_last_sync_at || site.last_woocommerce_sync_at || null;
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() - 30);
        const sinceDate = lastSyncAt
          ? new Date(new Date(lastSyncAt).getTime() - 60 * 60 * 1000)
          : fallbackDate;
        const modifiedAfter = sinceDate.toISOString().split(".")[0];
        console.log(`[woo-sync] v${FUNCTION_VERSION} site ${siteId} — incremental since ${modifiedAfter}`);

        // ---- Sync Orders (incremental by modified_after) ----
        const orders = await fetchAllPages(site_url, woo_consumer_key, woo_consumer_secret, "orders", {
          modified_after: modifiedAfter,
          orderby: "modified",
          order: "asc",
        });

        let allOrders = [...orders];

        // Manual / single-site sync: backfill attribution on recent orders even if not modified lately.
        if (attributionBackfillDays > 0) {
          try {
            const afterDate = new Date();
            afterDate.setDate(afterDate.getDate() - attributionBackfillDays);
            // WooCommerce expects ISO8601 date-time for `after`, not YYYY-MM-DD alone.
            const afterIso = afterDate.toISOString().split(".")[0];
            const backfillOrders = await fetchAllPages(
              site_url,
              woo_consumer_key,
              woo_consumer_secret,
              "orders",
              {
                after: afterIso,
                orderby: "date",
                order: "desc",
              },
              30,
            );
            allOrders = mergeOrdersById([...allOrders, ...backfillOrders]);
            console.log(
              `[woo-sync] attribution backfill ${attributionBackfillDays}d — ${backfillOrders.length} orders fetched, ${allOrders.length} unique`,
            );
          } catch (backfillErr: any) {
            console.warn(
              `[woo-sync] attribution backfill skipped for ${siteId}:`,
              backfillErr?.message || backfillErr,
            );
          }
        }

        const orderRows = allOrders.map((order: any) => mapOrderRow(tenant_id, siteId, order));
        await upsertChunks(supabase, "woocommerce_orders", orderRows, "site_id,woo_order_id");
        ordersCount = orderRows.length;

        // ---- Sync Products ----
        const products = await fetchAllPages(site_url, woo_consumer_key, woo_consumer_secret, "products", {
          modified_after: modifiedAfter,
        });
        const productRows = products.map((product: any) => ({
          tenant_id,
          site_id: siteId,
          woo_product_id: product.id,
          name: product.name,
          slug: product.slug,
          status: product.status,
          type: product.type,
          sku: product.sku || null,
          price: parseFloat(product.price) || null,
          regular_price: parseFloat(product.regular_price) || null,
          sale_price: parseFloat(product.sale_price) || null,
          stock_quantity: product.stock_quantity ?? null,
          stock_status: product.stock_status,
          total_sales: product.total_sales || 0,
          categories: product.categories || [],
          images: product.images || [],
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        await upsertChunks(supabase, "woocommerce_products", productRows, "site_id,woo_product_id");
        productsCount = productRows.length;

        // ---- Sync Customers (capped — full historical pull is too slow for the edge limit) ----
        // Prefer recent registrations; dashboards primarily need order-side metrics.
        const customerMaxPages = lastSyncAt ? 1 : 5;
        const customers = await fetchAllPages(
          site_url,
          woo_consumer_key,
          woo_consumer_secret,
          "customers",
          { orderby: "registered_date", order: "desc" },
          customerMaxPages
        );
        const customerRows = customers.map((customer: any) => ({
          tenant_id,
          site_id: siteId,
          woo_customer_id: customer.id,
          email: customer.email,
          first_name: customer.first_name,
          last_name: customer.last_name,
          username: customer.username,
          role: customer.role,
          orders_count: customer.orders_count || 0,
          total_spent: parseFloat(customer.total_spent) || 0,
          avatar_url: customer.avatar_url || null,
          billing: customer.billing || {},
          shipping: customer.shipping || {},
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        await upsertChunks(supabase, "woocommerce_customers", customerRows, "site_id,woo_customer_id");
        customersCount = customerRows.length;

        const syncedAt = new Date().toISOString();
        // Update site last sync time (both column names used in the wild)
        await supabase
          .from("social_media_wordpress_sites")
          .update({
            woo_last_sync_at: syncedAt,
            last_woocommerce_sync_at: syncedAt,
          })
          .eq("id", siteId);

        if (logId) {
          await supabase
            .from("woocommerce_sync_log")
            .update({
              status: "success",
              orders_synced: ordersCount,
              products_synced: productsCount,
              customers_synced: customersCount,
              finished_at: syncedAt,
            })
            .eq("id", logId);
        }

        summaries.push({
          site_id: siteId,
          site_url,
          orders_synced: ordersCount,
          products_synced: productsCount,
          customers_synced: customersCount,
        });
      } catch (siteError: any) {
        console.error(`Error syncing site ${siteId}:`, siteError);
        if (logId) {
          await supabase
            .from("woocommerce_sync_log")
            .update({
              status: "error",
              error_message: siteError.message,
              orders_synced: ordersCount,
              products_synced: productsCount,
              customers_synced: customersCount,
              finished_at: new Date().toISOString(),
            })
            .eq("id", logId);
        }
        summaries.push({ site_id: siteId, error: siteError.message });
      }
    }

    const first = summaries[0] || {};
    return new Response(
      JSON.stringify({
        success: !summaries.some((s) => s.error),
        version: FUNCTION_VERSION,
        sites_processed: summaries.length,
        orders_synced: first.orders_synced ?? 0,
        products_synced: first.products_synced ?? 0,
        customers_synced: first.customers_synced ?? 0,
        summaries,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("sync-woocommerce-data error:", error);
    return new Response(
      JSON.stringify({ error: error.message, version: FUNCTION_VERSION }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
