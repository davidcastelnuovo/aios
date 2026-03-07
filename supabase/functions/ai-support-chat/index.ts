import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const AI_MODEL = 'google/gemini-3-flash-preview';

function buildSystemPrompt(userName: string, userEmail: string, campaignerName?: string, campaignerId?: string) {
  return `אתה **AIOS** - עוזר AI חכם ומרכזי של מערכת CRM לניהול סוכנויות שיווק.

👤 **אתה מדבר עם:**
- **שם:** ${userName}
- **אימייל:** ${userEmail}
${campaignerName ? `- **תפקיד:** קמפיינר - ${campaignerName}` : ''}
${campaignerId ? `- **מזהה קמפיינר:** ${campaignerId}` : ''}

📋 **מבנה המערכת:**
- **agencies** (סוכנויות) - חברות שמנהלות קמפיינים
- **clients** (לקוחות) - לקוחות של הסוכנויות
- **tasks** (משימות) - משימות שקשורות ללקוחות/סוכנויות
- **campaigners** (קמפיינרים) - עובדים שמבצעים את העבודה
- **leads** (לידים) - לקוחות פוטנציאליים
- **automations** (אוטומציות) - כללים אוטומטיים שמגיבים לאירועים

🔧 **פעולות שאתה יכול לבצע:**
1. **משימות** - יצירה, עדכון סטטוס, הצגת רשימות
2. **לידים** - יצירה, עדכון סטטוס, חיפוש, הצגת רשימות
3. **לקוחות** - יצירה, הצגת מידע, הצגת רשימות
4. **אוטומציות** - יצירת אוטומציות חדשות (trigger + action)
5. **הודעות** - שליחת הודעות WhatsApp ללקוחות/לידים
6. **חיפוש** - מציאת סוכנויות, לקוחות, קמפיינרים
7. **אימיילים** - קריאה, שליחה, מחיקה של אימיילים מ-Gmail

💬 **הנחיות תקשורת:**
- דבר בעברית, בצורה ישירה ומקצועית
- התייחס למשתמש בשמו (${userName})
- היה פרו-אקטיבי - הצע דברים שיכולים לעזור
- תמיד הסבר מה עשית אחרי ביצוע פעולה
- אם משהו לא ברור, שאל במקום לנחש
- השתמש ב-markdown לעיצוב התשובות

⚠️ **קריטי - שימוש ב-IDs:**
- כאשר אתה מחפש ישות ומקבל תוצאות, חובה להשתמש ב-UUID המדויק מהתוצאה!
- **אל תמציא** IDs - חפש קודם ואז השתמש ב-ID האמיתי.

⚠️ **לפני יצירת אוטומציה:**
- וודא שהמשתמש ציין trigger_type ו-action_type ברורים
- שאל לפרטים חסרים אם צריך

⚠️ **לפני שליחת הודעה:**
- חפש קודם את איש הקשר כדי לקבל את ה-ID שלו
- וודא שיש לו מספר טלפון`;
}

interface ToolCall {
  name: string;
  args: Record<string, any>;
}

