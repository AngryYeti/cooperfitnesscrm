import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, BRAND, isEmailConfigured } from "@/lib/email";
import { getFullName } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "Zoho SMTP is not configured. Set ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD in Vercel env vars." },
        { status: 500 }
      );
    }

    const cronSecret = request.headers.get("x-cron-secret");
    const isCron = cronSecret === process.env.CRON_SECRET;

    const supabase = isCron ? createAdminClient() : await createClient();
    let toEmail: string | undefined;

    if (isCron) {
      toEmail = BRAND.replyTo;
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      toEmail = user?.email || BRAND.replyTo;
    }

    if (!toEmail) {
      return NextResponse.json({ error: "No recipient email configured" }, { status: 500 });
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

    let html = `<h2>${BRAND.name} CRM — Pending Follow-Ups</h2>`;

    if (overdue.length > 0) {
      html += `<h3 style="color:#dc2626;">Overdue</h3><ul>`;
      overdue.forEach((fu: any) => {
        html += `<li><strong>${getFullName(fu.contacts?.first_name, fu.contacts?.last_name)}</strong> — ${fu.title} (due ${fu.due_date})</li>`;
      });
      html += `</ul>`;
    }

    if (dueToday.length > 0) {
      html += `<h3 style="color:#2563eb;">Due Today</h3><ul>`;
      dueToday.forEach((fu: any) => {
        html += `<li><strong>${getFullName(fu.contacts?.first_name, fu.contacts?.last_name)}</strong> — ${fu.title}</li>`;
      });
      html += `</ul>`;
    }

    if (upcoming.length > 0) {
      html += `<h3 style="color:#16a34a;">Upcoming</h3><ul>`;
      upcoming.forEach((fu: any) => {
        html += `<li><strong>${getFullName(fu.contacts?.first_name, fu.contacts?.last_name)}</strong> — ${fu.title} (due ${fu.due_date})</li>`;
      });
      html += `</ul>`;
    }

    html += `<p style="margin-top:20px;font-size:12px;color:#666;">Sent every 3 hours from ${BRAND.name} CRM</p>`;

    const result = await sendEmail({
      to: toEmail,
      subject: `${followUps.length} pending follow-up${followUps.length > 1 ? "s" : ""} — ${new Date().toLocaleDateString()}`,
      html,
      replyTo: BRAND.replyTo,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 500 });
    }

    return NextResponse.json({ sent: followUps.length, messageId: result.messageId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
