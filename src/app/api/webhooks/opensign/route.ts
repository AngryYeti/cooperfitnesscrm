import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const event = body.event as string;
    const documentId = body.objectId as string;

    if (!event || !documentId) {
      return NextResponse.json({ error: "Missing event or objectId" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: packet } = await supabase
      .from("intake_packets")
      .select("id, contact_id, docusign_envelope_id, intake_forms(*)")
      .like("docusign_envelope_id", `%${documentId}%`)
      .single();

    if (!packet) {
      return NextResponse.json({ received: true, note: "Packet not found for document" });
    }

    await supabase.from("intake_audit").insert({
      packet_id: packet.id,
      contact_id: packet.contact_id,
      action: `opensign_${event}`,
      details: JSON.stringify(body),
    });

    if (event === "completed") {
      const signedFileUrl = body.file as string | undefined;
      const certificateUrl = body.certificate as string | undefined;

      const matchingForm = (packet.intake_forms as { id: string; docusign_document_id: string }[]).find(
        (f) => f.docusign_document_id === documentId
      );

      if (matchingForm) {
        await supabase
          .from("intake_forms")
          .update({ status: "signed", signed_at: new Date().toISOString() })
          .eq("id", matchingForm.id);

        await supabase.from("intake_documents").insert({
          packet_id: packet.id,
          form_id: matchingForm.id,
          contact_id: packet.contact_id,
          document_name: body.name || "Signed Document",
          docusign_envelope_id: documentId,
          pdf_url: signedFileUrl || null,
          signed_at: new Date().toISOString(),
        });
      }

      const allDocIds = (packet.docusign_envelope_id || "").split(",").filter(Boolean);
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

    if (event === "signed") {
      const matchingForm = (packet.intake_forms as { id: string; docusign_document_id: string }[]).find(
        (f) => f.docusign_document_id === documentId
      );

      if (matchingForm) {
        await supabase
          .from("intake_forms")
          .update({ status: "signed", signed_at: new Date().toISOString() })
          .eq("id", matchingForm.id);
      }
    }

    if (event === "declined") {
      await supabase
        .from("intake_packets")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", packet.id);
    }

    return NextResponse.json({ received: true, event });
  } catch (err) {
    console.error("OpenSign webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
