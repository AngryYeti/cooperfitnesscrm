import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

export async function POST() {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }
    const resend = new Resend(resendApiKey);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: followUps, error } = await supabase
      .from("follow_ups")
      .select("id, title, due_date, completed, reminder_sent_at, contacts(first_name, last_name)")
      .eq("completed", false)
      .lte("due_date", today)
      .is("reminder_sent_at", null)
      .order("due_date", { ascending: true });

    if (error) throw new Error(error.message);
    if (!followUps || followUps.length === 0) {
      return NextResponse.json({ sent: 0, message: "No pending reminders to send." });
    }

    const overdue = followUps.filter((fu: any) => fu.due_date < today);
    const dueToday = followUps.filter((fu: any) => fu.due_date === today);

    let html = `<h2>Cooper Fitness CRM — Follow-Up Reminders</h2>`;

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

    html += `<p style="margin-top:20px;font-size:12px;color:#666;">Sent from Cooper Fitness CRM</p>`;

    const fromEmail = process.env.EMAIL_FROM || "onboarding@resend.dev";

    await resend.emails.send({
      from: `Cooper Fitness CRM <${fromEmail}>`,
      to: user.email,
      subject: `You have ${followUps.length} follow-up${followUps.length > 1 ? "s" : ""} pending`,
      html,
    });

    const ids = followUps.map((fu: any) => fu.id);
    await supabase
      .from("follow_ups")
      .update({ reminder_sent_at: new Date().toISOString() })
      .in("id", ids);

    return NextResponse.json({ sent: followUps.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
