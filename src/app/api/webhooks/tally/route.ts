import { NextResponse } from "next/server";
import { markPacketComplete } from "@/lib/actions/intake";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Only process form submissions
    if (payload.eventType !== "FORM_SUBMISSION" && payload.eventType !== "FORM_RESPONSE") {
      return NextResponse.json({ message: "Ignored event type" }, { status: 200 });
    }

    const fields = payload.data?.fields || [];
    let packetId = null;

    // Find the packet_id hidden field
    for (const field of fields) {
      if (field.key === "packet_id" || field.label === "packet_id") {
        packetId = field.value;
        break;
      }
    }

    if (!packetId) {
      console.warn("Tally webhook received without packet_id hidden field");
      return NextResponse.json({ message: "Missing packet_id in submission" }, { status: 200 }); // Return 200 so Tally doesn't retry
    }

    const submissionId = payload.data?.submissionId;
    console.log(`[Tally Webhook] Found packet ID: ${packetId}, Submission ID: ${submissionId}`);

    // Pass `true` as the third argument to use the Admin client (bypass RLS)
    await markPacketComplete(packetId, submissionId, true);

    console.log(`[Tally Webhook] Successfully marked packet ${packetId} as complete`);
    return NextResponse.json({ success: true, message: "Intake marked as complete" }, { status: 200 });
  } catch (err) {
    console.error("Tally webhook error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
