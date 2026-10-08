-- Delete duplicate campaigner records, keeping only:
-- a3ab197e-28d3-4204-bf18-dfffc1f3526c (david - linked to user)
-- e2fd8806-305b-48b2-9fa5-9da1f35fcc28 (דוד קסטלנואובו)

DELETE FROM campaigners 
WHERE id IN (
  '26221b44-e119-47e7-9a53-6d1f2b21aad7', -- davi
  'e9eb9548-796b-4309-82b3-a9463539dea8', -- david duplicate
  '5affb462-0c76-43e2-bf05-68108cae9eaa', -- david duplicate
  'f8e135b8-f5a1-4f9a-86e2-88cd4cdfd633', -- david duplicate
  '07e7a1af-96a8-4299-9c6d-fbc6cbaae169', -- david duplicate
  'd64c6a93-4eae-4ad4-a1d7-aca322ce4d9b', -- david duplicate
  '219de20a-88d6-4bb9-866c-0fea0734ebc6', -- david duplicate
  '3041ce8f-8b82-41dd-9537-03864f187de5', -- david duplicate
  '24f453bf-3f14-4822-9647-6b636e2f4717', -- david duplicate
  '5520eb01-ac7f-4196-8b73-a4dc84e6a7a4'  -- david.dmm4business
);
