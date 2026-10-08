-- Tasks linked to a client must carry that client's agency.
--
-- Historically the board stamped `tasks.agency_id` with the creator's first /
-- default agency instead of the client's, so the agency filter showed tasks of
-- other agencies' clients (and hid tasks that did belong to the agency).
-- The write paths now derive the agency from the client; this repoints the rows
-- that were already stored with the wrong stamp.
--
-- Scope: only rows that have a client whose agency is known and different.
-- Tasks without a client keep their stamp.

UPDATE public.tasks AS t
SET agency_id = c.agency_id
FROM public.clients AS c
WHERE t.client_id = c.id
  AND c.agency_id IS NOT NULL
  AND t.agency_id IS DISTINCT FROM c.agency_id;
