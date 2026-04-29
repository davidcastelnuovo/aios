import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 100;

// ---- WooCommerce API helper ----
async function wooFetch(
  siteUrl: string,
  consumerKey: string,
  consumerSecret: string,
  endpoint: string,
  params: Record<string, string | number> = {}
) {
  const url = new URL(`${siteUrl}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.set("consumer_key", consumerKey);
  url.searchParams.set("consumer_secret", consumerSecret);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url.toString());
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
  extraParams: Record<string, string | number> = {}
) {
  const results: any[] = [];
  let page = 1;
  while (true) {
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { site_id, tenant_id: bodyTenantId } = body;

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
        JSON.stringify({ message: "No WooCommerce sites found", sites_processed: 0 }),
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

      // Create sync log entry
      const { data: logEntry } = await supabase
        .from("woocommerce_sync_log")
        .insert({
          tenant_id,
          site_id: siteId,
          sync_type: "full",
          status: "running",
        })
        .select()
        .single();

      const logId = logEntry?.id;
      let ordersCount = 0;
      let productsCount = 0;
      let customersCount = 0;

      try {
        // ---- Determine incremental window ----
        // Use modified_after = last successful sync minus 1h overlap (safety),
        // fallback to last 30 days if no previous sync.
        const lastSyncAt: string | null = site.woo_last_sync_at || null;
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() - 30);
        const sinceDate = lastSyncAt
          ? new Date(new Date(lastSyncAt).getTime() - 60 * 60 * 1000)
          : fallbackDate;
        // WooCommerce expects ISO8601 without milliseconds, in site timezone agnostic form
        const modifiedAfter = sinceDate.toISOString().split(".")[0];
        console.log(`[woo-sync] site ${siteId} — incremental since ${modifiedAfter}`);

        // ---- Sync Orders (incremental by modified_after) ----
        const orders = await fetchAllPages(site_url, woo_consumer_key, woo_consumer_secret, "orders", {
          modified_after: modifiedAfter,
          orderby: "modified",
          order: "asc",
        });
        for (const order of orders) {
          const record = {
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
            raw_data: order,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabase
            .from("woocommerce_orders")
            .upsert(record, { onConflict: "site_id,woo_order_id" });
        }
        ordersCount = orders.length;

        // ---- Sync Products ----
        const products = await fetchAllPages(site_url, woo_consumer_key, woo_consumer_secret, "products", {
          modified_after: modifiedAfter,
        });
        for (const product of products) {
          const record = {
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
            raw_data: product,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabase
            .from("woocommerce_products")
            .upsert(record, { onConflict: "site_id,woo_product_id" });
        }
        productsCount = products.length;

        // ---- Sync Customers ----
        const customers = await fetchAllPages(site_url, woo_consumer_key, woo_consumer_secret, "customers");
        for (const customer of customers) {
          const record = {
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
            raw_data: customer,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabase
            .from("woocommerce_customers")
            .upsert(record, { onConflict: "site_id,woo_customer_id" });
        }
        customersCount = customers.length;

        // Update site last sync time
        await supabase
          .from("social_media_wordpress_sites")
          .update({ woo_last_sync_at: new Date().toISOString() })
          .eq("id", siteId);

        // Update sync log — success
        if (logId) {
          await supabase
            .from("woocommerce_sync_log")
            .update({
              status: "success",
              orders_synced: ordersCount,
              products_synced: productsCount,
              customers_synced: customersCount,
              finished_at: new Date().toISOString(),
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
              finished_at: new Date().toISOString(),
            })
            .eq("id", logId);
        }
        summaries.push({ site_id: siteId, error: siteError.message });
      }
    }

    // Return first site's stats if single site sync
    const first = summaries[0] || {};
    return new Response(
      JSON.stringify({
        success: true,
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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
