import { sendEmail } from "@/lib/email";
import { FoundingConfigError, getFoundingConfig } from "@/lib/founding/config";
import {
  claimEmailOutboxJobs,
  getFoundingEmailDetails,
  markEmailOutboxFailed,
  markEmailOutboxSent,
} from "@/lib/founding/store";
import { renderFoundingWelcomeEmail } from "@/lib/founding/welcome-email";
import { hasValidBearer } from "@/lib/founding/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isOutboxAuthorized(request: Request, secret: string): boolean {
  if (hasValidBearer(request, secret)) return true;
  const cronSecret = process.env.CRON_SECRET?.trim();
  return Boolean(cronSecret && hasValidBearer(request, cronSecret));
}

export async function POST(request: Request) {
  let config;
  try {
    config = getFoundingConfig();
  } catch (error) {
    if (!(error instanceof FoundingConfigError)) console.error("[founding-email-outbox] configuration unavailable");
    return Response.json({ error: "Outbox unavailable" }, { status: 503 });
  }
  if (!isOutboxAuthorized(request, config.internalApiSecret)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let jobs;
  try {
    jobs = await claimEmailOutboxJobs(10);
  } catch {
    return Response.json({ error: "Outbox unavailable" }, { status: 503 });
  }
  let sent = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      if (job.template !== "founding_welcome") throw new Error("Unsupported founding email template");
      const details = await getFoundingEmailDetails(job);
      if (!details) throw new Error("Founding email details are unavailable");
      const message = renderFoundingWelcomeEmail(details, {
        supportEmail: config.supportEmail,
        serviceTimezone: config.serviceTimezone,
      });
      const delivery = await sendEmail({
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: config.supportEmail,
      });
      if (!delivery.ok) throw new Error(delivery.error || "Email provider rejected message");
      await markEmailOutboxSent(job.id, delivery.messageId ?? null);
      sent += 1;
    } catch (error) {
      failed += 1;
      try {
        await markEmailOutboxFailed(job.id, job.attempts, error instanceof Error ? error.message : "Email delivery failed");
      } catch {
        console.error("[founding-email-outbox] failed to record delivery error");
      }
    }
  }
  return Response.json({ received: true, claimed: jobs.length, sent, failed });
}

// Vercel cron invokes Route Handlers with GET. The same bearer checks and
// bounded worker are used for operator-triggered POST requests.
export async function GET(request: Request) {
  return POST(request);
}
