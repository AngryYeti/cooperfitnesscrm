/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { downloadCompletedForm } from "@/lib/actions/forms";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-docuseal-signature");
    const webhookSecret = process.env.DOCUSEAL_WEBHOOK_SECRET;

    // 1. Verify Signature (if secret is configured)
    if (webhookSecret && signature) {
      const hmac = crypto.createHmac("sha256", webhookSecret);
      const computed = hmac.update(rawBody).digest("hex");
      if (computed !== signature) {
        console.warn("[docuseal-webhook] Signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else if (webhookSecret) {
      console.warn("[docuseal-webhook] Webhook secret configured but signature header missing");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type; // e.g. "form.completed", "form.viewed", "submission.completed"
    
    console.log(`[docuseal-webhook] Received event: ${eventType}`);

    const docusealSubmission = payload.data?.submission || payload.submission;
    const docusealSubmitter = payload.data || payload.submitter;

    const submissionId = docusealSubmission?.id;
    const submitterId = docusealSubmitter?.id;

    if (!submissionId && !submitterId) {
      return NextResponse.json({ error: "No submission or submitter ID found in payload" }, { status: 400 });
    }

    // Initialize admin client to bypass RLS for webhook operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Locate the client form in the database
    let query = supabase.from("client_forms").select("id, contact_id, status");
    if (submissionId && submitterId) {
      query = query.or(`docuseal_submission_id.eq.${submissionId},docuseal_submitter_id.eq.${submitterId}`);
    } else if (submissionId) {
      query = query.eq("docuseal_submission_id", submissionId);
    } else {
      query = query.eq("docuseal_submitter_id", submitterId);
    }

    const { data: forms, error: queryError } = await query;

    if (queryError || !forms || forms.length === 0) {
      console.warn(`[docuseal-webhook] No matching client form found for submissionId: ${submissionId}, submitterId: ${submitterId}`);
      return NextResponse.json({ message: "No matching client form found" }, { status: 200 });
    }

    const clientForm = forms[0];
    let newStatus: "sent" | "received" | "completed" = clientForm.status;

    if (eventType === "form.completed" || eventType === "submission.completed" || docusealSubmission?.status === "completed" || docusealSubmitter?.status === "completed") {
      newStatus = "completed";
    } else if (eventType === "form.viewed" || eventType === "submission.viewed" || docusealSubmitter?.status === "viewed" || docusealSubmitter?.status === "opened") {
      newStatus = "received";
    }

    // 3. Update database record if status changed
    if (newStatus !== clientForm.status) {
      const updatePayload: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "completed") {
        updatePayload.completed_at = new Date().toISOString();
        if (docusealSubmission?.combined_document_url) {
          updatePayload.pdf_url = docusealSubmission.combined_document_url;
        }
      }

      const { error: updateError } = await supabase
        .from("client_forms")
        .update(updatePayload)
        .eq("id", clientForm.id);

      if (updateError) {
        console.error("[docuseal-webhook] Failed to update status in DB", updateError);
        return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
      }

      // Add to activity log
      const { data: contact } = await supabase
        .from("contacts")
        .select("first_name, last_name")
        .eq("id", clientForm.contact_id)
        .single();

      if (contact) {
        const fullName = `${contact.first_name} ${contact.last_name}`;
        await supabase.from("activities").insert({
          type: "contact_updated",
          contact_id: clientForm.contact_id,
          contact_name: fullName,
          description: newStatus === "completed" 
            ? `Completed signing DocuSeal document (${fullName})` 
            : `Viewed DocuSeal document (${fullName})`,
        });
      }

      // 4. Download and save the PDF locally if completed
      if (newStatus === "completed") {
        try {
          await downloadCompletedForm(clientForm.id);
          console.log(`[docuseal-webhook] Successfully auto-downloaded PDF for client form: ${clientForm.id}`);
        } catch (downloadErr) {
          console.error(`[docuseal-webhook] Failed to auto-download PDF for client form ${clientForm.id}:`, downloadErr);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[docuseal-webhook] Processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
