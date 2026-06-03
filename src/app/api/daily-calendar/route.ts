import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, BRAND, isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function sendDailyCalendar(request: Request) {
  try {
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "Zoho SMTP is not configured. Set ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD in Vercel env vars." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const toEmail = BRAND.replyTo;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const todayStart = `${today}T00:00:00.000Z`;
    const tomorrowEnd = `${tomorrow}T23:59:59.999Z`;

    const { data: events, error } = await supabase
      .from("calendar_events")
      .select("*, contacts(first_name, last_name)")
      .lte("start_time", tomorrowEnd)
      .gte("end_time", todayStart)
      .order("start_time", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Supabase query failed", details: error.message },
        { status: 500 }
      );
    }

    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    });

    let html = `<h2 style="margin-bottom:5px;">${BRAND.name} CRM</h2>`;
    html += `<p style="color:#666;margin-top:0;margin-bottom:20px;">${dateStr}</p>`;

    if (!events || events.length === 0) {
      html += `<p style="color:#666;">No events scheduled for today.</p>`;
    } else {
      const activeEvents = events.filter((e: any) => !e.completed);
      const completedEvents = events.filter((e: any) => e.completed);

      const renderEvent = (event: any) => {
        const contactName = event.contacts
          ? `${event.contacts.first_name} ${event.contacts.last_name}`
          : "";
        const isAllDay = event.all_day;
        let timeStr = "All day";
        if (!isAllDay) {
          const start = new Date(event.start_time);
          const end = new Date(event.end_time);
          const opts = {
            hour: "numeric" as const,
            minute: "2-digit" as const,
            timeZone: "America/New_York",
          };
          timeStr = `${start.toLocaleTimeString("en-US", opts)} - ${end.toLocaleTimeString("en-US", opts)} ET`;
        }

        const dotColor = event.color || "#2563eb";
        const isDone = event.completed;
        const titleStyle = isDone
          ? "text-decoration:line-through;color:#999;"
          : "";

        html += `<li style="margin-bottom:10px;border-left:3px solid ${dotColor};padding-left:10px;${isDone ? "opacity:0.6;" : ""}">`;
        html += `<strong style="${titleStyle}">${isDone ? "✓ " : ""}${event.title}</strong>`;
        html += `<br><span style="color:#2563eb;">${timeStr}</span>`;
        if (contactName) html += ` &mdash; ${contactName}`;
        if (event.description)
          html += `<br><span style="color:#666;font-size:13px;">${event.description}</span>`;
        html += `</li>`;
      };

      if (activeEvents.length > 0) {
        html += `<ul style="padding-left:0;list-style:none;">`;
        for (const event of activeEvents) renderEvent(event);
        html += `</ul>`;
      }

      if (completedEvents.length > 0) {
        html += `<p style="margin-top:20px;margin-bottom:8px;color:#999;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Completed</p>`;
        html += `<ul style="padding-left:0;list-style:none;">`;
        for (const event of completedEvents) renderEvent(event);
        html += `</ul>`;
      }

      if (activeEvents.length === 0 && completedEvents.length === 0) {
        html += `<p style="color:#666;">No events scheduled for today.</p>`;
      }

      html += `<p style="margin-top:15px;color:#666;font-size:14px;">${activeEvents.length} active · ${completedEvents.length} completed</p>`;
    }

    html += `<p style="margin-top:25px;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:15px;">Sent daily from ${BRAND.name} CRM</p>`;

    const result = await sendEmail({
      to: toEmail,
      subject: `Today's Schedule \u2014 ${dateStr}`,
      html,
      replyTo: BRAND.replyTo,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sent: events?.length || 0,
      active: events?.filter((e: any) => !e.completed).length || 0,
      completed: events?.filter((e: any) => e.completed).length || 0,
      to: toEmail,
      messageId: result.messageId,
      date: dateStr,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return sendDailyCalendar(request);
}

export async function GET(request: Request) {
  return sendDailyCalendar(request);
}
