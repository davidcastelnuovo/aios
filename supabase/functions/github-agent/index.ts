import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GITHUB_API = "https://api.github.com";

interface AgentRequest {
  action: 'analyze_error' | 'fix_code' | 'check_permissions' | 'chat_support' | 'approve_action' | 'reject_action';
  tenant_id: string;
  // For chat_support
  message?: string;
  user_id?: string;
  conversation_id?: string;
  // For analyze_error / fix_code
  error?: string;
  file_path?: string;
  stack_trace?: string;
  // For approve/reject
  approval_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing environment variables');
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const request = await req.json() as AgentRequest;
    const { action, tenant_id } = request;

    if (!tenant_id) throw new Error('Missing tenant_id');

    // Get GitHub token for this tenant
    const githubToken = await getGithubToken(supabase, tenant_id);

    switch (action) {
      case 'chat_support':
        return await handleChatSupport(supabase, request, user.id, tenant_id, LOVABLE_API_KEY, githubToken);

      case 'analyze_error':
        return await handleAnalyzeError(supabase, request, user.id, tenant_id, LOVABLE_API_KEY, githubToken);

      case 'fix_code':
        return await handleFixCode(supabase, request, user.id, tenant_id, LOVABLE_API_KEY, githubToken);

      case 'check_permissions':
        return await handleCheckPermissions(supabase, request, user.id, tenant_id);

      case 'approve_action':
        return await handleApproval(supabase, request, user.id, tenant_id, githubToken, 'approved');

      case 'reject_action':
        return await handleApproval(supabase, request, user.id, tenant_id, githubToken, 'rejected');

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ==========================================
// Get GitHub token from secure storage
// ==========================================
async function getGithubToken(supabase: any, tenantId: string): Promise<string | null> {
  const { data } = await supabase
    .from('agent_credentials')
    .select('encrypted_value')
    .eq('tenant_id', tenantId)
    .eq('credential_type', 'github_token')
    .single();

  return data?.encrypted_value || null;
}

// ==========================================
// Chat Support - understands user requests
// ==========================================
async function handleChatSupport(
  supabase: any, request: AgentRequest, userId: string, tenantId: string,
  apiKey: string, githubToken: string | null
) {
  const { message, user_id: reportingUserId } = request;
  if (!message) throw new Error('Missing message');

  // Get user context
  const targetUserId = reportingUserId || userId;
  const userContext = await getUserContext(supabase, targetUserId, tenantId);

  const systemPrompt = `אתה סוכן תמיכה טכנית חכם של מערכת AfterLead - מערכת CRM לניהול לקוחות, לידים וסוכנויות.

## היכולות שלך:
1. **ניתוח בעיות** - כשמשתמש אומר "לא עובד", "אין לי גישה", "יש שגיאה" - אתה מבין את ההקשר
2. **בדיקת הרשאות** - אתה יכול לבדוק אם למשתמש יש הרשאות למודול מסוים
3. **תיקון קוד** - אם זה באג בקוד, אתה יכול להציע תיקון ולפתוח PR (דורש אישור)
4. **הבנת הקשר** - אם למשתמש אין גישה בכוונה (לפי ההרשאות) - זו לא תקלה

## פרטי המשתמש הנוכחי:
${JSON.stringify(userContext, null, 2)}

## כללים חשובים:
- אם זה נראה כמו באג בקוד → הצע תיקון, סמן כ-action_needed: "code_fix"
- אם למשתמש אין הרשאה בכוונה → הסבר שזה לפי ההגדרות, לא תקלה
- אם צריך שינוי הרשאות → סמן כ-action_needed: "permission_change" (דורש אישור אדמין)
- אם לא ברור → שאל שאלות הבהרה
- תמיד ענה בעברית

## פורמט תשובה (JSON):
{
  "response": "הטקסט שיוצג למשתמש",
  "action_needed": null | "code_fix" | "permission_change" | "config_change" | "escalate",
  "action_details": { ... } | null,
  "requires_approval": true/false,
  "severity": "low" | "medium" | "high"
}`;

  const aiResponse = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
    }),
  });

  if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content || '';

  // Try to parse JSON response
  let parsed;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: content, action_needed: null };
  } catch {
    parsed = { response: content, action_needed: null };
  }

  // If action needed and requires approval, add to queue
  if (parsed.action_needed && parsed.requires_approval) {
    await supabase.from('agent_approval_queue').insert({
      tenant_id: tenantId,
      requested_by: userId,
      action_type: parsed.action_needed,
      title: `${parsed.action_needed}: ${message.substring(0, 100)}`,
      description: parsed.response,
      context: { message, user_context: userContext, ai_analysis: parsed },
      proposed_changes: parsed.action_details,
      status: 'pending',
    });

    parsed.response += '\n\n⏳ הפעולה הועברה לתור אישורים. אדמין צריך לאשר לפני ביצוע.';
  }

  // Log the action
  await supabase.from('agent_action_log').insert({
    tenant_id: tenantId,
    action_type: 'chat_support',
    action_details: { message, response: parsed },
    status: parsed.action_needed ? 'pending_approval' : 'success',
    user_id: userId,
    conversation_id: request.conversation_id,
  });

  return new Response(
    JSON.stringify(parsed),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ==========================================
// Analyze Error
// ==========================================
async function handleAnalyzeError(
  supabase: any, request: AgentRequest, userId: string, tenantId: string,
  apiKey: string, githubToken: string | null
) {
  const { error: errorMsg, file_path, stack_trace } = request;
  if (!errorMsg) throw new Error('Missing error');

  // If we have GitHub token, try to read the file
  let fileContent = '';
  if (githubToken && file_path) {
    fileContent = await readGithubFile(githubToken, file_path);
  }

  const analysisPrompt = `Analyze this error from the AfterLead CRM system:

Error: ${errorMsg}
${stack_trace ? `Stack trace: ${stack_trace}` : ''}
${file_path ? `File: ${file_path}` : ''}
${fileContent ? `File content:\n${fileContent}` : ''}

Return JSON:
{
  "diagnosis": "explanation of the issue in Hebrew",
  "is_bug": true/false,
  "severity": "low"|"medium"|"high"|"critical",
  "suggested_fix": "description of fix" or null,
  "fix_code": "the corrected code" or null,
  "file_path": "path to fix" or null
}`;

  const aiResponse = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: 'You are an expert developer analyzing errors in a React + TypeScript + Supabase application.' },
        { role: 'user', content: analysisPrompt }
      ],
    }),
  });

  if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content || '';

  let analysis;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { diagnosis: content };
  } catch {
    analysis = { diagnosis: content };
  }

  // If it's a bug with a fix, add to approval queue
  if (analysis.is_bug && analysis.fix_code) {
    await supabase.from('agent_approval_queue').insert({
      tenant_id: tenantId,
      requested_by: userId,
      action_type: 'code_fix',
      title: `תיקון באג: ${errorMsg.substring(0, 100)}`,
      description: analysis.diagnosis,
      context: { error: errorMsg, stack_trace, file_path, analysis },
      proposed_changes: { file_path: analysis.file_path || file_path, new_code: analysis.fix_code },
      status: 'pending',
    });
  }

  // Log
  await supabase.from('agent_action_log').insert({
    tenant_id: tenantId,
    action_type: 'analyze_error',
    action_details: { error: errorMsg, file_path, analysis },
    status: analysis.is_bug ? 'pending_approval' : 'success',
    user_id: userId,
  });

  return new Response(
    JSON.stringify({ success: true, analysis }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ==========================================
// Fix Code - creates PR on GitHub
// ==========================================
async function handleFixCode(
  supabase: any, request: AgentRequest, userId: string, tenantId: string,
  apiKey: string, githubToken: string | null
) {
  if (!githubToken) {
    return new Response(
      JSON.stringify({ error: 'GitHub token not configured. Go to Agent Hub settings to add it.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // This is called after approval - get the approved action
  const { approval_id } = request;
  if (!approval_id) throw new Error('Missing approval_id');

  const { data: approval } = await supabase
    .from('agent_approval_queue')
    .select('*')
    .eq('id', approval_id)
    .eq('status', 'approved')
    .single();

  if (!approval) throw new Error('Approved action not found');

  const { file_path, new_code } = approval.proposed_changes;
  if (!file_path || !new_code) throw new Error('Missing fix details');

  // Get repo info from credentials metadata
  const { data: cred } = await supabase
    .from('agent_credentials')
    .select('metadata')
    .eq('tenant_id', tenantId)
    .eq('credential_type', 'github_token')
    .single();

  const repo = cred?.metadata?.repo || 'davidcastelnuovo/after-lead';
  const [owner, repoName] = repo.split('/');

  try {
    // 1. Get current file SHA
    const fileResp = await fetch(`${GITHUB_API}/repos/${owner}/${repoName}/contents/${file_path}`, {
      headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' },
    });

    if (!fileResp.ok) throw new Error(`Failed to read file: ${fileResp.status}`);
    const fileData = await fileResp.json();

    // 2. Create a new branch
    const branchName = `auto-fix/${Date.now()}`;
    const mainRef = await fetch(`${GITHUB_API}/repos/${owner}/${repoName}/git/ref/heads/main`, {
      headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' },
    });
    const mainData = await mainRef.json();

    await fetch(`${GITHUB_API}/repos/${owner}/${repoName}/git/refs`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainData.object.sha }),
    });

    // 3. Update file on new branch
    const encodedContent = btoa(unescape(encodeURIComponent(new_code)));
    await fetch(`${GITHUB_API}/repos/${owner}/${repoName}/contents/${file_path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: `Auto-fix: ${approval.title}`,
        content: encodedContent,
        sha: fileData.sha,
        branch: branchName,
      }),
    });

    // 4. Create PR
    const prResp = await fetch(`${GITHUB_API}/repos/${owner}/${repoName}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title: `🤖 Auto-fix: ${approval.title}`,
        body: `## תיקון אוטומטי\n\n${approval.description}\n\n---\n*נוצר אוטומטית על ידי סוכן AfterLead*`,
        head: branchName,
        base: 'main',
      }),
    });

    const prData = await prResp.json();

    // 5. Update approval status
    await supabase.from('agent_approval_queue').update({
      status: 'executed',
      executed_at: new Date().toISOString(),
      execution_result: { pr_url: prData.html_url, pr_number: prData.number, branch: branchName },
    }).eq('id', approval_id);

    // Log
    await supabase.from('agent_action_log').insert({
      tenant_id: tenantId,
      action_type: 'code_fix',
      action_details: { approval_id, pr_url: prData.html_url, file_path },
      status: 'success',
      user_id: userId,
    });

    return new Response(
      JSON.stringify({ success: true, pr_url: prData.html_url, pr_number: prData.number }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('GitHub error:', err);
    throw err;
  }
}

// ==========================================
// Check user permissions
// ==========================================
async function handleCheckPermissions(
  supabase: any, request: AgentRequest, userId: string, tenantId: string
) {
  const targetUserId = request.user_id || userId;
  const context = await getUserContext(supabase, targetUserId, tenantId);

  return new Response(
    JSON.stringify({ success: true, ...context }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ==========================================
// Handle approval/rejection
// ==========================================
async function handleApproval(
  supabase: any, request: AgentRequest, userId: string, tenantId: string,
  githubToken: string | null, status: 'approved' | 'rejected'
) {
  const { approval_id } = request;
  if (!approval_id) throw new Error('Missing approval_id');

  await supabase.from('agent_approval_queue').update({
    status,
    approved_by: userId,
    approved_at: new Date().toISOString(),
  }).eq('id', approval_id).eq('tenant_id', tenantId);

  // If approved and it's a code fix, execute it
  if (status === 'approved') {
    const { data: approval } = await supabase
      .from('agent_approval_queue')
      .select('*')
      .eq('id', approval_id)
      .single();

    if (approval?.action_type === 'code_fix' && githubToken) {
      // Trigger the fix
      return await handleFixCode(supabase, { ...request, action: 'fix_code' }, userId, tenantId, '', githubToken);
    }
  }

  return new Response(
    JSON.stringify({ success: true, status }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ==========================================
// Helpers
// ==========================================
async function getUserContext(supabase: any, userId: string, tenantId: string) {
  const [rolesResult, permissionsResult, profileResult] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId).eq('tenant_id', tenantId),
    supabase.from('user_permissions').select('module, can_access').eq('user_id', userId),
    supabase.from('profiles').select('display_name, email').eq('id', userId).single(),
  ]);

  return {
    user_id: userId,
    tenant_id: tenantId,
    display_name: profileResult.data?.display_name || 'Unknown',
    email: profileResult.data?.email || '',
    roles: (rolesResult.data || []).map((r: any) => r.role),
    permissions: (permissionsResult.data || []).reduce((acc: any, p: any) => {
      acc[p.module] = p.can_access;
      return acc;
    }, {}),
  };
}

async function readGithubFile(token: string, filePath: string): Promise<string> {
  try {
    const resp = await fetch(`${GITHUB_API}/repos/davidcastelnuovo/after-lead/contents/${filePath}`, {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!resp.ok) return '';
    const data = await resp.json();
    return atob(data.content);
  } catch {
    return '';
  }
}
