import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'

function resolveModel(engine: string): string {
  const map: Record<string, string> = {
    // Gemini models
    'gemini-2.5-flash': 'google/gemini-2.5-flash',
    'gemini-2.5-pro': 'google/gemini-2.5-pro',
    'gemini-3-flash': 'google/gemini-3-flash-preview',
    'gemini-3-pro': 'google/gemini-3-pro-image-preview',
    'gemini-1.5-flash': 'google/gemini-2.5-flash',
    // OpenAI models
    'gpt-5': 'openai/gpt-5',
    'gpt-5-mini': 'openai/gpt-5-mini',
    // Legacy manus mappings -> redirect to gemini
    'manus-1.6': 'google/gemini-3-flash-preview',
    'manus-1.6-max': 'google/gemini-2.5-pro',
    'manus-1.6-lite': 'google/gemini-2.5-flash-lite',
  }
  return map[engine] || 'google/gemini-3-flash-preview'
}

// ===========================
// ALL AVAILABLE TOOLS
// ===========================
const ALL_TOOLS = [
  // LEADS
  { name: 'create_lead', description: 'יצירת ליד חדש', parameters: { type: 'object', properties: { company_name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, source: { type: 'string' }, notes: { type: 'string' } }, required: ['contact_name'] } },
  { name: 'list_leads', description: 'רשימת לידים', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'update_lead_status', description: 'עדכון סטטוס ליד', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, status: { type: 'string' } }, required: ['lead_id', 'status'] } },
  { name: 'add_lead_update', description: 'הוספת עדכון לליד', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, content: { type: 'string' } }, required: ['lead_id', 'content'] } },
  // TASKS
  { name: 'create_task', description: 'יצירת משימה חדשה', parameters: { type: 'object', properties: { title: { type: 'string' }, client_id: { type: 'string' }, lead_id: { type: 'string' }, campaigner_id: { type: 'string', description: 'מזהה קמפיינר לשיוך המשימה' }, priority: { type: 'integer' }, due_date: { type: 'string' }, due_time: { type: 'string' }, notes: { type: 'string' }, duration_minutes: { type: 'integer', description: 'משך המשימה בדקות' } }, required: ['title'] } },
  { name: 'search_tasks', description: 'חיפוש משימות לפי שם/כותרת. חשוב! השתמש בכלי הזה לפני יצירת משימה כדי לוודא שהיא לא קיימת כבר', parameters: { type: 'object', properties: { search_term: { type: 'string', description: 'מילת חיפוש בכותרת המשימה' }, status: { type: 'string' }, client_id: { type: 'string' } }, required: ['search_term'] } },
  { name: 'list_tasks', description: 'רשימת משימות', parameters: { type: 'object', properties: { status: { type: 'string' }, client_id: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'update_task_status', description: 'עדכון סטטוס משימה', parameters: { type: 'object', properties: { task_id: { type: 'string' }, status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'] } }, required: ['task_id', 'status'] } },
  // CLIENTS
  { name: 'list_clients', description: 'רשימת לקוחות', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'get_client_info', description: 'מידע על לקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' } }, required: ['client_id'] } },
  { name: 'add_client_update', description: 'הוספת עדכון ללקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' }, content: { type: 'string' } }, required: ['client_id', 'content'] } },
  // MESSAGES
  { name: 'send_message', description: 'שליחת הודעת WhatsApp ללקוח או ליד', parameters: { type: 'object', properties: { contact_type: { type: 'string', enum: ['lead', 'client'] }, contact_id: { type: 'string' }, message_text: { type: 'string' } }, required: ['contact_type', 'contact_id', 'message_text'] } },
  // SEARCH
  { name: 'search_entities', description: 'חיפוש סוכנויות, לקוחות, קמפיינרים או לידים לפי שם', parameters: { type: 'object', properties: { entity_type: { type: 'string', enum: ['agency', 'client', 'campaigner', 'lead'] }, search_term: { type: 'string' } }, required: ['entity_type', 'search_term'] } },
  // MANUS AI - Complex task delegation
  { name: 'delegate_to_manus', description: 'שליחת משימה מורכבת ל-Manus AI לביצוע ברקע (מחקר שוק, ניתוח קמפיינים, יצירת תוכן, ניתוח נתונים). המשימה רצה ברקע ועשויה לקחת דקות עד שעות.', parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'תיאור מפורט של המשימה לביצוע' }, context_data: { type: 'string', description: 'נתוני הקשר רלוונטיים (למשל נתוני קמפיינים)' } }, required: ['prompt'] } },
  { name: 'get_facebook_campaign_data', description: 'שליפת נתוני קמפיינים מפייסבוק לצורך ניתוח', parameters: { type: 'object', properties: { client_id: { type: 'string' }, days: { type: 'integer', description: 'מספר ימים אחורה (ברירת מחדל 30)' } } } },
  // CLIENTS - full CRUD
  { name: 'create_client', description: 'יצירת לקוח חדש במערכת', parameters: { type: 'object', properties: { name: { type: 'string', description: 'שם העסק/לקוח' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, agency_id: { type: 'string', description: 'מזהה סוכנות (אופציונלי)' }, notes: { type: 'string' } }, required: ['name'] } },
  { name: 'update_client', description: 'עדכון פרטי לקוח קיים', parameters: { type: 'object', properties: { client_id: { type: 'string' }, name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, status: { type: 'string', enum: ['active', 'inactive', 'lead'] }, notes: { type: 'string' } }, required: ['client_id'] } },
  { name: 'update_client_status', description: 'עדכון סטטוס לקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' }, status: { type: 'string', enum: ['active', 'inactive', 'lead'] } }, required: ['client_id', 'status'] } },
  // LEADS - full CRUD
  { name: 'update_lead', description: 'עדכון פרטי ליד קיים (שם, טלפון, אימייל, מקור, הערות)', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, company_name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, source: { type: 'string' }, notes: { type: 'string' }, follow_up_date: { type: 'string', description: 'תאריך מעקב בפורמט YYYY-MM-DD' } }, required: ['lead_id'] } },
  { name: 'delete_lead', description: 'מחיקת ליד מהמערכת', parameters: { type: 'object', properties: { lead_id: { type: 'string' } }, required: ['lead_id'] } },
  // TASKS - full CRUD
  { name: 'update_task', description: 'עדכון פרטי משימה (כותרת, תאריך, עדיפות, הערות, סטטוס, שיוך ליד/קמפיינר)', parameters: { type: 'object', properties: { task_id: { type: 'string' }, title: { type: 'string' }, due_date: { type: 'string' }, due_time: { type: 'string' }, priority: { type: 'integer', description: '1-10' }, notes: { type: 'string' }, client_id: { type: 'string' }, lead_id: { type: 'string' }, campaigner_id: { type: 'string' }, duration_minutes: { type: 'integer' }, status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'] } }, required: ['task_id'] } },
  { name: 'delete_task', description: 'מחיקת משימה', parameters: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
  { name: 'add_task_update', description: 'הוספת הערה/עדכון למשימה', parameters: { type: 'object', properties: { task_id: { type: 'string' }, content: { type: 'string' } }, required: ['task_id', 'content'] } },
  { name: 'manage_task_collaborators', description: 'הוספה או הסרה של שותפים (קמפיינרים) למשימה', parameters: { type: 'object', properties: { task_id: { type: 'string' }, campaigner_id: { type: 'string' }, action: { type: 'string', enum: ['add', 'remove'] } }, required: ['task_id', 'campaigner_id', 'action'] } },
  // CLIENT ONBOARDING
  { name: 'create_onboarding', description: 'יצירת תהליך קליטת לקוח חדש', parameters: { type: 'object', properties: { title: { type: 'string' }, client_id: { type: 'string' }, campaigner_id: { type: 'string' }, notes: { type: 'string' } }, required: ['title', 'client_id'] } },
  { name: 'list_onboarding', description: 'רשימת תהליכי קליטת לקוחות', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'update_onboarding_status', description: 'עדכון סטטוס קליטת לקוח', parameters: { type: 'object', properties: { onboarding_id: { type: 'string' }, status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] } }, required: ['onboarding_id', 'status'] } },
  // CAMPAIGNERS
  { name: 'list_campaigners', description: 'רשימת קמפיינרים בטננט', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_campaigner', description: 'יצירת קמפיינר חדש', parameters: { type: 'object', properties: { full_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, role: { type: 'array', items: { type: 'string' } } }, required: ['full_name'] } },
  // SALES PEOPLE
  { name: 'list_sales_people', description: 'רשימת אנשי מכירות', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_sales_person', description: 'יצירת איש מכירות חדש', parameters: { type: 'object', properties: { full_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } }, required: ['full_name'] } },
  // AGENCIES
  { name: 'list_agencies', description: 'רשימת סוכנויות בטננט', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_agency', description: 'יצירת סוכנות חדשה', parameters: { type: 'object', properties: { name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } }, required: ['name'] } },
  // SUPPLIERS
  { name: 'list_suppliers', description: 'רשימת ספקים', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_supplier', description: 'יצירת ספק חדש', parameters: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } }, required: ['name'] } },
  // PRODUCTS
  { name: 'list_products', description: 'רשימת מוצרים/שירותים', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_product', description: 'יצירת מוצר/שירות חדש', parameters: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, price: { type: 'number' } }, required: ['name', 'price'] } },
  // AUTOMATIONS
  { name: 'list_automations', description: 'רשימת אוטומציות', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'toggle_automation', description: 'הפעלה/כיבוי אוטומציה', parameters: { type: 'object', properties: { automation_id: { type: 'string' }, active: { type: 'boolean' } }, required: ['automation_id', 'active'] } },
  // REPORTS & ANALYTICS
  { name: 'get_dashboard_stats', description: 'שליפת נתוני דשבורד: כמה לידים, לקוחות, משימות פתוחות, ועוד', parameters: { type: 'object', properties: {} } },
  // SOCIAL MEDIA
  { name: 'create_social_post', description: 'יצירת פוסט/מודעה חדשה במודול ניהול סושיאל מדיה. השתמש בכלי הזה כדי ליצור פוסטים עם תוכן טקסטואלי ותמונות. הפוסט יישמר כטיוטה במערכת.', parameters: { type: 'object', properties: { title: { type: 'string', description: 'כותרת הפוסט/מודעה' }, content: { type: 'string', description: 'תוכן הפוסט - הקופי של המודעה' }, post_type: { type: 'string', enum: ['text', 'image', 'video', 'carousel'], description: 'סוג הפוסט' }, media_urls: { type: 'array', items: { type: 'string' }, description: 'קישורי מדיה (תמונות/וידאו)' } }, required: ['title', 'content'] } },
  { name: 'generate_ad_image', description: 'יצירת תמונה למודעה/פוסט באמצעות AI. מחזיר URL של התמונה שנוצרה. השתמש בכלי הזה כדי ליצור ויזואל למודעות ופוסטים ואז השתמש ב-create_social_post כדי לשמור את הפוסט.', parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'תיאור מפורט של התמונה הרצויה באנגלית' }, aspect_ratio: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:5'], description: 'יחס גובה-רוחב' } }, required: ['prompt'] } },
  // MEMORY
  { name: 'save_memory', description: 'שמירת מידע לזיכרון מתמשך (העדפות, פרויקטים, הוראות)', parameters: { type: 'object', properties: { key: { type: 'string', description: 'מפתח זיהוי' }, content: { type: 'string', description: 'התוכן לשמירה' }, category: { type: 'string', enum: ['preferences', 'projects', 'clients', 'workflows', 'personal'] } }, required: ['key', 'content'] } },
  { name: 'recall_memory', description: 'שליפת זיכרונות שנשמרו', parameters: { type: 'object', properties: { category: { type: 'string' }, search: { type: 'string' } } } },
  { name: 'delete_memory', description: 'מחיקת זיכרון', parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } },
  // CHAT HISTORY
  { name: 'get_chat_history', description: 'שליפת היסטוריית שיחות WhatsApp עם ליד או לקוח', parameters: { type: 'object', properties: { contact_type: { type: 'string', enum: ['lead', 'client'] }, contact_id: { type: 'string' }, limit: { type: 'integer' } }, required: ['contact_type', 'contact_id'] } },
  { name: 'get_recent_inbound_messages', description: 'שליפת הודעות נכנסות אחרונות מכל השיחות', parameters: { type: 'object', properties: { limit: { type: 'integer' }, hours: { type: 'integer', description: 'כמה שעות אחורה (ברירת מחדל 24)' } } } },
  // FINANCE
  { name: 'list_finance', description: 'רשימת תנועות כספיות', parameters: { type: 'object', properties: { client_id: { type: 'string' }, type: { type: 'string', enum: ['income', 'expense'] }, limit: { type: 'integer' } } } },
  { name: 'create_finance_entry', description: 'יצירת רשומה כספית', parameters: { type: 'object', properties: { client_id: { type: 'string' }, amount: { type: 'number' }, type: { type: 'string', enum: ['income', 'expense'] }, description: { type: 'string' }, date: { type: 'string' } }, required: ['amount', 'type', 'description'] } },
  { name: 'get_finance_summary', description: 'סיכום כספי חודשי', parameters: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' } } } },
  // UPDATES
  { name: 'list_updates', description: 'רשימת עדכונים ללקוח או ליד', parameters: { type: 'object', properties: { entity_type: { type: 'string', enum: ['client', 'lead'] }, entity_id: { type: 'string' }, limit: { type: 'integer' } }, required: ['entity_type', 'entity_id'] } },
]

// ===========================
// TOOL EXECUTOR
// ===========================
async function executeTool(name: string, args: Record<string, any>, supabase: any, tenantId: string, userId: string): Promise<any> {
  switch (name) {
    case 'create_lead': {
      const { data: agency } = await supabase.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).single()
      const { data, error } = await supabase.from('leads').insert({
        ...args, status: 'new', agency_id: agency?.id, tenant_id: tenantId,
        company_name: args.company_name || args.contact_name,
      }).select('id, company_name, contact_name, status').single()
      if (error) throw error
      return { lead_id: data.id, company_name: data.company_name, status: data.status }
    }
    case 'list_leads': {
      let query = supabase.from('leads').select('id, company_name, contact_name, phone, status, source, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, leads: data }
    }
    case 'update_lead_status': {
      const { data, error } = await supabase.from('leads').update({ status: args.status }).eq('id', args.lead_id).eq('tenant_id', tenantId).select('id, company_name, status').single()
      if (error) throw error
      return data
    }
    case 'add_lead_update': {
      const { data, error } = await supabase.from('lead_updates').insert({ lead_id: args.lead_id, user_id: userId, tenant_id: tenantId, content: args.content }).select('id').single()
      if (error) throw error
      return { update_id: data.id }
    }
    case 'create_task': {
      let campaignerId = args.campaigner_id
      let agencyId = null
      if (!campaignerId) {
        const { data: profile } = await supabase.from('profiles').select('campaigner_id').eq('id', userId).single()
        campaignerId = profile?.campaigner_id
      }
      if (campaignerId) {
        const { data: campAgency } = await supabase.from('campaigner_agencies').select('agency_id').eq('campaigner_id', campaignerId).limit(1).single()
        agencyId = campAgency?.agency_id
      }
      if (!agencyId) {
        const { data: defaultAgency } = await supabase.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).single()
        agencyId = defaultAgency?.id
      }
      const { data, error } = await supabase.from('tasks').insert({
        title: args.title, agency_id: agencyId, campaigner_id: campaignerId,
        tenant_id: tenantId, priority: args.priority || 5, status: 'open', task_type: 'other',
        client_id: args.client_id || null, lead_id: args.lead_id || null,
        due_date: args.due_date, due_time: args.due_time, notes: args.notes,
        duration_minutes: args.duration_minutes || null,
      }).select('id, title, status').single()
      if (error) throw error
      return { task_id: data.id, title: data.title, status: data.status }
    }
    case 'search_tasks': {
      let query = supabase.from('tasks').select('id, title, status, priority, due_date, due_time, notes, duration_minutes, clients(name), leads(company_name), campaigners(full_name)')
        .eq('tenant_id', tenantId)
        .ilike('title', `%${args.search_term}%`)
        .order('created_at', { ascending: false })
        .limit(10)
      if (args.status) query = query.eq('status', args.status)
      if (args.client_id) query = query.eq('client_id', args.client_id)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, tasks: data.map((t: any) => ({ ...t, client_name: t.clients?.name, lead_name: t.leads?.company_name, campaigner_name: t.campaigners?.full_name })) }
    }
    case 'list_tasks': {
      let query = supabase.from('tasks').select('id, title, status, priority, due_date, due_time, duration_minutes, clients(name), leads(company_name), campaigners(full_name)').eq('tenant_id', tenantId).order('priority', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      if (args.client_id) query = query.eq('client_id', args.client_id)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, tasks: data.map((t: any) => ({ ...t, client_name: t.clients?.name, lead_name: t.leads?.company_name, campaigner_name: t.campaigners?.full_name })) }
    }
    case 'update_task_status': {
      const { data, error } = await supabase.from('tasks').update({ status: args.status }).eq('id', args.task_id).eq('tenant_id', tenantId).select('id, title, status').single()
      if (error) throw error
      return data
    }
    case 'list_clients': {
      let query = supabase.from('clients').select('id, name, contact_name, phone, status').eq('tenant_id', tenantId).order('name').limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, clients: data }
    }
    case 'get_client_info': {
      const { data, error } = await supabase.from('clients').select('*, agencies(name)').eq('id', args.client_id).eq('tenant_id', tenantId).single()
      if (error) throw error
      return data
    }
    case 'add_client_update': {
      const { data, error } = await supabase.from('client_updates').insert({ client_id: args.client_id, user_id: userId, tenant_id: tenantId, content: args.content }).select('id').single()
      if (error) throw error
      return { update_id: data.id }
    }
    case 'send_message': {
      let phone: string | null = null
      let contactName: string | null = null
      if (args.contact_type === 'lead') {
        const { data } = await supabase.from('leads').select('phone, company_name, contact_name').eq('id', args.contact_id).single()
        phone = data?.phone; contactName = data?.contact_name || data?.company_name
      } else {
        const { data } = await supabase.from('clients').select('phone, name, contact_name').eq('id', args.contact_id).single()
        phone = data?.phone; contactName = data?.contact_name || data?.name
      }
      if (!phone) return { success: false, error: 'לא נמצא מספר טלפון' }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-green-api-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ phone, message: args.message_text, tenantId, [`${args.contact_type}_id`]: args.contact_id }),
      })
      if (!res.ok) throw new Error(await res.text())
      return { sent_to: contactName, phone }
    }
    case 'search_entities': {
      const tableMap: Record<string, string> = { agency: 'agencies', client: 'clients', campaigner: 'campaigners', lead: 'leads' }
      const nameMap: Record<string, string> = { agency: 'name', client: 'name', campaigner: 'full_name', lead: 'company_name' }
      const table = tableMap[args.entity_type]
      const nameField = nameMap[args.entity_type]
      const { data, error } = await supabase.from(table).select('id, ' + nameField).eq('tenant_id', tenantId).ilike(nameField, `%${args.search_term}%`).limit(10)
      if (error) throw error
      return { count: data.length, results: data }
    }
    case 'delegate_to_manus': {
      // Call the existing manus-api edge function
      const manusBody: any = {
        action: 'create_task',
        tenantId,
        prompt: args.prompt,
      }
      if (args.context_data) {
        manusBody.prompt = `${args.prompt}\n\nנתוני הקשר:\n${args.context_data}`
      }

      const manusRes = await fetch(`${SUPABASE_URL}/functions/v1/manus-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(manusBody),
      })

      if (!manusRes.ok) {
        const errText = await manusRes.text()
        throw new Error(`Manus API error: ${errText}`)
      }

      const manusData = await manusRes.json()
      return {
        success: true,
        task_id: manusData.task_id,
        task_url: manusData.task_url,
        share_url: manusData.share_url,
        message: 'המשימה נשלחה ל-Manus AI ורצה ברקע. תוכל לעקוב אחריה בהגדרות Manus.',
      }
    }
    case 'get_facebook_campaign_data': {
      const daysBack = args.days || 30
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - daysBack)
      const sinceDateStr = sinceDate.toISOString().split('T')[0]

      let query = supabase
        .from('facebook_insights')
        .select('campaign_name, date, impressions, clicks, spend, leads_count, reach, cpc, cpm, ctr, cost_per_lead, campaign_status')
        .eq('tenant_id', tenantId)
        .gte('date', sinceDateStr)
        .order('date', { ascending: false })
        .limit(500)

      if (args.client_id) {
        query = query.eq('client_id', args.client_id)
      }

      const { data, error } = await query
      if (error) throw error
      return { count: data?.length || 0, campaigns: data || [], period: `${daysBack} days` }
    }
    case 'create_social_post': {
      const { data, error } = await supabase.from('social_media_posts').insert({
        tenant_id: tenantId,
        title: args.title,
        content: args.content,
        post_type: args.post_type || 'image',
        media_urls: args.media_urls || [],
        status: 'draft',
        created_by: userId !== 'system' ? userId : null,
      }).select('id, title, content, post_type, media_urls, status').single()
      if (error) throw error
      return { success: true, post_id: data.id, title: data.title, content: data.content, media_urls: data.media_urls, status: 'draft', message: 'הפוסט נוצר בהצלחה כטיוטה במודול סושיאל מדיה' }
    }
    case 'generate_ad_image': {
      const imagePrompt = args.prompt
      const model = 'google/gemini-3.1-flash-image-preview'
      
      const imageRes = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'user', content: `Generate an image: ${imagePrompt}. Make it professional, high quality, suitable for a social media advertisement.` }
          ],
          modalities: ['image', 'text'],
        }),
      })
      
      if (!imageRes.ok) {
        const errText = await imageRes.text()
        throw new Error(`Image generation error: ${errText}`)
      }
      
      const imageData = await imageRes.json()
      const content = imageData.choices?.[0]?.message?.content || ''
      
      // Check for images array in response (Lovable AI Gateway format)
      const images = imageData.choices?.[0]?.message?.images || []
      let imageUrl = ''
      
      if (images.length > 0 && images[0]?.image_url?.url) {
        const dataUrl = images[0].image_url.url
        // Extract base64 data from data URL
        const base64Match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/)
        if (base64Match) {
          const mimeType = `image/${base64Match[1]}`
          const base64 = base64Match[2]
          const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1]
          const fileName = `agent-generated/${tenantId}/${crypto.randomUUID()}.${ext}`
          
          const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
          
          // Ensure bucket exists
          await supabase.storage.createBucket('social-media', { public: true }).catch(() => {})
          
          const { error: uploadError } = await supabase.storage
            .from('social-media')
            .upload(fileName, binaryData, { contentType: mimeType, upsert: true })
          
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
          
          const { data: urlData } = supabase.storage.from('social-media').getPublicUrl(fileName)
          imageUrl = urlData.publicUrl
        }
      }
      
      // Fallback: check inline_data in parts
      if (!imageUrl) {
        const parts = imageData.choices?.[0]?.message?.parts || []
        for (const part of parts) {
          if (part.inline_data) {
            const base64 = part.inline_data.data
            const mimeType = part.inline_data.mime_type || 'image/png'
            const ext = mimeType.includes('jpeg') ? 'jpg' : 'png'
            const fileName = `agent-generated/${tenantId}/${crypto.randomUUID()}.${ext}`
            const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            await supabase.storage.createBucket('social-media', { public: true }).catch(() => {})
            const { error: uploadError } = await supabase.storage
              .from('social-media')
              .upload(fileName, binaryData, { contentType: mimeType, upsert: true })
            if (uploadError) throw uploadError
            const { data: urlData } = supabase.storage.from('social-media').getPublicUrl(fileName)
            imageUrl = urlData.publicUrl
            break
          }
        }
      }
      
      if (!imageUrl) {
        return { success: false, error: 'לא הצלחתי ליצור תמונה. נסה שוב עם תיאור אחר.', raw_content: content }
      }
      
      return { success: true, image_url: imageUrl, message: 'התמונה נוצרה בהצלחה. השתמש בה ביצירת הפוסט.' }
    }
    // CLIENTS - full CRUD
    case 'create_client': {
      const { data: defaultAgency } = await supabase.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).single()
      const { data, error } = await supabase.from('clients').insert({
        name: args.name, contact_name: args.contact_name || null, phone: args.phone || null,
        email: args.email || null, notes: args.notes || null, tenant_id: tenantId,
        agency_id: args.agency_id || defaultAgency?.id, status: 'active',
      }).select('id, name, status').single()
      if (error) throw error
      return { client_id: data.id, name: data.name, status: data.status }
    }
    case 'update_client': {
      const updates: Record<string, any> = {}
      if (args.name) updates.name = args.name
      if (args.contact_name !== undefined) updates.contact_name = args.contact_name
      if (args.phone !== undefined) updates.phone = args.phone
      if (args.email !== undefined) updates.email = args.email
      if (args.status) updates.status = args.status
      if (args.notes !== undefined) updates.notes = args.notes
      const { data, error } = await supabase.from('clients').update(updates).eq('id', args.client_id).eq('tenant_id', tenantId).select('id, name, status').single()
      if (error) throw error
      return data
    }
    case 'update_client_status': {
      const { data, error } = await supabase.from('clients').update({ status: args.status }).eq('id', args.client_id).eq('tenant_id', tenantId).select('id, name, status').single()
      if (error) throw error
      return data
    }
    // LEADS - full CRUD
    case 'update_lead': {
      const updates: Record<string, any> = {}
      if (args.company_name) updates.company_name = args.company_name
      if (args.contact_name !== undefined) updates.contact_name = args.contact_name
      if (args.phone !== undefined) updates.phone = args.phone
      if (args.email !== undefined) updates.email = args.email
      if (args.source !== undefined) updates.source = args.source
      if (args.notes !== undefined) updates.notes = args.notes
      if (args.follow_up_date !== undefined) updates.follow_up_date = args.follow_up_date
      const { data, error } = await supabase.from('leads').update(updates).eq('id', args.lead_id).eq('tenant_id', tenantId).select('id, company_name, status').single()
      if (error) throw error
      return data
    }
    case 'delete_lead': {
      const { error } = await supabase.from('leads').delete().eq('id', args.lead_id).eq('tenant_id', tenantId)
      if (error) throw error
      return { success: true, deleted_id: args.lead_id }
    }
    // TASKS - full CRUD
    case 'update_task': {
      const updates: Record<string, any> = {}
      if (args.title) updates.title = args.title
      if (args.due_date !== undefined) updates.due_date = args.due_date
      if (args.due_time !== undefined) updates.due_time = args.due_time
      if (args.priority !== undefined) updates.priority = args.priority
      if (args.notes !== undefined) updates.notes = args.notes
      if (args.client_id !== undefined) updates.client_id = args.client_id
      if (args.lead_id !== undefined) updates.lead_id = args.lead_id
      if (args.campaigner_id !== undefined) updates.campaigner_id = args.campaigner_id
      if (args.duration_minutes !== undefined) updates.duration_minutes = args.duration_minutes
      if (args.status) updates.status = args.status
      const { data, error } = await supabase.from('tasks').update(updates).eq('id', args.task_id).eq('tenant_id', tenantId).select('id, title, status').single()
      if (error) throw error
      return data
    }
    case 'delete_task': {
      const { error } = await supabase.from('tasks').delete().eq('id', args.task_id).eq('tenant_id', tenantId)
      if (error) throw error
      return { success: true, deleted_id: args.task_id }
    }
    case 'add_task_update': {
      const { data, error } = await supabase.from('task_updates').insert({ task_id: args.task_id, user_id: userId, tenant_id: tenantId, content: args.content }).select('id').single()
      if (error) throw error
      return { update_id: data.id }
    }
    case 'manage_task_collaborators': {
      if (args.action === 'add') {
        const { data, error } = await supabase.from('task_collaborators').insert({
          task_id: args.task_id, campaigner_id: args.campaigner_id, tenant_id: tenantId,
        }).select('id').single()
        if (error) throw error
        return { success: true, action: 'added', collaborator_id: data.id }
      } else {
        const { error } = await supabase.from('task_collaborators').delete()
          .eq('task_id', args.task_id).eq('campaigner_id', args.campaigner_id).eq('tenant_id', tenantId)
        if (error) throw error
        return { success: true, action: 'removed' }
      }
    }
    // CLIENT ONBOARDING
    case 'create_onboarding': {
      const { data, error } = await supabase.from('client_onboarding').insert({
        title: args.title, client_id: args.client_id, campaigner_id: args.campaigner_id || null,
        notes: args.notes || null, tenant_id: tenantId, status: 'pending',
      }).select('id, title, status').single()
      if (error) throw error
      return { onboarding_id: data.id, title: data.title, status: data.status }
    }
    case 'list_onboarding': {
      let query = supabase.from('client_onboarding').select('id, title, status, clients(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, onboarding: data.map((o: any) => ({ ...o, client_name: o.clients?.name })) }
    }
    case 'update_onboarding_status': {
      const { data, error } = await supabase.from('client_onboarding').update({ status: args.status }).eq('id', args.onboarding_id).eq('tenant_id', tenantId).select('id, title, status').single()
      if (error) throw error
      return data
    }
    // CAMPAIGNERS
    case 'list_campaigners': {
      const { data, error } = await supabase.from('campaigners').select('id, full_name, phone, email, role').eq('tenant_id', tenantId).order('full_name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, campaigners: data }
    }
    case 'create_campaigner': {
      const { data, error } = await supabase.from('campaigners').insert({
        full_name: args.full_name, phone: args.phone || null, email: args.email || null,
        role: args.role || null, tenant_id: tenantId,
      }).select('id, full_name').single()
      if (error) throw error
      return { campaigner_id: data.id, full_name: data.full_name }
    }
    // SALES PEOPLE
    case 'list_sales_people': {
      const { data, error } = await supabase.from('sales_people').select('id, full_name, phone, email').eq('tenant_id', tenantId).order('full_name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, sales_people: data }
    }
    case 'create_sales_person': {
      const { data, error } = await supabase.from('sales_people').insert({
        full_name: args.full_name, phone: args.phone || null, email: args.email || null, tenant_id: tenantId,
      }).select('id, full_name').single()
      if (error) throw error
      return { sales_person_id: data.id, full_name: data.full_name }
    }
    // AGENCIES
    case 'list_agencies': {
      const { data, error } = await supabase.from('agencies').select('id, name, contact_name, phone, email').eq('tenant_id', tenantId).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, agencies: data }
    }
    case 'create_agency': {
      const { data, error } = await supabase.from('agencies').insert({
        name: args.name, contact_name: args.contact_name || null, phone: args.phone || null,
        email: args.email || null, tenant_id: tenantId,
      }).select('id, name').single()
      if (error) throw error
      return { agency_id: data.id, name: data.name }
    }
    // SUPPLIERS
    case 'list_suppliers': {
      const { data, error } = await supabase.from('suppliers').select('id, name, type, phone, email').eq('tenant_id', tenantId).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, suppliers: data }
    }
    case 'create_supplier': {
      const { data, error } = await supabase.from('suppliers').insert({
        name: args.name, type: args.type || 'other', phone: args.phone || null,
        email: args.email || null, tenant_id: tenantId,
      }).select('id, name').single()
      if (error) throw error
      return { supplier_id: data.id, name: data.name }
    }
    // PRODUCTS
    case 'list_products': {
      const { data, error } = await supabase.from('products').select('id, name, description, price, active').eq('tenant_id', tenantId).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, products: data }
    }
    case 'create_product': {
      const { data, error } = await supabase.from('products').insert({
        name: args.name, description: args.description || null, price: args.price, active: true, tenant_id: tenantId,
      }).select('id, name, price').single()
      if (error) throw error
      return { product_id: data.id, name: data.name, price: data.price }
    }
    // AUTOMATIONS
    case 'list_automations': {
      const { data, error } = await supabase.from('automations').select('id, name, active, trigger_type').eq('tenant_id', tenantId).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, automations: data }
    }
    case 'toggle_automation': {
      const { data, error } = await supabase.from('automations').update({ active: args.active }).eq('id', args.automation_id).eq('tenant_id', tenantId).select('id, name, active').single()
      if (error) throw error
      return { automation_id: data.id, name: data.name, active: data.active }
    }
    // DASHBOARD STATS
    case 'get_dashboard_stats': {
      const [leadsRes, clientsRes, tasksRes, onboardingRes] = await Promise.all([
        supabase.from('leads').select('status', { count: 'exact', head: false }).eq('tenant_id', tenantId),
        supabase.from('clients').select('status', { count: 'exact', head: false }).eq('tenant_id', tenantId),
        supabase.from('tasks').select('status', { count: 'exact', head: false }).eq('tenant_id', tenantId).eq('status', 'open'),
        supabase.from('client_onboarding').select('status', { count: 'exact', head: false }).eq('tenant_id', tenantId).eq('status', 'in_progress'),
      ])
      const leadsByStatus = (leadsRes.data || []).reduce((acc: any, l: any) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {})
      const clientsByStatus = (clientsRes.data || []).reduce((acc: any, c: any) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc }, {})
      return {
        leads: { total: leadsRes.data?.length || 0, by_status: leadsByStatus },
        clients: { total: clientsRes.data?.length || 0, by_status: clientsByStatus },
        open_tasks: tasksRes.data?.length || 0,
        active_onboarding: onboardingRes.data?.length || 0,
      }
    }
    // MEMORY
    case 'save_memory': {
      const { data, error } = await supabase.from('ai_memory').upsert({
        tenant_id: tenantId, user_id: userId || 'system', key: args.key, content: args.content, category: args.category || 'general',
      }, { onConflict: 'tenant_id,user_id,key' }).select('key, category').single()
      if (error) throw error
      return { saved: true, key: data.key, category: data.category }
    }
    case 'recall_memory': {
      let query = supabase.from('ai_memory').select('key, content, category, updated_at').eq('tenant_id', tenantId)
      if (args.category) query = query.eq('category', args.category)
      if (args.search) query = query.ilike('content', `%${args.search}%`)
      const { data, error } = await query.order('updated_at', { ascending: false }).limit(20)
      if (error) throw error
      return { count: data.length, memories: data }
    }
    case 'delete_memory': {
      const { error } = await supabase.from('ai_memory').delete().eq('tenant_id', tenantId).eq('key', args.key)
      if (error) throw error
      return { deleted: true, key: args.key }
    }
    // CHAT HISTORY
    case 'get_chat_history': {
      const filterCol = args.contact_type === 'client' ? 'client_id' : 'lead_id'
      const { data, error } = await supabase.from('chat_messages').select('id, message_text, direction, sender_name, created_at')
        .eq('tenant_id', tenantId).eq(filterCol, args.contact_id)
        .order('created_at', { ascending: false }).limit(args.limit || 20)
      if (error) throw error
      return { count: data.length, messages: data.reverse() }
    }
    case 'get_recent_inbound_messages': {
      const hoursAgo = args.hours || 24
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase.from('chat_messages')
        .select('id, message_text, sender_name, sender_phone, created_at, client_id, lead_id, clients(name), leads(company_name)')
        .eq('tenant_id', tenantId).eq('direction', 'inbound').gte('created_at', since)
        .order('created_at', { ascending: false }).limit(args.limit || 30)
      if (error) throw error
      return { count: data.length, messages: data.map((m: any) => ({ ...m, contact_name: m.clients?.name || m.leads?.company_name || m.sender_name || m.sender_phone })) }
    }
    // FINANCE
    case 'list_finance': {
      let query = supabase.from('finance').select('id, amount, type, description, date, client_id, clients(name)').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(args.limit || 20)
      if (args.client_id) query = query.eq('client_id', args.client_id)
      if (args.type) query = query.eq('type', args.type)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, entries: data.map((f: any) => ({ ...f, client_name: f.clients?.name })) }
    }
    case 'create_finance_entry': {
      const { data, error } = await supabase.from('finance').insert({
        amount: args.amount, type: args.type, description: args.description,
        date: args.date || new Date().toISOString().split('T')[0],
        client_id: args.client_id || null, tenant_id: tenantId,
      }).select('id, amount, type, description').single()
      if (error) throw error
      return { finance_id: data.id, amount: data.amount, type: data.type }
    }
    case 'get_finance_summary': {
      const month = args.month || new Date().toISOString().slice(0, 7)
      const startDate = `${month}-01`
      const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]
      const { data, error } = await supabase.from('finance').select('amount, type').eq('tenant_id', tenantId).gte('date', startDate).lte('date', endDate)
      if (error) throw error
      const income = (data || []).filter((f: any) => f.type === 'income').reduce((s: number, f: any) => s + (f.amount || 0), 0)
      const expense = (data || []).filter((f: any) => f.type === 'expense').reduce((s: number, f: any) => s + (f.amount || 0), 0)
      return { month, income, expense, profit: income - expense, entries_count: data.length }
    }
    // UPDATES
    case 'list_updates': {
      const table = args.entity_type === 'client' ? 'client_updates' : 'lead_updates'
      const idCol = args.entity_type === 'client' ? 'client_id' : 'lead_id'
      const { data, error } = await supabase.from(table).select('id, content, created_at').eq(idCol, args.entity_id).order('created_at', { ascending: false }).limit(args.limit || 10)
      if (error) throw error
      return { count: data.length, updates: data }
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// ===========================
// MAIN HANDLER
// ===========================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { agent_id, command_text, temperature, automation_id, user_name, lead_data, tenant_id, user_id, task_skills, task_mode, conversation_history } = await req.json()

    if (!agent_id || !command_text) throw new Error('Missing agent_id or command_text')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Fetch agent
    const { data: agent, error: agentError } = await supabase.from('ai_agents').select('*').eq('id', agent_id).single()
    if (agentError || !agent) throw new Error(`Agent not found: ${agent_id}`)


    // 2. Resolve tenant
    let resolvedTenantId = tenant_id || agent.tenant_id
    let resolvedUserId = user_id || 'system'

    // 3. Build system prompt with full tenant context
    // Fetch tenant context, memory for Carmen and all agents
    const [tenantRes, agenciesRes, statsRes, memoryRes] = await Promise.all([
      supabase.from('tenants').select('name, type').eq('id', resolvedTenantId).single(),
      supabase.from('agencies').select('id, name').eq('tenant_id', resolvedTenantId).order('name').limit(20),
      Promise.all([
        supabase.from('leads').select('status', { count: 'exact', head: false }).eq('tenant_id', resolvedTenantId),
        supabase.from('clients').select('id', { count: 'exact', head: false }).eq('tenant_id', resolvedTenantId),
        supabase.from('tasks').select('id', { count: 'exact', head: false }).eq('tenant_id', resolvedTenantId).eq('status', 'open'),
      ]),
      supabase.from('ai_memory').select('key, content, category').eq('tenant_id', resolvedTenantId).order('updated_at', { ascending: false }).limit(30),
    ])
    const tenantName = tenantRes.data?.name || 'הארגון'
    const agencyList = (agenciesRes.data || []).map((a: any) => `${a.name} (${a.id})`).join(', ')
    const [leadsData, clientsData, tasksData] = statsRes
    const leadsByStatus = (leadsData.data || []).reduce((acc: any, l: any) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {})
    const tenantContext = [
      `ארגון: ${tenantName} (tenant_id: ${resolvedTenantId})`,
      agencyList ? `סוכנויות: ${agencyList}` : '',
      `לידים: ${leadsData.data?.length || 0} (${Object.entries(leadsByStatus).map(([k,v]) => `${k}: ${v}`).join(', ')})`,
      `לקוחות פעילים: ${clientsData.data?.length || 0}`,
      `משימות פתוחות: ${tasksData.data?.length || 0}`,
    ].filter(Boolean).join('\n')
    let systemPrompt = agent.system_prompt || ''
    const isCarmen = agent.name?.toLowerCase().includes('carmen') || agent.name?.includes('כרמן')
    if (!systemPrompt) {
      const parts = isCarmen
        ? [
            `אתה כרמן, מנהלת AI ראשית של ${tenantName}. את עוזרת אישית חכמה, יעילה ומקצועית.`,
            'יש לך גישה מלאה לכל מודולי המערכת: לידים, לקוחות, משימות, קמפיינרים, אנשי מכירות, סוכנויות, ספקים, מוצרים, אוטומציות, ועוד.',
            'את יכולה לבצע כל פעולה שמשתמש יכול לבצע ידנית במערכת.',
            'חשוב מאוד: לפני יצירת משימה חדשה, תמיד חפשי קודם עם search_tasks כדי לוודא שהמשימה לא קיימת כבר. אם היא קיימת - עדכני אותה במקום ליצור חדשה.',
            'ענה בעברית. היי תמציתית, מקצועית, ויעילה. כשמבצעים פעולה — אשרי את הביצוע עם פרטים.',
          ]
        : [
            `אתה ${agent.name}.`,
            agent.personality ? `אופי: ${agent.personality}.` : '',
            agent.soul ? `נשמה: ${agent.soul}.` : '',
            agent.talent ? `טלנט: ${agent.talent}.` : '',
            'ענה בעברית. היה תמציתי ומקצועי.',
          ]
      parts.push('כשמבקשים ממך ליצור מודעה או פוסט לסושיאל: 1) קודם צור תמונה עם generate_ad_image עם תיאור מפורט באנגלית 2) אז צור פוסט עם create_social_post והכנס את ה-image_url שקיבלת ל-media_urls. תמיד צור גם ויזואל וגם טקסט.')
      systemPrompt = parts.filter(Boolean).join(' ')
    }
    // Inject task-level mode override (from AgentTasksPage)
    if (task_mode) {
      const TASK_MODE_PROMPTS: Record<string, string> = {
        sales: 'את מומחית מכירות. מזהה הזדמנויות בלידים, מעקבת אחרי פיפלאיים, מסייעת בסגירת עסקאות ויוצרת הצעות מותאמות אישית.',
        support: 'את מומחית שירות לקוחות. אמפתית, סבלנית ופותרת בעיות.',
        copywriting: 'את מומחית קופיראיטינג. כותבת בצורה משכנעת, יצירתית ומותאמת לקהל יעד.',
        analyst: 'את מנתחת נתונים. שולפת נתונים מהמערכת, מזהה דפוסים ומסיקה תובנות עסקיות ברורות.',
        scheduler: 'את מומחית ניהול לוח זמנים. מתאמת פגישות, יוצרת תזכורות ומנהלת משימות זמניות בצורה יעילה.',
        onboarding: 'את מומחית קליטת לקוחות. מדריכה לקוחות חדשים בצורה חמה ומקצועית.',
      }
      if (TASK_MODE_PROMPTS[task_mode]) {
        systemPrompt += `\n\n=== מוד משימה ===\n${TASK_MODE_PROMPTS[task_mode]}`
      }
    }
    // Inject task-level skills override (from AgentTasksPage)
    if (task_skills && Array.isArray(task_skills) && task_skills.length > 0) {
      const TASK_SKILLS_PROMPTS: Record<string, string> = {
        'lead-qualifier': 'כשמתבקשת להעריך ליד, תשאלי על תקציב, גודל עסק, צורך ולוח זמנים. דרגי 0-10 וספקי הסבר.',
        'follow-up': 'כשמתבקשת לעקוב אחרי ליד או לקוח, צרי משימות מעקב בזמנים אסטרטגיים (3 ימים, שבוע, חודש).',
        'proposal-writer': 'כשמתבקשת לכתוב הצעה, שאלי על צרכי הלקוח, תקציב ודדליין. צרי הצעה מותאמת אישית עם הדגשת הערך ללקוח.',
        'meeting-prep': 'לפני פגישה, שלוף את היסטוריית הלקוח/ליד, הצע נקודות דיון ושאלות רלוונטיות.',
        'objection-handler': 'כשלקוח מתנגד, הביני את החשש האמיתי מאחוריו ועני בצורה אמפתית ומשכנעת.',
        'task-manager': 'כשמתבקשת לנהל משימות, תמיד חפשי קודם אם המשימה קיימת. צרי משימות עם תאריך יעד ושייוך לאדם הנכון.',
        'whatsapp-responder': 'כשעונה להודעות WhatsApp, כתוב בסגנון קצר, ישיר וחברותי.',
        'data-enricher': 'כשנתקלת על ליד/לקוח עם פרטים חסרים, שאלי שאלות משלימות באופן טבעי ועדכני את הפרופיל.',
        'report-generator': 'כשמתבקשת דוח, שלוף נתונים מהמערכת, זהה דפוסים והצג תובנות ברורות עם מסקנות עסקיות.',
        'email-drafter': 'כשמתבקשת לכתוב אימייל, שאלי על הנמען, הטון והמטרה. צרי אימייל מקצועי עם שורת נושא משכנעת.',
        'social-planner': 'כשמתבקשת תוכן לסושיאל, שאלי על הפלטפורמה, קהל היעד והמסר. צרי תוכן משכנע עם סיפור וקריאה לפעולה.',
        'price-calculator': 'כשמתבקשת מחיר, שאלי על השירות/מוצר, כמות ופרטי לקוח. הצג מחיר סופי עם פירוט ואפשרות הנחה.',
        'competitor-analyzer': 'כשמתבקשת ניתוח מתחרים, שלוף נתונים מהמערכת, זהה דפוסים והצג השוואה מול מתחרים.',
        'sentiment-analyzer': 'בכל הודעה שמקבלת, נתחי את הטון הרגשי (חיובי/שלילי/נייטרלי) והתאם את התגובה בהתאם.',
        'faq-responder': 'כשעונה לשאלות, שלוף קודם את הנתונים הקיימים במערכת וענה לפי המידע הקיים.',
        'upsell-advisor': 'כשמתבקשת לנתח לקוח, זהה הזדמנויות לאפסליינג וקרוס-סלינג לפי היסטוריית הקניות.',
        'churn-predictor': 'נתח את דפוסי הלקוחות וזהה סימני אזהרה לנטישה פוטנציאלית. הצע פעולות שימור מתאימות.',
        'campaign-optimizer': 'נתח נתוני קמפיינים מהמערכת, זהה מה עובד ומה לא, והצע שיפורים קונקרטיים.',
        'smart-summarizer': 'כשמתבקשת סיכום, שלוף את כל המידע הרלוונטי והצג את העיקריות בצורה קצרה וברורה.',
      }
      const taskSkillPrompts = (task_skills as string[]).map((s: string) => TASK_SKILLS_PROMPTS[s]).filter(Boolean)
      if (taskSkillPrompts.length > 0) {
        systemPrompt += `\n\n=== סקילז למשימה זו ===\n${taskSkillPrompts.join('\n')}`
      }
    }
    // Inject active modes
    const activeModes: string[] = (agent as any).active_modes || []
    if (activeModes.length > 0) {
      const MODES_PROMPTS: Record<string, string> = {
        sales: 'את מומחית מכירות. מזהה הזדמנויות בלידים, מעקבת אחרי פיפלאיים, מסייעת בסגירת עסקאות ויוצרת הצעות מותאמות אישית. תמיד תשאלי שאלות בירור לפני שתיצרי פעולות.',
        support: 'את מומחית שירות לקוחות. אמפתית, סבלנית ופותרת בעיות. תמיד תוודאי שהלקוח הבין את הפתרון לפני שתסגרי את השיחה. תיעדי ביצירת משימות מעקב לאחר כל פנייה.',
        copywriting: 'את מומחית קופיראיטינג. כותבת בצורה משכנעת, יצירתית ומותאמת לקהל יעד. תמיד תשאלי על הטון, הפלטפורמה וקהל היעד לפני שתתחילי לכתוב.',
        analyst: 'את מנתחת נתונים. שולפת נתונים מהמערכת, מזהה דפוסים ומסיקה תובנות עסקיות ברורות. תמיד תציגי נתונים בצורה מסודרת וברורה.',
        scheduler: 'את מומחית ניהול לוח זמנים. מתאמת פגישות, יוצרת תזכורות ומנהלת משימות זמניות בצורה יעילה. תמיד תאשרי פרטי תאריך ושעה לפני שתיצרי אירוע.',
        onboarding: 'את מומחית קליטת לקוחות. מדריכה לקוחות חדשים בצורה חמה ומקצועית, מודיעה אותם על המערכת ומסייעת בהגדרת הפרופיל שלהם.',
      }
      const modePrompts = activeModes.map((m: string) => MODES_PROMPTS[m]).filter(Boolean)
      if (modePrompts.length > 0) {
        systemPrompt += `\n\n=== מצבי פעולה פעילים ===\n${modePrompts.join('\n')}`
      }
    }
    // Inject active skills
    const activeSkills: string[] = (agent as any).active_skills || []
    if (activeSkills.length > 0) {
      const SKILLS_PROMPTS: Record<string, string> = {
        'lead-qualifier': 'כשמתבקשת להעריך ליד, תשאלי על תקציב, גודל עסק, צורך ולוח זמנים. דרגי 0-10 וספקי הסבר.',
        'follow-up': 'כשמתבקשת לעקוב אחרי ליד או לקוח, צרי משימות מעקב בזמנים אסטרטגיים (3 ימים, שבוע, חודש).',
        'proposal-writer': 'כשמתבקשת לכתוב הצעה, שאלי על צרכי הלקוח, תקציב ודדליין. צרי הצעה מותאמת אישית עם הדגשת הערך ללקוח.',
        'meeting-prep': 'לפני פגישה, שלוף את היסטוריית הלקוח/ליד, הצע נקודות דיון ושאלות רלוונטיות.',
        'objection-handler': 'כשלקוח מתנגד, הביני את החשש האמיתי מאחוריו ועני בצורה אמפתית ומשכנעת. אל תוויתרי אותומטית במחיר.',
        'task-manager': 'כשמתבקשת לנהל משימות, תמיד חפשי קודם אם המשימה קיימת. צרי משימות עם תאריך יעד ושייוך לאדם הנכון.',
        'whatsapp-responder': 'כשעונה להודעות WhatsApp, כתוב בסגנון קצר, ישיר וחברותי. הימנע מטקסט ארוך מדי.',
        'data-enricher': 'כשנתקלת על ליד/לקוח עם פרטים חסרים, שאלי שאלות משלימות באופן טבעי ועדכני את הפרופיל.',
        'report-generator': 'כשמתבקשת דוח, שלוף נתונים מהמערכת, זהה דפוסים והצג תובנות ברורות עם מסקנות עסקיות.',
        'email-drafter': 'כשמתבקשת לכתוב אימייל, שאלי על הנמען, הטון והמטרה. צרי אימייל מקצועי עם שורת נושא משכנעת.',
        'social-planner': 'כשמתבקשת תוכן לסושיאל, שאלי על הפלטפורמה, קהל היעד והמסר. צרי תוכן משכנע עם סיפור וקריאה לפעולה.',
        'price-calculator': 'כשמתבקשת מחיר, שאלי על השירות/מוצר, כמות ופרטי לקוח. הצג מחיר סופי עם פירוט ואפשרות הנחה.',
        'competitor-analyzer': 'כשמתבקשת ניתוח מתחרים, שלוף נתונים מהמערכת, זהה דפוסים והצג השוואה מול מתחרים.',
        'sentiment-analyzer': 'בכל הודעה שמקבלת, נתחי את הטון הרגשי (חיובי/שלילי/נייטרלי) והתאם את התגובה בהתאם.',
        'faq-responder': 'כשעונה לשאלות, שלוף קודם את הנתונים הקיימים במערכת וענה לפי המידע הקיים.',
        'upsell-advisor': 'כשמתבקשת לנתח לקוח, זהה הזדמנויות לאפסליינג וקרוס-סלינג לפי היסטוריית הקניות.',
        'churn-predictor': 'נתח את דפוסי הלקוחות וזהה סימני אזהרה לנטישה פוטנציאלית. הצע פעולות שימור מתאימות.',
        'campaign-optimizer': 'נתח נתוני קמפיינים מהמערכת, זהה מה עובד ומה לא, והצע שיפורים קונקרטיים.',
        'smart-summarizer': 'כשמתבקשת סיכום, שלוף את כל המידע הרלוונטי והצג את העיקריות בצורה קצרה וברורה.',
      }
      const skillPrompts = activeSkills.map((s: string) => SKILLS_PROMPTS[s]).filter(Boolean)
      if (skillPrompts.length > 0) {
        systemPrompt += `\n\n=== סקילז פעילים ===\n${skillPrompts.join('\n')}`
      }
    }
    // Inject writing style
    const writingStyle = (agent as any).writing_style
    if (writingStyle && writingStyle !== 'professional') {
      const styleMap: Record<string, string> = {
        friendly: 'כתוב בסגנון חברותי וחמול.',
        formal: 'כתוב בסגנון פורמלי ועסקי.',
        casual: 'כתוב בסגנון קזואלי ונגיש.',
        empathetic: 'כתוב בסגנון אמפתי ומבין.',
      }
      if (styleMap[writingStyle]) systemPrompt += `\n${styleMap[writingStyle]}`
    }
    // Inject response length
    const responseLength = (agent as any).response_length
    if (responseLength) {
      const lengthMap: Record<string, string> = {
        short: 'הגבל תשובות ל-2-3 משפטים מקסימום.',
        detailed: 'תן תשובות מפורטות ומקיפות.',
      }
      if (lengthMap[responseLength]) systemPrompt += `\n${lengthMap[responseLength]}`
    }
    // Always inject current date and tenant context
    const now = new Date()
    const currentDate = now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jerusalem' })
    const currentTime = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const todayISO = now.toISOString().split('T')[0]
    systemPrompt += `\n\n=== תאריך ושעה נוכחיים ===\nהיום: ${currentDate}, שעה: ${currentTime}\nתאריך ISO של היום: ${todayISO}\nתאריך ISO של מחר: ${tomorrowDate}\nחשוב: כשמבקשים "למחר" השתמש ב-${tomorrowDate}, כש"היום" השתמש ב-${todayISO}.`
    systemPrompt += `\n\n=== הקשר ארגוני ===\n${tenantContext}`

    // Inject memory context
    const memoryItems = memoryRes.data || []
    if (memoryItems.length > 0) {
      const memoryContext = memoryItems.map((m: any) => `[${m.category}] ${m.key}: ${m.content}`).join('\n')
      systemPrompt += `\n\n🧠 === זיכרון מתמשך ===\n${memoryContext}`
    }

    // Inject lead context
    if (lead_data) {
      const leadParts = Object.entries(lead_data)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
      if (leadParts.length) systemPrompt += `\n\nפרטי ליד:\n${leadParts.join('\n')}`
    }

    // WhatsApp context
    if (isCarmen) {
      systemPrompt += `\n\n💬 **כשעונה להודעות WhatsApp:** כתוב בסגנון קצר, ישיר וחברותי. הימנע מטקסט ארוך מדי. אל תשתמש ב-markdown בהודעות וואטסאפ.`
      systemPrompt += `\n🧠 **זיכרון:** כשהמשתמש מספר לך העדפות, שמות פרויקטים, או מידע חשוב — שמור אותם אוטומטית באמצעות save_memory.`
    }

    // 4. Filter tools
    const allowedTools = (agent.allowed_tools || []) as string[]
    const filteredTools = allowedTools.length > 0
      ? ALL_TOOLS.filter(t => allowedTools.includes(t.name))
      : ALL_TOOLS

    const toolsForAPI = filteredTools.map(t => ({ type: 'function', function: t }))

    // 5. Run agent with tool loop
    const model = resolveModel(agent.engine || 'gemini-3-flash')
    const maxRounds = agent.max_tool_rounds || 5
    const safeTemp = typeof temperature === 'number' ? Math.min(2, Math.max(0, temperature)) : undefined

    // Build messages with conversation history
    let messages: any[] = [{ role: 'system', content: systemPrompt }]
    
    // Add conversation history from Carmen WhatsApp sessions
    const history = Array.isArray(conversation_history) ? conversation_history : []
    for (const h of history) {
      if (h.role === 'user' || h.role === 'assistant') {
        messages.push({ role: h.role, content: h.content })
      }
    }
    
    // Add current message
    messages.push({ role: 'user', content: command_text })

    let finalOutput = ''
    const toolLog: any[] = []
    const startTime = Date.now()

    for (let round = 0; round < maxRounds; round++) {
      const payload: any = { model, messages }
      if (safeTemp !== undefined) payload.temperature = safeTemp
      if (toolsForAPI.length > 0) payload.tools = toolsForAPI

      const res = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.text()
        if (res.status === 429) throw new Error('מגבלת קצב. נסה שוב.')
        throw new Error(`AI error: ${res.status} ${err}`)
      }

      const data = await res.json()
      const choice = data.choices?.[0]
      const msg = choice?.message

      if (!msg) break

      messages.push(msg)

      // No tool calls → done
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        finalOutput = msg.content || ''
        break
      }

      // Execute tool calls
      const toolResults: any[] = []
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name
        let toolArgs: Record<string, any> = {}
        try { toolArgs = JSON.parse(tc.function.arguments || '{}') } catch { /* ignore */ }


        let result: any
        try {
          result = await executeTool(toolName, toolArgs, supabase, resolvedTenantId, resolvedUserId)
        } catch (e: any) {
          result = { error: e.message }
        }

        toolLog.push({ tool: toolName, args: toolArgs, result })
        toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
      }

      messages.push(...toolResults)
    }

    const executionTime = Date.now() - startTime

    // 6. Log to automation_logs
    if (automation_id) {
      await supabase.from('automation_logs').insert({
        automation_id,
        success: true,
        payload: { command_text, user_name, agent_id, agent_name: agent.name },
        response: { agent_output: finalOutput, model, execution_time_ms: executionTime, tools_used: toolLog.map(t => t.tool) },
        execution_time_ms: executionTime,
      })
    }

    return new Response(JSON.stringify({
      success: true,
      output: finalOutput,
      agent_name: agent.name,
      model,
      execution_time_ms: executionTime,
      tools_used: toolLog.map(t => t.tool),
      tool_log: toolLog,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('run-ai-agent error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    })
  }
})
