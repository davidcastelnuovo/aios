import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeadPayload {
  company_name?: string
  contact_name?: string
  email?: string
  phone?: string
  source?: string
  notes?: string
  monthly_budget?: number
  three_month_budget?: number
  products?: string
  industry?: string
  agency_id?: string
  manychat_subscriber_id?: string
  tag_name?: string
  tenant_slug?: string
  tenant_id?: string
}

// Normalize phone for comparison
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/[\s\-\(\)\.+]/g, '').replace(/^0/, '972');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔔 Webhook lead intake received')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse query parameters from URL
    const url = new URL(req.url)
    const queryTenantSlug = url.searchParams.get('tenant_slug')
    const queryTenantId = url.searchParams.get('tenant_id')
    const queryAgencyId = url.searchParams.get('agency_id')

    // Parse incoming data
    const rawBody = await req.json()
    console.log('📦 Received raw body:', JSON.stringify(rawBody, null, 2))
    if (queryTenantSlug || queryTenantId || queryAgencyId) {
      console.log('🔗 Query params - tenant_slug:', queryTenantSlug, 'tenant_id:', queryTenantId, 'agency_id:', queryAgencyId)
    }

    // ========== WIX FORM PARSER ==========
    // Wix sends data nested in data.submissions[] with {label, value} objects
    let payload: LeadPayload
    const wixSubmissions = rawBody?.data?.submissions
    if (wixSubmissions && Array.isArray(wixSubmissions)) {
      console.log('🔷 Detected Wix form format, parsing submissions...')
      const parsed: Record<string, string> = {}
      
      for (const sub of wixSubmissions) {
        const label = (sub.label || '').trim().toLowerCase()
        const value = (sub.value || '').trim()
        if (!value) continue

        // Map Hebrew and English Wix form labels to lead fields
        if (['שם מלא', 'full name', 'name', 'שם'].includes(label)) {
          parsed.contact_name = value
        } else if (['שם חברה', 'company name', 'company', 'חברה'].includes(label)) {
          parsed.company_name = value
        } else if (['כתובת אימייל', 'email', 'אימייל', 'מייל', 'דוא"ל'].includes(label)) {
          parsed.email = value
        } else if (['טלפון', 'phone', 'מספר טלפון', 'נייד', 'telephone'].includes(label)) {
          parsed.phone = value
        } else if (['הערות', 'notes', 'הודעה', 'message', 'תיאור'].includes(label)) {
          parsed.notes = (parsed.notes ? parsed.notes + '\n' : '') + value
        } else if (['תקציב', 'budget', 'תקציב חודשי', 'monthly budget'].includes(label)) {
          parsed.monthly_budget = value
        } else if (['תעשייה', 'industry', 'תחום'].includes(label)) {
          parsed.industry = value
        } else if (['מוצרים', 'products', 'שירותים', 'services'].includes(label)) {
          parsed.products = value
        } else {
          // Unknown fields go to notes
          console.log(`📝 Unmapped Wix field "${sub.label}": "${value}" → adding to notes`)
          parsed.notes = (parsed.notes ? parsed.notes + '\n' : '') + `${sub.label}: ${value}`
        }
      }

      // Also check Wix contact object for fallbacks
      const wixContact = rawBody?.data?.contact
      if (wixContact) {
        if (!parsed.contact_name && wixContact.name) {
          parsed.contact_name = [wixContact.name.first, wixContact.name.last].filter(Boolean).join(' ')
        }
        if (!parsed.email && wixContact.email) {
          parsed.email = wixContact.email
        }
      }

      // Add form name as source context
      const formName = rawBody?.data?.formName
      if (formName) {
        parsed.notes = (parsed.notes ? parsed.notes + '\n' : '') + `טופס: ${formName}`
      }

      console.log('✅ Parsed Wix data:', JSON.stringify(parsed, null, 2))

      payload = {
        company_name: parsed.company_name || parsed.contact_name || '',
        contact_name: parsed.contact_name || undefined,
        email: parsed.email || undefined,
        phone: parsed.phone || undefined,
        notes: parsed.notes || undefined,
        monthly_budget: parsed.monthly_budget ? Number(parsed.monthly_budget) || undefined : undefined,
        industry: parsed.industry || undefined,
        products: parsed.products || undefined,
        source: 'website',
        // Preserve any tenant/agency from body-level fields
        tenant_slug: rawBody.tenant_slug || undefined,
        tenant_id: rawBody.tenant_id || undefined,
        agency_id: rawBody.agency_id || undefined,
      }
    } else {
      // Standard flat JSON payload
      payload = rawBody as LeadPayload
    }
    // ========== END WIX FORM PARSER ==========

    // Merge: body takes priority, then query params
    let agencyId = payload.agency_id || queryAgencyId || undefined
    let tenantId: string | null = payload.tenant_id || queryTenantId || null
    const effectiveTenantSlug = payload.tenant_slug || queryTenantSlug || null
    
    // Resolve tenant from tenant_slug if provided
    if (!tenantId && effectiveTenantSlug) {
      console.log(`🔍 Resolving tenant from slug: "${effectiveTenantSlug}"`)
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', effectiveTenantSlug)
        .single()
      
      if (tenantError || !tenantData) {
        console.error('❌ Tenant not found for slug:', effectiveTenantSlug)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Tenant not found for slug: ${effectiveTenantSlug}`,
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      tenantId = tenantData.id
      console.log(`✅ Resolved tenant_id: ${tenantId}`)
    }

    // If agency_id is provided, use it and get tenant_id from it
    if (agencyId) {
      console.log(`🔑 Agency ID provided: ${agencyId}`)
      
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('tenant_id')
        .eq('id', agencyId)
        .single()
      
      if (agencyError) {
        console.error('❌ Error querying agency:', agencyError)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Agency not found',
            details: agencyError.message
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      tenantId = agency.tenant_id
      console.log(`✅ Found tenant_id from agency: ${tenantId}`)
    } 
    // If no agency_id but we have tenant_id, find the default or first agency
    else if (tenantId) {
      console.log(`🔍 Finding agency for tenant: ${tenantId}`)
      
      // First, try to find the default agency for this tenant
      const { data: defaultAgency, error: defaultError } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .eq('is_default', true)
        .limit(1)
        .maybeSingle()
      
      if (defaultError) {
        console.error('⚠️ Error querying default agency:', defaultError)
      }
      
      if (defaultAgency) {
        agencyId = defaultAgency.id
        console.log(`✅ Found default agency: ${defaultAgency.name} (${agencyId})`)
      } else {
        console.log('⚠️ No default agency found, trying first active agency...')
        
        // Fallback to first active agency in this tenant
        const { data: firstAgency, error: firstError } = await supabase
          .from('agencies')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        
        if (firstError) {
          console.error('❌ Error querying first agency:', firstError)
        }
        
        if (firstAgency) {
          agencyId = firstAgency.id
          console.log(`✅ Found first active agency: ${firstAgency.name} (${agencyId})`)
        } else {
          console.log('❌ No active agencies found for this tenant')
        }
      }
    } else {
      // No tenant identification provided
      console.error('❌ No tenant_slug, tenant_id, or agency_id provided')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing tenant identification. Please provide tenant_slug, tenant_id, or agency_id in the payload.',
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log(`📍 Final - agencyId: ${agencyId}, tenantId: ${tenantId}`)

    if (!agencyId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No active agency found for this tenant. Please create an agency first or mark one as default.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Map source into DB enum values (lead_source)
    // Allowed enum values: website, referral, social_media, paid_ads, cold_call, email_campaign, event, other
    const sourceMap: Record<string, string> = {
      // website
      'website': 'website',
      'site': 'website',
      'form': 'website',
      'contact_form': 'website',
      'אתר': 'website',
      'טופס': 'website',

      // referral
      'referral': 'referral',
      'recommendation': 'referral',
      'המלצה': 'referral',

      // social media
      'social': 'social_media',
      'social_media': 'social_media',
      'facebook': 'social_media',
      'instagram': 'social_media',
      'linkedin': 'social_media',
      'tiktok': 'social_media',
      'סושיאל': 'social_media',

      // paid ads
      'paid_ads': 'paid_ads',
      'ads': 'paid_ads',
      'google_ads': 'paid_ads',
      'facebook_ads': 'paid_ads',
      'ממומן': 'paid_ads',

      // cold call
      'cold_call': 'cold_call',
      'call': 'cold_call',
      'phone_call': 'cold_call',
      'שיחה': 'cold_call',

      // email campaign
      'email_campaign': 'email_campaign',
      'email': 'email_campaign',
      'newsletter': 'email_campaign',
      'דיוור': 'email_campaign',

      // event
      'event': 'event',
      'webinar': 'event',
      'conference': 'event',
      'כנס': 'event',

      // tooling / misc
      'make': 'other',
      'zapier': 'other',

      // messaging channels - now has dedicated enum value
      'whatsapp': 'whatsapp',
      'ווטסאפ': 'whatsapp',
    }

    const normalizedSource = payload.source?.toString().trim().toLowerCase() || ''
    const leadSource = normalizedSource ? (sourceMap[normalizedSource] || 'other') : 'other'

    // ========== DEDUPLICATION LOGIC ==========
    // Check for existing lead by phone or email
    const normalizedPhone = normalizePhone(payload.phone);
    const normalizedEmail = payload.email?.trim().toLowerCase() || null;
    
    let existingLead = null;
    
    if (normalizedPhone || normalizedEmail) {
      console.log(`🔍 Checking for existing lead - phone: ${normalizedPhone}, email: ${normalizedEmail}`);
      
      // First try to find by phone
      if (normalizedPhone) {
        // Build possible phone variants for DB-level filtering
        const phoneVariants = [
          payload.phone,                                    // original
          normalizedPhone,                                  // stripped
          normalizedPhone.replace(/^972/, '0'),             // local format
          '+' + normalizedPhone,                            // with +
          '+972' + normalizedPhone.replace(/^972/, ''),     // international
        ].filter(Boolean) as string[];
        const uniqueVariants = [...new Set(phoneVariants)];

        const { data: leadsByPhone } = await supabase
          .from('leads')
          .select('*')
          .eq('tenant_id', tenantId)
          .in('phone', uniqueVariants)
          .limit(1);
        
        existingLead = leadsByPhone?.[0] || null;

        // If not found by exact variants, do a broader but limited search
        if (!existingLead) {
          const { data: recentLeads } = await supabase
            .from('leads')
            .select('*')
            .eq('tenant_id', tenantId)
            .not('phone', 'is', null)
            .order('created_at', { ascending: false })
            .limit(500);
          existingLead = recentLeads?.find(l => normalizePhone(l.phone) === normalizedPhone) || null;
        }
        
        if (existingLead) {
          console.log(`📌 Found existing lead by phone: ${existingLead.id} (${existingLead.company_name})`);
        }
      }
      
      // If not found by phone, try email
      if (!existingLead && normalizedEmail) {
        const { data: leadByEmail } = await supabase
          .from('leads')
          .select('*')
          .eq('tenant_id', tenantId)
          .ilike('email', normalizedEmail)
          .limit(1)
          .maybeSingle();
        
        if (leadByEmail) {
          existingLead = leadByEmail;
          console.log(`📌 Found existing lead by email: ${existingLead.id} (${existingLead.company_name})`);
        }
      }
    }
    
    // If existing lead found - update with new info if available
    if (existingLead) {
      console.log(`🔄 Lead already exists, checking for new information to update...`);
      
      const updates: Record<string, any> = {};
      let hasUpdates = false;
      
      // Only update fields that are empty in existing lead but have values in payload
      if (!existingLead.contact_name && payload.contact_name) {
        updates.contact_name = payload.contact_name;
        hasUpdates = true;
      }
      if (!existingLead.email && payload.email) {
        updates.email = payload.email;
        hasUpdates = true;
      }
      if (!existingLead.phone && payload.phone) {
        updates.phone = payload.phone;
        hasUpdates = true;
      }
      if (!existingLead.monthly_budget && payload.monthly_budget) {
        updates.monthly_budget = payload.monthly_budget;
        hasUpdates = true;
      }
      if (!existingLead.three_month_budget && payload.three_month_budget) {
        updates.three_month_budget = payload.three_month_budget;
        hasUpdates = true;
      }
      if (!existingLead.products && payload.products) {
        updates.products = payload.products;
        hasUpdates = true;
      }
      if (!existingLead.industry && payload.industry) {
        updates.industry = payload.industry;
        hasUpdates = true;
      }
      if (!existingLead.manychat_subscriber_id && payload.manychat_subscriber_id) {
        updates.manychat_subscriber_id = payload.manychat_subscriber_id;
        hasUpdates = true;
      }
      
      // Append notes if there are new notes
      if (payload.notes && payload.notes.trim()) {
        const existingNotes = existingLead.notes || '';
        if (!existingNotes.includes(payload.notes.trim())) {
          updates.notes = existingNotes 
            ? `${existingNotes}\n\n[${new Date().toISOString()}] ${payload.notes.trim()}`
            : payload.notes.trim();
          hasUpdates = true;
        }
      }
      
      if (hasUpdates) {
        updates.updated_at = new Date().toISOString();
        
        const { error: updateError } = await supabase
          .from('leads')
          .update(updates)
          .eq('id', existingLead.id);
        
        if (updateError) {
          console.error('❌ Error updating existing lead:', updateError);
        } else {
          console.log(`✅ Updated existing lead with new info:`, Object.keys(updates));
        }
      } else {
        console.log(`ℹ️ No new information to add, ignoring duplicate lead`);
      }
      
      // Handle tag_name for existing lead
      if (payload.tag_name && tenantId) {
        try {
          const tagName = payload.tag_name.trim();
          console.log(`🏷️ Processing tag_name for existing lead: "${tagName}"`);
          
          const { data: existingTag } = await supabase
            .from('chat_tags')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('name', tagName)
            .maybeSingle();
          
          let tagId = existingTag?.id;
          
          if (!tagId) {
            const { data: newTag } = await supabase
              .from('chat_tags')
              .insert({
                tenant_id: tenantId,
                name: tagName,
                color: '#3b82f6'
              })
              .select('id')
              .single();
            tagId = newTag?.id;
          }
          
          if (tagId) {
            // Check if tag already applied
            const { data: existingTagLink } = await supabase
              .from('chat_contact_tags')
              .select('id')
              .eq('lead_id', existingLead.id)
              .eq('tag_id', tagId)
              .maybeSingle();
            
            if (!existingTagLink) {
              await supabase
                .from('chat_contact_tags')
                .insert({
                  tenant_id: tenantId,
                  tag_id: tagId,
                  lead_id: existingLead.id,
                  user_id: '00000000-0000-0000-0000-000000000000'
                });
              console.log(`✅ New tag applied to existing lead`);
            }
          }
        } catch (tagError) {
          console.error('⚠️ Error processing tag for existing lead:', tagError);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          lead_id: existingLead.id,
          message: hasUpdates ? 'Existing lead updated with new information' : 'Lead already exists, no new information',
          duplicate: true,
          updated: hasUpdates
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    // ========== END DEDUPLICATION LOGIC ==========

    // Insert new lead - all fields optional
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        company_name: payload.company_name || '',
        contact_name: payload.contact_name || null,
        email: payload.email || null,
        phone: payload.phone || null,
        source: leadSource,
        notes: payload.notes || null,
        monthly_budget: payload.monthly_budget || null,
        three_month_budget: payload.three_month_budget || null,
        products: payload.products || null,
        industry: payload.industry || null,
        agency_id: agencyId,
        tenant_id: tenantId,
        manychat_subscriber_id: payload.manychat_subscriber_id || null,
        status: 'new'
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error inserting lead:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create lead',
          details: error.message,
          code: error.code
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Lead created successfully:', lead.id)

    // Handle tag_name - find or create tag and apply it
    if (payload.tag_name && tenantId) {
      try {
        const tagName = payload.tag_name.trim()
        console.log(`🏷️ Processing tag_name: "${tagName}"`)
        
        // Check if tag exists
        const { data: existingTag, error: tagQueryError } = await supabase
          .from('chat_tags')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', tagName)
          .maybeSingle()
        
        if (tagQueryError) {
          console.error('⚠️ Error querying existing tag:', tagQueryError)
        } else {
          let tagId = existingTag?.id
          
          // Create tag if it doesn't exist
          if (!tagId) {
            console.log(`🆕 Creating new tag: "${tagName}"`)
            const { data: newTag, error: createTagError } = await supabase
              .from('chat_tags')
              .insert({
                tenant_id: tenantId,
                name: tagName,
                color: '#3b82f6' // default blue color
              })
              .select('id')
              .single()
            
            if (createTagError) {
              console.error('⚠️ Error creating tag:', createTagError)
            } else {
              tagId = newTag.id
              console.log(`✅ Tag created with id: ${tagId}`)
            }
          } else {
            console.log(`✅ Found existing tag with id: ${tagId}`)
          }
          
          // Apply tag to lead
          if (tagId) {
            const { error: applyTagError } = await supabase
              .from('chat_contact_tags')
              .insert({
                tenant_id: tenantId,
                tag_id: tagId,
                lead_id: lead.id,
                user_id: '00000000-0000-0000-0000-000000000000' // system user placeholder
              })
            
            if (applyTagError) {
              console.error('⚠️ Error applying tag to lead:', applyTagError)
            } else {
              console.log(`✅ Tag applied to lead ${lead.id}`)
            }
          }
        }
      } catch (tagError) {
        console.error('⚠️ Error processing tag:', tagError)
      }
    }

    // Trigger lead_created automation
    if (tenantId) {
      try {
        const automationResponse = await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            trigger_type: 'lead_created',
            data: {
              id: lead.id,
              lead_id: lead.id,
              company_name: lead.company_name,
              contact_name: lead.contact_name,
              phone: lead.phone,
              email: lead.email,
              status: lead.status,
              source: lead.source,
              agency_id: lead.agency_id,
            },
            tenant_id: tenantId,
          }),
        });
        
        if (automationResponse.ok) {
          console.log('✅ lead_created automation triggered successfully');
        } else {
          console.error('⚠️ Failed to trigger automation:', await automationResponse.text());
        }
      } catch (automationError) {
        console.error('⚠️ Error triggering lead_created automation:', automationError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead_id: lead.id,
        message: 'Lead created successfully',
        duplicate: false
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 Webhook error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stack: errorStack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})