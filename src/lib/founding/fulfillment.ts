import "server-only";
import type Stripe from "stripe";
import { getFoundingConfig } from "./config";
import {
  fulfillFoundingCheckout,
  markFoundingSessionManualReview,
  releaseFoundingReservation,
} from "./store";
import {
  getSessionReservationId,
  FoundingSessionValidationError,
  retrieveAndValidatePaidSession,
} from "./stripe";

export async function fulfillCompletedFoundingSession(
  stripe: Stripe,
  event: Stripe.Event,
) {
  const config = getFoundingConfig();
  const session = event.data.object as Stripe.Checkout.Session;
  try {
    const paid = await retrieveAndValidatePaidSession(stripe, session.id, config);
    const result = await fulfillFoundingCheckout({
      eventId: event.id,
      eventType: event.type,
      sessionId: paid.sessionId,
      paymentIntentId: paid.paymentIntentId,
      customerId: paid.customerId,
      email: paid.email,
      firstName: paid.firstName,
      lastName: paid.lastName,
      amountCents: paid.amountCents,
      currency: paid.currency,
      paidAt: paid.paidAt,
    });
    if (!result) throw new Error("Founding fulfillment returned no result");
    if (result.result === "FAILED") {
      const marked = await markFoundingSessionManualReview(
        session.id,
        event.id,
        "Founding fulfillment could not match a live reservation",
      );
      if (!marked) throw new Error("Founding paid session requires operator review");
      return { ...result, result: "MANUAL_REVIEW" };
    }
    return result;
  } catch (error) {
    if (!(error instanceof FoundingSessionValidationError)) throw error;
    const reason = error instanceof Error ? error.message : "Founding payment validation failed";
    const marked = await markFoundingSessionManualReview(session.id, event.id, reason);
    if (!marked) throw new Error("Founding paid session requires operator review");
    return { result: "MANUAL_REVIEW", reservation_id: null, contact_id: null, membership_id: null };
  }
}

export async function expireFoundingSession(event: Stripe.Event): Promise<{ released: boolean }> {
  const config = getFoundingConfig();
  const session = event.data.object as Stripe.Checkout.Session;
  const reservationId = getSessionReservationId(session, config.campaignKey);
  if (!reservationId) return { released: false };
  return { released: await releaseFoundingReservation(reservationId, session.id) };
}
