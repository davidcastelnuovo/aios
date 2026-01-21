import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "./useCurrentTenant";

export interface TeamRole {
  key: string;
  label: string;
}

/**
 * ברירות מחדל לתפקידי צוות לפי סוג ארגון
 */
const DEFAULT_ROLES_BY_ORG_TYPE: Record<string, TeamRole[]> = {
  // סוכנות דיגיטל
  organization: [
    { key: "campaigner", label: "קמפיינר" },
    { key: "seo", label: "SEO" },
    { key: "team_manager", label: "מנהל צוות" },
    { key: "content_writer", label: "כותב תוכן" },
    { key: "designer", label: "מעצב גרפי" },
    { key: "developer", label: "מפתח" },
    { key: "social_media", label: "רשתות חברתיות" },
  ],

  // עסק כללי (תת-ארגון)
  sub_organization: [
    { key: "customer_service", label: "שירות לקוחות" },
    { key: "account_manager", label: "מנהל לקוח" },
    { key: "sales", label: "מכירות" },
    { key: "support", label: "תמיכה טכנית" },
    { key: "operations", label: "תפעול" },
    { key: "team_leader", label: "ראש צוות" },
    { key: "specialist", label: "מומחה" },
  ],

  // ארגון שורש (ברירת מחדל כמו organization)
  root: [
    { key: "campaigner", label: "קמפיינר" },
    { key: "seo", label: "SEO" },
    { key: "team_manager", label: "מנהל צוות" },
    { key: "content_writer", label: "כותב תוכן" },
    { key: "designer", label: "מעצב גרפי" },
  ],
};

/**
 * Hook לקבלת תפקידי צוות דינמיים לפי סוג הארגון
 *
 * @returns {Object} - teamRoles (רשימת התפקידים), isLoading, orgType
 *
 * דוגמת שימוש:
 * ```tsx
 * const { teamRoles, isLoading } = useTeamRoles();
 *
 * {teamRoles.map(role => (
 *   <Checkbox key={role.key} value={role.key}>
 *     {role.label}
 *   </Checkbox>
 * ))}
 * ```
 */
export function useTeamRoles() {
  const { tenantId } = useCurrentTenant();

  // שליפת סוג הארגון מטבלת tenants
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant-org-type", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from("tenants")
        .select("org_type, settings")
        .eq("id", tenantId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // שליפת הגדרות תפקידים מותאמות אישית (אם קיימות)
  const { data: customRoles, isLoading: settingsLoading } = useQuery({
    queryKey: ["tenant-team-roles", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from("tenant_settings")
        .select("setting_value")
        .eq("tenant_id", tenantId)
        .eq("setting_key", "team_roles")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      if (data?.setting_value && Array.isArray(data.setting_value)) {
        return data.setting_value as unknown as TeamRole[];
      }
      return null;
    },
    enabled: !!tenantId,
  });

  const isLoading = tenantLoading || settingsLoading;

  // לוגיקת בחירת התפקידים:
  // 1. אם יש הגדרות מותאמות אישית - השתמש בהן
  // 2. אחרת, אם יש הגדרות ב-tenant.settings.team_roles - השתמש בהן
  // 3. אחרת, השתמש בברירת מחדל לפי org_type
  const teamRoles: TeamRole[] = (() => {
    // הגדרות מותאמות אישית מטבלת tenant_settings
    if (customRoles && Array.isArray(customRoles) && customRoles.length > 0) {
      return customRoles;
    }

    // הגדרות מטבלת tenants (שדה settings)
    const settings = tenant?.settings as Record<string, unknown> | null;
    if (settings?.team_roles && Array.isArray(settings.team_roles)) {
      return settings.team_roles as TeamRole[];
    }

    // ברירת מחדל לפי org_type
    const orgType = tenant?.org_type || "organization";
    return DEFAULT_ROLES_BY_ORG_TYPE[orgType] || DEFAULT_ROLES_BY_ORG_TYPE.organization;
  })();

  return {
    teamRoles,
    isLoading,
    orgType: tenant?.org_type || "organization",
    defaultRoles: DEFAULT_ROLES_BY_ORG_TYPE,
  };
}

/**
 * Hook לשמירת תפקידים מותאמים אישית
 */
export function useUpdateTeamRoles() {
  const { tenantId } = useCurrentTenant();

  const updateRoles = async (roles: TeamRole[]) => {
    if (!tenantId) throw new Error("No tenant ID found");

    const { error } = await supabase
      .from("tenant_settings")
      .upsert({
        tenant_id: tenantId,
        setting_key: "team_roles",
        setting_value: roles as any,
      }, {
        onConflict: "tenant_id,setting_key",
      });

    if (error) throw error;
  };

  return { updateRoles };
}
