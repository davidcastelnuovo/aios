-- Marketing module data dump integration
-- Date: 2026-06-27
-- Tables: marketing_stage_templates, marketing_pipelines, marketing_pipeline_stages,
--         marketing_work_items, marketing_runs, marketing_assets
-- Strategy: INSERT ... ON CONFLICT (id) DO NOTHING
--   Safe to run multiple times. Will not overwrite existing rows.
--   Does not touch any other module tables.

BEGIN;

-- ── 1. marketing_stage_templates ────────────────────────────────────────────
INSERT INTO public.marketing_stage_templates
  ("id","tenant_id","track","stage_type","name","default_agent_id","default_approval_mode",
   "default_instructions","default_tools","default_target","is_system","created_at","updated_at")
VALUES
  ('6c888ca0-15dd-4796-a368-46a8af59ed0d','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','campaigns','strategy',
   'בריף',NULL,'manual',
   'אתה אסטרטג שיווקי בכיר. הפק בריף שיווקי מובנה לפריט הזה: קהל יעד מדויק, כאבים מרכזיים, הצעת ערך ייחודית, 3-5 מסרים מרכזיים, טון תקשורת, ו-KPIs מדידים. השתמש במידע על הלקוח שניתן לך.',
   '[]'::jsonb,'{}' ::jsonb,false,
   '2026-06-21T16:10:03.953544+00:00','2026-06-21T16:10:03.953544+00:00')
ON CONFLICT (id) DO NOTHING;

-- ── 2. marketing_pipelines ───────────────────────────────────────────────────
INSERT INTO public.marketing_pipelines
  ("id","tenant_id","client_id","name","is_active","created_at","updated_at","track")
VALUES
  ('d5abbde7-fadb-4b1f-a443-2958bd0a42d0','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','5af32e16-162d-4025-addf-266bf0b17cf2','מחלקת שיווק',true,'2026-06-21T12:43:41.097993+00:00','2026-06-21T12:43:41.097993+00:00','campaigns'),
  ('564910b8-fbec-4e98-8958-a1e17682fa2a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','b14c3cca-6d97-4b00-90dc-148bf1281bd1','מחלקת שיווק',true,'2026-06-21T12:44:47.536825+00:00','2026-06-21T12:44:47.536825+00:00','campaigns'),
  ('aaa307d9-2e64-4575-bd4e-57a566264861','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','5af32e16-162d-4025-addf-266bf0b17cf2','מחלקת שיווק',true,'2026-06-21T13:28:57.974511+00:00','2026-06-21T13:28:57.974511+00:00','social_organic'),
  ('3996c417-a8c8-4170-adb8-b76d233bc950','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','5af32e16-162d-4025-addf-266bf0b17cf2','מחלקת שיווק',true,'2026-06-21T13:29:01.65735+00:00', '2026-06-21T13:29:01.65735+00:00', 'seo_geo'),
  ('2731a726-7067-4466-948f-c009aca3675a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','6687506e-ed57-477d-89db-2ed8160ce6c9','מחלקת שיווק',true,'2026-06-21T17:40:26.310633+00:00','2026-06-21T17:40:26.310633+00:00','campaigns')
ON CONFLICT (id) DO NOTHING;

-- ── 3. marketing_pipeline_stages ─────────────────────────────────────────────
INSERT INTO public.marketing_pipeline_stages
  ("id","pipeline_id","tenant_id","stage_type","name","agent_id","approval_mode",
   "position_x","position_y","parent_stage_id","configuration","sort_order","created_at","updated_at")
