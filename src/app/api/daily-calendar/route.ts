import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const cronSecret = request.headers.get("x-cron-secret");
    const isCron = cronSecret === process.env.CRON_SECRET;

    const supabase = await createClient();
    let toEmail: string | undefined;

    if (isCron) {
      toEmail = process.env.REMINDER_EMAIL || process.env.GMAIL_USER;
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      toEmail = user?.email;
    }

    if (!toEmail) {
      return NextResponse.json({ error: "No recipient email configured" }, { status: 500 });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPass) {
      return NextResponse.json({ error: "Gmail not configured" }, { status: 500 });
    }

    const today = new Date().toISOString().split("T")[0];
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;

    const { data: events, error } = await supabase
      .from("calendar_events")
      .select("*, contacts(first_name, last_name)")
      .lte("start_time", todayEnd)
      .gte("end_time", todayStart)
      .order("start_time", { ascending: true });

    if (error) throw new Error(error.message);

    const dateStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let html = `<h2 style="margin-bottom:5px;">Cooper Fitness CRM</h2>`;
    html += `<p style="color:#666;margin-top:0;margin-bottom:20px;">${dateStr}</p>`;

    if (!events || events.length === 0) {
      html += `<p style="color:#666;">No events scheduled for today.</p>`;
    } else {
      html += `<ul style="padding-left:0;list-style:none;">`;
      for (const event of events) {
        const contactName = event.contacts
          ? `${event.contacts.first_name} ${event.contacts.last_name}`
          : "";
        const isAllDay = event.all_day;
        let timeStr = "All day";
        if (!isAllDay) {
          const start = new Date(event.start_time);
          const end = new Date(event.end_time);
          timeStr = `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
        }

        const dotColor = event.color || "#2563eb";
        html += `<li style="margin-bottom:10px;border-left:3px solid ${dotColor};padding-left:10px;">`;
        html += `<strong>${event.title}</strong>`;
        html += `<br><span style="color:#2563eb;">${timeStr}</span>`;
        if (contactName) html += ` &mdash; ${contactName}`;
        if (event.description) html += `<br><span style="color:#666;font-size:13px;">${event.description}</span>`;
        html += `</li>`;
      }
      html += `</ul>`;
      html += `<p style="margin-top:15px;color:#666;font-size:14px;">${events.length} event${events.length > 1 ? "s" : ""} today</p>`;
    }

    html += `<p style="margin-top:25px;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:15px;">Sent daily from Cooper Fitness CRM</p>`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    await transporter.sendMail({
      from: `"Cooper Fitness CRM" <${gmailUser}>`,
      to: toEmail,
      subject: `Today's Schedule \u2014 ${dateStr}`,
      html,
    });

    return NextResponse.json({ sent: events?.length || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
