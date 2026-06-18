"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, BRAND } from "@/lib/email";
import { getFullName } from "@/lib/utils";

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

  await supabase.from("intake_audit").insert({
    packet_id: packet.id,
    contact_id: contactId,
    action: "packet_created",
    details: `Intake packet created for ${getFullName(contact.first_name, contact.last_name)}`,
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
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getAllPackets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_packets")
    .select("*, contacts(first_name, last_name, email, intake_status)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getPacketById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_packets")
    .select("*, contacts(first_name, last_name, email, intake_status)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getPacketByToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intake_packets")
    .select("*, contacts(first_name, last_name, email)")
    .eq("access_token", token)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function sendIntakePacket(packetId: string) {
  const supabase = await createClient();

  const { data: packet, error } = await supabase
    .from("intake_packets")
    .select("*, contacts(first_name, last_name, email)")
    .eq("id", packetId)
    .single();

  if (error || !packet) throw new Error("Packet not found");

  const contact = packet.contacts as { first_name: string; last_name: string; email: string };
  if (!contact.email) throw new Error("Contact has no email address");

  const tallyUrl = process.env.NEXT_PUBLIC_TALLY_FORM_URL;
  if (!tallyUrl) {
    throw new Error("Tally form URL is not configured. Please add NEXT_PUBLIC_TALLY_FORM_URL to your environment variables.");
  }

  // Construct the Tally URL with the hidden field `packet_id`
  const intakeLink = `${tallyUrl}?packet_id=${packet.id}`;

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
    action: "packet_sent_tally",
    details: `Sent Tally intake link via email`,
  });

  await sendIntakeEmail(contact.email, getFullName(contact.first_name, contact.last_name), intakeLink);

  revalidatePath("/intake");
  return { method: "tally", signingUrl: intakeLink };
}

export async function markPacketComplete(packetId: string, submissionId?: string) {
  const supabase = await createClient();

  const { data: packet } = await supabase
    .from("intake_packets")
    .select("contact_id")
    .eq("id", packetId)
    .single();

  if (!packet) throw new Error("Packet not found");

  const updateData: Record<string, unknown> = {
    status: "completed",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (submissionId) {
    updateData.tally_submission_id = submissionId;
  }

  await supabase
    .from("intake_packets")
    .update(updateData)
    .eq("id", packetId);

  await supabase
    .from("contacts")
    .update({ intake_status: "completed" })
    .eq("id", packet.contact_id);

  await supabase.from("intake_audit").insert({
    packet_id: packetId,
    contact_id: packet.contact_id,
    action: "packet_completed",
    details: `Tally form submitted successfully${submissionId ? ` (Submission ID: ${submissionId})` : ''}`,
  });

  revalidatePath("/intake");
  revalidatePath(`/clients/${packet.contact_id}`);
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

async function sendIntakeEmail(
  toEmail: string,
  clientName: string,
  intakeLink: string
) {
  await sendEmail({
    to: toEmail,
    subject: `${BRAND.name} - Complete Your Intake Forms`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2>Welcome to ${BRAND.name}, ${clientName}!</h2>
        <p>Please complete your intake forms by clicking the link below:</p>
        <a href="${intakeLink}" style="display:inline-block;background:#171717;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:20px 0;">Complete Intake Forms</a>
        <p style="color:#666;font-size:14px;">This link is unique to you. Please do not share it.</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #eee;">
        <p style="font-size:12px;color:#999;">${BRAND.name} CRM</p>
      </div>
    `,
    replyTo: BRAND.replyTo,
  });
}
