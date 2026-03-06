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

    const { messageId, channelId, tenantId, messageContent, senderName, channelName, tenantSlug, targetOverride } = await req.json()

    if (!channelId || !tenantId || !messageContent) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = Deno.env.get('SITE_URL') || 'https://after-lead.lovable.app'
    const slug = tenantSlug || ''
    const chatLink = slug ? `${baseUrl}/t/${slug}/team-chat` : `${baseUrl}/team-chat`

    console.log(`🔔 Notify request for channel ${channelId} by user ${user.id}`)

    // Get channel-level notification_group_link
    const { data: channelData } = await supabaseAdmin
      .from('team_channels')
      .select('notification_group_link')
      .eq('id', channelId)
      .single()

    const channelGroupLink = channelData?.notification_group_link || null

    // Get channel members with notification settings (exclude sender)
    const { data: members, error: membersError } = await supabaseAdmin
      .from('team_channel_members')
      .select('user_id, notify_enabled, notify_override_phone, notify_override_group')
      .eq('channel_id', channelId)
      .neq('user_id', user.id)

    if (membersError || !members?.length) {
      console.log('No other members to notify')
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Filter out disabled members
    const enabledMembers = members.filter(m => m.notify_enabled !== false)
    if (enabledMembers.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0, reason: 'All members have notifications disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const memberUserIds = enabledMembers.map(m => m.user_id)

    // Get profiles
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, notification_group_link, campaigner_id')
      .in('id', memberUserIds)

    if (!profiles?.length) {
      return new Response(JSON.stringify({ success: true, notified: 0, reason: 'No profiles found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get campaigner phones as fallback
    const campaignerIds = profiles.filter(p => p.campaigner_id && !p.phone).map(p => p.campaigner_id!)
    let campaignerPhoneMap: Record<string, string> = {}
    if (campaignerIds.length > 0) {
      const { data: campaigners } = await supabaseAdmin
        .from('campaigners')
        .select('id, phone')
        .in('id', campaignerIds)
      if (campaigners) {
        campaigners.forEach(c => { if (c.phone) campaignerPhoneMap[c.id] = c.phone })
      }
    }

    // Build notification targets using priority logic:
    // 1. member notify_override_group → send to that group
    // 2. channel notification_group_link → send to channel group (deduplicated)
    // 3. member notify_override_phone → send to that phone
    // 4. profile notification_group_link → send to profile group
    // 5. profile phone / campaigner phone → send to phone
    const groupsToNotify = new Set<string>()
    const phonesToNotify: { phone: string; name: string }[] = []

    for (const member of enabledMembers) {
      const profile = profiles.find(p => p.id === member.user_id)
      if (!profile) continue

      // Priority 1: member-level group override
      if (member.notify_override_group) {
        groupsToNotify.add(member.notify_override_group)
        continue
      }

      // Priority 2: channel-level group
      if (channelGroupLink) {
        groupsToNotify.add(channelGroupLink)
        continue
      }

      // Priority 3: member-level phone override
      if (member.notify_override_phone) {
        phonesToNotify.push({ phone: member.notify_override_phone, name: profile.full_name || 'חבר צוות' })
        continue
      }

      // Priority 4: profile group
      if (profile.notification_group_link) {
        groupsToNotify.add(profile.notification_group_link)
        continue
      }

      // Priority 5: profile phone / campaigner phone
      const phone = profile.phone || (profile.campaigner_id ? campaignerPhoneMap[profile.campaigner_id] : null)
      if (phone) {
        phonesToNotify.push({ phone, name: profile.full_name || 'חבר צוות' })
      }
    }

    if (phonesToNotify.length === 0 && groupsToNotify.size === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0, reason: 'No phone numbers or groups found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`📱 Sending to ${phonesToNotify.length} phones + ${groupsToNotify.size} groups`)

    // Find Green API integration
    let integration: any = null
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
      return new Response(JSON.stringify({ error: 'Green API not configured.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const instanceId = integration.settings.instance_id
    const apiToken = integration.api_key
    const notificationMessage = `🔔 *התראה מצ'אט צוות*\n\n📢 *ערוץ:* ${channelName || 'ערוץ'}\n👤 *מאת:* ${senderName || 'חבר צוות'}\n\n💬 ${messageContent}\n\n🔗 ${chatLink}`

    let sentCount = 0
    const errors: string[] = []

    const sendGreenApi = async (chatId: string, label: string) => {
      try {
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
          console.log(`✅ Sent to ${label}`)
        } else {
          const errText = await response.text()
          console.error(`❌ Failed ${label}: ${errText}`)
          errors.push(`${label}: ${errText}`)
        }
      } catch (err) {
        console.error(`❌ Error ${label}:`, err)
        errors.push(`${label}: ${err.message}`)
      }
    }

    // If targetOverride is provided, skip normal priority logic and send only to specified target
    if (targetOverride) {
      console.log(`🎯 Target override: ${JSON.stringify(targetOverride)}`)
      
      if (targetOverride.type === 'group') {
        // Send to channel group link
        if (channelGroupLink) {
          let groupChatId = channelGroupLink.trim()
          if (!groupChatId.endsWith('@g.us')) {
            const match = groupChatId.match(/([0-9-]+@g\.us)/)
            if (match) {
              groupChatId = match[1]
            } else {
              const digits = groupChatId.replace(/[^0-9-]/g, '')
              if (digits) groupChatId = digits + '@g.us'
            }
          }
          await sendGreenApi(groupChatId, `קבוצה: ${groupChatId}`)
        } else {
          return new Response(JSON.stringify({ success: true, notified: 0, reason: 'אין קבוצה משויכת לערוץ' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } else if (targetOverride.type === 'contact' && targetOverride.phone) {
        let digits = targetOverride.phone.replace(/[^0-9]/g, '')
        if (digits.startsWith('00')) digits = digits.slice(2)
        if (digits.startsWith('0') && digits.length <= 10) digits = '972' + digits.slice(1)
        await sendGreenApi(digits + '@c.us', targetOverride.name || 'איש קשר')
      }

      return new Response(JSON.stringify({
        success: true,
        notified: sentCount,
        total: 1,
        errors: errors.length > 0 ? errors : undefined,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send to groups
    for (const groupLink of groupsToNotify) {
      let groupChatId = groupLink.trim()
      if (!groupChatId.endsWith('@g.us')) {
        const match = groupChatId.match(/([0-9-]+@g\.us)/)
        if (match) {
          groupChatId = match[1]
        } else {
          const digits = groupChatId.replace(/[^0-9-]/g, '')
          if (digits) groupChatId = digits + '@g.us'
        }
      }
      await sendGreenApi(groupChatId, `קבוצה: ${groupChatId}`)
    }

    // Send to individual phones
    for (const target of phonesToNotify) {
      let digits = target.phone.replace(/[^0-9]/g, '')
      if (digits.startsWith('00')) digits = digits.slice(2)
      if (digits.startsWith('0') && digits.length <= 10) digits = '972' + digits.slice(1)
      await sendGreenApi(digits + '@c.us', target.name)
    }

    const totalTargets = phonesToNotify.length + groupsToNotify.size
    console.log(`✅ Sent to ${sentCount}/${totalTargets} targets`)

    return new Response(JSON.stringify({
      success: true,
      notified: sentCount,
      total: totalTargets,
      groups: groupsToNotify.size,
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
