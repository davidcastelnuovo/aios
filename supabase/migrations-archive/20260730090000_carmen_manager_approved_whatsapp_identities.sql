-- Carmen group access is approved by a tenant manager in AIOS.
-- A manager-approved identity is immediately usable; no OTP or self-enrollment
-- is required or allowed for group participants.

create or replace function public.carmen_identity_activation_trigger()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
begin
  new.phone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  new.updated_at := now();

  if new.status = 'approved' then
    new.approved_by := coalesce(new.approved_by, auth.uid());
    new.approved_at := coalesce(new.approved_at, now());
    new.verified_at := coalesce(new.verified_at, now());
  elsif new.status in ('rejected', 'revoked') then
    new.verified_at := null;
  end if;

  return new;
end;
$$;

-- Existing manager-approved identities should work without the retired OTP
-- handshake. This does not approve pending, rejected, or revoked identities.
update public.carmen_whatsapp_identities
set verified_at = coalesce(verified_at, approved_at, created_at),
    updated_at = now()
where status = 'approved'
  and verified_at is null;
