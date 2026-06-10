import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUrgentLeadEvent } from "@/lib/urgent-lead-event";
import { getFullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function dollarsFromCents(cents: number | null | undefined): number | null {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  return Math.round(cents) / 100;
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY in Vercel env." },
      { status: 500 }
    );
  }
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 }
    );
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "signature verification failed";
    console.error("[stripe-webhook] signature verification failed");
    return NextResponse.json(
      { error: `Invalid signature: ${message}` },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const fullSession =
        session.customer_details || session.amount_total == null
          ? await stripe.checkout.sessions.retrieve(session.id, {
              expand: ["line_items", "customer_details"],
            })
          : session;

      const email =
        fullSession.customer_details?.email || fullSession.customer_email || null;
      const name =
        fullSession.customer_details?.name ||
        (fullSession.metadata?.name as string | undefined) ||
        null;
      const amount = dollarsFromCents(fullSession.amount_total);
      const productName =
        fullSession.line_items?.data?.[0]?.description ||
        fullSession.metadata?.product ||
        "Website purchase";

      const result = await handleLeadFromStripe({
        email,
        name,
        amount,
        productName,
        contextLabel: `Website purchase — ${productName}`,
        stripeEventId: event.id,
        source: "checkout.session",
        stripeCreatedAt: fullSession.created
          ? new Date(fullSession.created * 1000).toISOString()
          : new Date().toISOString(),
      });

      return NextResponse.json({ received: true, ...result }, { status: 200 });
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      let receipt: Stripe.Charge.BillingDetails | undefined;
      if (intent.latest_charge) {
        const chargeId =
          typeof intent.latest_charge === "string"
            ? intent.latest_charge
            : intent.latest_charge.id;
        const charge = await stripe.charges.retrieve(chargeId);
        receipt = charge.billing_details;
      }
      const email = receipt?.email || intent.receipt_email || null;
      const name = receipt?.name || (intent.metadata?.name as string | undefined) || null;
      const amount = dollarsFromCents(intent.amount);
      const productName =
        intent.metadata?.product ||
        intent.description ||
        "Website purchase";

      const result = await handleLeadFromStripe({
        email,
        name,
        amount,
        productName,
        contextLabel: `Website purchase — ${productName}`,
        stripeEventId: event.id,
        source: "payment_intent",
        stripeCreatedAt: intent.created
          ? new Date(intent.created * 1000).toISOString()
          : new Date().toISOString(),
      });

      return NextResponse.json({ received: true, ...result }, { status: 200 });
    }

    return NextResponse.json({ received: true, ignored: event.type }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler error";
    console.error("[stripe-webhook] handler error");
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

async function handleLeadFromStripe({
  email,
  name,
  amount,
  productName,
  contextLabel,
  stripeEventId,
  source,
  stripeCreatedAt,
}: {
  email: string | null;
  name: string | null;
  amount: number | null;
  productName: string;
  contextLabel: string;
  stripeEventId: string;
  source: "checkout.session" | "payment_intent";
  stripeCreatedAt: string;
}) {
  if (!email) {
    console.warn("[stripe-webhook]", stripeEventId, "no email on event; skipping");
    return { skipped: true, reason: "no_email" };
  }

  const displayName = name?.trim() || email;
  const nameParts = displayName.split(/\s+/);
  const firstName = nameParts[0] || displayName;
  const lastName = nameParts.slice(1).join(" ") || "Unknown";

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, status")
    .eq("email", email)
    .maybeSingle();

  let contactId: string;
  let merged = false;
  let contactFullName: string;

  if (existing) {
    contactId = existing.id;
    contactFullName = getFullName(existing.first_name, existing.last_name);
    merged = true;

    await supabase.from("activities").insert({
      type: "contact_updated",
      contact_id: contactId,
      contact_name: contactFullName,
      description: `Website purchase received from ${contactFullName}${
        amount != null ? ` ($${amount.toFixed(2)})` : ""
      }`,
    });

    if (existing.status === "Lead") {
      await supabase
        .from("contacts")
        .update({ status: "Trial" })
        .eq("id", contactId);
    }
  } else {
    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        status: "Lead",
        source: "Website",
        date_added: new Date().toISOString(),
        tags: ["Website Lead", "Website Purchase"],
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    contactId = contact.id;
    contactFullName = getFullName(firstName, lastName);

    await supabase.from("activities").insert({
      type: "contact_created",
      contact_id: contactId,
      contact_name: contactFullName,
      description: `Website purchase from ${contactFullName}${
        amount != null ? ` ($${amount.toFixed(2)})` : ""
      }`,
    });
  }

  const urgentEvent = await createUrgentLeadEvent({
    supabase,
    contactId,
    contactName: contactFullName,
    source: "website_purchase",
    contextLabel,
    amount,
  });

  if (amount != null && amount > 0) {
    await supabase.from("revenue").insert({
      stripe_event_id: stripeEventId,
      contact_id: contactId,
      product_name: productName,
      amount_cents: Math.round(amount * 100),
      currency: "usd",
      status: "succeeded",
      source,
      stripe_created_at: stripeCreatedAt,
    });
  }

  console.log("[stripe-webhook] processed purchase");

  return {
    contactId,
    contactName: contactFullName,
    urgentEventId: urgentEvent?.id ?? null,
    merged,
    amount,
  };
}
