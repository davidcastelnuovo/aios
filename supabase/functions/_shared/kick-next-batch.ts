/**
 * Queue the next cron batch in pg_net. A fire-and-forget fetch is cancelled when
 * the edge isolate returns, which dropped every batch after the first and left
 * later clients unsynced until somebody pressed sync by hand.
 */
type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ error: { message: string } | null }>;
};

export async function kickNextBatch(
  supabase: RpcClient,
  functionName: string,
  body: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.rpc("kick_internal_function", {
    p_function: functionName,
    p_body: body,
  });
  if (!error) return;

  console.error(
    `[kick] ${functionName} rpc failed, falling back to fetch:`,
    error.message,
  );
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const task = fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  }).catch((err) => console.error(`[kick] ${functionName} fetch failed:`, err));

  const runtime = (
    globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }
  ).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task);
  else
    await Promise.race([
      task,
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
}
