import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getSignedDocument,
  listEnvelopeDocuments,
  isDocuSignConfigured,
} from "@/lib/docusign";

export async function POST(request: Request) {
  try {
    const body = await request.text();

    let envelopeData: { envelopeId: string; status: string } | null = null;
    try {
      const xmlMatch = body.match(/<EnvelopeID>(.*?)<\/EnvelopeID>/);
      const statusMatch = body.match(/<Status>(.*?)<\/Status>/);
      if (xmlMatch && statusMatch) {
        envelopeData = {
          envelopeId: xmlMatch[1],
          status: statusMatch[1],
        };
      }
    } catch {
      try {
        const json = JSON.parse(body);
        if (json.envelopeId) {
          envelopeData = {
            envelopeId: json.envelopeId,
            status: json.status || "completed",
          };
        }
      } catch {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
    }

    if (!envelopeData) {
      return NextResponse.json({ error: "No envelope data" }, { status: 400 });
    }

    const { envelopeId, status } = envelopeData;

    if (status.toLowerCase() !== "completed") {
      return NextResponse.json({ received: true, status });
    }

    const supabase = await createClient();

    const { data: packet } = await supabase
      .from("intake_packets")
      .select("id, contact_id, intake_forms(*)")
      .eq("docusign_envelope_id", envelopeId)
      .single();

    if (!packet) {
      return NextResponse.json({ error: "Packet not found" }, { status: 404 });
    }

    if (isDocuSignConfigured()) {
      const documents = await listEnvelopeDocuments(envelopeId);

      for (const doc of documents) {
        if (doc.documentId === "certificate") continue;

        const pdfBuffer = await getSignedDocument(envelopeId, doc.documentId!);
        const pdfBase64 = pdfBuffer.toString("base64");

        const matchingForm = (packet.intake_forms as { id: string; form_title: string }[]).find(
          (_, i) => String(i + 1) === doc.documentId
        );

        await supabase.from("intake_documents").insert({
          packet_id: packet.id,
          form_id: matchingForm?.id || null,
          contact_id: packet.contact_id,
          document_name: doc.name || "Signed Document",
          docusign_envelope_id: envelopeId,
          docusign_document_id: doc.documentId,
          pdf_data: pdfBase64,
          signed_at: new Date().toISOString(),
        });
      }
    }

    await supabase
      .from("intake_packets")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", packet.id);

    await supabase
      .from("intake_forms")
      .update({ status: "signed", signed_at: new Date().toISOString() })
      .eq("packet_id", packet.id)
      .neq("status", "signed");

    await supabase
      .from("contacts")
      .update({ intake_status: "signed" })
      .eq("id", packet.contact_id);

    await supabase.from("intake_audit").insert({
      packet_id: packet.id,
      contact_id: packet.contact_id,
      action: "docusign_completed",
      details: `Envelope ${envelopeId} completed. Documents stored.`,
    });

    return NextResponse.json({ received: true, status: "completed" });
  } catch (err) {
    console.error("DocuSign webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
