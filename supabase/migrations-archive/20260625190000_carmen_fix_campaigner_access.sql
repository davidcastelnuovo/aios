-- carmen_fix_campaigner_access — SAFE, scoped fix for "a campaigner can't see a
-- client's reports". It attaches the campaigner to the client (client_team) ONLY
-- when the campaigner already belongs to that client's agency; otherwise it
-- refuses. It never raises a role and never grants out-of-scope access. Every
-- call is logged to claude_carmen_audit. See CLAUDE.md "Safety rules".
--
-- Exposed to Carmen as the `fix_campaigner_access` tool via the carmen-admin-mcp
-- edge function.

create or replace function public.carmen_fix_campaigner_access(
  p_campaigner_id uuid,
  p_client_id uuid,
  p_tenant uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $func$
declare
  v_client     record;
  v_campaigner record;
  v_in_agency  boolean;
  v_has_team   boolean;
  v_outcome    text;
  v_message    text;
begin
  select id, name, agency_id, tenant_id into v_client from public.clients where id = p_client_id;
  if v_client.id is null or v_client.tenant_id is distinct from p_tenant then
    return jsonb_build_object('outcome','error','message','client not found in this tenant');
  end if;

  select id, full_name, tenant_id into v_campaigner from public.campaigners where id = p_campaigner_id;
  if v_campaigner.id is null or v_campaigner.tenant_id is distinct from p_tenant then
    return jsonb_build_object('outcome','error','message','campaigner not found in this tenant');
  end if;

  -- LEGITIMACY: the campaigner must already belong to the client's agency.
  select exists(
    select 1 from public.campaigner_agencies
    where campaigner_id = p_campaigner_id and agency_id = v_client.agency_id
  ) into v_in_agency;

  select exists(
    select 1 from public.client_team
    where campaigner_id = p_campaigner_id and client_id = p_client_id
  ) into v_has_team;

  if not v_in_agency then
    v_outcome := 'refused_out_of_scope';
    v_message := format('הקמפיינר %s אינו שייך לסוכנות של הלקוח %s — אסור להעלות גישה. הפנה את הבקשה לדוד.',
                        v_campaigner.full_name, v_client.name);
  elsif v_has_team then
    v_outcome := 'already_assigned';
    v_message := format('הקמפיינר %s כבר משויך ללקוח %s ב-client_team. אם עדיין לא רואה — ייתכן שהבעיה היא קישור הפרופיל (profiles.campaigner_id) או role חסר; הפנה לבדיקה.',
                        v_campaigner.full_name, v_client.name);
  else
    insert into public.client_team (client_id, campaigner_id) values (p_client_id, p_campaigner_id);
    v_outcome := 'granted';
    v_message := format('שויך הקמפיינר %s ללקוח %s (בתוך הסוכנות שלו). כעת יראה את הדוחות.',
                        v_campaigner.full_name, v_client.name);
  end if;

  insert into public.claude_carmen_audit (tenant_id, actor, action, target, details)
  values (p_tenant, 'carmen', 'fix_campaigner_access', v_client.name,
          jsonb_build_object('campaigner_id', p_campaigner_id, 'client_id', p_client_id,
                             'agency_id', v_client.agency_id, 'outcome', v_outcome));

  return jsonb_build_object(
    'outcome', v_outcome, 'message', v_message,
    'campaigner', v_campaigner.full_name, 'client', v_client.name,
    'in_agency', v_in_agency, 'already_assigned', v_has_team
  );
end;
$func$;

grant execute on function public.carmen_fix_campaigner_access(uuid, uuid, uuid) to service_role;
