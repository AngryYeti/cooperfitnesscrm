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
      toEmail = "evan@cooper.fitness";
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      toEmail = user?.email || "evan@cooper.fitness";
    }

    if (!toEmail) {
      return NextResponse.json({ error: "No recipient email configured" }, { status: 500 });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPass) {
      return NextResponse.json({ error: "Gmail not configured" }, { status: 500 });
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const todayStart = `${today}T00:00:00`;
    const tomorrowEnd = `${tomorrowStr}T23:59:59`;

    const { data: events, error } = await supabase
      .from("calendar_events")
      .select("*, contacts(first_name, last_name)")
      .lte("start_time", tomorrowEnd)
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
          timeStr = `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
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
        if (event.description) html += `<br><span style="color:#666;font-size:13px;">${event.description}</span>`;
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

    html += `<p style="margin-top:25px;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:15px;">Sent daily from Cooper Fitness CRM</p>`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    await transporter.sendMail({
      from: '"Cooper Fitness" <evan@cooper.fitness>',
      replyTo: "evan@cooper.fitness",
      to: toEmail,
      subject: `Today's Schedule \u2014 ${dateStr}`,
      html,
    });

    return NextResponse.json({ sent: events?.length || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
