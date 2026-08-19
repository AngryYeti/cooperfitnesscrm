import "server-only";
import Stripe from "stripe";
import { EXPECTED_PRICE_ID, getFoundingConfig } from "./config";
import type { FoundingConfig } from "./types";

export class FoundingSessionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoundingSessionValidationError";
  }
}

export function getFoundingStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("Stripe is not configured");
  return new Stripe(secretKey);
}

export async function createFoundingCheckoutSession(input: {
  stripe: Stripe;
  config: FoundingConfig;
  reservationId: string;
  email: string;
}): Promise<Stripe.Checkout.Session> {
  const now = Math.floor(Date.now() / 1000);
  return input.stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: EXPECTED_PRICE_ID, quantity: 1 }],
    customer_email: input.email,
    client_reference_id: input.reservationId,
    metadata: {
      campaign_key: input.config.campaignKey,
      reservation_id: input.reservationId,
    },
    expires_at: now + 30 * 60,
    success_url: `${input.config.siteOrigin}/founding/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.config.siteOrigin}/founding/cancelled`,
  });
}

export function constructFoundingWebhookEvent(
  stripe: Stripe,
  body: string,
  signature: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(body, signature, getFoundingConfig().stripeWebhookSecret);
}

export interface ValidatedPaidSession {
  sessionId: string;
  paymentIntentId: string;
  customerId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  reservationId: string;
  amountCents: number;
  currency: string;
  paidAt: string;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function retrieveAndValidatePaidSession(
  stripe: Stripe,
  sessionId: string,
  config = getFoundingConfig(),
): Promise<ValidatedPaidSession> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["customer_details"] });
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 10,
    expand: ["data.price.product"],
  });
  if (session.status !== "complete" || session.payment_status !== "paid" || session.mode !== "payment") {
    throw new FoundingSessionValidationError("Founding Checkout Session is not a completed payment");
  }
  if (session.amount_total !== config.expectedAmountCents || session.currency !== config.expectedCurrency) {
    throw new FoundingSessionValidationError("Founding Checkout amount or currency mismatch");
  }
  if (session.metadata?.campaign_key !== config.campaignKey) throw new FoundingSessionValidationError("Founding campaign metadata mismatch");
  const reservationId = stringValue(session.metadata?.reservation_id);
  if (!reservationId || session.client_reference_id !== reservationId) {
    throw new FoundingSessionValidationError("Founding reservation metadata mismatch");
  }
  const paymentIntentId = stringValue(session.payment_intent);
  if (!paymentIntentId) throw new FoundingSessionValidationError("Founding payment intent is missing");
  if (lineItems.data.length !== 1 || lineItems.data[0]?.quantity !== 1) {
    throw new FoundingSessionValidationError("Founding Checkout line items are invalid");
  }
  const item = lineItems.data[0];
  const price = item.price;
  const productId = typeof price?.product === "string" ? price.product : price?.product?.id;
  if (
    price?.id !== EXPECTED_PRICE_ID ||
    productId !== config.stripeProductId ||
    price.unit_amount !== config.expectedAmountCents ||
    price.currency !== config.expectedCurrency ||
    price.type !== "one_time" ||
    item.amount_total !== config.expectedAmountCents
  ) {
    throw new FoundingSessionValidationError("Founding Checkout product validation failed");
  }
  const email = stringValue(session.customer_details?.email) || stringValue(session.customer_email);
  if (!email) throw new FoundingSessionValidationError("Founding purchaser email is missing");
  const name = stringValue(session.customer_details?.name) || email;
  const nameParts = name.trim().split(/\s+/);
  return {
    sessionId: session.id,
    paymentIntentId,
    customerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
    email: email.toLowerCase(),
    firstName: nameParts[0] || "Founding",
    lastName: nameParts.slice(1).join(" ") || "Member",
    reservationId,
    amountCents: config.expectedAmountCents,
    currency: config.expectedCurrency,
    paidAt: new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
  };
}

export function getSessionReservationId(session: Stripe.Checkout.Session, campaignKey: string): string | null {
  if (session.metadata?.campaign_key !== campaignKey) return null;
  const reservationId = stringValue(session.metadata?.reservation_id);
  return reservationId && session.client_reference_id === reservationId ? reservationId : null;
}
