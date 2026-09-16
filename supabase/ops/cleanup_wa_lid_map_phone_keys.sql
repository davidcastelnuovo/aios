-- Cleanup: wa_lid_map rows whose `lid` key is actually a real phone number.
--
-- The Manus gateway delivers private messages with the sender's REAL phone in
-- `from` / `senderPhone` while flagging the chat as `@lid`. manus-wa-webhook used
-- to key wa_lid_map by that value, so the "learned map" stored phone→phone rows:
--
--   lid 972507677613 (David)          -> phone 972549696673 (Carmen's own number)
--   lid 972508266089 (another member) -> phone 972507677613 (David)
--
-- Every later private message from those numbers was re-attributed to the mapped
-- phone, so Carmen answered the wrong chat or refused with `reason=scope_phone`.
--
-- The webhook no longer writes or reads phone-shaped LID keys, so these rows are
-- already inert; this removes them so the map only holds genuine LIDs.
-- Run via the "Apply SQL migration (Management API)" workflow (workflow_dispatch).

begin;

create temp table wa_lid_map_phone_keys_removed as
select lid, phone, source
from public.wa_lid_map
where length(regexp_replace(lid, '\D', '', 'g')) <= 13
  and right(regexp_replace(lid, '\D', '', 'g'), 9) ~ '^[5-9][0-9]{8}$';

delete from public.wa_lid_map w
using wa_lid_map_phone_keys_removed r
where w.lid = r.lid;

select * from wa_lid_map_phone_keys_removed;

commit;
