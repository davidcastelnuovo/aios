import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

function buildSystemPrompt(userName: string, userEmail: string, campaignerName?: string, campaignerId?: string) {
  return `אתה עוזר AI אישי של מערכת ניהול קמפיינים דיגיטליים.

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

🔧 **פעולות שאתה יכול לבצע:**
1. **הצגת המשימות שלי** - רשימת כל המשימות הפתוחות של ${userName}
2. **יצירת משימה חדשה** - פתיחת משימה חדשה במערכת (ללא צורך לציין סוכנות או קמפיינר - זה אוטומטי!)
3. **עדכון סטטוס משימה** - שינוי סטטוס משימה קיימת
4. **חיפוש ישויות** - מציאת סוכנויות, לקוחות או קמפיינרים
5. **מידע על לקוח** - פרטים מלאים על לקוח ספציפי
6. **סיכום יומי** - סיכום של כל המשימות והפעילות

💬 **הנחיות תקשורת:**
- דבר בעברית בצורה חברית, ישירה ומקצועית
- התייחס למשתמש בשמו (${userName})
${campaignerName ? `- כשאתה מדבר על משימות, זכור שאתה מדבר עם ${campaignerName} הקמפיינר` : ''}
- היה פרו-אקטיבי - הצע דברים שיכולים לעזור למשתמש
- אם המשתמש שואל "מה יש לי?" או "מה פתוח?" - הצג את המשימות שלו
- סדר משימות לפי עדיפות וחשיבות
- תמיד הסבר מה עשית אחרי ביצוע פעולה
- אם משהו לא ברור, שאל במקום לנחש

⚠️ **קריטי - שימוש ב-IDs:**
- כאשר אתה מחפש ישות (לקוח, סוכנות, קמפיינר) עם search_entities ומקבל תוצאות, חובה להשתמש ב-UUID המדויק מהתוצאה!
- לדוגמה: אם קיבלת {"id": "3668c531-184c-4be5-b739-c6c35f7caf00", "name": "נקסוס"} - השתמש בדיוק ב-"3668c531-184c-4be5-b739-c6c35f7caf00"
- **אל תמציא** IDs או תכתוב טקסט כמו "client_id_of_..." - זה יגרום לשגיאה!
- כדי ליצור משימה, מספיק לתת כותרת בלבד. אם המשתמש מזכיר לקוח, חפש אותו קודם ואז השתמש ב-ID האמיתי.

⚠️ **חשוב:**
- היה תמיד מועיל ומדויק
- תעדף משימות דחופות ובעדיפות גבוהה
- הצג מידע בצורה ברורה עם אייקונים ומבנה נקי`;
}

interface ToolCall {
  name: string;
  args: Record<string, any>;
}

