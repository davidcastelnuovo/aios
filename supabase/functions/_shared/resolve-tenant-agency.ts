/** Resolve the agency a tenant should stamp on new leads / tasks. */

type AgencyLookupClient = {
  from: (table: string) => {
    select: (columns: string) => any
  }
}

/**
 * Home agency for a tenant: owned default → first owned → first agency
 * shared into the tenant via agency_tenant_access.
 * Keep the priority in sync with src/lib/resolveTenantAgency.ts.
 */
export async function resolveTenantHomeAgencyId(
  supabase: AgencyLookupClient,
  tenantId: string | null | undefined,
): Promise<string | null> {
  if (!tenantId) return null

  const { data: defaultOwned, error: defaultError } = await supabase
    .from('agencies')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .eq('is_default', true)
    .limit(1)
    .maybeSingle()
  if (defaultError) {
    console.error('resolveTenantHomeAgencyId default owned:', defaultError)
  }
  if (defaultOwned?.id) return defaultOwned.id

  const { data: firstOwned, error: firstError } = await supabase
    .from('agencies')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (firstError) {
    console.error('resolveTenantHomeAgencyId first owned:', firstError)
  }
  if (firstOwned?.id) return firstOwned.id

  const { data: shared, error: sharedError } = await supabase
    .from('agency_tenant_access')
    .select('agency_id')
    .eq('accessing_tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (sharedError) {
    console.error('resolveTenantHomeAgencyId shared:', sharedError)
  }
  return shared?.agency_id ?? null
}
