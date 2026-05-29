"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createSubmissionFromHtml,
  isConfigured as isDocuSealConfigured,
} from "@/lib/docuseal";
import nodemailer from "nodemailer";

const FORM_TEMPLATES = [
  { type: "parq", title: "PAR-Q+ Health Questionnaire", required: true },
  { type: "consent", title: "Informed Consent Form", required: true },
  { type: "liability", title: "Liability Waiver & Release", required: true },
  { type: "agreement", title: "Coaching Agreement", required: true },
  { type: "goals", title: "Goal & Lifestyle Assessment", required: true },
  { type: "nutrition", title: "Nutrition Questionnaire", required: true },
  { type: "progress", title: "Progress & Baseline Assessment", required: true },
  { type: "emergency", title: "Emergency Contact Form", required: true },
  { type: "media", title: "Media Release Consent", required: false },
  { type: "privacy", title: "Privacy Policy & Data Consent", required: true },
];

export async function createIntakePacket(contactId: string) {
  const supabase = await createClient();

  const { data: contact, error: contactErr } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .eq("id", contactId)
    .single();

  if (contactErr || !contact) throw new Error("Contact not found");

  const { data: packet, error: packetErr } = await supabase
    .from("intake_packets")
    .insert({ contact_id: contactId, status: "draft" })
    .select()
    .single();

  if (packetErr || !packet) throw new Error(packetErr?.message || "Failed to create packet");

  const forms = FORM_TEMPLATES.map((t) => ({
    packet_id: packet.id,
    form_type: t.type,
    form_title: t.title,
    status: "pending",
  }));

  const { error: formsErr } = await supabase.from("intake_forms").insert(forms);
  if (formsErr) throw new Error(formsErr.message);

  await supabase.from("intake_audit").insert({
    packet_id: packet.id,
    contact_id: contactId,
    action: "packet_created",
    details: `Intake packet created for ${contact.first_name} ${contact.last_name}`,
  });

  await supabase
    .from("contacts")
    .update({ intake_status: "started" })
    .eq("id", contactId);

  revalidatePath("/intake");
  revalidatePath(`/clients/${contactId}`);
  return packet;
}