async function executeTool(
  toolCall: ToolCall, 
  supabase: any, 
  userId: string, 
  tenantId: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  console.log('Executing tool:', toolCall.name, 'with args:', toolCall.args);

  try {
    switch (toolCall.name) {
      case 'create_task': {
        const { title, client_id, priority, due_date, notes } = toolCall.args;
        
        // Get user's campaigner_id and their first agency
        const { data: profileData } = await supabase
          .from('profiles')
          .select('campaigner_id')
          .eq('id', userId)
          .single();
        
        if (!profileData?.campaigner_id) {
          return {
            success: false,
            error: 'לא נמצא קמפיינר מקושר למשתמש שלך. אנא פנה למנהל המערכת.'
          };
        }

        const userCampaignerId = profileData.campaigner_id;

        // Get the first agency associated with this campaigner
        const { data: campaignerAgency } = await supabase
          .from('campaigner_agencies')
          .select('agency_id')
          .eq('campaigner_id', userCampaignerId)
          .limit(1)
          .single();

        if (!campaignerAgency?.agency_id) {
          return {
            success: false,
            error: 'לא נמצאה סוכנות מקושרת לקמפיינר שלך. אנא פנה למנהל המערכת.'
          };
        }

        const taskData: any = {
          title,
          agency_id: campaignerAgency.agency_id,
          campaigner_id: userCampaignerId,
          tenant_id: tenantId,
          priority: priority || 5,
          status: 'open',
          task_type: 'other',
        };

        if (client_id) taskData.client_id = client_id;
        if (due_date) taskData.due_date = due_date;
        if (notes) taskData.notes = notes;

        const { data, error } = await supabase
          .from('tasks')
          .insert(taskData)
          .select('*, clients(name), agencies(name), campaigners(full_name)')
          .single();

        if (error) throw error;

        return {
          success: true,
          result: {
            task_id: data.id,
            title: data.title,
            client_name: data.clients?.name,
            agency_name: data.agencies?.name,
            campaigner_name: data.campaigners?.full_name,
            priority: data.priority,
            due_date: data.due_date,
          }
        };
      }

      case 'update_task_status': {
        const { task_id, status } = toolCall.args;

        const { data, error } = await supabase
          .from('tasks')
          .update({ status })
          .eq('id', task_id)
          .eq('tenant_id', tenantId)
          .select('*, clients(name), agencies(name)')
          .single();

        if (error) throw error;

        return {
          success: true,
          result: {
            task_id: data.id,
            title: data.title,
            status: data.status,
            client_name: data.clients?.name,
            agency_name: data.agencies?.name,
          }
        };
      }

      case 'list_tasks': {
        const { agency_id, client_id, status, limit = 20, my_tasks = false } = toolCall.args;

        // Get user's campaigner_id
        const { data: profileData } = await supabase
          .from('profiles')
          .select('campaigner_id')
          .eq('id', userId)
          .single();
        
        const userCampaignerId = profileData?.campaigner_id;
        console.log('User campaigner_id:', userCampaignerId, 'my_tasks:', my_tasks);

        let query = supabase
          .from('tasks')
          .select('*, clients(name), agencies(name), campaigners(full_name)')
          .eq('tenant_id', tenantId)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit);

        // If my_tasks is true, filter by user's campaigner
        if (my_tasks && userCampaignerId) {
          query = query.eq('campaigner_id', userCampaignerId);
        }

        if (agency_id) query = query.eq('agency_id', agency_id);
        if (client_id) query = query.eq('client_id', client_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;

        if (error) {
          console.error('❌ list_tasks query error:', error);
          throw error;
        }

        console.log('✅ list_tasks query completed:', {
          tenant_id: tenantId,
          my_tasks,
          userCampaignerId,
          tasksFound: data?.length || 0,
          taskTitles: data?.map((t: any) => t.title) || []
        });

        // If my_tasks was requested but no campaigner_id, notify user
        const noCampaignerWarning = my_tasks && !userCampaignerId 
          ? 'שים לב: הפרופיל שלך לא מקושר לקמפיינר. מציג את כל המשימות בארגון.' 
          : null;

        const result = {
          count: data.length,
          warning: noCampaignerWarning,
          is_filtered_by_user: my_tasks && !!userCampaignerId,
          tasks: data.map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            due_date: t.due_date,
            client_name: t.clients?.name,
            agency_name: t.agencies?.name,
            campaigner_name: t.campaigners?.full_name,
          }))
        };

        console.log('📋 list_tasks returning result:', JSON.stringify(result).slice(0, 500));

        return {
          success: true,
          result
        };
      }

      case 'get_client_info': {
        const { client_id } = toolCall.args;

        const { data, error } = await supabase
          .from('clients')
          .select('*, agencies(name)')
          .eq('id', client_id)
          .eq('tenant_id', tenantId)
          .single();

        if (error) throw error;

        return {
          success: true,
          result: {
            id: data.id,
            name: data.name,
            status: data.status,
            email: data.email,
            phone: data.phone,
            industry: data.industry,
            agency_name: data.agencies?.name,
            monthly_budget: data.monthly_budget,
            retainer: data.retainer,
            start_date: data.start_date,
          }
        };
      }

      case 'search_entities': {
        const { entity_type, search_term } = toolCall.args;
        
        let tableName = '';
        let selectFields = '*';
        
        if (entity_type === 'agency') {
          tableName = 'agencies';
          selectFields = 'id, name, active';
        } else if (entity_type === 'client') {
          tableName = 'clients';
          selectFields = 'id, name, status, email, phone, agencies(name)';
        } else if (entity_type === 'campaigner') {
          tableName = 'campaigners';
          selectFields = 'id, full_name, email, phone, role, active';
        } else {
          throw new Error(`Unknown entity type: ${entity_type}`);
        }

        const { data, error } = await supabase
          .from(tableName)
          .select(selectFields)
          .eq('tenant_id', tenantId)
          .ilike(entity_type === 'campaigner' ? 'full_name' : 'name', `%${search_term}%`)
          .limit(10);

        if (error) throw error;

        return {
          success: true,
          result: {
            entity_type,
            count: data.length,
            results: data
          }
        };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolCall.name}` };
    }
  } catch (error: any) {
    console.error('Tool execution error:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body early to get tenant_slug
    const reqBody = await req.json();
    const { message, conversation_id, tenant_slug } = reqBody;

    console.log('📍 Request tenant_slug:', tenant_slug);

    let tenantId: string | null = null;

    // If tenant_slug provided, use it to find the correct tenant
    if (tenant_slug) {
      const { data: tenantBySlug } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('slug', tenant_slug)
        .single();
      
      if (tenantBySlug) {
        tenantId = tenantBySlug.id;
        console.log('✅ Found tenant by slug:', tenantBySlug.name, tenantId);
      }
    }

    // Fallback: Get user's active tenant or first tenant
    if (!tenantId) {
      // Try user_active_tenant first
      const { data: activeTenant } = await supabase
        .from('user_active_tenant')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();
      
      if (activeTenant?.tenant_id) {
        tenantId = activeTenant.tenant_id;
        console.log('📍 Using active tenant:', tenantId);
      } else {
        // Fall back to first tenant_users entry
        const { data: tenantData } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        
        tenantId = tenantData?.tenant_id;
        console.log('📍 Using first tenant_users entry:', tenantId);
      }
    }

    if (!tenantId) {
      throw new Error('אין לך גישה למערכת. אנא צור קשר עם מנהל המערכת.');
    }

    // Get user profile and campaigner info
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, email, campaigner_id')
      .eq('id', user.id)
      .single();

    let campaignerName: string | null = null;
    let campaignerId: string | null = null;

    if (profileData?.campaigner_id) {
      const { data: campaignerData } = await supabase
        .from('campaigners')
        .select('full_name, id')
        .eq('id', profileData.campaigner_id)
        .single();
      
      if (campaignerData) {
        campaignerName = campaignerData.full_name;
        campaignerId = campaignerData.id;
      }
    }

    const userName = profileData?.full_name || user.email?.split('@')[0] || 'משתמש';
    const userEmail = profileData?.email || user.email || '';

    // message, conversation_id already extracted from reqBody above

    // Load conversation history if exists
    let conversation = null;
    let messages: any[] = [];

    if (conversation_id) {
      const { data: convData } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('id', conversation_id)
        .eq('user_id', user.id)
        .single();

      if (convData) {
        conversation = convData;
        messages = convData.messages || [];
      }
    }

    // Add user message
    messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Prepare messages for AI
    const aiMessages = messages
      .filter(m => m.role !== 'tool_call')
      .map(m => ({ role: m.role, content: m.content }));

    // Call OpenAI API with tools
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: buildSystemPrompt(userName, userEmail, campaignerName || undefined, campaignerId || undefined) },
          ...aiMessages,
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_task',
              description: 'יצירת משימה חדשה במערכת. הסוכנות והקמפיינר נקבעים אוטומטית לפי המשתמש המחובר.',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'כותרת המשימה' },
                  client_id: { type: 'string', description: 'מזהה הלקוח (UUID, אופציונלי)' },
                  priority: { type: 'integer', description: 'עדיפות 1-10 (אופציונלי)', minimum: 1, maximum: 10 },
                  due_date: { type: 'string', format: 'date', description: 'תאריך יעד (YYYY-MM-DD, אופציונלי)' },
                  notes: { type: 'string', description: 'הערות נוספות (אופציונלי)' },
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
                  status: { 
                    type: 'string', 
                    enum: ['open', 'in_progress', 'completed', 'cancelled'],
                    description: 'סטטוס חדש למשימה'
                  },
                },
                required: ['task_id', 'status'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'list_tasks',
              description: 'קבלת רשימת משימות. אם המשתמש שואל "מה יש לי?" או "המשימות שלי" - השתמש ב-my_tasks=true',
              parameters: {
                type: 'object',
                properties: {
                  my_tasks: { 
                    type: 'boolean', 
                    description: 'האם להציג רק את המשימות של המשתמש הנוכחי (true) או כל המשימות (false). ברירת מחדל: false'
                  },
                  agency_id: { type: 'string', description: 'סינון לפי סוכנות (UUID, אופציונלי)' },
                  client_id: { type: 'string', description: 'סינון לפי לקוח (UUID, אופציונלי)' },
                  status: { 
                    type: 'string',
                    enum: ['open', 'in_progress', 'completed', 'cancelled'],
                    description: 'סינון לפי סטטוס (אופציונלי)'
                  },
                  limit: { type: 'integer', description: 'מספר מקסימלי של תוצאות (ברירת מחדל: 10)' },
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
                properties: {
                  client_id: { type: 'string', description: 'מזהה הלקוח (UUID)' },
                },
                required: ['client_id'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'search_entities',
              description: 'חיפוש סוכנויות, לקוחות או קמפיינרים לפי שם',
              parameters: {
                type: 'object',
                properties: {
                  entity_type: {
                    type: 'string',
                    enum: ['agency', 'client', 'campaigner'],
                    description: 'סוג הישות לחיפוש',
                  },
                  search_term: { type: 'string', description: 'מונח החיפוש' },
                },
                required: ['entity_type', 'search_term'],
              },
            },
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'חריגה ממגבלת הקצב, אנא נסה שוב מאוחר יותר' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'נדרש תשלום, אנא הוסף יתרה ל-workspace' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantMessage = '';
        
        // Accumulate tool call data across streaming chunks
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
              if (data === '[DONE]') {
                finishReason = 'stop';
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                const choiceFinishReason = parsed.choices?.[0]?.finish_reason;
                
                if (choiceFinishReason) {
                  finishReason = choiceFinishReason;
                }

                // Accumulate tool calls across chunks
                if (delta?.tool_calls) {
                  for (const toolCall of delta.tool_calls) {
                    const index = toolCall.index ?? 0;
                    
                    if (!toolCallAccumulators[index]) {
                      toolCallAccumulators[index] = { name: '', arguments: '' };
                    }
                    
                    if (toolCall.function?.name) {
                      toolCallAccumulators[index].name = toolCall.function.name;
                    }
                    if (toolCall.function?.arguments) {
                      toolCallAccumulators[index].arguments += toolCall.function.arguments;
                    }
                  }
                } else if (delta?.content) {
                  // Regular content
                  assistantMessage += delta.content;
                  controller.enqueue(
                    new TextEncoder().encode(
                      `data: ${JSON.stringify({ type: 'token', content: delta.content })}\n\n`
                    )
                  );
                }
              } catch (e) {
                console.error('Parse error:', e);
              }
            }
          }
          
          // Process accumulated tool calls after streaming is complete
          if (finishReason === 'tool_calls' || Object.keys(toolCallAccumulators).length > 0) {
            for (const [_, accumulated] of Object.entries(toolCallAccumulators)) {
              if (!accumulated.name) continue;
              
              let toolArgs = {};
              try {
                toolArgs = JSON.parse(accumulated.arguments || '{}');
              } catch (e) {
                console.error('Failed to parse tool arguments:', accumulated.arguments, e);
                continue;
              }
              
              const toolName = accumulated.name;
              console.log('Executing accumulated tool:', toolName, 'with args:', toolArgs);

              // Send tool execution notification
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ type: 'tool_call', tool: toolName, args: toolArgs })}\n\n`
                )
              );

              // Execute tool
              const toolResult = await executeTool(
                { name: toolName, args: toolArgs },
                supabase,
                user.id,
                tenantId
              );

              console.log('🔧 Tool execution result:', {
                toolName,
                success: toolResult.success,
                error: toolResult.error,
                resultPreview: toolResult.result ? JSON.stringify(toolResult.result).slice(0, 300) : null
              });

              // Add tool call to messages
              messages.push({
                role: 'tool_call',
                tool: toolName,
                args: toolArgs,
                result: toolResult,
                timestamp: new Date().toISOString(),
              });

              // If tool succeeded, get AI's response with the result
              if (toolResult.success) {
                const toolResultContent = JSON.stringify(toolResult.result);
                console.log('📤 Sending tool result to OpenAI:', toolResultContent.slice(0, 500));

                const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                      { role: 'system', content: buildSystemPrompt(userName, userEmail, campaignerName || undefined, campaignerId || undefined) },
                      ...aiMessages,
                      { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: toolName, arguments: JSON.stringify(toolArgs) } }] },
                      { role: 'tool', tool_call_id: 'call_1', content: toolResultContent },
                    ],
                    stream: true,
                  }),
                });

                if (!followUpResponse.ok) {
                  console.error('❌ Follow-up OpenAI request failed:', followUpResponse.status, await followUpResponse.text());
                } else {
                  console.log('✅ Follow-up OpenAI request started successfully');
                }

                const followReader = followUpResponse.body!.getReader();
                let followBuffer = '';

                while (true) {
                  const { done: followDone, value: followValue } = await followReader.read();
                  if (followDone) break;

                  followBuffer += decoder.decode(followValue, { stream: true });
                  const followLines = followBuffer.split('\n');
                  followBuffer = followLines.pop() || '';

                  for (const followLine of followLines) {
                    if (!followLine.trim() || followLine.startsWith(':')) continue;
                    if (!followLine.startsWith('data: ')) continue;

                    const followData = followLine.slice(6);
                    if (followData === '[DONE]') continue;

                    try {
                      const followParsed = JSON.parse(followData);
                      const followContent = followParsed.choices?.[0]?.delta?.content;
                      if (followContent) {
                        assistantMessage += followContent;
                        controller.enqueue(
                          new TextEncoder().encode(
                            `data: ${JSON.stringify({ type: 'token', content: followContent })}\n\n`
                          )
                        );
                      }
                    } catch (e) {
                      // Ignore parse errors
                    }
                  }
                }
              } else {
                // Tool failed, inform user
                const errorMsg = `❌ שגיאה בביצוע הפעולה: ${toolResult.error}`;
                assistantMessage = errorMsg;
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({ type: 'token', content: errorMsg })}\n\n`
                  )
                );
              }
            }
          }

          // Add assistant message to history
          if (assistantMessage) {
            messages.push({
              role: 'assistant',
              content: assistantMessage,
              timestamp: new Date().toISOString(),
            });
          }

          // Save conversation
          const conversationTitle = conversation?.title || message.slice(0, 50);
          
          if (conversation_id && conversation) {
            await supabase
              .from('ai_conversations')
              .update({ messages, updated_at: new Date().toISOString() })
              .eq('id', conversation_id);
          } else {
            const { data: newConv } = await supabase
              .from('ai_conversations')
              .insert({
                user_id: user.id,
                tenant_id: tenantId,
                title: conversationTitle,
                messages,
              })
              .select()
              .single();

            if (newConv) {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ type: 'conversation_id', id: newConv.id })}\n\n`
                )
              );
            }
          }

          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          );
          controller.close();
        } catch (error: any) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error in ai-support-chat:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