VALUES
  ('d6e9113d-5d20-4a0a-84ed-70553d9e7010','564910b8-fbec-4e98-8958-a1e17682fa2a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','copy','כתיבת תוכן',NULL,'manual',280,200,NULL,'{}'::jsonb,1,'2026-06-21T12:44:47.748385+00:00','2026-06-21T12:44:47.748385+00:00'),
  ('8a6d9f84-55a5-4bdd-af7f-38119725ef7f','564910b8-fbec-4e98-8958-a1e17682fa2a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','creative','קריאייטיב',NULL,'manual',560,200,NULL,'{}'::jsonb,2,'2026-06-21T12:44:47.748385+00:00','2026-06-21T12:44:47.748385+00:00'),
  ('2a3b0a21-cf29-4684-ae41-bc99d56bfd70','564910b8-fbec-4e98-8958-a1e17682fa2a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','target_paid','קמפיין ממומן',NULL,'manual',880,60,NULL,'{}'::jsonb,3,'2026-06-21T12:44:47.748385+00:00','2026-06-21T12:44:47.748385+00:00'),
  ('9e0f4312-6acb-4b9e-bbf7-9f27e0ddc5ff','564910b8-fbec-4e98-8958-a1e17682fa2a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','measurement','מדידה',NULL,'manual',1180,200,NULL,'{}'::jsonb,6,'2026-06-21T12:44:47.748385+00:00','2026-06-21T12:44:47.748385+00:00'),
  ('833730c3-ef0c-4f84-a89b-d92a6319d5d9','d5abbde7-fadb-4b1f-a443-2958bd0a42d0','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','copy','כתיבת תוכן','8cdb9373-a370-4ae4-8e90-b5a7c35ab492','manual',900,200,NULL,'{"tools":["knowledge_base","translation","ai_text","web_search"],"target":{},"instructions":"אתה קופירייטר מקצועי. כתוב את הקופי לפי הבריף שניתן לך. שמור על נימה התואמת למותג, באורך מתאים לערוץ הפרסום. כתוב טקסט שיווקי משכנע, ברור ועם call to action חזק."}'::jsonb,1,'2026-06-21T12:43:41.295286+00:00','2026-06-21T16:11:15.937556+00:00'),
  ('fef7589f-3ec9-47ca-95fa-ec29336fa3e7','d5abbde7-fadb-4b1f-a443-2958bd0a42d0','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','strategy','בריף','8cdb9373-a370-4ae4-8e90-b5a7c35ab492','manual',1180,200,NULL,'{"tools":["knowledge_base","competitive_analysis","web_search"],"target":{},"instructions":""}'::jsonb,0,'2026-06-21T12:43:41.295286+00:00','2026-06-21T16:11:22.635786+00:00'),
  ('67ed94f6-81d3-4d21-a499-292e4b282be2','d5abbde7-fadb-4b1f-a443-2958bd0a42d0','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','target_paid','קמפיין ממומן',NULL,'manual',320,60,NULL,'{}'::jsonb,3,'2026-06-21T12:43:41.295286+00:00','2026-06-21T13:16:36.304439+00:00'),
  ('57dacb71-73d7-4cf0-99e6-186ca448d642','d5abbde7-fadb-4b1f-a443-2958bd0a42d0','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','creative','קריאייטיב','8cdb9373-a370-4ae4-8e90-b5a7c35ab492','manual',620,200,NULL,'{"tools":["image_gen","image_edit","video_gen","stock_library"],"target":{},"instructions":"אתה Art Director. צור תמונה שיווקית מקצועית התואמת לקופי שניתן לך. תמונה ברורה, מודרנית, מעוצבת, מתאימה לפלטפורמה. ללא טקסט מודבק על התמונה (אלא אם התבקש במפורש)."}'::jsonb,2,'2026-06-21T12:43:41.295286+00:00','2026-06-21T16:11:30.489033+00:00'),
  ('8efb0350-7f45-4ead-b6a7-1a4643641119','2731a726-7067-4466-948f-c009aca3675a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','strategy','בריף',NULL,'manual',1120,200,NULL,'{"tools":[],"target":{},"instructions":"אתה אסטרטג שיווקי בכיר. הפק בריף שיווקי מובנה לפריט הזה: קהל יעד מדויק, כאבים מרכזיים, הצעת ערך ייחודית, 3-5 מסרים מרכזיים, טון תקשורת, ו-KPIs מדידים. השתמש במידע על הלקוח שניתן לך."}'::jsonb,0,'2026-06-21T17:40:26.678597+00:00','2026-06-21T17:40:26.678597+00:00'),
  ('19be90d8-206d-4d24-a1d2-2ea5064e5955','d5abbde7-fadb-4b1f-a443-2958bd0a42d0','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','measurement','מדידה',NULL,'manual',0,200,NULL,'{}'::jsonb,6,'2026-06-21T12:43:41.295286+00:00','2026-06-21T13:16:36.310327+00:00'),
  ('1d5b817e-cca8-47ef-924c-824b57162b15','564910b8-fbec-4e98-8958-a1e17682fa2a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','strategy','בריף',NULL,'manual',0,200,NULL,'{}'::jsonb,0,'2026-06-21T12:44:47.748385+00:00','2026-06-21T13:23:51.114903+00:00'),
  ('22822f93-7b27-47a0-a899-96dadaa2636a','2731a726-7067-4466-948f-c009aca3675a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','copy','כתיבת תוכן',NULL,'manual',840,200,NULL,'{"tools":[],"target":{},"instructions":""}'::jsonb,1,'2026-06-21T17:40:26.678597+00:00','2026-06-21T17:40:26.678597+00:00'),
  ('920433a8-4b96-4756-87d9-7934a765cec0','aaa307d9-2e64-4575-bd4e-57a566264861','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','target_organic','סושיאל אורגני',NULL,'manual',280,200,NULL,'{}'::jsonb,3,'2026-06-21T13:28:58.111579+00:00','2026-06-21T13:28:58.111579+00:00'),
  ('be44a3df-ddb8-4a3b-814f-83e93f3485d2','aaa307d9-2e64-4575-bd4e-57a566264861','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','measurement','מדידה',NULL,'manual',0,200,NULL,'{}'::jsonb,4,'2026-06-21T13:28:58.111579+00:00','2026-06-21T13:28:58.111579+00:00'),
  ('8bf29918-acc5-4ae5-9a7c-66e1ccc1fc5f','3996c417-a8c8-4170-adb8-b76d233bc950','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','strategy','בריף',NULL,'manual',1120,200,NULL,'{}'::jsonb,0,'2026-06-21T13:29:01.822399+00:00','2026-06-21T13:29:01.822399+00:00'),
  ('2d7ea3f0-acea-465a-8f5a-0a143eef4950','3996c417-a8c8-4170-adb8-b76d233bc950','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','copy','כתיבת תוכן',NULL,'manual',840,200,NULL,'{}'::jsonb,1,'2026-06-21T13:29:01.822399+00:00','2026-06-21T13:29:01.822399+00:00'),
  ('0a8135c2-f39d-4e34-9518-8e37539caa50','3996c417-a8c8-4170-adb8-b76d233bc950','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','creative','קריאייטיב',NULL,'manual',560,200,NULL,'{}'::jsonb,2,'2026-06-21T13:29:01.822399+00:00','2026-06-21T13:29:01.822399+00:00'),
  ('04aa4a51-14a3-49b1-a7ac-1af5ebd8eee6','3996c417-a8c8-4170-adb8-b76d233bc950','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','target_seo','SEO / GEO',NULL,'manual',280,200,NULL,'{}'::jsonb,3,'2026-06-21T13:29:01.822399+00:00','2026-06-21T13:29:01.822399+00:00'),
  ('8dbc4c85-4eb4-4484-a72d-095089520118','3996c417-a8c8-4170-adb8-b76d233bc950','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','measurement','מדידה',NULL,'manual',0,200,NULL,'{}'::jsonb,4,'2026-06-21T13:29:01.822399+00:00','2026-06-21T13:29:01.822399+00:00'),
  ('5e781643-348c-42ce-8c00-0a66fcec5aa5','2731a726-7067-4466-948f-c009aca3675a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','creative','קריאייטיב',NULL,'manual',560,200,NULL,'{"tools":[],"target":{},"instructions":""}'::jsonb,2,'2026-06-21T17:40:26.678597+00:00','2026-06-21T17:40:26.678597+00:00'),
  ('2bd92d14-4ef4-4715-ac16-baef0789d4a5','aaa307d9-2e64-4575-bd4e-57a566264861','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','copy','כתיבת תוכן','8cdb9373-a370-4ae4-8e90-b5a7c35ab492','manual',840,200,NULL,'{"tools":["knowledge_base","translation","web_search","ai_text"],"target":{},"instructions":"תכתבי תוכן שמוכר את המערכת שלנו של מערכת הפעלה וניהול סוכנות פרסום מבוססת בינה מלאכותית"}'::jsonb,1,'2026-06-21T13:28:58.111579+00:00','2026-06-21T13:36:04.972702+00:00'),
  ('78c1c8d0-e494-491a-9685-738ef3ce4b41','aaa307d9-2e64-4575-bd4e-57a566264861','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','strategy','בריף','8cdb9373-a370-4ae4-8e90-b5a7c35ab492','manual',1120,200,NULL,'{"tools":["web_search","knowledge_base","competitive_analysis"],"target":{},"instructions":"תכיני בריף לקוח מסודר על דעת עצמך"}'::jsonb,0,'2026-06-21T13:28:58.111579+00:00','2026-06-21T13:36:46.644201+00:00'),
  ('3f1bdc64-6c84-4792-bcc8-7b258f7c0913','aaa307d9-2e64-4575-bd4e-57a566264861','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','creative','קריאייטיב','8cdb9373-a370-4ae4-8e90-b5a7c35ab492','manual',560,200,NULL,'{"tools":["image_gen","image_edit","video_gen","stock_library"],"target":{},"instructions":"תצרי 12 קריאייטיבים ב 4 סגנונות שונים"}'::jsonb,2,'2026-06-21T13:28:58.111579+00:00','2026-06-21T13:36:46.644201+00:00'),
  ('98fd5adf-6ca5-4ea6-903d-af87562036f3','2731a726-7067-4466-948f-c009aca3675a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','target_paid','קמפיין ממומן',NULL,'manual',280,200,NULL,'{"tools":[],"target":{},"instructions":""}'::jsonb,3,'2026-06-21T17:40:26.678597+00:00','2026-06-21T17:40:26.678597+00:00'),
  ('93d042af-e6ca-4339-aeca-4b2991a21110','2731a726-7067-4466-948f-c009aca3675a','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','measurement','מדידה',NULL,'manual',0,200,NULL,'{"tools":[],"target":{},"instructions":""}'::jsonb,4,'2026-06-21T17:40:26.678597+00:00','2026-06-21T17:40:26.678597+00:00')
