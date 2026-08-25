/** Tag + timeline row when an inbound lead matches an existing phone/email. */

export const REPEAT_CONTACT_TAG_NAME = "פניה חוזרת";
export const REPEAT_CONTACT_TAG_COLOR = "#F59E0B";

const SYSTEM_USER_PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

export function formatRepeatContactUpdate(at: Date = new Date()): string {
  const formatted = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
  return `פניה חוזרת — ${formatted}`;
}

async function resolveTenantUserId(
  supabase: { from: (table: string) => any },
  tenantId: string,
): Promise<string | null> {
  const { data: owner } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (owner?.user_id) return owner.user_id as string;

  const { data: anyRole } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (anyRole?.user_id) return anyRole.user_id as string;

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  return (tenantUser?.user_id as string | undefined) ?? null;
}

/**
 * Merge path for a new inbound lead whose phone/email already exists:
 * attach the "פניה חוזרת" tag and write a dated row in lead_updates.
 */
export async function recordRepeatContact(
  supabase: { from: (table: string) => any },
  params: { tenantId: string; leadId: string },
): Promise<void> {
  const { tenantId, leadId } = params;
  if (!tenantId || !leadId) return;

  const actorId = (await resolveTenantUserId(supabase, tenantId)) ?? SYSTEM_USER_PLACEHOLDER;

  try {
    let tagId: string | null = null;
    const { data: existingTag } = await supabase
      .from("chat_tags")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", REPEAT_CONTACT_TAG_NAME)
      .maybeSingle();

    if (existingTag?.id) {
      tagId = existingTag.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from("chat_tags")
        .insert({
          tenant_id: tenantId,
          name: REPEAT_CONTACT_TAG_NAME,
          color: REPEAT_CONTACT_TAG_COLOR,
        })
        .select("id")
        .single();

      if (createError) {
        const { data: raced } = await supabase
          .from("chat_tags")
          .select("id")
          .eq("tenant_id", tenantId)
          .ilike("name", REPEAT_CONTACT_TAG_NAME)
          .maybeSingle();
        tagId = raced?.id ?? null;
        if (!tagId) {
          console.error("recordRepeatContact: failed to create tag", createError);
        }
      } else {
        tagId = created?.id ?? null;
      }
    }

    if (tagId) {
      const { error: assignError } = await supabase.from("chat_contact_tags").upsert(
        {
          tag_id: tagId,
          lead_id: leadId,
          tenant_id: tenantId,
          user_id: actorId === SYSTEM_USER_PLACEHOLDER ? SYSTEM_USER_PLACEHOLDER : actorId,
        },
        { onConflict: "tag_id,lead_id", ignoreDuplicates: true },
      );
      if (assignError) {
        console.error("recordRepeatContact: failed to assign tag", assignError);
      }
    }
  } catch (error) {
    console.error("recordRepeatContact: tag error", error);
  }

  if (actorId === SYSTEM_USER_PLACEHOLDER) {
    console.error("recordRepeatContact: no tenant user for lead_updates", tenantId);
    return;
  }

  const { error: updateError } = await supabase.from("lead_updates").insert({
    lead_id: leadId,
    user_id: actorId,
    content: formatRepeatContactUpdate(),
  });
  if (updateError) {
    console.error("recordRepeatContact: failed to insert lead_updates", updateError);
  }
}
