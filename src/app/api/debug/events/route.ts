import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = createAdminClient();
  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const useDbFilter = url.searchParams.get("db") === "1";

  let query = supabase
    .from("calendar_events")
    .select(
      "id, title, start_time, end_time, all_day, completed, contact_id, contacts(first_name, last_name)"
    )
    .order("start_time", { ascending: true })
    .limit(200);

  if (useDbFilter && startParam && endParam) {
    query = query.lt("start_time", endParam).gt("end_time", startParam);
  }

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let filtered = events || [];
  if (!useDbFilter && (startParam || endParam)) {
    const s = startParam ? new Date(startParam).getTime() : -Infinity;
    const eEnd = endParam ? new Date(endParam).getTime() : Infinity;
    filtered = filtered.filter((ev: any) => {
      const st = new Date(ev.start_time).getTime();
      const en = new Date(ev.end_time).getTime();
      return st < eEnd && en > s;
    });
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
    filterMode: useDbFilter ? "db" : "js",
    range: { start: startParam, end: endParam },
    count: filtered.length,
    events: (filtered).map((e: any) => ({
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
