import { supabase } from "@/integrations/supabase/client";

/**
 * סנכרון נתוני פרופיל ↔ campaigner / sales_person
 * עיקרון: profile הוא מקור האמת לאימייל; שם מועתק רק כאשר חסר/זהה.
 *
 * שימוש: לאחר שמירת `profiles.campaigner_id` או `profiles.sales_person_id`
 * (או לאחר עדכון `profiles.full_name`).
 */
export async function syncProfileToTeamMember(userId: string): Promise<void> {
  if (!userId) return;

  // טען את הפרופיל
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, campaigner_id, sales_person_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    console.warn("syncProfileToTeamMember: profile not found", profileError);
    return;
  }

  // סנכרון לקמפיינר המקושר
  if (profile.campaigner_id) {
    const { data: campaigner } = await supabase
      .from("campaigners")
      .select("id, email, full_name")
      .eq("id", profile.campaigner_id)
      .maybeSingle();

    if (campaigner) {
      const patch: Record<string, any> = {};
      if ((!campaigner.email || campaigner.email === "") && profile.email) {
        patch.email = profile.email;
      }
      if (
        (!campaigner.full_name ||
          campaigner.full_name === "" ||
          campaigner.full_name === "קמפיינר") &&
        profile.full_name
      ) {
        patch.full_name = profile.full_name;
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from("campaigners").update(patch).eq("id", campaigner.id);
      }
    }
  }

  // סנכרון לאיש מכירות המקושר
  if (profile.sales_person_id) {
    const { data: sp } = await supabase
      .from("sales_people")
      .select("id, email, full_name")
      .eq("id", profile.sales_person_id)
      .maybeSingle();

    if (sp) {
      const patch: Record<string, any> = {};
      if ((!sp.email || sp.email === "") && profile.email) {
        patch.email = profile.email;
      }
      if (
        (!sp.full_name ||
          sp.full_name === "" ||
          sp.full_name === "איש מכירות") &&
        profile.full_name
      ) {
        patch.full_name = profile.full_name;
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from("sales_people").update(patch).eq("id", sp.id);
      }
    }
  }
}

/**
 * סנכרון מקמפיינר חזרה לפרופיל — רק שדות ריקים.
 * לא דורס email בפרופיל (ה-Auth הוא מקור האמת).
 */
export async function syncTeamMemberToProfile(
  campaignerId: string | null,
  salesPersonId: string | null,
): Promise<void> {
  if (campaignerId) {
    const { data: campaigner } = await supabase
      .from("campaigners")
      .select("full_name")
      .eq("id", campaignerId)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("campaigner_id", campaignerId)
      .maybeSingle();

    if (campaigner && profile && (!profile.full_name || profile.full_name === "")) {
      if (campaigner.full_name) {
        await supabase
          .from("profiles")
          .update({ full_name: campaigner.full_name })
          .eq("id", profile.id);
      }
    }
  }

  if (salesPersonId) {
    const { data: sp } = await supabase
      .from("sales_people")
      .select("full_name")
      .eq("id", salesPersonId)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("sales_person_id", salesPersonId)
      .maybeSingle();

    if (sp && profile && (!profile.full_name || profile.full_name === "")) {
      if (sp.full_name) {
        await supabase
          .from("profiles")
          .update({ full_name: sp.full_name })
          .eq("id", profile.id);
      }
    }
  }
}
