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

    const today = new Date().toISOString().split("T")[0];

    const { data: followUps, error } = await supabase
      .from("follow_ups")
      .select("id, title, due_date, completed, contacts(first_name, last_name)")
      .eq("completed", false)
      .order("due_date", { ascending: true });

    if (error) throw new Error(error.message);
    if (!followUps || followUps.length === 0) {
      return NextResponse.json({ sent: 0, message: "No pending reminders to send." });
    }

    const overdue = followUps.filter((fu: any) => fu.due_date < today);
    const dueToday = followUps.filter((fu: any) => fu.due_date === today);
    const upcoming = followUps.filter((fu: any) => fu.due_date > today);

    let html = `<h2>Cooper Fitness CRM — Pending Follow-Ups</h2>`;

    if (overdue.length > 0) {
      html += `<h3 style="color:#dc2626;">Overdue</h3><ul>`;
      overdue.forEach((fu: any) => {
        html += `<li><strong>${fu.contacts?.first_name} ${fu.contacts?.last_name}</strong> — ${fu.title} (due ${fu.due_date})</li>`;
      });
      html += `</ul>`;
    }

    if (dueToday.length > 0) {
      html += `<h3 style="color:#2563eb;">Due Today</h3><ul>`;
      dueToday.forEach((fu: any) => {
        html += `<li><strong>${fu.contacts?.first_name} ${fu.contacts?.last_name}</strong> — ${fu.title}</li>`;
      });
      html += `</ul>`;
    }

    if (upcoming.length > 0) {
      html += `<h3 style="color:#16a34a;">Upcoming</h3><ul>`;
      upcoming.forEach((fu: any) => {
        html += `<li><strong>${fu.contacts?.first_name} ${fu.contacts?.last_name}</strong> — ${fu.title} (due ${fu.due_date})</li>`;
      });
      html += `</ul>`;
    }

    html += `<p style="margin-top:20px;font-size:12px;color:#666;">Sent every 3 hours from Cooper Fitness CRM</p>`;

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
      subject: `${followUps.length} pending follow-up${followUps.length > 1 ? "s" : ""} — ${new Date().toLocaleDateString()}`,
      html,
    });

    return NextResponse.json({ sent: followUps.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
