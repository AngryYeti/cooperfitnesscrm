import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const packetId = searchParams.get("packetId");

    const supabase = createAdminClient();

    // 1. Test database connection & Admin Key
    const { data: testData, error: testErr } = await supabase
      .from("intake_packets")
      .select("id")
      .limit(1);

    if (testErr) {
      return NextResponse.json({
        error: "Database Connection Failed",
        details: testErr.message,
        hint: "SUPABASE_SERVICE_ROLE_KEY might be missing or incorrect in Vercel."
      });
    }

    // 2. Test if specific packet exists
    if (packetId) {
      const { data: packet, error: packetErr } = await supabase
        .from("intake_packets")
        .select("*")
        .eq("id", packetId)
        .single();

      if (packetErr || !packet) {
        return NextResponse.json({
          error: "Packet not found",
          details: packetErr?.message,
          searchedId: packetId
        });
      }

      return NextResponse.json({
        success: true,
        message: "Admin Client is working and Packet was found!",
        packetData: packet
      });
    }

    return NextResponse.json({
      success: true,
      message: "Admin Client is working perfectly!"
    });
  } catch (err) {
    return NextResponse.json({
      error: "Unexpected Crash",
      details: err instanceof Error ? err.message : String(err)
    });
  }
}
