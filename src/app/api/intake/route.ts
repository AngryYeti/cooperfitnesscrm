import { NextResponse } from "next/server";
import { sendIntakePacket } from "@/lib/actions/intake";

export async function POST(request: Request) {
  try {
    const { packetId, returnUrl } = await request.json();

    if (!packetId) {
      return NextResponse.json({ error: "packetId required" }, { status: 400 });
    }

    const result = await sendIntakePacket(packetId);

    return NextResponse.json({ success: true, method: result.method, intakeLink: result.signingUrl });
  } catch (err) {
    console.error("Send intake error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
