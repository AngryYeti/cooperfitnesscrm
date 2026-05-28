"use server";

import { createClient } from "@/lib/supabase/server";
import nodemailer from "nodemailer";

export async function sendBulkEmails(
  contactIds: string[],
  subject: string,
  body: string
) {
  if (!contactIds.length) {
    throw new Error("No contacts selected");
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    throw new Error("Gmail not configured");
  }

  const supabase = await createClient();

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email")
    .in("id", contactIds);

  if (error) throw new Error(error.message);
  if (!contacts || contacts.length === 0) {
    throw new Error("No contacts found");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const contact of contacts) {
    if (!contact.email) continue;

    const firstName = contact.first_name || "";
    const lastName = contact.last_name || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || firstName || lastName;

    let personalizedBody = body
      .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
      .replace(/\{\{\s*last_name\s*\}\}/gi, lastName)
      .replace(/\{\{\s*full_name\s*\}\}/gi, fullName);

    let personalizedSubject = subject
      .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
      .replace(/\{\{\s*last_name\s*\}\}/gi, lastName)
      .replace(/\{\{\s*full_name\s*\}\}/gi, fullName);

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        ${personalizedBody.replace(/\n/g, "<br>")}
        <hr style="margin-top:30px;border:none;border-top:1px solid #eee;">
        <p style="font-size:12px;color:#999;">
          Sent from Cooper Fitness CRM<br>
          To unsubscribe, reply to this email.
        </p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: '"Cooper Fitness" <evan@cooper.fitness>',
        replyTo: "evan@cooper.fitness",
        to: contact.email,
        subject: personalizedSubject,
        html,
      });
      sent++;
    } catch (err) {
      errors.push(`${contact.first_name} ${contact.last_name}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return { sent, errors, total: contacts.length };
}
