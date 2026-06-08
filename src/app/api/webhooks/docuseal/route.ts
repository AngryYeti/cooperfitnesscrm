import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface DocusealSubmission {
  id?: number;
  name?: string;
  submitters?: Array<{
    documents?: Array<{ url?: string }>;
  }>;
  documents?: Array<{ url?: string }>;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  const rawBody = await request.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (webhookSecret) {
    const signature = request.headers.get("x-docuseal-signature");
    const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

    if (!signature || signature !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("[docuseal] DOCUSEAL_WEBHOOK_SECRET not configured — allowing unauthenticated request");
  }

  try {

    const event = body.event as string;
    const submissionId = body.submission_id as number | undefined;
    const submission = (body.submission || body) as DocusealSubmission;

    if (!event) {
      return NextResponse.json({ error: "Missing event" }, { status: 400 });
    }

    const supabase = createAdminClient();


    const subId = submissionId || submission?.id;
    if (!subId) {
      return NextResponse.json({ received: true, note: "No submission ID" });
    }

    const { data: packet } = await supabase
      .from("intake_packets")
      .select("id, contact_id, docusign_envelope_id, intake_forms(*)")
      .like("docusign_envelope_id", `%${subId}%`)
      .single();

    if (!packet) {
      return NextResponse.json({ received: true, note: "Packet not found" });
    }

    await supabase.from("intake_audit").insert({
      packet_id: packet.id,
      contact_id: packet.contact_id,
      action: `docuseal_${event}`,
      details: JSON.stringify(body),
    });

    if (event === "submission.completed") {
      const submitters = submission.submitters || [];
      const documents = submission.documents || [];

      const matchingForm = (packet.intake_forms as { id: string; docusign_document_id: string }[]).find(
        (f) => f.docusign_document_id === String(subId)
      );

      if (matchingForm) {
        await supabase
          .from("intake_forms")
          .update({ status: "signed", signed_at: new Date().toISOString() })
          .eq("id", matchingForm.id);

        const docUrl = documents[0]?.url || submitters[0]?.documents?.[0]?.url || null;

        await supabase.from("intake_documents").insert({
          packet_id: packet.id,
          form_id: matchingForm.id,
          contact_id: packet.contact_id,
          document_name: submission.name || "Signed Document",
          docusign_envelope_id: String(subId),
          pdf_url: docUrl,
          signed_at: new Date().toISOString(),
        });
      }

      const { data: allForms } = await supabase
        .from("intake_forms")
        .select("id, status")
        .eq("packet_id", packet.id);

      const allSigned = allForms?.every(
        (f) => f.status === "signed" || f.status === "skipped"
      );

      if (allSigned) {
        await supabase
          .from("intake_packets")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", packet.id);

        await supabase
          .from("contacts")
          .update({ intake_status: "signed" })
          .eq("id", packet.contact_id);
      }
    }

    if (event === "submission.declined") {
      await supabase
        .from("intake_packets")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", packet.id);
    }

    return NextResponse.json({ received: true, event });
  } catch (err) {
    console.error("DocuSeal webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
