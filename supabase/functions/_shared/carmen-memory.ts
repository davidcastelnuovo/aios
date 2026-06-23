// Shared helpers for Carmen Memory Kingdom
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createEmbedding } from "./ai-gateway.ts";

export function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

// Embeddings now go to Google directly (1536-dim) via the shared gateway,
// matching the dimension of vectors already stored in carmen_memory_pointers.
export async function embed(text: string): Promise<number[] | null> {
  return await createEmbedding(text);
}

export async function upsertPointer(supabase: any, p: {
  tenant_id: string;
  category: string;
  subcategory?: string | null;
  path: string;
  entity_type: string;
  entity_id: string;
  title: string;
  summary?: string | null;
  ref_date?: string | null;
  importance?: number;
  metadata?: Record<string, unknown>;
  withEmbedding?: boolean;
}) {
  const row: any = {
    tenant_id: p.tenant_id,
    category: p.category,
    subcategory: p.subcategory ?? null,
    path: p.path,
    entity_type: p.entity_type,
    entity_id: p.entity_id,
    title: p.title,
    summary: p.summary ?? null,
    ref_date: p.ref_date ?? null,
    importance: p.importance ?? 50,
    metadata: p.metadata ?? {},
  };
  if (p.withEmbedding && p.summary) {
    const e = await embed(`${p.title}\n${p.summary}`);
    if (e) row.summary_embedding = e as any;
  }
  await supabase
    .from("carmen_memory_pointers")
    .upsert(row, { onConflict: "tenant_id,path,entity_type,entity_id,subcategory" });
}

export function shortText(s: string | null | undefined, n = 240): string {
  if (!s) return "";
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}