async function executeTool(
  toolCall: ToolCall, 
  supabaseClient: any, 
  userId: string, 
  tenantId: string,
  userToken?: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  console.log('Executing tool:', toolCall.name, 'with args:', toolCall.args);

  try {
    switch (toolCall.name) {
      case 'create_task': {
        const { title, client_id, priority, due_date, notes } = toolCall.args;
        
        const { data: profileData } = await supabaseClient
          .from('profiles')
          .select('campaigner_id')
          .eq('id', userId)
          .single();
        
        if (!profileData?.campaigner_id) {
          return { success: false, error: 'לא נמצא קמפיינר מקושר למשתמש שלך.' };
        }

        const { data: campaignerAgency } = await supabaseClient
          .from('campaigner_agencies')
          .select('agency_id')
          .eq('campaigner_id', profileData.campaigner_id)
          .limit(1)
          .single();

        if (!campaignerAgency?.agency_id) {
          return { success: false, error: 'לא נמצאה סוכנות מקושרת לקמפיינר שלך.' };
        }

        const taskData: any = {
          title,
          agency_id: campaignerAgency.agency_id,
          campaigner_id: profileData.campaigner_id,
          tenant_id: tenantId,
          priority: priority || 5,
          status: 'open',
          task_type: 'other',
        };
        if (client_id) taskData.client_id = client_id;
        if (due_date) taskData.due_date = due_date;
        if (notes) taskData.notes = notes;

        const { data, error } = await supabaseClient
          .from('tasks').insert(taskData)
          .select('*, clients(name), agencies(name), campaigners(full_name)')
          .single();
        if (error) throw error;

        return { success: true, result: { task_id: data.id, title: data.title, client_name: data.clients?.name, agency_name: data.agencies?.name, campaigner_name: data.campaigners?.full_name, priority: data.priority, due_date: data.due_date } };
      }

      case 'update_task_status': {
        const { task_id, status } = toolCall.args;
        const { data, error } = await supabaseClient
          .from('tasks').update({ status }).eq('id', task_id).eq('tenant_id', tenantId)
          .select('*, clients(name), agencies(name)').single();
        if (error) throw error;
        return { success: true, result: { task_id: data.id, title: data.title, status: data.status, client_name: data.clients?.name } };
      }

      case 'list_tasks': {
        const { agency_id, client_id, status, limit = 20, my_tasks = false } = toolCall.args;
        const { data: profileData } = await supabaseClient.from('profiles').select('campaigner_id').eq('id', userId).single();
        const userCampaignerId = profileData?.campaigner_id;

        let query = supabaseClient.from('tasks')
          .select('*, clients(name), agencies(name), campaigners(full_name)')
          .eq('tenant_id', tenantId)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit);

        if (my_tasks && userCampaignerId) query = query.eq('campaigner_id', userCampaignerId);
        if (agency_id) query = query.eq('agency_id', agency_id);
        if (client_id) query = query.eq('client_id', client_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;

        return { success: true, result: {
          count: data.length,
          is_filtered_by_user: my_tasks && !!userCampaignerId,
          tasks: data.map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date, client_name: t.clients?.name, agency_name: t.agencies?.name, campaigner_name: t.campaigners?.full_name }))
        }};
      }

      case 'get_client_info': {
        const { client_id } = toolCall.args;
        const { data, error } = await supabaseClient.from('clients').select('*, agencies(name)').eq('id', client_id).eq('tenant_id', tenantId).single();
        if (error) throw error;
        return { success: true, result: { id: data.id, name: data.name, status: data.status, email: data.email, phone: data.phone, industry: data.industry, agency_name: data.agencies?.name, monthly_budget: data.monthly_budget, retainer: data.retainer, start_date: data.start_date } };
      }

      case 'search_entities': {
        const { entity_type, search_term } = toolCall.args;
        let tableName = '', selectFields = '*', nameField = 'name';
        if (entity_type === 'agency') { tableName = 'agencies'; selectFields = 'id, name, status'; }
        else if (entity_type === 'client') { tableName = 'clients'; selectFields = 'id, name, status, email, phone, agencies(name)'; }
        else if (entity_type === 'campaigner') { tableName = 'campaigners'; selectFields = 'id, full_name, email, phone, role, active'; nameField = 'full_name'; }
        else if (entity_type === 'lead') { tableName = 'leads'; selectFields = 'id, company_name, contact_name, email, phone, status, source'; nameField = 'company_name'; }
        else throw new Error(`Unknown entity type: ${entity_type}`);

        const { data, error } = await supabaseClient.from(tableName).select(selectFields).eq('tenant_id', tenantId).ilike(nameField, `%${search_term}%`).limit(10);
        if (error) throw error;
        return { success: true, result: { entity_type, count: data.length, results: data } };
      }

      // === NEW TOOLS ===

      case 'create_lead': {
        const { company_name, contact_name, phone, email, source, notes } = toolCall.args;
        
        // Get default agency
        const { data: defaultAgency } = await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).eq('is_default', true).limit(1).single();
        const agencyId = defaultAgency?.id;
        if (!agencyId) {
          const { data: firstAgency } = await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).single();
          if (!firstAgency?.id) return { success: false, error: 'לא נמצאה סוכנות' };
        }

        const leadData: any = {
          company_name: company_name || contact_name || 'ליד חדש',
          contact_name,
          phone,
          email,
          source: source || 'aios',
          notes,
          status: 'new',
          agency_id: agencyId || (await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).single()).data?.id,
          tenant_id: tenantId,
        };

        const { data, error } = await supabaseClient.from('leads').insert(leadData).select('id, company_name, contact_name, status').single();
        if (error) throw error;
        return { success: true, result: { lead_id: data.id, company_name: data.company_name, contact_name: data.contact_name, status: data.status } };
      }

      case 'update_lead_status': {
        const { lead_id, status } = toolCall.args;
        const { data, error } = await supabaseClient.from('leads').update({ status }).eq('id', lead_id).eq('tenant_id', tenantId).select('id, company_name, status').single();
        if (error) throw error;
        return { success: true, result: { lead_id: data.id, company_name: data.company_name, status: data.status } };
      }

      case 'list_leads': {
        const { status, limit = 20, source } = toolCall.args;
        let query = supabaseClient.from('leads').select('id, company_name, contact_name, phone, email, status, source, created_at, agencies(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
        if (status) query = query.eq('status', status);
        if (source) query = query.eq('source', source);
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, result: { count: data.length, leads: data.map((l: any) => ({ id: l.id, company_name: l.company_name, contact_name: l.contact_name, phone: l.phone, email: l.email, status: l.status, source: l.source, agency_name: l.agencies?.name, created_at: l.created_at })) } };
      }

      case 'list_clients': {
        const { status, limit = 20 } = toolCall.args;
        let query = supabaseClient.from('clients').select('id, name, contact_name, phone, email, status, agencies(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, result: { count: data.length, clients: data.map((c: any) => ({ id: c.id, name: c.name, contact_name: c.contact_name, phone: c.phone, email: c.email, status: c.status, agency_name: c.agencies?.name })) } };
      }

      case 'create_client': {
        const { name, contact_name, phone, email, industry, notes } = toolCall.args;
        const { data: defaultAgency } = await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).eq('is_default', true).limit(1).single();
        let agencyId = defaultAgency?.id;
        if (!agencyId) {
          const { data: firstAgency } = await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).single();
          agencyId = firstAgency?.id;
        }
        if (!agencyId) return { success: false, error: 'לא נמצאה סוכנות' };

        const { data, error } = await supabaseClient.from('clients').insert({
          name, contact_name, phone, email, industry, notes, status: 'active', agency_id: agencyId, tenant_id: tenantId,
        }).select('id, name, status').single();
        if (error) throw error;
        return { success: true, result: { client_id: data.id, name: data.name, status: data.status } };
      }

      case 'create_automation': {
        const { name, description, trigger_type, action_type, configuration } = toolCall.args;
        const { data, error } = await supabaseClient.from('automations').insert({
          name, description, trigger_type, action_type, configuration: configuration || {}, tenant_id: tenantId, active: true,
        }).select('id, name, trigger_type, action_type, active').single();
        if (error) throw error;
        return { success: true, result: { automation_id: data.id, name: data.name, trigger_type: data.trigger_type, action_type: data.action_type, active: data.active } };
      }

      case 'list_emails': {
        const { query, maxResults = 10, date } = toolCall.args;
        let q = query || '';
        if (date) {
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);
          const fmt = (d: Date) => `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
          q = `after:${fmt(new Date(date))} before:${fmt(nextDay)} ${q}`.trim();
        }
        const authHeader2 = `Bearer ${userToken}`;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader2 },
          body: JSON.stringify({ action: 'list', query: q, maxResults }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error || 'Gmail API error' };
        return { success: true, result: { count: data.messages?.length || 0, emails: (data.messages || []).map((m: any) => ({ id: m.id, from: m.from, subject: m.subject, snippet: m.snippet, date: m.date, isUnread: m.isUnread })) } };
      }

      case 'get_email': {
        const { message_id } = toolCall.args;
        const authHeader2 = `Bearer ${userToken}`;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader2 },
          body: JSON.stringify({ action: 'get', messageId: message_id }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error || 'Gmail API error' };
        return { success: true, result: { id: data.id, from: data.from, to: data.to, subject: data.subject, date: data.date, body: data.body?.slice(0, 2000) } };
      }

      case 'send_email': {
        const { to, subject, body: emailBody } = toolCall.args;
        const authHeader2 = `Bearer ${userToken}`;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader2 },
          body: JSON.stringify({ action: 'send', to, subject, body: emailBody }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error || 'Send failed' };
        return { success: true, result: { sent: true, to, subject } };
      }

      case 'delete_email': {
        const { message_id } = toolCall.args;
        const authHeader2 = `Bearer ${userToken}`;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader2 },
          body: JSON.stringify({ action: 'trash', messageId: message_id }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error || 'Delete failed' };
        return { success: true, result: { deleted: true, message_id } };
      }

      case 'send_message': {
        const { contact_type, contact_id, message_text } = toolCall.args;
        
        // Get contact phone
        let phone: string | null = null;
        let contactName: string | null = null;
        
        if (contact_type === 'lead') {
          const { data } = await supabaseClient.from('leads').select('phone, company_name, contact_name, active_chat_provider').eq('id', contact_id).single();
          phone = data?.phone;
          contactName = data?.contact_name || data?.company_name;
        } else if (contact_type === 'client') {
          const { data } = await supabaseClient.from('clients').select('phone, name, contact_name, active_chat_provider').eq('id', contact_id).single();
          phone = data?.phone;
          contactName = data?.contact_name || data?.name;
        }

        if (!phone) return { success: false, error: 'לא נמצא מספר טלפון עבור איש הקשר' };

        // Try sending via Green API
        try {
          const sendResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-green-api-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              phone,
              message: message_text,
              tenantId,
              [`${contact_type}_id`]: contact_id,
            }),
          });

          if (!sendResponse.ok) {
            const errText = await sendResponse.text();
            throw new Error(errText);
          }

          return { success: true, result: { sent_to: contactName, phone, message_preview: message_text.slice(0, 50) } };
        } catch (e: any) {
          return { success: false, error: `שגיאה בשליחת ההודעה: ${e.message}` };
        }
      }

      default:
        return { success: false, error: `Unknown tool: ${toolCall.name}` };
    }
  } catch (error: any) {
    console.error('Tool execution error:', error);
    return { success: false, error: error.message };
  }
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'יצירת משימה חדשה במערכת',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'כותרת המשימה' },
          client_id: { type: 'string', description: 'מזהה הלקוח (UUID, אופציונלי)' },
          priority: { type: 'integer', description: 'עדיפות 1-10', minimum: 1, maximum: 10 },
          due_date: { type: 'string', format: 'date', description: 'תאריך יעד (YYYY-MM-DD)' },
          notes: { type: 'string', description: 'הערות' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task_status',
      description: 'עדכון סטטוס משימה קיימת',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'מזהה המשימה (UUID)' },
          status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'], description: 'סטטוס חדש' },
        },
        required: ['task_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'קבלת רשימת משימות. אם "מה יש לי?" - השתמש ב-my_tasks=true',
      parameters: {
        type: 'object',
        properties: {
          my_tasks: { type: 'boolean', description: 'רק משימות של המשתמש הנוכחי' },
          agency_id: { type: 'string', description: 'סינון לפי סוכנות (UUID)' },
          client_id: { type: 'string', description: 'סינון לפי לקוח (UUID)' },
          status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'], description: 'סינון לפי סטטוס' },
          limit: { type: 'integer', description: 'מספר מקסימלי (ברירת מחדל: 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_client_info',
      description: 'קבלת מידע מפורט על לקוח',
      parameters: {
        type: 'object',
        properties: { client_id: { type: 'string', description: 'מזהה הלקוח (UUID)' } },
        required: ['client_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_entities',
      description: 'חיפוש סוכנויות, לקוחות, קמפיינרים או לידים לפי שם',
      parameters: {
        type: 'object',
        properties: {
          entity_type: { type: 'string', enum: ['agency', 'client', 'campaigner', 'lead'], description: 'סוג הישות' },
          search_term: { type: 'string', description: 'מונח החיפוש' },
        },
        required: ['entity_type', 'search_term'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'יצירת ליד חדש במערכת',
      parameters: {
        type: 'object',
        properties: {
          company_name: { type: 'string', description: 'שם החברה' },
          contact_name: { type: 'string', description: 'שם איש הקשר' },
          phone: { type: 'string', description: 'מספר טלפון' },
          email: { type: 'string', description: 'אימייל' },
          source: { type: 'string', description: 'מקור הליד' },
          notes: { type: 'string', description: 'הערות' },
        },
        required: ['contact_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead_status',
      description: 'עדכון סטטוס ליד',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'מזהה הליד (UUID)' },
          status: { type: 'string', description: 'סטטוס חדש (לפי pipeline stages של הארגון)' },
        },
        required: ['lead_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_leads',
      description: 'הצגת רשימת לידים',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'סינון לפי סטטוס' },
          source: { type: 'string', description: 'סינון לפי מקור' },
          limit: { type: 'integer', description: 'מספר מקסימלי (ברירת מחדל: 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_clients',
      description: 'הצגת רשימת לקוחות',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'סינון לפי סטטוס' },
          limit: { type: 'integer', description: 'מספר מקסימלי (ברירת מחדל: 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_client',
      description: 'יצירת לקוח חדש',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'שם הלקוח/חברה' },
          contact_name: { type: 'string', description: 'שם איש הקשר' },
          phone: { type: 'string', description: 'טלפון' },
          email: { type: 'string', description: 'אימייל' },
          industry: { type: 'string', description: 'תעשייה' },
          notes: { type: 'string', description: 'הערות' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_automation',
      description: 'יצירת אוטומציה חדשה במערכת. trigger_type: lead_status_changed, task_status_changed, manual_command, meeting_created, inbound_webhook_task. action_type: send_whatsapp, create_task, add_lead_update, add_client_update, create_manychat_subscriber, add_manychat_tag.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'שם האוטומציה' },
          description: { type: 'string', description: 'תיאור' },
          trigger_type: { type: 'string', description: 'סוג הטריגר' },
          action_type: { type: 'string', description: 'סוג הפעולה' },
          configuration: { type: 'object', description: 'הגדרות הפעולה (template, tag_id, etc.)' },
        },
        required: ['name', 'trigger_type', 'action_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: 'שליחת הודעת WhatsApp ללקוח או ליד',
      parameters: {
        type: 'object',
        properties: {
          contact_type: { type: 'string', enum: ['lead', 'client'], description: 'סוג איש הקשר' },
          contact_id: { type: 'string', description: 'מזהה איש הקשר (UUID)' },
          message_text: { type: 'string', description: 'תוכן ההודעה' },
        },
        required: ['contact_type', 'contact_id', 'message_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_emails',
      description: 'שליפת רשימת אימיילים מ-Gmail. אפשר לסנן לפי query או תאריך.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'חיפוש חופשי (כמו בחיפוש Gmail)' },
          maxResults: { type: 'integer', description: 'מספר מקסימלי (ברירת מחדל: 10)' },
          date: { type: 'string', format: 'date', description: 'תאריך ספציפי (YYYY-MM-DD)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_email',
      description: 'קריאת תוכן אימייל ספציפי לפי מזהה',
      parameters: {
        type: 'object',
        properties: {
          message_id: { type: 'string', description: 'מזהה ההודעה' },
        },
        required: ['message_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'שליחת אימייל חדש דרך Gmail',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'כתובת אימייל של הנמען' },
          subject: { type: 'string', description: 'נושא ההודעה' },
          body: { type: 'string', description: 'תוכן ההודעה (HTML או טקסט)' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_email',
      description: 'מחיקת אימייל (העברה לאשפה)',
      parameters: {
        type: 'object',
        properties: {
          message_id: { type: 'string', description: 'מזהה ההודעה למחיקה' },
        },
        required: ['message_id'],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const reqBody = await req.json();
    const { message, conversation_id, tenant_slug } = reqBody;

    // Resolve tenant
    let tenantId: string | null = null;
    if (tenant_slug) {
      const { data: tenantBySlug } = await supabaseClient.from('tenants').select('id').eq('slug', tenant_slug).single();
      if (tenantBySlug) tenantId = tenantBySlug.id;
    }
    if (!tenantId) {
      const { data: activeTenant } = await supabaseClient.from('user_active_tenant').select('tenant_id').eq('user_id', user.id).single();
      tenantId = activeTenant?.tenant_id || null;
    }
    if (!tenantId) {
      const { data: tenantData } = await supabaseClient.from('tenant_users').select('tenant_id').eq('user_id', user.id).limit(1).single();
      tenantId = tenantData?.tenant_id || null;
    }
    if (!tenantId) throw new Error('אין לך גישה למערכת');

    // Get user profile
    const { data: profileData } = await supabaseClient.from('profiles').select('full_name, email, campaigner_id').eq('id', user.id).single();
    let campaignerName: string | null = null;
    let campaignerId: string | null = null;

    if (profileData?.campaigner_id) {
      const { data: campaignerData } = await supabaseClient.from('campaigners').select('full_name, id').eq('id', profileData.campaigner_id).single();
      if (campaignerData) { campaignerName = campaignerData.full_name; campaignerId = campaignerData.id; }
    }

    const userName = profileData?.full_name || user.email?.split('@')[0] || 'משתמש';
    const userEmail = profileData?.email || user.email || '';

    // Load conversation
    let conversation = null;
    let messages: any[] = [];
    if (conversation_id) {
      const { data: convData } = await supabaseClient.from('ai_conversations').select('*').eq('id', conversation_id).eq('user_id', user.id).single();
      if (convData) { conversation = convData; messages = convData.messages || []; }
    }

    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

    const aiMessages = messages.filter(m => m.role !== 'tool_call').map(m => ({ role: m.role, content: m.content }));

    // Call Lovable AI Gateway
    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt(userName, userEmail, campaignerName || undefined, campaignerId || undefined) },
          ...aiMessages,
        ],
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: 'חריגה ממגבלת הקצב' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'נדרש תשלום' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const errText = await response.text();
      console.error('AI Gateway error:', response.status, errText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    // Stream response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantMessage = '';
        const toolCallAccumulators: Record<number, { name: string; arguments: string }> = {};
        let finishReason: string | null = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              if (!line.startsWith('data: ')) continue;

              const data = line.slice(6);
              if (data === '[DONE]') { finishReason = finishReason || 'stop'; continue; }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                const choiceFinishReason = parsed.choices?.[0]?.finish_reason;
                if (choiceFinishReason) finishReason = choiceFinishReason;

                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallAccumulators[idx]) toolCallAccumulators[idx] = { name: '', arguments: '' };
                    if (tc.function?.name) toolCallAccumulators[idx].name = tc.function.name;
                    if (tc.function?.arguments) toolCallAccumulators[idx].arguments += tc.function.arguments;
                  }
                } else if (delta?.content) {
                  assistantMessage += delta.content;
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'token', content: delta.content })}\n\n`));
                }
              } catch (e) { /* ignore parse errors */ }
            }
          }
          
          // Execute accumulated tool calls
          if (finishReason === 'tool_calls' || Object.keys(toolCallAccumulators).length > 0) {
            for (const [_, accumulated] of Object.entries(toolCallAccumulators)) {
              if (!accumulated.name) continue;
              let toolArgs = {};
              try { toolArgs = JSON.parse(accumulated.arguments || '{}'); } catch { continue; }
              
              const toolName = accumulated.name;

              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'tool_call', tool: toolName, args: toolArgs })}\n\n`));

              const toolResult = await executeTool({ name: toolName, args: toolArgs }, supabaseClient, user.id, tenantId);

              messages.push({ role: 'tool_call', tool: toolName, args: toolArgs, result: toolResult, timestamp: new Date().toISOString() });

              if (toolResult.success) {
                const toolResultContent = JSON.stringify(toolResult.result);

                const followUpResponse = await fetch(AI_GATEWAY_URL, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: AI_MODEL,
                    messages: [
                      { role: 'system', content: buildSystemPrompt(userName, userEmail, campaignerName || undefined, campaignerId || undefined) },
                      ...aiMessages,
                      { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: toolName, arguments: JSON.stringify(toolArgs) } }] },
                      { role: 'tool', tool_call_id: 'call_1', content: toolResultContent },
                    ],
                    stream: true,
                  }),
                });

                if (followUpResponse.ok) {
                  const followReader = followUpResponse.body!.getReader();
                  let followBuffer = '';
                  while (true) {
                    const { done: followDone, value: followValue } = await followReader.read();
                    if (followDone) break;
                    followBuffer += decoder.decode(followValue, { stream: true });
                    const followLines = followBuffer.split('\n');
                    followBuffer = followLines.pop() || '';
                    for (const followLine of followLines) {
                      if (!followLine.trim() || followLine.startsWith(':') || !followLine.startsWith('data: ')) continue;
                      const followData = followLine.slice(6);
                      if (followData === '[DONE]') continue;
                      try {
                        const followParsed = JSON.parse(followData);
                        const followContent = followParsed.choices?.[0]?.delta?.content;
                        if (followContent) {
                          assistantMessage += followContent;
                          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'token', content: followContent })}\n\n`));
                        }
                      } catch { /* ignore */ }
                    }
                  }
                }
              } else {
                const errorMsg = `❌ שגיאה: ${toolResult.error}`;
                assistantMessage = errorMsg;
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'token', content: errorMsg })}\n\n`));
              }
            }
          }

          // Save
          if (assistantMessage) {
            messages.push({ role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() });
          }

          const conversationTitle = conversation?.title || message.slice(0, 50);
          if (conversation_id && conversation) {
            await supabaseClient.from('ai_conversations').update({ messages, updated_at: new Date().toISOString() }).eq('id', conversation_id);
          } else {
            const { data: newConv } = await supabaseClient.from('ai_conversations').insert({ user_id: user.id, tenant_id: tenantId, title: conversationTitle, messages }).select().single();
            if (newConv) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'conversation_id', id: newConv.id })}\n\n`));
            }
          }

          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (error: any) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error: any) {
    console.error('Error in ai-support-chat:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