export async function getContactPackets(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_packets")
    .select("*, intake_forms(*)")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getAllPackets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_packets")
    .select("*, contacts(first_name, last_name, email, intake_status), intake_forms(*)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getPacketById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_packets")
    .select("*, contacts(first_name, last_name, email, intake_status), intake_forms(*)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getPacketByToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_packets")
    .select("*, contacts(first_name, last_name, email), intake_forms(*)")
    .eq("access_token", token)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function saveFormData(
  formId: string,
  formData: Record<string, unknown>
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("intake_forms")
    .update({ form_data: formData, status: "filled" })
    .eq("id", formId);

  if (error) throw new Error(error.message);

  const { data: form } = await supabase
    .from("intake_forms")
    .select("packet_id")
    .eq("id", formId)
    .single();

  if (form) {
    await supabase
      .from("intake_packets")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", form.packet_id);

    const { data: packet } = await supabase
      .from("intake_packets")
      .select("contact_id")
      .eq("id", form.packet_id)
      .single();

    if (packet) {
      await supabase
        .from("contacts")
        .update({ intake_status: "forms_pending" })
        .eq("id", packet.contact_id);
    }
  }

  revalidatePath("/intake");
}

export async function sendIntakePacket(packetId: string, returnUrl: string) {
  const supabase = await createClient();

  const { data: packet, error } = await supabase
    .from("intake_packets")
    .select("*, contacts(first_name, last_name, email), intake_forms(*)")
    .eq("id", packetId)
    .single();

  if (error || !packet) throw new Error("Packet not found");

  const contact = packet.contacts as { first_name: string; last_name: string; email: string };
  if (!contact.email) throw new Error("Contact has no email address");

  const filledForms = (packet.intake_forms as { id: string; form_type: string; form_title: string; form_data: Record<string, unknown>; status: string }[]).filter(
    (f) => f.status === "filled"
  );

  if (isDocuSealConfigured() && filledForms.length > 0) {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_DOMAIN || "https://cooper-fitness.vercel.app"}/api/webhooks/docuseal`;

    const submissionIds: number[] = [];
    let lastEmbedSrc = "";

    for (const f of filledForms) {
      const htmlContent = generateFormHtml(f.form_title, f.form_data as Record<string, string>);

      const { submissionId, embedSrc } = await createSubmissionFromHtml(
        htmlContent,
        f.form_title,
        `${contact.first_name} ${contact.last_name}`,
        contact.email,
        undefined,
        webhookUrl
      );

      submissionIds.push(submissionId);
      if (embedSrc) lastEmbedSrc = embedSrc;

      await supabase
        .from("intake_forms")
        .update({ docusign_document_id: String(submissionId) })
        .eq("id", f.id);
    }

    await supabase
      .from("intake_packets")
      .update({
        status: "sent",
        docusign_envelope_id: submissionIds.join(","),
        signing_url: lastEmbedSrc,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", packetId);

    await supabase.from("intake_audit").insert({
      packet_id: packetId,
      contact_id: packet.contact_id,
      action: "packet_sent_docuseal",
      details: `Sent via DocuSeal. Submissions: ${submissionIds.join(", ")}`,
    });

    return { method: "docuseal", signingUrl: lastEmbedSrc, submissionIds };
  }

  const intakeLink = `${returnUrl}/onboarding/${packet.access_token}`;

  await supabase
    .from("intake_packets")
    .update({
      status: "sent",
      signing_url: intakeLink,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", packetId);

  await supabase.from("intake_audit").insert({
    packet_id: packetId,
    contact_id: packet.contact_id,
    action: "packet_sent_link",
    details: `Sent intake link via email`,
  });

  await sendIntakeEmail(contact.email, `${contact.first_name} ${contact.last_name}`, intakeLink);

  return { method: "link", signingUrl: intakeLink };
}

export async function markPacketComplete(packetId: string) {
  const supabase = await createClient();

  const { data: packet } = await supabase
    .from("intake_packets")
    .select("contact_id")
    .eq("id", packetId)
    .single();

  await supabase
    .from("intake_packets")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", packetId);

  await supabase
    .from("intake_forms")
    .update({ status: "signed" })
    .eq("packet_id", packetId)
    .eq("status", "filled");

  if (packet) {
    await supabase
      .from("contacts")
      .update({ intake_status: "signed" })
      .eq("id", packet.contact_id);

    await supabase.from("intake_audit").insert({
      packet_id: packetId,
      contact_id: packet.contact_id,
      action: "packet_completed",
      details: "All forms signed and completed",
    });
  }

  revalidatePath("/intake");
  revalidatePath(`/clients/${packet?.contact_id}`);
}

export async function storeSignedDocument(
  packetId: string,
  formId: string,
  contactId: string,
  documentName: string,
  envelopeId: string,
  documentId: string,
  pdfBase64: string
) {
  const supabase = await createClient();

  await supabase.from("intake_documents").insert({
    packet_id: packetId,
    form_id: formId,
    contact_id: contactId,
    document_name: documentName,
    docusign_envelope_id: envelopeId,
    docusign_document_id: documentId,
    pdf_data: pdfBase64,
    signed_at: new Date().toISOString(),
  });

  await supabase
    .from("intake_forms")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("id", formId);
}

export async function getPacketDocuments(packetId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_documents")
    .select("*")
    .eq("packet_id", packetId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateContactIntakeStatus(
  contactId: string,
  status: string
) {
  const supabase = await createClient();
  await supabase
    .from("contacts")
    .update({ intake_status: status })
    .eq("id", contactId);

  revalidatePath("/clients");
  revalidatePath(`/clients/${contactId}`);
}

export async function deletePacket(packetId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("intake_packets")
    .delete()
    .eq("id", packetId);

  if (error) throw new Error(error.message);
  revalidatePath("/intake");
}

function generateFormHtml(
  title: string,
  formData: Record<string, string>
): string {
  const rows = Object.entries(formData)
    .map(
      ([key, value]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;width:40%;color:#333;">${key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555;">${value || "—"}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px 20px;color:#333;">
  <div style="text-align:center;margin-bottom:30px;">
    <h1 style="color:#171717;margin-bottom:5px;">Cooper Fitness</h1>
    <h2 style="color:#555;font-weight:400;margin-top:0;">${title}</h2>
  </div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
    ${rows}
  </table>
  <div style="margin-top:40px;border-top:2px solid #eee;padding-top:20px;">
    <p style="font-size:14px;color:#666;">Signature: ___________________________________</p>
    <p style="font-size:14px;color:#666;">Date: ___________________________________</p>
  </div>
  <p style="font-size:11px;color:#999;margin-top:30px;text-align:center;">Generated by Cooper Fitness CRM</p>
</body>
</html>`;
}

async function sendIntakeEmail(
  toEmail: string,
  clientName: string,
  intakeLink: string
) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) return;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
  });

  await transporter.sendMail({
    from: '"Cooper Fitness" <evan@cooper.fitness>',
    replyTo: "evan@cooper.fitness",
    to: toEmail,
    subject: "Cooper Fitness - Complete Your Intake Forms",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2>Welcome to Cooper Fitness, ${clientName}!</h2>
        <p>Please complete your intake forms by clicking the link below:</p>
        <a href="${intakeLink}" style="display:inline-block;background:#171717;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:20px 0;">Complete Intake Forms</a>
        <p style="color:#666;font-size:14px;">This link is unique to you. Please do not share it.</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #eee;">
        <p style="font-size:12px;color:#999;">Cooper Fitness CRM</p>
      </div>
    `,
  });
}
