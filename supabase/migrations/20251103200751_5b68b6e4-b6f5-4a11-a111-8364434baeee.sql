-- Ensure triggers exist to create onboarding entries when client status changes or on insert
DROP TRIGGER IF EXISTS clients_onboarding_status ON public.clients;
DROP TRIGGER IF EXISTS clients_onboarding_insert ON public.clients;

-- Trigger after UPDATE of status
CREATE TRIGGER clients_onboarding_status
AFTER UPDATE OF status ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.handle_client_onboarding_status();

-- Trigger after INSERT (covers clients created directly with 'onboarding')
CREATE TRIGGER clients_onboarding_insert
AFTER INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.handle_client_onboarding_status();

-- Backfill: create client_onboarding rows for clients already in 'onboarding' without an active onboarding entry
WITH default_campaigner AS (
  SELECT c.id AS client_id,
         COALESCE(
           (SELECT ct.campaigner_id FROM public.client_team ct WHERE ct.client_id = c.id LIMIT 1),
           (SELECT cam.id FROM public.campaigners cam WHERE cam.active = true LIMIT 1)
         ) AS campaigner_id
  FROM public.clients c
  WHERE c.status = 'onboarding'
)
INSERT INTO public.client_onboarding (
  client_id,
  agency_id,
  campaigner_id,
  title,
  status,
  notes,
  tenant_id
)
SELECT c.id,
       c.agency_id,
       dc.campaigner_id,
       'קליטת לקוח: ' || c.name,
       'research_meeting',
       'נוצר אוטומטית מבקפיל',
       c.tenant_id
FROM public.clients c
JOIN default_campaigner dc ON dc.client_id = c.id
WHERE c.status = 'onboarding'
  AND dc.campaigner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_onboarding co
    WHERE co.client_id = c.id
      AND co.status != 'campaign_live'
);
