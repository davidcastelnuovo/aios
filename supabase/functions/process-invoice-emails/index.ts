import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function refreshTokenIfNeeded(supabaseService: any, tokenData: any) {
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt > new Date(Date.now() + 60000)) return tokenData.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: tokenData.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();
  if (!tokens.access_token) throw new Error("Token refresh failed");

  const newExpires = new Date(Date.now() + tokens.expires_in * 1000);
  await supabaseService.from("gmail_tokens").update({
    access_token: tokens.access_token,
    expires_at: newExpires.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", tokenData.user_id);

  return tokens.access_token;
}

function parseEmailHeader(payload: any, headerName: string): string {
  return payload?.headers?.find((h: any) => h.name.toLowerCase() === headerName.toLowerCase())?.value || "";
}

// Find attachments recursively in MIME parts
function findAttachments(parts: any[], result: any[] = []): any[] {
  for (const part of parts || []) {
    if (part.filename && part.body?.attachmentId) {
      result.push({
        filename: part.filename,
        mimeType: part.mimeType,
        attachmentId: part.body.attachmentId,
        size: part.body.size || 0,
      });
    }
    if (part.parts) findAttachments(part.parts, result);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tokenData, error: tokenError } = await serviceClient
      .from("gmail_tokens").select("*").eq("user_id", user.id).single();
    if (tokenError || !tokenData) throw new Error("Gmail not connected");

    const accessToken = await refreshTokenIfNeeded(serviceClient, tokenData);
    const { messageIds, tenantId } = await req.json();

    if (!messageIds?.length || !tenantId) {
      throw new Error("Missing messageIds or tenantId");
    }

    // Get suppliers for matching
    const { data: suppliers } = await serviceClient
      .from("suppliers").select("id, name, email").eq("tenant_id", tenantId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const results: any[] = [];

    for (const messageId of messageIds) {
      try {
        // 1. Get full message with attachments
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msgData = await msgRes.json();
        if (!msgRes.ok) {
          results.push({ messageId, error: msgData.error?.message || "Failed to fetch message" });
          continue;
        }

        const from = parseEmailHeader(msgData.payload, "From");
        const subject = parseEmailHeader(msgData.payload, "Subject");
        const date = parseEmailHeader(msgData.payload, "Date");
        const fromEmail = from.match(/<([^>]+)>/)?.[1]?.toLowerCase() || from.toLowerCase();

        // 2. Find attachments (PDF, images)
        const attachments = findAttachments(msgData.payload?.parts || []);
        const invoiceAttachments = attachments.filter((a: any) =>
          /\.(pdf|png|jpg|jpeg|gif|webp|tiff|bmp)$/i.test(a.filename) ||
          a.mimeType.startsWith("image/") ||
          a.mimeType === "application/pdf"
        );

        if (invoiceAttachments.length === 0) {
          results.push({ messageId, subject, from, error: "no_attachments", skipped: true });
          continue;
        }

        // 3. Try to match supplier by email
        let matchedSupplier = suppliers?.find(s => 
          s.email && s.email.toLowerCase() === fromEmail
        ) || null;

        // 4. Process each attachment
        for (const att of invoiceAttachments) {
          try {
            // Download attachment
            const attRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${att.attachmentId}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const attData = await attRes.json();
            if (!attRes.ok || !attData.data) {
              results.push({ messageId, subject, from, filename: att.filename, error: "Failed to download attachment" });
              continue;
            }

            // Convert from URL-safe base64 to standard base64
            const base64Data = attData.data.replace(/-/g, "+").replace(/_/g, "/");

            // 5. Upload to storage
            const ext = att.filename.split(".").pop() || "pdf";
            const storagePath = `${tenantId}/gmail-invoices/${Date.now()}-${att.filename}`;
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

            const { error: uploadError } = await serviceClient.storage
              .from("supplier-invoices")
              .upload(storagePath, bytes, { contentType: att.mimeType });

            let fileUrl: string | null = null;
            if (!uploadError) {
              const { data: urlData } = serviceClient.storage.from("supplier-invoices").getPublicUrl(storagePath);
              fileUrl = urlData.publicUrl;
            }

            // 6. Extract invoice data with AI
            let invoiceName = subject || att.filename;
            let invoiceAmount = 0;
            let aiExtracted = false;

            if (LOVABLE_API_KEY && (att.mimeType.startsWith("image/") || att.mimeType === "application/pdf")) {
              try {
                const mediaType = att.mimeType === "application/pdf" ? "application/pdf" : att.mimeType;
                const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [
                      {
                        role: "system",
                        content: "You are an invoice data extraction assistant. Extract the invoice name/description, total amount, and supplier/vendor name from the provided invoice. The invoice may be in Hebrew or English. Always use the extract_invoice_data tool."
                      },
                      {
                        role: "user",
                        content: [
                          { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64Data}` } },
                          { type: "text", text: "Extract the invoice name/title, total amount, and supplier/vendor name from this invoice." }
                        ]
                      }
                    ],
                    tools: [{
                      type: "function",
                      function: {
                        name: "extract_invoice_data",
                        description: "Extract invoice data",
                        parameters: {
                          type: "object",
                          properties: {
                            invoice_name: { type: "string", description: "Invoice name/title/description" },
                            invoice_amount: { type: "number", description: "Total amount" },
                            supplier_name: { type: "string", description: "Supplier/vendor name" }
                          },
                          required: ["invoice_name", "invoice_amount"],
                          additionalProperties: false,
                        }
                      }
                    }],
                    tool_choice: { type: "function", function: { name: "extract_invoice_data" } }
                  }),
                });

                if (aiResponse.ok) {
                  const aiData = await aiResponse.json();
                  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
                  if (toolCall?.function?.arguments) {
                    const extracted = JSON.parse(toolCall.function.arguments);
                    if (extracted.invoice_name) invoiceName = extracted.invoice_name;
                    if (extracted.invoice_amount) invoiceAmount = extracted.invoice_amount;
                    aiExtracted = true;

                    // Try to match supplier by AI-extracted name if not already matched
                    if (!matchedSupplier && extracted.supplier_name && suppliers) {
                      const aiSupplierLower = extracted.supplier_name.toLowerCase();
                      matchedSupplier = suppliers.find(s =>
                        s.name.toLowerCase().includes(aiSupplierLower) ||
                        aiSupplierLower.includes(s.name.toLowerCase())
                      ) || null;
                    }
                  }
                }
              } catch (aiErr) {
                console.error("AI extraction error:", aiErr);
              }
            }

            // 7. Parse date from email
            let invoiceDate: string | null = null;
            try {
              const d = new Date(date);
              if (!isNaN(d.getTime())) {
                invoiceDate = d.toISOString().split("T")[0];
              }
            } catch {}

            const invoiceMonth = invoiceDate ? invoiceDate.substring(0, 7) : new Date().toISOString().substring(0, 7);

            results.push({
              messageId,
              subject,
              from,
              fromEmail,
              filename: att.filename,
              fileUrl,
              invoiceName,
              invoiceAmount,
              invoiceDate,
              invoiceMonth,
              aiExtracted,
              matchedSupplierId: matchedSupplier?.id || null,
              matchedSupplierName: matchedSupplier?.name || null,
            });
          } catch (attErr) {
            console.error("Attachment processing error:", attErr);
            results.push({ messageId, subject, from, filename: att.filename, error: String(attErr) });
          }
        }
      } catch (msgErr) {
        console.error("Message processing error:", msgErr);
        results.push({ messageId, error: String(msgErr) });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-invoice-emails error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
