import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  const { data: events, error } = await supabase
    .from("calendar_events")
    .select(
      "id, title, start_time, end_time, all_day, completed, contact_id, contacts(first_name, last_name)"
    )
    .order("start_time", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const etFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const today = etFmt.format(now).split(",")[0];

  return NextResponse.json({
    serverNowUTC: now.toISOString(),
    serverNowET: etFmt.format(now),
    etTodayLabel: today,
    count: events?.length || 0,
    events: (events || []).map((e: any) => ({
      id: e.id,
      title: e.title,
      start_utc: e.start_time,
      end_utc: e.end_time,
      start_et: e.start_time ? etFmt.format(new Date(e.start_time)) : null,
      end_et: e.end_time ? etFmt.format(new Date(e.end_time)) : null,
      all_day: e.all_day,
      completed: e.completed,
      contact: e.contacts
        ? `${e.contacts.first_name} ${e.contacts.last_name}`.trim()
        : null,
    })),
  });
}
