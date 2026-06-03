import { NextResponse } from "next/server";
import { isEmailConfigured, verifyEmailConnection, getEmailConfig, sendEmail, BRAND } from "@/lib/email";

export async function GET() {
  const config = getEmailConfig();
  const configured = isEmailConfigured();
  const maskedUser = config.user
    ? config.user.replace(/(.{2})(.*)(@.*)/, "$1***$3")
    : null;

  return NextResponse.json({
    configured,
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: maskedUser,
    from: config.from,
    replyTo: BRAND.replyTo,
    message: configured
      ? "Email service is configured. POST to this endpoint to verify connection or send a test email."
      : "Email service is NOT configured. Set ZOHO_SMTP_USER, ZOHO_SMTP_PASSWORD, and EMAIL_FROM in env vars.",
  });
}

export async function POST(request: Request) {
  try {
    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          step: "config",
          error: "Zoho SMTP is not configured. Set ZOHO_SMTP_USER, ZOHO_SMTP_PASSWORD, and EMAIL_FROM in env vars.",
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const testTo: string = body.to || BRAND.replyTo;
    const verifyFirst: boolean = body.verify !== false;

    if (verifyFirst) {
      const verify = await verifyEmailConnection();
      if (!verify.ok) {
        return NextResponse.json(
          {
            ok: false,
            step: "verify",
            error: verify.error,
            code: verify.code,
            hint: "Double-check ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD. For Zoho, this is the app password, not your login password.",
          },
          { status: 500 }
        );
      }
    }

    const result = await sendEmail({
      to: testTo,
      subject: `${BRAND.name} CRM — Test Email`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#16a34a;">✓ Email Service Working</h2>
          <p>Your Zoho SMTP integration is configured correctly.</p>
          <p style="color:#666;font-size:14px;">Sent at: ${new Date().toISOString()}</p>
          <hr style="margin-top:30px;border:none;border-top:1px solid #eee;">
          <p style="font-size:12px;color:#999;">${BRAND.name} CRM</p>
        </div>
      `,
      replyTo: BRAND.replyTo,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          step: "send",
          error: result.error,
          code: result.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      sentTo: testTo,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        step: "exception",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
