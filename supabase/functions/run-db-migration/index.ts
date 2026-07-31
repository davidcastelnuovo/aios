// Neutralized. Schema changes go through supabase/ops + apply-sql-migration.yml.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return new Response(
    JSON.stringify({
      success: true,
      neutralized: true,
      message: "run-db-migration is a no-op. Use apply-sql-migration.yml / SQL editor.",
    }),
    { status: 200, headers: cors },
  );
});