ON CONFLICT (id) DO NOTHING;

-- ── 4. marketing_work_items ──────────────────────────────────────────────────
INSERT INTO public.marketing_work_items
  ("id","pipeline_id","tenant_id","client_id","current_stage_id","target_channel",
   "title","status","payload","links","scheduled_date","created_by","created_at","updated_at")
VALUES
  ('e49e7b23-9df0-4ac2-bc73-52b3e691f71d',
   'd5abbde7-fadb-4b1f-a443-2958bd0a42d0',
   '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
   '5af32e16-162d-4025-addf-266bf0b17cf2',
   'fef7589f-3ec9-47ca-95fa-ec29336fa3e7',
   NULL,'פריט תוכן חדש','draft',
   '{"copy_text":"שלום, כאן כרמן! איזה כיף לעבור מהתיאוריה לשטח."}'::jsonb,
   '{}'::jsonb,NULL,NULL,
   '2026-06-21T12:44:28.171513+00:00','2026-06-21T16:14:29.362795+00:00')
ON CONFLICT (id) DO NOTHING;

-- ── 5. marketing_runs ────────────────────────────────────────────────────────
INSERT INTO public.marketing_runs
  ("id","tenant_id","item_id","stage_id","status","input","output","error",
   "model","tokens_in","tokens_out","cost_usd","started_at","finished_at",
   "created_by","created_at","updated_at")
