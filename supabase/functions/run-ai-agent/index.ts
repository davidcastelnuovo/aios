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
    // Manus models (default for Carmen)
    'manus-1.6': 'manus/manus-1.6',
    'manus-1.6-max': 'manus/manus-1.6-max',
    'manus-1.6-lite': 'manus/manus-1.6-lite',
    // Gemini models
    'gemini-2.5-flash': 'google/gemini-2.5-flash',
    'gemini-2.5-pro': 'google/gemini-2.5-pro',
    'gemini-3-flash': 'google/gemini-3-flash-preview',
    'gemini-3-pro': 'google/gemini-3-pro-preview',
    // OpenAI models
    'gpt-5': 'openai/gpt-5',
    'gpt-5-mini': 'openai/gpt-5-mini',
    // Anthropic / Claude models
    'claude-sonnet': 'anthropic/claude-sonnet-4-6',
    'claude-opus': 'anthropic/claude-opus-4-6',
  }
  return map[engine] || 'manus/manus-1.6'
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
      const { data: profile } = await supabase.from('profiles').select('campaigner_id').eq('id', userId).single()
      const { data: campAgency } = await supabase.from('campaigner_agencies').select('agency_id').eq('campaigner_id', profile?.campaigner_id).limit(1).single()
      const { data, error } = await supabase.from('tasks').insert({
        title: args.title, agency_id: campAgency?.agency_id, campaigner_id: profile?.campaigner_id,
        tenant_id: tenantId, priority: args.priority || 5, status: 'open', task_type: 'other',
        client_id: args.client_id, due_date: args.due_date, due_time: args.due_time, notes: args.notes,
      }).select('id, title, status').single()
      if (error) throw error
      return { task_id: data.id, title: data.title, status: data.status }
    }
    case 'list_tasks': {
      let query = supabase.from('tasks').select('id, title, status, priority, due_date, clients(name)').eq('tenant_id', tenantId).order('priority', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      if (args.client_id) query = query.eq('client_id', args.client_id)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, tasks: data.map((t: any) => ({ ...t, client_name: t.clients?.name })) }
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
    const { agent_id, command_text, temperature, automation_id, user_name, lead_data, tenant_id, user_id } = await req.json()

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
    // Fetch tenant context for Carmen and all agents
    const [tenantRes, agenciesRes, statsRes] = await Promise.all([
      supabase.from('tenants').select('name, type').eq('id', resolvedTenantId).single(),
      supabase.from('agencies').select('id, name').eq('tenant_id', resolvedTenantId).order('name').limit(20),
      Promise.all([
        supabase.from('leads').select('status', { count: 'exact', head: false }).eq('tenant_id', resolvedTenantId),
        supabase.from('clients').select('id', { count: 'exact', head: false }).eq('tenant_id', resolvedTenantId),
        supabase.from('tasks').select('id', { count: 'exact', head: false }).eq('tenant_id', resolvedTenantId).eq('status', 'open'),
      ])
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
    // Always inject tenant context
    systemPrompt += `\n\n=== הקשר ארגוני ===\n${tenantContext}`

    // Inject lead context
    if (lead_data) {
      const leadParts = Object.entries(lead_data)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
      if (leadParts.length) systemPrompt += `\n\nפרטי ליד:\n${leadParts.join('\n')}`
    }

    // 4. Filter tools
    const allowedTools = (agent.allowed_tools || []) as string[]
    const filteredTools = allowedTools.length > 0
      ? ALL_TOOLS.filter(t => allowedTools.includes(t.name))
      : ALL_TOOLS

    const toolsForAPI = filteredTools.map(t => ({ type: 'function', function: t }))

    // 5. Run agent with tool loop
    const model = resolveModel(agent.engine || 'gemini-3-flash')
    const maxRounds = agent.max_tool_rounds || 3
    const safeTemp = typeof temperature === 'number' ? Math.min(2, Math.max(0, temperature)) : undefined

    let messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: command_text },
    ]

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
