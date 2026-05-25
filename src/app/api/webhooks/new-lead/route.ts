import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ORIGINS = [
  "https://cooper-fitness.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") || "";
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin") || "";
  const headers = corsHeaders(origin);

  try {
    const body = await request.json();
    const name = body.name?.trim();
    const email = body.email?.trim();
    const goals = body.goals?.trim();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400, headers }
      );
    }

    const nameParts = name.split(/\s+/);
    const firstName = nameParts[0] || name;
    const lastName = nameParts.slice(1).join(" ") || "Unknown";

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: true, id: existing.id, message: "Lead already exists." },
        { status: 200, headers }
      );
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        fitness_goal: goals || null,
        status: "Lead",
        source: "Website",
        date_added: new Date().toISOString(),
        tags: ["Website Lead"],
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabase.from("activities").insert({
      type: "contact_created",
      contact_id: contact.id,
      contact_name: `${firstName} ${lastName}`,
      description: `Website inquiry from ${firstName} ${lastName}`,
    });

    await supabase.from("follow_ups").insert({
      contact_id: contact.id,
      title: "Follow up on website inquiry",
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      completed: false,
    });

    return NextResponse.json(
      { success: true, id: contact.id },
      { status: 200, headers }
    );
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers }
    );
  }
}
