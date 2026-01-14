import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DuplicateGroup {
  normalized_phone: string;
  leads: LeadInfo[];
}

interface LeadInfo {
  id: string;
  company_name: string;
  status: string;
  response_status: string | null;
  created_at: string;
  updated_at: string;
  updates_count: number;
  tasks_count: number;
  messages_count: number;
  tags_count: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { tenant_id, dry_run = true } = await req.json();

    if (!tenant_id) {
      throw new Error("tenant_id is required");
    }

    console.log(`Starting duplicate merge for tenant: ${tenant_id}, dry_run: ${dry_run}`);

    // Step 1: Find all duplicate phone groups
    const { data: duplicatePhones, error: dupError } = await supabase.rpc('get_duplicate_lead_phones', {
      p_tenant_id: tenant_id
    });

    if (dupError) {
      // If RPC doesn't exist, do it manually
      console.log("RPC not found, running manual query...");
    }

    // Manual query to find duplicates
    const { data: allLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, company_name, phone, status, response_status, created_at, updated_at')
      .eq('tenant_id', tenant_id)
      .not('phone', 'is', null)
      .neq('phone', '');

    if (leadsError) throw leadsError;

    // Normalize phones and group duplicates
    const phoneGroups: Map<string, any[]> = new Map();
    
    for (const lead of allLeads || []) {
      const normalized = lead.phone?.replace(/[^0-9]/g, '') || '';
      if (normalized.length >= 9 && normalized.length <= 15) {
        if (!phoneGroups.has(normalized)) {
          phoneGroups.set(normalized, []);
        }
        phoneGroups.get(normalized)!.push(lead);
      }
    }

    // Filter to only groups with duplicates
    const duplicateGroups: DuplicateGroup[] = [];
    
    for (const [phone, leads] of phoneGroups) {
      if (leads.length > 1) {
        // Get additional info for each lead
        const enrichedLeads: LeadInfo[] = [];
        
        for (const lead of leads) {
          const [updatesRes, tasksRes, messagesRes, tagsRes] = await Promise.all([
            supabase.from('lead_updates').select('id', { count: 'exact', head: true }).eq('lead_id', lead.id),
            supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('lead_id', lead.id),
            supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('lead_id', lead.id),
            supabase.from('chat_contact_tags').select('id', { count: 'exact', head: true }).eq('lead_id', lead.id),
          ]);

          enrichedLeads.push({
            id: lead.id,
            company_name: lead.company_name,
            status: lead.status,
            response_status: lead.response_status,
            created_at: lead.created_at,
            updated_at: lead.updated_at,
            updates_count: updatesRes.count || 0,
            tasks_count: tasksRes.count || 0,
            messages_count: messagesRes.count || 0,
            tags_count: tagsRes.count || 0,
          });
        }

        duplicateGroups.push({
          normalized_phone: phone,
          leads: enrichedLeads,
        });
      }
    }

    console.log(`Found ${duplicateGroups.length} duplicate groups`);

    const results = {
      groups_processed: 0,
      leads_deleted: 0,
      tags_transferred: 0,
      updates_transferred: 0,
      tasks_transferred: 0,
      messages_transferred: 0,
      statuses_updated: 0,
      details: [] as any[],
    };

    // Process each duplicate group
    for (const group of duplicateGroups) {
      console.log(`Processing group: ${group.normalized_phone} with ${group.leads.length} leads`);

      // Sort leads to find master:
      // 1. Has updates/tasks/messages (more is better)
      // 2. Has specific status (not default)
      // 3. Has more tags
      // 4. Is oldest
      const sortedLeads = [...group.leads].sort((a, b) => {
        // Total activity score
        const aActivity = a.updates_count + a.tasks_count + a.messages_count;
        const bActivity = b.updates_count + b.tasks_count + b.messages_count;
        if (aActivity !== bActivity) return bActivity - aActivity;

        // Has specific response status
        const aHasStatus = a.response_status && !a.response_status.startsWith('custom_') ? 1 : 0;
        const bHasStatus = b.response_status && !b.response_status.startsWith('custom_') ? 1 : 0;
        if (aHasStatus !== bHasStatus) return bHasStatus - aHasStatus;

        // More tags
        if (a.tags_count !== b.tags_count) return b.tags_count - a.tags_count;

        // Oldest
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const master = sortedLeads[0];
      const duplicates = sortedLeads.slice(1);
      const duplicateIds = duplicates.map(d => d.id);

      const groupResult = {
        phone: group.normalized_phone,
        master_id: master.id,
        master_name: master.company_name,
        duplicates_to_delete: duplicateIds,
        actions: [] as string[],
      };

      if (!dry_run) {
        // Transfer tags from duplicates to master (avoid duplicates)
        for (const dupId of duplicateIds) {
          const { data: dupTags } = await supabase
            .from('chat_contact_tags')
            .select('tag_id, tenant_id, user_id')
            .eq('lead_id', dupId);

          if (dupTags && dupTags.length > 0) {
            // Get existing master tags
            const { data: masterTags } = await supabase
              .from('chat_contact_tags')
              .select('tag_id')
              .eq('lead_id', master.id);

            const existingTagIds = new Set((masterTags || []).map(t => t.tag_id));

            for (const tag of dupTags) {
              if (!existingTagIds.has(tag.tag_id)) {
                const { error: insertError } = await supabase
                  .from('chat_contact_tags')
                  .insert({
                    tag_id: tag.tag_id,
                    lead_id: master.id,
                    tenant_id: tag.tenant_id,
                    user_id: tag.user_id,
                  });

                if (!insertError) {
                  results.tags_transferred++;
                  groupResult.actions.push(`Transferred tag ${tag.tag_id} to master`);
                }
              }
            }

            // Delete original tags from duplicate
            await supabase.from('chat_contact_tags').delete().eq('lead_id', dupId);
          }
        }

        // Transfer lead_updates
        const { data: updatesToTransfer } = await supabase
          .from('lead_updates')
          .update({ lead_id: master.id })
          .in('lead_id', duplicateIds)
          .select();

        if (updatesToTransfer) {
          results.updates_transferred += updatesToTransfer.length;
          groupResult.actions.push(`Transferred ${updatesToTransfer.length} updates`);
        }

        // Transfer tasks
        const { data: tasksToTransfer } = await supabase
          .from('tasks')
          .update({ lead_id: master.id })
          .in('lead_id', duplicateIds)
          .select();

        if (tasksToTransfer) {
          results.tasks_transferred += tasksToTransfer.length;
          groupResult.actions.push(`Transferred ${tasksToTransfer.length} tasks`);
        }

        // Transfer chat_messages
        const { data: messagesToTransfer } = await supabase
          .from('chat_messages')
          .update({ lead_id: master.id })
          .in('lead_id', duplicateIds)
          .select();

        if (messagesToTransfer) {
          results.messages_transferred += messagesToTransfer.length;
          groupResult.actions.push(`Transferred ${messagesToTransfer.length} messages`);
        }

        // Update master status if needed
        const bestStatus = duplicates.find(d => d.response_status && !d.response_status.startsWith('custom_'));
        if (bestStatus && (!master.response_status || master.response_status.startsWith('custom_'))) {
          await supabase
            .from('leads')
            .update({ response_status: bestStatus.response_status })
            .eq('id', master.id);

          results.statuses_updated++;
          groupResult.actions.push(`Updated status to ${bestStatus.response_status}`);
        }

        // Update master company_name if duplicate has a longer/better name
        const bestName = duplicates.find(d => d.company_name && d.company_name.length > (master.company_name?.length || 0));
        if (bestName) {
          await supabase
            .from('leads')
            .update({ company_name: bestName.company_name })
            .eq('id', master.id);

          groupResult.actions.push(`Updated company name to ${bestName.company_name}`);
        }

        // Delete duplicates
        const { error: deleteError } = await supabase
          .from('leads')
          .delete()
          .in('id', duplicateIds);

        if (deleteError) {
          console.error(`Error deleting duplicates for ${group.normalized_phone}:`, deleteError);
          groupResult.actions.push(`Error deleting: ${deleteError.message}`);
        } else {
          results.leads_deleted += duplicateIds.length;
          groupResult.actions.push(`Deleted ${duplicateIds.length} duplicate leads`);
        }
      } else {
        groupResult.actions.push('DRY RUN - no changes made');
      }

      results.groups_processed++;
      results.details.push(groupResult);
    }

    console.log(`Merge complete. Processed ${results.groups_processed} groups, deleted ${results.leads_deleted} leads`);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in merge-duplicate-leads:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
