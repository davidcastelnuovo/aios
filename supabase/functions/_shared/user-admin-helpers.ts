import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const USER_ADMIN_ROLES = new Set(["owner", "agency_owner"]);

export async function callerCanDeleteUsers(
  supabaseAdmin: SupabaseClient,
  callerId: string,
  tenantId?: string | null,
): Promise<boolean> {
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role, tenant_id")
    .eq("user_id", callerId);

  if (rolesError) {
    throw new Error("Error checking user roles");
  }

  const isSuperAdmin = roles?.some((r) => r.role === "super_admin" && r.tenant_id === null);
  if (isSuperAdmin) return true;

  if (tenantId) {
    const hasRoleInTenant = roles?.some(
      (r) => USER_ADMIN_ROLES.has(r.role) && r.tenant_id === tenantId,
    );
    if (hasRoleInTenant) return true;

    const { data: membership } = await supabaseAdmin
      .from("tenant_users")
      .select("role")
      .eq("user_id", callerId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (membership && USER_ADMIN_ROLES.has(membership.role)) return true;
    return false;
  }

  const hasAnyAdminRole = roles?.some((r) => USER_ADMIN_ROLES.has(r.role));
  if (hasAnyAdminRole) return true;

  const { data: memberships } = await supabaseAdmin
    .from("tenant_users")
    .select("role")
    .eq("user_id", callerId)
    .in("role", ["owner", "agency_owner"]);

  return (memberships?.length ?? 0) > 0;
}

export async function detachUserReferences(
  supabaseAdmin: SupabaseClient,
  targetUserId: string,
  fallbackUserId: string,
): Promise<void> {
  const nullify = async (table: string, column: string) => {
    const { error } = await supabaseAdmin.from(table).update({ [column]: null }).eq(column, targetUserId);
    if (error) console.error(`detachUserReferences nullify ${table}.${column}:`, error);
  };

  const reassign = async (table: string, column: string) => {
    const { error } = await supabaseAdmin.from(table).update({ [column]: fallbackUserId }).eq(column, targetUserId);
    if (error) console.error(`detachUserReferences reassign ${table}.${column}:`, error);
  };

  await nullify("agency_tenant_access", "created_by");
  await nullify("chat_messages", "blocked_by_user_id");
  await nullify("chat_messages", "sent_by_user_id");
  await nullify("crm_records", "created_by");
  await reassign("crm_tables", "created_by");
  await nullify("expense_payments", "paid_by");
  await nullify("import_history", "imported_by");
  await nullify("income_payments", "received_by");
  await nullify("integration_tenant_access", "granted_by");
  await nullify("invitation_tokens", "used_by");
  await nullify("one_time_incomes", "created_by");
  await nullify("payment_links", "created_by");
  await nullify("report_alerts", "created_by");
  await nullify("seo_monthly_updates", "updated_by");
  await nullify("task_collaborators", "added_by");
  await reassign("tasks", "created_by");

  await supabaseAdmin.from("user_active_tenant").delete().eq("user_id", targetUserId);
  await supabaseAdmin.from("user_workspace_layout").delete().eq("user_id", targetUserId);
}
