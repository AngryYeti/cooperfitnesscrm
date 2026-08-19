import { FoundingConfigError, getFoundingConfig } from "@/lib/founding/config";
import { expireFoundingSession, fulfillCompletedFoundingSession } from "@/lib/founding/fulfillment";
import { constructFoundingWebhookEvent, getFoundingStripe } from "@/lib/founding/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    getFoundingConfig();
  } catch (error) {
    if (!(error instanceof FoundingConfigError)) console.error("[founding-stripe-webhook] configuration unavailable");
    return Response.json({ error: "Webhook unavailable" }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Invalid webhook" }, { status: 400 });
  const body = await request.text();
  let event;
  try {
    event = constructFoundingWebhookEvent(getFoundingStripe(), body, signature);
  } catch {
    return Response.json({ error: "Invalid webhook" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.expired") {
    return Response.json({ received: true, ignored: true });
  }
  try {
    if (event.type === "checkout.session.completed") {
      await fulfillCompletedFoundingSession(getFoundingStripe(), event);
    } else {
      await expireFoundingSession(event);
    }
    return Response.json({ received: true });
  } catch {
    console.error("[founding-stripe-webhook] processing failed");
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
