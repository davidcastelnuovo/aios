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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json().catch(() => ({}))
    const jobTypes = body.job_types || null
    const maxJobs = Math.min(body.max_jobs || 10, 50) // Process up to 50 jobs per invocation

    const results: any[] = []

    for (let i = 0; i < maxJobs; i++) {
      // Atomically claim next job
      const { data: jobs, error: claimError } = await supabase
        .rpc('claim_next_job', { p_job_types: jobTypes })

      if (claimError) {
        console.error('Error claiming job:', claimError)
        break
      }

      if (!jobs || jobs.length === 0) {
        console.log(`No more jobs to process after ${i} jobs`)
        break
      }

      const job = jobs[0]
      console.log(`Processing job ${job.id} (type: ${job.job_type}, attempt: ${job.attempts}/${job.max_attempts})`)

      try {
        // Check circuit breaker for integration jobs
        if (job.job_type.startsWith('integration_')) {
          const provider = job.payload?.provider || job.job_type.replace('integration_', '')
          const { data: circuitOk } = await supabase.rpc('check_circuit_breaker', {
            p_tenant_id: job.tenant_id,
            p_provider: provider,
          })

          if (!circuitOk) {
            console.log(`Circuit breaker OPEN for ${provider}, re-queuing job ${job.id}`)
            await supabase.rpc('complete_job', { p_job_id: job.id, p_success: false, p_error: 'Circuit breaker open' })
            results.push({ job_id: job.id, status: 'circuit_open' })
            continue
          }
        }

        // Execute job based on type
        let success = false
        let error: string | null = null

        switch (job.job_type) {
          case 'automation': {
            // Forward to trigger-automation
            const res = await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify(job.payload),
            })
            const result = await res.json()
            success = res.ok && result.success !== false
            if (!success) error = result.error || `HTTP ${res.status}`
            break
          }

          case 'integration_manychat':
          case 'integration_greenapi':
          case 'integration_facebook': {
            // Forward to the appropriate edge function
            const functionName = job.payload?.function_name
            if (!functionName) {
              error = 'No function_name in payload'
              break
            }
            const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify(job.payload.data || {}),
            })
            success = res.ok
            if (!success) error = `HTTP ${res.status}: ${await res.text().catch(() => '')}`

            // Record integration result for circuit breaker
            const provider = job.job_type.replace('integration_', '')
            await supabase.rpc('record_integration_result', {
              p_tenant_id: job.tenant_id,
              p_provider: provider,
              p_success: success,
            })
            break
          }

          case 'heavy_import':
          case 'heavy_export':
          case 'heavy_sync': {
            const functionName = job.payload?.function_name
            if (!functionName) {
              error = 'No function_name in payload'
              break
            }
            const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify(job.payload.data || {}),
            })
            success = res.ok
            if (!success) error = `HTTP ${res.status}`
            break
          }

          default:
            error = `Unknown job type: ${job.job_type}`
        }

        // Complete the job
        await supabase.rpc('complete_job', {
          p_job_id: job.id,
          p_success: success,
          p_error: error,
        })

        results.push({ job_id: job.id, type: job.job_type, success, error })
      } catch (jobError: any) {
        console.error(`Error processing job ${job.id}:`, jobError)
        await supabase.rpc('complete_job', {
          p_job_id: job.id,
          p_success: false,
          p_error: jobError.message || 'Unknown error',
        })
        results.push({ job_id: job.id, type: job.job_type, success: false, error: jobError.message })
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in process-job-queue:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
