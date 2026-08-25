import { supabase } from "@/integrations/supabase/client";
import { leadOriginTagNames, leadSourceDisplay, type LeadSourceLike } from "@/lib/leadFields";

const SOURCE_TAG_COLOR = "#3B82F6";
const CAMPAIGN_TAG_COLOR = "#8B5CF6";

export async function ensureLeadOriginTags(params: {
  tenantId: string;
  userId: string;
  leadId: string;
  campaign_name?: string | null;
  source?: string | null;
}): Promise<void> {
  const { tenantId, userId, leadId } = params;
  const lead: LeadSourceLike = {
    campaign_name: params.campaign_name,
    source: params.source,
  };
  const names = leadOriginTagNames(lead);
  if (!names.length || !tenantId || !userId || !leadId) return;

  try {
    const { data: existingTags, error: existingError } = await supabase
      .from("chat_tags")
      .select("id, name")
      .eq("tenant_id", tenantId);
    if (existingError) throw existingError;

    const byLower = new Map(
      (existingTags || []).map((tag) => [tag.name.toLowerCase().trim(), tag]),
    );

    const { data: maxSortData } = await supabase
      .from("chat_tags")
      .select("sort_order")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: false })
      .limit(1);

    let nextSort =
      (typeof maxSortData?.[0]?.sort_order === "number" ? maxSortData[0].sort_order : 0) + 1;

    const sourceLabel = leadSourceDisplay(lead).trim();
    const tagIds: string[] = [];

    for (const name of names) {
      const found = byLower.get(name.toLowerCase());
      if (found) {
        tagIds.push(found.id);
        continue;
      }

      const color =
        sourceLabel && name.toLowerCase() === sourceLabel.toLowerCase()
          ? SOURCE_TAG_COLOR
          : CAMPAIGN_TAG_COLOR;

      const { data: created, error: createError } = await supabase
        .from("chat_tags")
        .insert({
          tenant_id: tenantId,
          name,
          color,
          sort_order: nextSort++,
        })
        .select("id, name")
        .single();

      if (createError) {
        const { data: raced } = await supabase
          .from("chat_tags")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .ilike("name", name)
          .maybeSingle();
        if (raced?.id) {
          byLower.set(raced.name.toLowerCase().trim(), raced);
          tagIds.push(raced.id);
        } else {
          console.error("ensureLeadOriginTags: failed to create tag", name, createError);
        }
        continue;
      }

      if (created?.id) {
        byLower.set(created.name.toLowerCase().trim(), created);
        tagIds.push(created.id);
      }
    }

    if (tagIds.length === 0) return;

    const { error: assignError } = await supabase.from("chat_contact_tags").upsert(
      tagIds.map((tag_id) => ({
        tag_id,
        lead_id: leadId,
        tenant_id: tenantId,
        user_id: userId,
      })),
      { onConflict: "tag_id,lead_id", ignoreDuplicates: true },
    );
    if (assignError) {
      console.error("ensureLeadOriginTags: failed to assign tags", assignError);
    }
  } catch (error) {
    console.error("ensureLeadOriginTags failed", error);
  }
}
