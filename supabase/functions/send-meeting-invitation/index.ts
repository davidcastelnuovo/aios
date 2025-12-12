import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MeetingInvitationRequest {
  to_email: string;
  to_name: string;
  meeting_subject: string;
  meeting_date: string; // ISO date string
  meeting_time: string; // HH:MM format
  personal_message?: string;
  calendar_link?: string;
  organizer_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      to_email,
      to_name,
      meeting_subject,
      meeting_date,
      meeting_time,
      personal_message,
      calendar_link,
      organizer_name,
    }: MeetingInvitationRequest = await req.json();

    if (!to_email) {
      return new Response(
        JSON.stringify({ error: "Missing recipient email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format the date for display
    const dateObj = new Date(meeting_date);
    const formattedDate = dateObj.toLocaleDateString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📅 הוזמנת לפגישה!</h1>
          </div>
          
          <div style="padding: 30px;">
            <p style="font-size: 18px; color: #333; margin-bottom: 20px;">
              שלום ${to_name || 'לקוח יקר'},
            </p>
            
            <div style="background-color: #f0f9ff; border-right: 4px solid #3b82f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e40af; margin: 0 0 15px 0; font-size: 20px;">${meeting_subject}</h2>
              
              <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 16px; color: #4b5563;">
                  📆 <strong>תאריך:</strong> ${formattedDate}
                </span>
              </div>
              
              <div style="display: flex; align-items: center;">
                <span style="font-size: 16px; color: #4b5563;">
                  🕐 <strong>שעה:</strong> ${meeting_time}
                </span>
              </div>
            </div>
            
            ${personal_message ? `
              <div style="background-color: #fefce8; border-right: 4px solid #eab308; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #713f12; margin: 0; font-size: 14px;">
                  ${personal_message}
                </p>
              </div>
            ` : ''}
            
            ${calendar_link ? `
              <div style="text-align: center; margin-top: 25px;">
                <a href="${calendar_link}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  הוסף ליומן שלי
                </a>
              </div>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
            
            <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
              ${organizer_name ? `נשלח על ידי ${organizer_name}` : 'נשלח באמצעות Marketing Captain'}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log("Sending meeting invitation to:", to_email);

    const emailResponse = await resend.emails.send({
      from: "Marketing Captain <onboarding@resend.dev>",
      to: [to_email],
      subject: `📅 זימון לפגישה: ${meeting_subject}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending meeting invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
