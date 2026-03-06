import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    )

    // Use service role for cross-user queries
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { messageId, channelId, tenantId, messageContent, senderName, channelName, tenantSlug } = await req.json()

    if (!channelId || !tenantId || !messageContent) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build direct link to team chat
    const baseUrl = Deno.env.get('SITE_URL') || 'https://after-lead.lovable.app'
    const slug = tenantSlug || ''
    const chatLink = slug ? `${baseUrl}/t/${slug}/team-chat` : `${baseUrl}/team-chat`

    console.log(`🔔 Notify request for channel ${channelId} by user ${user.id}`)

    // Get channel members (exclude the sender)
    const { data: members, error: membersError } = await supabaseAdmin
      .from('team_channel_members')
      .select('user_id')
      .eq('channel_id', channelId)
      .neq('user_id', user.id)

    if (membersError || !members?.length) {
      console.log('No other members to notify')
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const memberUserIds = members.map(m => m.user_id)
    console.log(`📋 Found ${memberUserIds.length} members to notify`)

    // Get profiles with campaigner_id for these users
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, campaigner_id')
      .in('id', memberUserIds)

    if (!profiles?.length) {
      return new Response(JSON.stringify({ success: true, notified: 0, reason: 'No profiles found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get campaigner phone numbers
    const campaignerIds = profiles
      .filter(p => p.campaigner_id)
      .map(p => p.campaigner_id!)

    let phoneMap: Record<string, string> = {} // campaigner_id -> phone

    if (campaignerIds.length > 0) {
      const { data: campaigners } = await supabaseAdmin
        .from('campaigners')
        .select('id, phone')
        .in('id', campaignerIds)

      if (campaigners) {
        campaigners.forEach(c => {
          if (c.phone) {
            phoneMap[c.id] = c.phone
          }
        })
      }
    }

    // Build list of phones to notify
    const phonesToNotify: { phone: string; name: string }[] = []
    for (const profile of profiles) {
      if (profile.campaigner_id && phoneMap[profile.campaigner_id]) {
        phonesToNotify.push({
          phone: phoneMap[profile.campaigner_id],
          name: profile.full_name || 'חבר צוות',
        })
      }
    }

    if (phonesToNotify.length === 0) {
      console.log('No phone numbers found for members')
      return new Response(JSON.stringify({ success: true, notified: 0, reason: 'No phone numbers found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`📱 Sending notifications to ${phonesToNotify.length} phones`)

    // Find any active Green API integration for this tenant (prefer the sender's)
    let integration: any = null

    // First try sender's integration
    const { data: senderIntegration } = await supabaseAdmin
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('integration_type', 'green_api')
      .eq('is_active', true)
      .maybeSingle()

    if (senderIntegration?.api_key && senderIntegration?.settings?.instance_id) {
      integration = senderIntegration
    } else {
      // Fallback: any active Green API integration for this tenant
      const { data: anyIntegration } = await supabaseAdmin
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'green_api')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (anyIntegration?.api_key && anyIntegration?.settings?.instance_id) {
        integration = anyIntegration
      }
    }

    if (!integration) {
      console.error('No Green API integration found for tenant')
      return new Response(JSON.stringify({ error: 'Green API not configured. Please set up a WhatsApp integration.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const instanceId = integration.settings.instance_id
    const apiToken = integration.api_key

    // Format notification message
    const notificationMessage = `🔔 *התראה מצ'אט צוות*\n\n📢 *ערוץ:* ${channelName || 'ערוץ'}\n👤 *מאת:* ${senderName || 'חבר צוות'}\n\n💬 ${messageContent}\n\n🔗 ${chatLink}`

    let sentCount = 0
    const errors: string[] = []

    for (const target of phonesToNotify) {
      try {
        // Normalize phone
        let digits = target.phone.replace(/[^0-9]/g, '')
        if (digits.startsWith('00')) digits = digits.slice(2)
        if (digits.startsWith('0') && digits.length <= 10) digits = '972' + digits.slice(1)
        const chatId = digits + '@c.us'

        console.log(`📤 Sending to ${target.name} (${chatId})`)

        const response = await fetch(
          `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, message: notificationMessage }),
          }
        )

        if (response.ok) {
          sentCount++
          console.log(`✅ Sent to ${target.name}`)
        } else {
          const errText = await response.text()
          console.error(`❌ Failed to send to ${target.name}: ${errText}`)
          errors.push(`${target.name}: ${errText}`)
        }
      } catch (err) {
        console.error(`❌ Error sending to ${target.name}:`, err)
        errors.push(`${target.name}: ${err.message}`)
      }
    }

    console.log(`✅ Notification sent to ${sentCount}/${phonesToNotify.length} members`)

    return new Response(JSON.stringify({
      success: true,
      notified: sentCount,
      total: phonesToNotify.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('❌ Unexpected error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
