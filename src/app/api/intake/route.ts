import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const { packetId, returnUrl } = await request.json();

    if (!packetId) {
      return NextResponse.json({ error: "packetId required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: packet, error } = await supabase
      .from("intake_packets")
      .select("*, contacts(first_name, last_name, email), intake_forms(*)")
      .eq("id", packetId)
      .single();

    if (error || !packet) {
      return NextResponse.json({ error: "Packet not found" }, { status: 404 });
    }

    const contact = packet.contacts as { first_name: string; last_name: string; email: string };
    if (!contact.email) {
      return NextResponse.json({ error: "Contact has no email" }, { status: 400 });
    }

    const filledForms = (packet.intake_forms as { id: string; form_type: string; form_title: string; status: string }[]).filter(
      (f) => f.status === "filled"
    );

    if (filledForms.length === 0) {
      return NextResponse.json({ error: "No filled forms" }, { status: 400 });
    }

    const intakeLink = `${returnUrl || process.env.VERCEL_DOMAIN || "https://cooper-fitness.vercel.app"}/onboarding/${packet.access_token}`;

    await supabase
      .from("intake_packets")
      .update({
        status: "sent",
        signing_url: intakeLink,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", packetId);

    await supabase.from("intake_audit").insert({
      packet_id: packetId,
      contact_id: packet.contact_id,
      action: "packet_sent",
      details: "Intake link sent via email",
    });

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (gmailUser && gmailPass) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });

      await transporter.sendMail({
        from: '"Cooper Fitness" <evan@cooper.fitness>',
        replyTo: "evan@cooper.fitness",
        to: contact.email,
        subject: "Cooper Fitness - Complete Your Intake Forms",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2>Welcome to Cooper Fitness, ${contact.first_name}!</h2>
            <p>Please complete your intake forms using the secure link below:</p>
            <a href="${intakeLink}" style="display:inline-block;background:#171717;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:20px 0;">Complete Intake Forms</a>
            <p style="color:#666;font-size:14px;">This link is unique to you. Please do not share it.</p>
            <hr style="margin-top:30px;border:none;border-top:1px solid #eee;">
            <p style="font-size:12px;color:#999;">Cooper Fitness CRM</p>
          </div>
        `,
      });
    }

    return NextResponse.json({ success: true, intakeLink });
  } catch (err) {
    console.error("Send intake error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