VALUES
  ('06850cff-9744-481b-abe0-55b77c4c7100','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','e49e7b23-9df0-4ac2-bc73-52b3e691f71d','fef7589f-3ec9-47ca-95fa-ec29336fa3e7','awaiting_approval','{"item_title":"פריט תוכן חדש","stage_type":"strategy"}'::jsonb,'{"text":"בריף שיווקי ראשון"}'::jsonb,NULL,'google/gemini-3-flash-preview',60,1016,0.000309,'2026-06-21T16:10:54.913+00:00','2026-06-21T16:11:01.528+00:00','bcd21d1c-3b39-4a7c-9dbf-4c89679110b9','2026-06-21T16:10:54.930995+00:00','2026-06-21T16:11:01.545602+00:00'),
  ('b8f4b513-bc30-4a48-858d-c22e2006495c','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','e49e7b23-9df0-4ac2-bc73-52b3e691f71d','fef7589f-3ec9-47ca-95fa-ec29336fa3e7','awaiting_approval','{"item_title":"פריט תוכן חדש","stage_type":"strategy"}'::jsonb,'{"text":"בריף שיווקי שני"}'::jsonb,NULL,'google/gemini-3-flash-preview',821,1054,0.000378,'2026-06-21T16:11:35.385+00:00','2026-06-21T16:11:42.617+00:00','bcd21d1c-3b39-4a7c-9dbf-4c89679110b9','2026-06-21T16:11:35.401929+00:00','2026-06-21T16:11:42.630575+00:00'),
  ('f3f70ba4-0ab2-41fc-afa3-ddffff233ffe','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','e49e7b23-9df0-4ac2-bc73-52b3e691f71d','fef7589f-3ec9-47ca-95fa-ec29336fa3e7','awaiting_approval','{"item_title":"פריט תוכן חדש","stage_type":"strategy"}'::jsonb,'{"text":"בריף שיווקי שלישי"}'::jsonb,NULL,'google/gemini-3-flash-preview',1580,1068,0.000397,'2026-06-21T16:12:31.754+00:00','2026-06-21T16:12:38.396+00:00','bcd21d1c-3b39-4a7c-9dbf-4c89679110b9','2026-06-21T16:12:31.770285+00:00','2026-06-21T16:12:38.409499+00:00'),
  ('3a3f3db3-5deb-48ad-92da-8061ccea9104','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','e49e7b23-9df0-4ac2-bc73-52b3e691f71d','833730c3-ef0c-4f84-a89b-d92a6319d5d9','awaiting_approval','{"item_title":"פריט תוכן חדש","stage_type":"copy"}'::jsonb,'{"text":"קופי שיווקי"}'::jsonb,NULL,'google/gemini-3-flash-preview',2276,603,0.000352,'2026-06-21T16:14:24.568+00:00','2026-06-21T16:14:29.371+00:00','bcd21d1c-3b39-4a7c-9dbf-4c89679110b9','2026-06-21T16:14:24.585488+00:00','2026-06-21T16:14:29.399749+00:00'),
  ('98ff51bc-0cc3-4c5f-956a-c386b91c4606','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','e49e7b23-9df0-4ac2-bc73-52b3e691f71d','57dacb71-73d7-4cf0-99e6-186ca448d642','failed','{"item_title":"פריט תוכן חדש","stage_type":"creative"}'::jsonb,'{}'::jsonb,'No image returned','google/gemini-2.5-flash-image',0,0,0,'2026-06-21T16:14:39.285+00:00','2026-06-21T16:14:40.421+00:00','bcd21d1c-3b39-4a7c-9dbf-4c89679110b9','2026-06-21T16:14:39.303863+00:00','2026-06-21T16:14:40.433645+00:00')
