import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let sender_email, subject, text_body, recipient_email;
    let debugInfo: any = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const rawText = await req.text();
      const params = new URLSearchParams(rawText);
      sender_email = params.get("sender_email")?.trim();
      recipient_email = params.get("recipient_email")?.trim();
      subject = params.get("subject");
      text_body = params.get("text_body");
      debugInfo = { rawText, parsedKeys: Array.from(params.keys()) };
    } else {
      const payload = await req.json();
      sender_email = payload.sender_email?.trim();
      recipient_email = payload.recipient_email?.trim();
      subject = payload.subject;
      text_body = payload.text_body;
      debugInfo = { payload };
    }

    if (!sender_email) {
      return NextResponse.json({ error: "Missing sender_email", debug: debugInfo, contentType }, { status: 400 });
    }

    // Extract pure email address if formatted as "Name <email@domain.com>" or as a stringified JSON object
    let cleanEmail = sender_email.trim();
    if (cleanEmail.startsWith("{")) {
      try {
        const parsed = JSON.parse(cleanEmail);
        if (parsed.address) cleanEmail = parsed.address;
      } catch (e) {
        // ignore JSON parse error
      }
    } else {
      const emailMatch = sender_email.match(/<(.+)>/);
      if (emailMatch) cleanEmail = emailMatch[1].trim();
    }

    // Initialize admin client to bypass RLS for webhook processing
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find the contact by sender email (Inbound)
    let { data: contacts, error: contactError } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .ilike("email", cleanEmail);

    let direction = "inbound";

    if (contactError || !contacts || contacts.length === 0) {
      // If sender doesn't match, maybe this is an outbound email sent via Bcc to the webhook.
      // Check if recipient_email matches a contact.
      if (recipient_email) {
        let cleanRecipient = recipient_email.trim();
        if (cleanRecipient.startsWith("{")) {
          try {
            const parsed = JSON.parse(cleanRecipient);
            if (parsed.address) cleanRecipient = parsed.address;
          } catch (e) {}
        } else {
          const match = cleanRecipient.match(/<(.+)>/);
          if (match) cleanRecipient = match[1].trim();
        }

        const { data: recipientContacts, error: recipientError } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .ilike("email", cleanRecipient);

        if (!recipientError && recipientContacts && recipientContacts.length > 0) {
          contacts = recipientContacts;
          direction = "outbound";
        }
      }
    }

    if (contactError || !contacts || contacts.length === 0) {
      // Email not associated with any client, ignore or log
      return NextResponse.json({ message: "No matching contact found", searchedEmail: cleanEmail }, { status: 200 });
    }

    const contact = contacts[0];
    const fullName = `${contact.first_name} ${contact.last_name}`;

    // Insert the email into client_communications
    const { error: insertError } = await supabase.from("client_communications").insert({
      contact_id: contact.id,
      direction,
      sender_email: cleanEmail,
      subject: subject || "No Subject",
      body_text: text_body || "",
    });

    if (insertError) {
      console.error("Failed to insert communication", insertError);
      return NextResponse.json({ error: "Failed to save email" }, { status: 500 });
    }

    // Add to activity feed
    await supabase.from("activities").insert({
      type: direction === "inbound" ? "email_received" : "email_sent",
      contact_id: contact.id,
      contact_name: fullName,
      description: direction === "inbound" ? `Received email: "${subject || "No Subject"}"` : `Sent email: "${subject || "No Subject"}"`,
    });

    return NextResponse.json({ success: true, contact_id: contact.id });
  } catch (error: any) {
    console.error("Zoho Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
