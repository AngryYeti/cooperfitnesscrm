import { sendEmail, isEmailConfigured, BRAND } from "@/lib/email";

export interface FoundingWelcomeArgs {
  email: string;
  firstName: string;
  amount: number | null;
}

/**
 * Where customers book their intro call.
 * Today this is a Calendly link. When the in-house booking page ships,
 * change this env var (or pass a per-customer token URL) and nothing
 * else in this file needs to move.
 */
function getBookingUrl(): string | null {
  const url = process.env.BOOKING_URL?.trim();
  if (!url) return null;
  if (!/^https:\/\//i.test(url)) return null; // never email a non-https link
  return url;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildFoundingWelcomeEmail({
  firstName,
  amount,
}: Omit<FoundingWelcomeArgs, "email">) {
  const name = firstName?.trim() || "there";
  const paid = amount != null && amount > 0 ? `$${amount.toFixed(2)} USD` : null;
  const bookingUrl = getBookingUrl();

  const subject = "You're in — let's book your first call";

  // If BOOKING_URL isn't set we degrade to a promise rather than
  // emailing a broken or empty link.
  const bookingText = bookingUrl
    ? [
        `First step: book your intro call.`,
        bookingUrl,
        ``,
        `Twenty to thirty minutes on Zoom. We'll go through your training history, your schedule, what's worked before and what hasn't.`,
      ]
    : [
        `First step is a short intro call — twenty to thirty minutes on Zoom. I'll email you a link to book it within 24 hours.`,
      ];

  const text = [
    `Hi ${name},`,
    ``,
    `Your Founding spot is confirmed. Six months of coaching, starting with a conversation.`,
    ``,
    ...bookingText,
    ``,
    `Your intake form will follow once we have a time in the diary — training background, injuries, equipment you can get to, and how your week actually looks. Filling it in before we speak means we spend the call on you rather than on admin.`,
    ``,
    `I won't send you a program before we've talked. Writing a plan without knowing your history, your schedule, and what you've already tried is how people end up with something that looks impressive and never gets done.`,
    ``,
    `After the call I'll build your first block — 3-4 sessions a week, around 45 minutes each.`,
    ``,
    `Any questions in the meantime, just reply. This comes straight to me.`,
    ``,
    `Evan`,
    `Cooper Fitness`,
    ...(paid
      ? [``, `Payment received: ${paid}. Stripe has sent your receipt separately.`]
      : []),
  ].join("\n");

  const bookingHtml = bookingUrl
    ? `<p><strong>First step: book your intro call.</strong></p>
  <p style="margin:20px 0;">
    <a href="${escapeHtml(bookingUrl)}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;">Book your call</a>
  </p>
  <p>Twenty to thirty minutes on Zoom. We'll go through your training history, your schedule, what's worked before and what hasn't.</p>`
    : `<p><strong>First step is a short intro call</strong> — twenty to thirty minutes on Zoom. I'll email you a link to book it within 24 hours.</p>`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;">
  <p>Hi ${escapeHtml(name)},</p>
  <p>Your Founding spot is confirmed. Six months of coaching, starting with a conversation.</p>
  ${bookingHtml}
  <p>Your intake form will follow once we have a time in the diary — training background, injuries, equipment you can get to, and how your week actually looks. Filling it in before we speak means we spend the call on you rather than on admin.</p>
  <p>I won't send you a program before we've talked. Writing a plan without knowing your history, your schedule, and what you've already tried is how people end up with something that looks impressive and never gets done.</p>
  <p>After the call I'll build your first block — 3–4 sessions a week, around 45 minutes each.</p>
  <p>Any questions in the meantime, just reply. This comes straight to me.</p>
  <p>Evan<br/>Cooper Fitness</p>
  ${paid ? `<p style="color:#666;font-size:14px;">Payment received: ${escapeHtml(paid)}. Stripe has sent your receipt separately.</p>` : ""}
</div>`.trim();

  return { subject, text, html, hasBookingLink: Boolean(bookingUrl) };
}

/**
 * Sends the founding-offer welcome email.
 * Never throws — the caller is a Stripe webhook and must still return 200.
 */
export async function sendFoundingWelcomeEmail(
  args: FoundingWelcomeArgs
): Promise<{ ok: boolean; subject: string; hasBookingLink: boolean; error?: string }> {
  const { subject, text, html, hasBookingLink } = buildFoundingWelcomeEmail(args);

  if (!hasBookingLink) {
    console.warn("[welcome-email] BOOKING_URL not set — sent fallback wording.");
  }

  if (!isEmailConfigured()) {
    return { ok: false, subject, hasBookingLink, error: "email_not_configured" };
  }

  try {
    const result = await sendEmail({
      to: args.email,
      subject,
      html,
      text,
      replyTo: BRAND.replyTo,
    });
    return { ok: result.ok, subject, hasBookingLink, error: result.error };
  } catch (err) {
    return {
      ok: false,
      subject,
      hasBookingLink,
      error: err instanceof Error ? err.message : "send_failed",
    };
  }
}
