import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { contact_id, subject, body_text } = payload;

    if (!contact_id || !subject || !body_text) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Initialize admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch the contact's email
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .eq("id", contact_id)
      .single();

    if (contactError || !contact || !contact.email) {
      return NextResponse.json(
        { error: "Contact not found or missing email" },
        { status: 404 }
      );
    }

    const fullName = `${contact.first_name} ${contact.last_name}`;

    // Prepare HTML body (convert newlines to <br/>)
    const htmlBody = body_text.replace(/\n/g, "<br/>");

    // Send the email via our lib/email.ts
    const result = await sendEmail({
      to: { name: fullName, address: contact.email },
      subject,
      text: body_text,
      html: htmlBody,
    });

    if (!result.ok) {
      console.error("Email send failed:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      );
    }

    // Insert into client_communications
    const { error: insertError } = await supabase
      .from("client_communications")
      .insert({
        contact_id: contact.id,
        direction: "outbound",
        sender_email: process.env.EMAIL_FROM || process.env.ZOHO_SMTP_USER || "admin",
        subject,
        body_text,
      });

    if (insertError) {
      console.error("Failed to insert outbound communication", insertError);
      // We don't fail the request since email was sent successfully
    }

    // Add to activity feed
    await supabase.from("activities").insert({
      type: "email_sent",
      contact_id: contact.id,
      contact_name: fullName,
      description: `Sent email: "${subject}"`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Email API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
