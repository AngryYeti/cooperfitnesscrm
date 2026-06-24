/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getFullName } from "@/lib/utils";
import fs from "fs";
import path from "path";

const DOCUSEAL_API_URL = process.env.DOCUSEAL_API_URL || "https://api.docuseal.co";
const DOCUSEAL_API_TOKEN = process.env.DOCUSEAL_API_TOKEN;

function getDocusealHeaders() {
  if (!DOCUSEAL_API_TOKEN) {
    throw new Error("DocuSeal API token is not configured. Add DOCUSEAL_API_TOKEN to .env.local");
  }
  return {
    "X-Auth-Token": DOCUSEAL_API_TOKEN,
    "Content-Type": "application/json",
  };
}

// ==========================================
// TEMPLATE ACTIONS
// ==========================================

export async function getFormTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getFormTemplateById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createFormTemplate(name: string, htmlContent: string, fields: unknown[]) {
  const supabase = await createClient();

  // 1. Register/Create the template on DocuSeal
  let docusealTemplateId: number | null = null;
  try {
    const res = await fetch(`${DOCUSEAL_API_URL}/templates/html`, {
      method: "POST",
      headers: getDocusealHeaders(),
      body: JSON.stringify({
        name,
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DocuSeal API error: ${errText}`);
    }

    const docusealTemplate = await res.json();
    docusealTemplateId = docusealTemplate.id;
  } catch (err: any) {
    console.error("Failed to register template on DocuSeal:", err);
    throw new Error(`Failed to save template on DocuSeal: ${err.message}`);
  }

  // 2. Insert into local Supabase database
  const { data, error } = await supabase
    .from("form_templates")
    .insert({
      name,
      html_content: htmlContent,
      fields,
      docuseal_template_id: docusealTemplateId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/forms/templates");
  return data;
}

export async function deleteFormTemplate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("form_templates")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/forms/templates");
}

// ==========================================
// CLIENT FORM ACTIONS (SUBMISSIONS)
// ==========================================

export async function getClientForms() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_forms")
    .select(`
      *,
      contacts (
        first_name,
        last_name,
        email
      ),
      form_templates (
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getClientFormsByContactId(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_forms")
    .select(`
      *,
      form_templates (
        name
      )
    `)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function sendFormToClient(contactId: string, templateId: string) {
  const supabase = await createClient();

  // 1. Fetch Contact Details
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("first_name, last_name, email")
    .eq("id", contactId)
    .single();

  if (contactError || !contact) throw new Error("Contact not found");
  if (!contact.email) throw new Error("Contact does not have an email address");

  // 2. Fetch Form Template
  const { data: template, error: templateError } = await supabase
    .from("form_templates")
    .select("docuseal_template_id, name")
    .eq("id", templateId)
    .single();

  if (templateError || !template || !template.docuseal_template_id) {
    throw new Error("Form template not found or not registered on DocuSeal");
  }

  // 3. Initiate Submission on DocuSeal
  let submissionId: number;
  let submitterId: number;
  let signingUrl: string;

  try {
    const clientName = getFullName(contact.first_name, contact.last_name);
    const res = await fetch(`${DOCUSEAL_API_URL}/submissions`, {
      method: "POST",
      headers: getDocusealHeaders(),
      body: JSON.stringify({
        template_id: template.docuseal_template_id,
        send_email: true,
        submitters: [
          {
            role: "Signer",
            email: contact.email,
            name: clientName,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DocuSeal error: ${errText}`);
    }

    const submissions = await res.json();
    // DocuSeal returns an array or single object depending on configuration
    const submission = Array.isArray(submissions) ? submissions[0] : submissions;

    submissionId = submission.id;
    const submitter = submission.submitters?.[0];
    submitterId = submitter?.id;
    signingUrl = submitter?.url || `https://docuseal.co/s/${submitter?.slug}`;
  } catch (err: any) {
    console.error("Failed to initiate DocuSeal submission:", err);
    throw new Error(`Failed to send form via DocuSeal: ${err.message}`);
  }

  // 4. Save client form record locally in Supabase
  const { data: clientForm, error: insertError } = await supabase
    .from("client_forms")
    .insert({
      contact_id: contactId,
      template_id: templateId,
      docuseal_submission_id: submissionId,
      docuseal_submitter_id: submitterId,
      status: "sent",
      signing_url: signingUrl,
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);

  // 5. Add to activities log
  const fullName = getFullName(contact.first_name, contact.last_name);
  await supabase.from("activities").insert({
    type: "contact_updated",
    contact_id: contactId,
    contact_name: fullName,
    description: `Sent DocuSeal form "${template.name}" to ${fullName}`,
  });

  revalidatePath("/forms");
  revalidatePath(`/clients/${contactId}`);
  return clientForm;
}

// ==========================================
// DOWNLOADS & SYNC ACTIONS
// ==========================================

export async function downloadCompletedForm(clientFormId: string) {
  const supabase = await createClient();

  // 1. Fetch form record
  const { data: clientForm, error } = await supabase
    .from("client_forms")
    .select("*, contacts(first_name, last_name)")
    .eq("id", clientFormId)
    .single();

  if (error || !clientForm) throw new Error("Client form not found");
  if (clientForm.local_pdf_path && fs.existsSync(path.join(process.cwd(), "public", clientForm.local_pdf_path))) {
    return clientForm.local_pdf_path;
  }

  if (clientForm.status !== "completed" || !clientForm.docuseal_submission_id) {
    throw new Error("Document is not signed or completed yet");
  }

  // 2. Fetch download URL from DocuSeal
  let downloadUrl = "";
  try {
    const res = await fetch(`${DOCUSEAL_API_URL}/submissions/${clientForm.docuseal_submission_id}/documents`, {
      method: "GET",
      headers: getDocusealHeaders(),
    });

    if (!res.ok) throw new Error(`Failed to fetch documents: ${res.statusText}`);
    const docs = await res.json();
    const doc = Array.isArray(docs) ? docs[0] : docs;
    downloadUrl = doc?.download_url || doc?.url;
  } catch (err: any) {
    console.error("Failed to retrieve document URL from DocuSeal:", err);
    throw new Error(`Failed to get document URL: ${err.message}`);
  }

  if (!downloadUrl) throw new Error("No download URL returned from DocuSeal");

  // 3. Fetch PDF binary and save locally
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Failed to download PDF binary: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const dir = path.join(process.cwd(), "public", "downloads", "forms");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const localPath = `/downloads/forms/${clientFormId}.pdf`;
    const filePath = path.join(dir, `${clientFormId}.pdf`);
    fs.writeFileSync(filePath, buffer);

    // Update DB with local path
    await supabase
      .from("client_forms")
      .update({ local_pdf_path: localPath })
      .eq("id", clientFormId);

    revalidatePath("/forms");
    revalidatePath(`/clients/${clientForm.contact_id}`);
    return localPath;
  } catch (err: any) {
    console.error("Failed to save PDF locally:", err);
    throw new Error(`Failed to save PDF locally: ${err.message}`);
  }
}

export async function syncDocuSealSubmissions() {
  const supabase = await createClient();

  // 1. Get all pending client forms
  const { data: pendingForms, error } = await supabase
    .from("client_forms")
    .select("*")
    .neq("status", "completed");

  if (error) throw new Error(error.message);
  if (!pendingForms || pendingForms.length === 0) return { updated: 0 };

  let updatedCount = 0;

  // 2. Poll DocuSeal for each pending submission
  for (const form of pendingForms) {
    if (!form.docuseal_submission_id) continue;

    try {
      const res = await fetch(`${DOCUSEAL_API_URL}/submissions/${form.docuseal_submission_id}`, {
        method: "GET",
        headers: getDocusealHeaders(),
      });

      if (!res.ok) continue;

      const submission = await res.json();
      const newStatus = submission.status; // e.g. 'completed', 'opened', 'viewed', 'declined'
      let localStatus: "sent" | "received" | "completed" = "sent";

      if (newStatus === "completed") {
        localStatus = "completed";
      } else if (newStatus === "viewed" || newStatus === "opened") {
        localStatus = "received";
      }

      if (localStatus !== form.status) {
        const updatePayload: any = {
          status: localStatus,
          updated_at: new Date().toISOString(),
        };

        if (localStatus === "completed") {
          updatePayload.completed_at = new Date().toISOString();
        }

        await supabase
          .from("client_forms")
          .update(updatePayload)
          .eq("id", form.id);

        if (localStatus === "completed") {
          // Immediately queue local PDF download
          try {
            await downloadCompletedForm(form.id);
          } catch (downloadErr) {
            console.error(`Failed to auto-download form ${form.id}:`, downloadErr);
          }
        }

        updatedCount++;
      }
    } catch (err) {
      console.error(`Failed to sync submission ${form.docuseal_submission_id}:`, err);
    }
  }

  if (updatedCount > 0) {
    revalidatePath("/forms");
    revalidatePath("/clients");
  }

  return { updated: updatedCount };
}
