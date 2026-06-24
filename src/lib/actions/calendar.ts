"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CalendarEvent, CalendarEventPriority, CalendarEventSource } from "@/lib/types";
import { getFullName } from "@/lib/utils";
import { sendEmail, BRAND } from "@/lib/email";
import { format } from "date-fns";

// Helper function to format dates for .ics files (UTC: YYYYMMDDTHHmmSSZ)
function formatICSDate(dateStr: string) {
  const d = new Date(dateStr);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// Helper function to format dates for date-only all-day events (YYYYMMDD)
function formatDateOnly(dateStr: string) {
  const d = new Date(dateStr);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

export async function sendCalendarInvite(
  event: CalendarEvent,
  clientEmail: string,
  clientName: string
) {
  const dtStamp = formatICSDate(new Date().toISOString());
  
  let dtStartLine = `DTSTART:${formatICSDate(event.start_time)}`;
  let dtEndLine = `DTEND:${formatICSDate(event.end_time)}`;
  
  if (event.all_day) {
    dtStartLine = `DTSTART;VALUE=DATE:${formatDateOnly(event.start_time)}`;
    dtEndLine = `DTEND;VALUE=DATE:${formatDateOnly(event.end_time)}`;
  }

  const title = event.title;
  const description = event.description || "";

  // Escape special characters for .ics
  const escapeICS = (str: string) =>
    str
      .replace(/\\/g, "\\\\")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;")
      .replace(/\n/g, "\\n");

  const escapedTitle = escapeICS(title);
  const escapedDescription = escapeICS(description);

  // Construct iCalendar invite content
  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cooper Fitness CRM//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${event.id}@cooperfitnesscrm.com`,
    `DTSTAMP:${dtStamp}`,
    dtStartLine,
    dtEndLine,
    `SUMMARY:${escapedTitle}`,
    `DESCRIPTION:${escapedDescription}`,
    `ORGANIZER;CN="Cooper Fitness":MAILTO:${BRAND.replyTo}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${clientName}":MAILTO:${clientEmail}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const icsContent = icsLines.join("\r\n");

  // Construct Google Calendar TEMPLATE link
  const gcalDates = event.all_day
    ? `${formatDateOnly(event.start_time)}/${formatDateOnly(event.end_time)}`
    : `${formatICSDate(event.start_time)}/${formatICSDate(event.end_time)}`;
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${gcalDates}&details=${encodeURIComponent(description)}`;

  const eventDateTimeStr = event.all_day
    ? `${format(new Date(event.start_time), "EEEE, MMMM d, yyyy")} (All Day)`
    : `${format(new Date(event.start_time), "EEEE, MMMM d, yyyy 'at' h:mm a")} - ${format(new Date(event.end_time), "h:mm a")}`;

  const subject = `Calendar Invite: ${title}`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;border:1px solid #e5e7eb;padding:30px;border-radius:12px;">
      <h2 style="color:#2563eb;margin-top:0;margin-bottom:20px;font-size:24px;border-bottom:2px solid #eff6ff;padding-bottom:10px;">Calendar Invitation</h2>
      <p style="font-size:16px;">Hi ${clientName},</p>
      <p style="font-size:16px;">You have been invited to the following event with <strong>Cooper Fitness</strong>:</p>
      
      <div style="background-color:#f9fafb;border-left:4px solid #2563eb;padding:15px;border-radius:0 8px 8px 0;margin:25px 0;">
        <p style="margin:5px 0;font-size:16px;"><strong>Event:</strong> ${title}</p>
        <p style="margin:5px 0;font-size:16px;"><strong>Date/Time:</strong> ${eventDateTimeStr}</p>
        ${description ? `<p style="margin:5px 0;font-size:16px;"><strong>Details:</strong> ${description}</p>` : ""}
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="${gcalUrl}" target="_blank" style="background-color:#2563eb;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;display:inline-block;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          Add to Google Calendar
        </a>
      </div>

      <p style="font-size:14px;color:#4b5563;margin-top:30px;">
        Alternatively, you can open the attached <strong>invite.ics</strong> file to add this event to your preferred calendar client (Apple Calendar, Outlook, etc.).
      </p>
      
      <hr style="margin-top:40px;border:none;border-top:1px solid #e5e7eb;">
      <p style="font-size:12px;color:#9ca3af;margin-bottom:0;text-align:center;">
        Sent from ${BRAND.name} CRM
      </p>
    </div>
  `;

  return await sendEmail({
    to: clientEmail,
    subject,
    html,
    replyTo: BRAND.replyTo,
    attachments: [
      {
        filename: "invite.ics",
        content: icsContent,
        contentType: "text/calendar; charset=utf-8; method=REQUEST",
      },
    ],
  });
}

export async function getCalendarEvents(startDate: string, endDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*, contacts(first_name, last_name)")
    .lte("start_time", endDate)
    .gte("end_time", startDate)
    .order("start_time", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as CalendarEvent[];
}

export async function createCalendarEvent(
  event: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    all_day?: boolean;
    contact_id?: string | null;
    color?: string;
    google_event_id?: string | null;
    priority?: CalendarEventPriority;
    source?: CalendarEventSource | null;
  },
  sendInvite?: boolean
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      title: event.title,
      description: event.description || null,
      start_time: event.start_time,
      end_time: event.end_time,
      all_day: event.all_day || false,
      contact_id: event.contact_id || null,
      color: event.color || "#2563eb",
      google_event_id: event.google_event_id || null,
      priority: event.priority || "normal",
      source: event.source || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (event.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name,last_name,email")
      .eq("id", event.contact_id)
      .single();

    const fullName = contact ? getFullName(contact.first_name, contact.last_name) : "Client";

    await supabase.from("activities").insert({
      type: "calendar_event_created",
      contact_id: event.contact_id,
      contact_name: contact ? getFullName(contact.first_name, contact.last_name) : null,
      description: `Created calendar event: ${event.title}`,
    });

    if (sendInvite && contact?.email) {
      try {
        const result = await sendCalendarInvite(data as CalendarEvent, contact.email, fullName);
        if (result.ok) {
          await supabase.from("activities").insert({
            type: "contact_updated",
            contact_id: event.contact_id,
            contact_name: fullName,
            description: `Sent calendar invitation for "${event.title}" to ${contact.email}`,
          });
        } else {
          console.error("Failed to send calendar invite email:", result.error);
        }
      } catch (err) {
        console.error("Error in sending calendar invite:", err);
      }
    }
  }

  revalidatePath("/calendar");
  return data as CalendarEvent;
}

export async function updateCalendarEvent(
  id: string,
  event: Partial<{
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    all_day: boolean;
    contact_id: string | null;
    color: string;
    google_event_id: string | null;
    priority: CalendarEventPriority;
    source: CalendarEventSource | null;
  }>,
  sendInvite?: boolean
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .update(event)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  const activeContactId = event.contact_id !== undefined ? event.contact_id : data.contact_id;

  if (activeContactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name,last_name,email")
      .eq("id", activeContactId)
      .single();

    const fullName = contact ? getFullName(contact.first_name, contact.last_name) : "Client";

    await supabase.from("activities").insert({
      type: "calendar_event_updated",
      contact_id: activeContactId,
      contact_name: contact ? getFullName(contact.first_name, contact.last_name) : null,
      description: `Updated calendar event: ${event.title || data.title}`,
    });

    if (sendInvite && contact?.email) {
      try {
        const result = await sendCalendarInvite(data as CalendarEvent, contact.email, fullName);
        if (result.ok) {
          await supabase.from("activities").insert({
            type: "contact_updated",
            contact_id: activeContactId,
            contact_name: fullName,
            description: `Sent calendar invitation for "${event.title || data.title}" to ${contact.email}`,
          });
        } else {
          console.error("Failed to send calendar invite email:", result.error);
        }
      } catch (err) {
        console.error("Error in sending calendar invite:", err);
      }
    }
  }

  revalidatePath("/calendar");
  return data as CalendarEvent;
}

export async function deleteCalendarEvent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/calendar");
}

export async function toggleEventCompleted(
  id: string,
  completed: boolean
) {
  const supabase = await createClient();

  const { data: cols, error: colsError } = await supabase
    .from("calendar_events")
    .select("completed")
    .limit(1);

  if (
    !colsError &&
    Array.isArray(cols) &&
    cols.length > 0 &&
    cols[0] &&
    !("completed" in cols[0])
  ) {
    const err = new Error(
      "MISSING_COLUMN: The 'completed' column is missing. Run supabase/calendar-completed-migration.sql in the Supabase SQL Editor."
    );
    Object.assign(err, { code: "MISSING_COLUMN" });
    throw err;
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id, title, contact_id, contacts(first_name, last_name)")
    .single();

  if (error) {
    if (
      error.message?.includes("column") &&
      error.message?.includes("completed")
    ) {
      const err = new Error(
        "MISSING_COLUMN: The 'completed' column is missing. Run supabase/calendar-completed-migration.sql in the Supabase SQL Editor."
      );
      Object.assign(err, { code: "MISSING_COLUMN" });
      throw err;
    }
    throw new Error(error.message);
  }

  if (data?.contact_id && data?.contacts) {
    const contact = data.contacts as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ as {
      first_name: string;
      last_name: string;
    };
    await supabase.from("activities").insert({
      type: completed ? "calendar_event_completed" : "calendar_event_uncompleted",
      contact_id: data.contact_id,
      contact_name: getFullName(contact.first_name, contact.last_name),
      description: `${completed ? "Completed" : "Reopened"} calendar event: ${data.title}`,
    });
  }

  return data;
}
