import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANUS_API_URL = 'https://api.manus.ai/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, tenantId, ...params } = body;

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenantId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Manus API key from tenant_integrations
    const { data: integration, error: intError } = await supabaseClient
      .from('tenant_integrations')
      .select('settings')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'manus')
      .eq('is_active', true)
      .maybeSingle();

    if (intError || !integration) {
      return new Response(JSON.stringify({ error: 'Manus integration not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = (integration.settings as any)?.api_key;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Manus API key not found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const manusHeaders = {
      'API_KEY': apiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    };

    let result: any;

    switch (action) {
      case 'create_task': {
        const { prompt, agentProfile, taskMode, connectors, attachments } = params;
        if (!prompt) {
          return new Response(JSON.stringify({ error: 'prompt is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const taskBody: any = {
          prompt,
          agentProfile: agentProfile || 'manus-1.6',
        };
        if (taskMode) taskBody.taskMode = taskMode;
        if (connectors) taskBody.connectors = connectors;
        if (attachments) taskBody.attachments = attachments;

        const res = await fetch(`${MANUS_API_URL}/tasks`, {
          method: 'POST',
          headers: manusHeaders,
          body: JSON.stringify(taskBody),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(`Manus API error [${res.status}]: ${JSON.stringify(data)}`);
        }

        // Save task to our DB
        const { error: insertError } = await supabaseClient
          .from('manus_tasks')
          .insert({
            tenant_id: tenantId,
            task_id: data.task_id,
            title: data.task_title || prompt.substring(0, 100),
            prompt,
            status: 'pending',
            task_url: data.task_url,
            share_url: data.share_url,
            created_by: user.id,
          });

        if (insertError) {
          console.error('Failed to save manus task:', insertError);
        }

        result = data;
        break;
      }

      case 'list_tasks': {
        const { status: taskStatus, limit, after } = params;
        const queryParams = new URLSearchParams();
        if (taskStatus) queryParams.set('status', taskStatus);
        if (limit) queryParams.set('limit', String(limit));
        if (after) queryParams.set('after', after);

        const res = await fetch(`${MANUS_API_URL}/tasks?${queryParams}`, {
          method: 'GET',
          headers: manusHeaders,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(`Manus API error [${res.status}]: ${JSON.stringify(data)}`);
        }

        result = data;
        break;
      }

      case 'get_task': {
        const { taskId } = params;
        if (!taskId) {
          return new Response(JSON.stringify({ error: 'taskId is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const res = await fetch(`${MANUS_API_URL}/tasks?query=${encodeURIComponent(taskId)}`, {
          method: 'GET',
          headers: manusHeaders,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(`Manus API error [${res.status}]: ${JSON.stringify(data)}`);
        }

        // Update local DB if we have results
        if (data?.data?.length > 0) {
          const task = data.data[0];
          await supabaseClient
            .from('manus_tasks')
            .update({
              status: task.status,
              output: task.output,
              credit_usage: task.credit_usage,
            })
            .eq('task_id', taskId)
            .eq('tenant_id', tenantId);
        }

        result = data;
        break;
      }

      case 'register_webhook': {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const webhookUrl = `${supabaseUrl}/functions/v1/manus-webhook`;

        const res = await fetch(`${MANUS_API_URL}/webhooks`, {
          method: 'POST',
          headers: manusHeaders,
          body: JSON.stringify({ webhook: { url: webhookUrl } }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(`Manus API error [${res.status}]: ${JSON.stringify(data)}`);
        }

        // Save webhook_id in integration settings
        const currentSettings = (integration.settings as any) || {};
        await supabaseClient
          .from('tenant_integrations')
          .update({
            settings: { ...currentSettings, webhook_id: data.webhook_id, webhook_url: webhookUrl },
          })
          .eq('tenant_id', tenantId)
          .eq('integration_type', 'manus');

        result = { ...data, webhook_url: webhookUrl };
        break;
      }

      case 'test_connection': {
        const res = await fetch(`${MANUS_API_URL}/tasks?limit=1`, {
          method: 'GET',
          headers: manusHeaders,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(`Connection test failed [${res.status}]: ${JSON.stringify(errorData)}`);
        }

        result = { success: true, message: 'Connection successful' };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Manus API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
