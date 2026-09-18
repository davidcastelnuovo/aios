-- Carmen skin: campaign data snapshot (Staging apply via apply-staging-sql-migration.yml).
-- Idempotent — safe to re-run.

INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description,
  trigger_phrases, triggers, steps, system_prompt, constraints, allowed_tools, output_template
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  true,
  true,
  'campaign_data_snapshot',
  'נתוני קמפיינים — snapshot + טבלה',
  'שליפה חיה של נתוני קמפיין (המרות, עלות להמרה) לפי קמפיין, שמירה לזיכרון, והצגה בטבלה מסודרת לשליפה חוזרת מהירה.',
  ARRAY[
    'נתוני קמפיינים',
    'נתונים על קמפיינים',
    'תראי קמפיינים',
    'המרות לפי קמפיין',
    'עלות להמרה',
    'cost per conversion',
    'campaign data',
    'campaign snapshot',
    'טבלת קמפיינים',
    'ביצועי קמפיינים'
  ],
  ARRAY[
    'נתוני קמפיינים',
    'המרות קמפיין',
    'עלות להמרה'
  ],
  $$1. זהי לקוח/סקופ (client_id או agency) — search_entities / list_clients.
2. recall_memory(category=clients, search=<שם לקוח>) — אם יש snapshot עדכני (<30 דק') הציגי קודם, אבל תמיד שלפי נתונים חיים לפני התשובה הסופית.
3. Meta: get_facebook_campaign_data(client_id, days=7|30 לפי הבקשה). Google: list_google_campaigns(client_id). CRM fallback: analyze_campaign_performance(client_id).
4. אגרגי לפי campaign_id/campaign_name: spend, conversions (leads/purchases/conversions), cost_per_conversion (=spend/conversions או CPL/CPP).
5. save_memory — key: campaign_snapshot_{client_id}_{period}d, category: clients. תוכן JSON + טבמת markdown (ראה output_template).
6. kb_learn(topic=<client> campaign snapshot, summary=שורת סיכום + totals, importance=7).
7. הציגי לדוד: כותרת + תאריך שליפה + טבלה + שורת סיכום.$$,
  $$כשדוד מבקש נתונים על קמפיינים — **תמיד** שלפי נתונים חיים, **שמרי** snapshot מעודכן, והציגי **טבלה מדויקת**.

### שליפה
- לקוח יחיד: `get_facebook_campaign_data(client_id, days)` (live Meta ראשון) + `list_google_campaigns(client_id)` אם יש Google.
- סוכנות / ריבוי לקוחות: `analyze_campaign_performance(agency_id|agency_name)` ואז drill-down ללקוח ספציפי.
- אם `fb_not_connected` / `no_campaign_table` — דווחי בבירור; אל תמציאי מספרים.

### אגרגציה לפי קמפיין
| שדה | Meta leads | Meta ecommerce | Google |
|-----|-----------|----------------|--------|
| conversions | leads_count | purchases (מ-actions או CRM) | metrics.conversions |
| cost_per_conversion | cost_per_lead / spend÷leads | spend÷purchases | cost÷conversions |
| spend | spend | spend | cost |

עגלו ל-2 ספרות. ₪ לפני סכומים. אם conversions=0 — עלות להמרה = "—".

### שמירה לזיכרון (חובה בכל שליפה)
`save_memory`:
- **key:** `campaign_snapshot_{client_id}_{period}d` (למשל `campaign_snapshot_a1b2..._7d`)
- **category:** `clients`
- **content:** JSON:
```json
{"fetched_at":"ISO","client_id":"...","client_name":"...","period_days":7,"source":"live_meta|google_ads|crm_sync","campaigns":[{"campaign_id":"...","campaign_name":"...","spend":0,"conversions":0,"cost_per_conversion":null,"status":"ACTIVE"}],"totals":{"spend":0,"conversions":0,"cost_per_conversion":null},"table_markdown":"..."}
```

### שליפה חוזרת
לפני fetch — `recall_memory(category=clients, search=campaign_snapshot_<client>)`. אם snapshot <30 דק' — אפשר להציג מיד, **אבל** עדיין refresh + upsert לפני תשובה סופית.

### פורמט תצוגה (WhatsApp / Command Center)
כותרת: `📊 נתוני קמפיינים — {client_name} ({period}d) · עודכן {HH:MM}`
טבלה markdown (RTL-friendly):
| קמפיין | הוצאה (₪) | המרות | עלות להמרה (₪) | סטטוס |
|--------|----------:|------:|----------------:|-------|
| ... | ... | ... | ... | ... |
| **סה"כ** | **...** | **...** | **...** | |

שורת סיכום: קמפיין מוביל / חריג / המלצה קצרה אם רלוונטי.
אל תוסיפי "פרטים בדשבורד בלבד" — הטבלה היא התשובה.$$,
  'אסור להמציא מספרים. אסור לדלג על save_memory. אסור להחליף קמפיין בלי campaign_id. Google+Meta — שתי טבלאות נפרדות אם שני הערוצים פעילים.',
  ARRAY['get_facebook_campaign_data','list_facebook_campaigns','analyze_campaign_performance','list_facebook_campaigns','search_entities','list_clients','save_memory','recall_memory','kb_learn'],
  $$📊 נתוני קמפיינים — {client_name} ({period_days} ימים) · עודכן {fetched_at_local}

| קמפיין | הוצאה (₪) | המרות | עלות להמרה (₪) | סטטוס |
|--------|----------:|------:|----------------:|-------|
{rows}
| **סה"כ** | **{total_spend}** | **{total_conversions}** | **{total_cpa}** | |

{summary_line}$$
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'campaign_data_snapshot'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
