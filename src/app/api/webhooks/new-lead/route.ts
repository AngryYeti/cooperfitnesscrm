import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUrgentLeadEvent } from "@/lib/urgent-lead-event";
import { getFullName } from "@/lib/utils";

const ALLOWED_ORIGINS = [
  "https://cooper-fitness.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

const TIMEZONE = process.env.TIMEZONE || "America/New_York";

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
  console.log("[webhook] received from origin:", origin);
  const headers = corsHeaders(origin);

  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const provided = request.headers.get("x-webhook-secret");
    if (provided !== webhookSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }
  } else {
    console.warn("[webhook] WEBHOOK_SECRET not configured — allowing unauthenticated request");
  }

  try {
    const body = await request.json();
    console.log("[webhook] received");
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

    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      const inquiryDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: TIMEZONE,
      });
      const noteContent = `Additional website inquiry (${inquiryDate}) — Goals: ${goals || "(none provided)"}`;

      const { error: noteError } = await supabase.from("notes").insert({
        contact_id: existing.id,
        content: noteContent,
      });

      if (noteError) {
        console.error("[webhook] failed to add dedupe note");
      }

      await supabase.from("activities").insert({
        type: "contact_updated",
        contact_id: existing.id,
        contact_name: getFullName(existing.first_name, existing.last_name),
        description: `Additional website inquiry received from ${getFullName(existing.first_name, existing.last_name)}`,
      });

      const urgentEvent = await createUrgentLeadEvent({
        supabase,
        contactId: existing.id,
        contactName: getFullName(existing.first_name, existing.last_name),
        source: "website_inquiry",
        contextLabel: "Website inquiry",
      });

      console.log("[webhook] merged into existing lead");
      return NextResponse.json(
        {
          success: true,
          id: existing.id,
          merged: true,
          note: noteError ? null : noteContent,
          urgentEventId: urgentEvent?.id ?? null,
          message: "Lead already exists — added inquiry note and urgent follow-up event.",
        },
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
      contact_name: getFullName(firstName, lastName),
      description: `Website inquiry from ${getFullName(firstName, lastName)}`,
    });

    await supabase.from("follow_ups").insert({
      contact_id: contact.id,
      title: "Follow up on website inquiry",
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      completed: false,
    });

    const urgentEvent = await createUrgentLeadEvent({
      supabase,
      contactId: contact.id,
      contactName: getFullName(firstName, lastName),
      source: "website_inquiry",
      contextLabel: "Website inquiry",
    });

    console.log("[webhook] created lead");
    return NextResponse.json(
      { success: true, id: contact.id, urgentEventId: urgentEvent?.id ?? null },
      { status: 200, headers }
    );
  } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    console.error("[webhook] processing error");
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers }
    );
  }
}
