import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const unifiedApiKey = Deno.env.get('UNIFIED_API_KEY');
    if (!unifiedApiKey) {
      return new Response(JSON.stringify({ error: 'UNIFIED_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, tenant_id, connection_id: explicit_connection_id, target_user_id } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the unified calendar connection for this tenant
    let connectionId = explicit_connection_id;
    if (!connectionId) {
      const { data: integrations, error: intError } = await supabase
        .from('tenant_integrations')
        .select('settings')
        .eq('tenant_id', tenant_id)
        .eq('integration_type', 'unified_calendar')
        .limit(1);

      if (intError) {
        console.error('Error fetching calendar integration:', intError);
      }

      if (integrations && integrations.length > 0) {
        const settings = integrations[0].settings as Record<string, unknown>;
        connectionId = settings?.unified_connection_id as string;
      }

      if (!connectionId) {
        return new Response(JSON.stringify({ 
          error: 'Calendar not connected', 
          needsSetup: true,
          message: 'אין חיבור יומן דרך Unified.to. יש להגדיר חיבור בהגדרות אינטגרציות.' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const baseUrl = `https://api.unified.to/unified/calendar/${connectionId}`;
    const unifiedHeaders = {
      'Authorization': `Bearer ${unifiedApiKey}`,
      'Content-Type': 'application/json',
    };

    switch (action) {
      case 'list_events': {
        const { timeMin, timeMax } = body;
        const url = new URL(`${baseUrl}/event`);
        if (timeMin) url.searchParams.append('updated_gte', timeMin);
        // Unified.to uses query params for filtering
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: unifiedHeaders,
        });

        const events = await response.json();

        if (!response.ok) {
          console.error('Unified.to calendar list error:', events);
          throw new Error(events?.message || 'Failed to fetch calendar events');
        }

        // Transform Unified.to event format to match our existing format
        const transformedEvents = (Array.isArray(events) ? events : []).map((event: any) => ({
          id: event.id,
          summary: event.title || event.subject || 'ללא כותרת',
          description: event.description || event.notes || '',
          start: {
            dateTime: event.start_at || event.start,
            timeZone: event.timezone || 'Asia/Jerusalem',
          },
          end: {
            dateTime: event.end_at || event.end,
            timeZone: event.timezone || 'Asia/Jerusalem',
          },
          calendarId: event.calendar_id,
          calendarName: event.calendar_id ? 'Unified Calendar' : undefined,
          calendarColor: '#4285f4',
        }));

        return new Response(JSON.stringify({
          success: true,
          events: transformedEvents,
          calendars: [],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create_event': {
        const { summary, description, start, end, attendees } = body;

        if (!summary || !start) {
          throw new Error('Missing required fields: summary and start');
        }

        const eventBody: Record<string, unknown> = {
          title: summary,
          description: description || '',
          start_at: start,
          end_at: end || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString(),
          timezone: 'Asia/Jerusalem',
        };

        if (attendees && Array.isArray(attendees) && attendees.length > 0) {
          eventBody.attendees = attendees.map((email: string) => ({ email }));
        }

        const response = await fetch(`${baseUrl}/event`, {
          method: 'POST',
          headers: unifiedHeaders,
          body: JSON.stringify(eventBody),
        });

        const eventData = await response.json();

        if (!response.ok) {
          console.error('Unified.to create event error:', eventData);
          throw new Error(eventData?.message || 'Failed to create event');
        }

        return new Response(JSON.stringify({
          success: true,
          eventId: eventData.id,
          htmlLink: eventData.web_url || null,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_event': {
        const { eventId, summary, description, start, end } = body;

        if (!eventId) {
          throw new Error('Missing required field: eventId');
        }

        const updateBody: Record<string, unknown> = {};
        if (summary !== undefined) updateBody.title = summary;
        if (description !== undefined) updateBody.description = description;
        if (start) updateBody.start_at = start;
        if (end) updateBody.end_at = end;
        updateBody.timezone = 'Asia/Jerusalem';

        const response = await fetch(`${baseUrl}/event/${eventId}`, {
          method: 'PUT',
          headers: unifiedHeaders,
          body: JSON.stringify(updateBody),
        });

        const eventData = await response.json();

        if (!response.ok) {
          console.error('Unified.to update event error:', eventData);
          throw new Error(eventData?.message || 'Failed to update event');
        }

        return new Response(JSON.stringify({
          success: true,
          eventId: eventData.id,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete_event': {
        const { eventId } = body;

        if (!eventId) {
          throw new Error('Missing required field: eventId');
        }

        const response = await fetch(`${baseUrl}/event/${eventId}`, {
          method: 'DELETE',
          headers: unifiedHeaders,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Unified.to delete event error:', errorData);
          throw new Error(errorData?.message || 'Failed to delete event');
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'check_connection': {
        // Simply check if we have a valid connection
        return new Response(JSON.stringify({
          connected: true,
          connection_id: connectionId,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('unified-calendar-proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