ON CONFLICT (id) DO NOTHING;

-- ── 6. marketing_assets ──────────────────────────────────────────────────────
INSERT INTO public.marketing_assets
  ("id","tenant_id","item_id","run_id","stage_id","type","url","content","meta","created_at")
VALUES
  ('012a918d-7f06-44fb-8f53-8817c631dc8c','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','e49e7b23-9df0-4ac2-bc73-52b3e691f71d','06850cff-9744-481b-abe0-55b77c4c7100','fef7589f-3ec9-47ca-95fa-ec29336fa3e7','brief',NULL,'בריף שיווקי ראשון','{"stage_type":"strategy"}'::jsonb,'2026-06-21T16:11:01.486597+00:00'),
  ('e002d8f9-59f8-4702-a0eb-f8b73b8ba750','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','e49e7b23-9df0-4ac2-bc73-52b3e691f71d','b8f4b513-bc30-4a48-858d-c22e2006495c','fef7589f-3ec9-47ca-95fa-ec29336fa3e7','brief',NULL,'בריף שיווקי שני','{"stage_type":"strategy"}'::jsonb,'2026-06-21T16:11:42.585831+00:00'),
  ('7744b6c5-a48d-4d37-a896-20c785b6f92d','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','e49e7b23-9df0-4ac2-bc73-52b3e691f71d','f3f70ba4-0ab2-41fc-afa3-ddffff233ffe','fef7589f-3ec9-47ca-95fa-ec29336fa3e7','brief',NULL,'בריף שיווקי שלישי','{"stage_type":"strategy"}'::jsonb,'2026-06-21T16:12:38.409499+00:00'),
  ('0069152b-bbc5-487c-af43-7216569ea285','2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019','e49e7b23-9df0-4ac2-bc73-52b3e691f71d','3a3f3db3-5deb-48ad-92da-8061ccea9104','833730c3-ef0c-4f84-a89b-d92a6319d5d9','copy',NULL,'קופי שיווקי','{"stage_type":"copy"}'::jsonb,'2026-06-21T16:14:29.334524+00:00')
ON CONFLICT (id) DO NOTHING;

COMMIT;
