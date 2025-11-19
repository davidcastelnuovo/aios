import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

interface RequestBody {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: RequestBody = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Processing temporary password request for:", email);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if user exists
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error fetching users:", userError);
      throw new Error("Failed to fetch user data");
    }

    const user = userData.users.find(u => u.email === email);

    if (!user) {
      console.log("User not found:", email);
      // Return success even if user doesn't exist (security best practice)
      return new Response(
        JSON.stringify({ success: true, message: "If the email exists, a temporary password has been sent." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();
    console.log("Generated temporary password for user:", user.id);

    // Update user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: temporaryPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      throw new Error("Failed to update password");
    }

    // Send email with temporary password
    const emailResponse = await resend.emails.send({
      from: "Marketing Captain <onboarding@resend.dev>",
      to: [email],
      subject: "הסיסמה הזמנית שלך - Marketing Captain",
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">שלום,</h1>
          <p style="font-size: 16px; color: #555;">
            קיבלנו בקשה לאיפוס הסיסמה שלך במערכת Marketing Captain.
          </p>
          <p style="font-size: 16px; color: #555;">
            הסיסמה הזמנית שלך היא:
          </p>
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <code style="font-size: 24px; font-weight: bold; color: #2563eb; letter-spacing: 2px;">
              ${temporaryPassword}
            </code>
          </div>
          <p style="font-size: 14px; color: #888;">
            <strong>חשוב:</strong> מומלץ להחליף סיסמה זו מיד לאחר ההתחברות דרך "האזור האישי" &gt; "שינוי סיסמה".
          </p>
          <p style="font-size: 14px; color: #888;">
            אם לא ביקשת לאפס את הסיסמה, אנא התעלם ממייל זה או פנה לתמיכה.
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">
            Marketing Captain - מערכת ניהול סוכנויות שיווק
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "סיסמה זמנית נשלחה למייל שלך" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-temporary-password function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "שגיאה בשליחת סיסמה זמנית" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
