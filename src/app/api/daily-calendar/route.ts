import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, BRAND, isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type DayBounds = { start: Date; end: Date; label: string; iso: { start: string; end: string } };

function getETDayBounds(date: Date = new Date()): DayBounds {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);

  const utcNoon = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const etFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [etHour, etMinute] = etFmt.format(utcNoon).split(":").map(Number);
  const offsetMinutes = (etHour - 12) * 60 + etMinute;

  const start = new Date(Date.UTC(year, month, day, 0, 0, 0) - offsetMinutes * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);

  return {
    start,
    end,
    label,
    iso: { start: start.toISOString(), end: end.toISOString() },
  };
}

function formatET(date: Date, withDate = false): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    ...(withDate ? { month: "short", day: "numeric" } : {}),
  }).format(date);
}

function inferEventKind(title: string): string {
  const t = title.toLowerCase();
  if (/\b(consult|consultation)\b/.test(t)) return "Consultation";
  if (/\b(intake|onboard)\b/.test(t)) return "Intake";
  if (/\b(check[\s-]?in|checkin)\b/.test(t)) return "Check-In";
  if (/\b(follow[\s-]?up|followup)\b/.test(t)) return "Follow-Up";
  if (/\b(eval|evaluation|assessment)\b/.test(t)) return "Evaluation";
  if (/\b(train|workout|session|pt |1[\s-]?1|one[\s-]?on[\s-]?one)\b/.test(t)) return "Training";
  if (/\b(review)\b/.test(t)) return "Review";
  if (/\b(call|phone)\b/.test(t)) return "Call";
  if (/\b(meet|meeting)\b/.test(t)) return "Meeting";
  return "Event";
}

async function sendDailyCalendar(request: Request) {
  try {
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "Zoho SMTP is not configured." },
        { status: 500 }
      );
    }

    const supabase = createAdminClient();
    const toEmail = BRAND.replyTo;

    const now = new Date();
    const bounds = getETDayBounds(now);
    const dateStr = bounds.label;

    const { data: events, error } = await supabase
      .from("calendar_events")
      .select("*, contacts(first_name, last_name)")
      .lt("start_time", bounds.iso.end)
      .gt("end_time", bounds.iso.start)
      .order("start_time", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Supabase query failed", details: error.message },
        { status: 500 }
      );
    }

    const activeEvents = (events || []).filter((e: any) => !e.completed);
    const completedEvents = (events || []).filter((e: any) => e.completed);

    const renderEvent = (event: any) => {
      const contactName = event.contacts
        ? `${event.contacts.first_name} ${event.contacts.last_name}`.trim()
        : "";
      const isAllDay = event.all_day;
      const kind = inferEventKind(event.title);

      let timeStr: string;
      if (isAllDay) {
        timeStr = "All day";
      } else {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        timeStr = `${formatET(start)} – ${formatET(end)} ET`;
      }

      const dotColor = event.color || "#2563eb";
      const isDone = event.completed;
      const titleStyle = isDone
        ? "text-decoration:line-through;color:#999;"
        : "";

      return `
        <tr>
          <td style="padding:0 0 14px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid ${dotColor};${isDone ? "opacity:0.55;" : ""}">
              <tr>
                <td style="padding:10px 0 10px 14px;">
                  <div style="font-size:15px;font-weight:600;color:#171717;${titleStyle}line-height:1.3;">
                    ${isDone ? "✓ " : ""}${event.title}
                  </div>
                  <div style="margin-top:5px;font-size:13px;color:#666;line-height:1.5;">
                    <span style="display:inline-block;background:${dotColor}1A;color:${dotColor};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.02em;margin-right:6px;">${kind}</span>
                    <span style="color:#2563eb;font-weight:500;">${timeStr}</span>
                    ${contactName ? ` &nbsp;·&nbsp; <span style="color:#171717;font-weight:500;">${contactName}</span>` : ""}
                  </div>
                  ${event.description ? `<div style="margin-top:6px;font-size:12px;color:#888;font-style:italic;line-height:1.5;">${event.description}</div>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    };

    let eventsHtml = "";
    if (activeEvents.length > 0) {
      eventsHtml += `<tr><td style="padding:0 0 6px 0;"><p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.08em;">Today's schedule</p></td></tr>`;
      for (const event of activeEvents) {
        eventsHtml += renderEvent(event);
      }
    }

    if (completedEvents.length > 0) {
      eventsHtml += `<tr><td style="padding:18px 0 6px 0;"><p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.08em;">Completed</p></td></tr>`;
      for (const event of completedEvents) {
        eventsHtml += renderEvent(event);
      }
    }

    let bodyHtml: string;
    if ((events || []).length === 0) {
      bodyHtml = `
        <tr><td style="padding:8px 0 24px 0;">
          <p style="margin:0;font-size:15px;color:#666;line-height:1.6;">No events scheduled for today.</p>
          <p style="margin:14px 0 0 0;font-size:13px;color:#999;line-height:1.5;">Add events in the calendar and they'll appear in tomorrow's digest.</p>
        </td></tr>
      `;
    } else {
      bodyHtml = eventsHtml;
    }

    const summaryLine =
      (events || []).length > 0
        ? `${activeEvents.length} scheduled${completedEvents.length > 0 ? ` · ${completedEvents.length} completed` : ""}`
        : "";

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:0;color:#171717;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding:24px 0 4px 0;">
            <h1 style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.01em;">${BRAND.name} CRM</h1>
            <p style="margin:4px 0 0 0;font-size:14px;color:#666;">${dateStr}</p>
          </td></tr>
          <tr><td style="padding:0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${bodyHtml}
            </table>
          </td></tr>
          ${summaryLine ? `<tr><td style="padding:18px 0 0 0;border-top:1px solid #eee;"><p style="margin:14px 0 0 0;font-size:12px;color:#999;">${summaryLine}</p></td></tr>` : ""}
          <tr><td style="padding:24px 0 0 0;"><p style="margin:0;font-size:11px;color:#bbb;">Sent daily at 8:00 AM ET from ${BRAND.name} CRM</p></td></tr>
        </table>
      </div>
    `;

    const result = await sendEmail({
      to: toEmail,
      subject: `Today's Schedule — ${dateStr}`,
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
      active: activeEvents.length,
      completed: completedEvents.length,
      to: toEmail,
      messageId: result.messageId,
      date: dateStr,
      query: {
        timezone: "America/New_York",
        start: bounds.iso.start,
        end: bounds.iso.end,
      },
      events: (events || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
        all_day: e.all_day,
        completed: e.completed,
        contact: e.contacts
          ? `${e.contacts.first_name} ${e.contacts.last_name}`.trim()
          : null,
      })),
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
