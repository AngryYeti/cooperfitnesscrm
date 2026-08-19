import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  FoundingEmailDetails,
  FoundingInventoryState,
  InventoryState,
  OutboxJob,
  Reservation,
} from "./types";

function throwIfError(error: { message?: string } | null): void {
  if (error) throw new Error(error.message || "Founding database operation failed");
}

export async function getFoundingInventory(campaignKey: string): Promise<InventoryState> {
  const { data, error } = await createAdminClient().rpc("get_founding_inventory_state", {
    p_campaign_key: campaignKey,
  });
  throwIfError(error);
  const row = (Array.isArray(data) ? data[0] : data) as Partial<InventoryState> | null;
  const state: FoundingInventoryState = row?.state === "OPEN" || row?.state === "HELD" ? row.state : "FULL";
  return {
    state,
    purchased_count: Number(row?.purchased_count ?? 0),
    pending_count: Number(row?.pending_count ?? 0),
    capacity: Number(row?.capacity ?? 0),
  };
}

export type FoundingSessionStatus = "FULFILLED" | "PROCESSING" | "NOT_FOUND";

export async function getFoundingSessionStatus(
  campaignKey: string,
  sessionId: string,
): Promise<FoundingSessionStatus> {
  const client = createAdminClient();
  const { data: cohort, error: cohortError } = await client
    .from("founding_cohorts")
    .select("id")
    .eq("campaign_key", campaignKey)
    .maybeSingle();
  throwIfError(cohortError);
  if (!cohort) return "NOT_FOUND";

  const { data: reservation, error: reservationError } = await client
    .from("founding_reservations")
    .select("reservation_id,state")
    .eq("cohort_id", cohort.id)
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  throwIfError(reservationError);
  if (!reservation) return "NOT_FOUND";

  const [membership, processedEvent] = await Promise.all([
    client
      .from("founding_memberships")
      .select("id")
      .eq("reservation_id", reservation.reservation_id)
      .maybeSingle(),
    client
      .from("stripe_webhook_events")
      .select("id")
      .eq("reservation_id", reservation.reservation_id)
      .eq("event_type", "checkout.session.completed")
      .eq("processing_state", "PROCESSED")
      .limit(1)
      .maybeSingle(),
  ]);
  throwIfError(membership.error);
  throwIfError(processedEvent.error);
  if (reservation.state === "PURCHASED" && membership.data && processedEvent.data) {
    return "FULFILLED";
  }
  return "PROCESSING";
}

export async function reserveFoundingCapacity(input: {
  campaignKey: string;
  email: string;
  firstName: string;
  lastName: string;
}): Promise<Reservation> {
  const { data, error } = await createAdminClient().rpc("create_founding_reservation", {
    p_campaign_key: input.campaignKey,
    p_email: input.email,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: null,
    p_hold_minutes: 30,
  });
  throwIfError(error);
  const row = (Array.isArray(data) ? data[0] : data) as Reservation | null;
  if (!row?.reservation_id || !row.hold_expires_at) throw new Error("Reservation was not created");
  return row;
}

export async function attachFoundingCheckout(input: {
  reservationId: string;
  sessionId: string;
  customerId: string | null;
  expiresAt: string;
}): Promise<Reservation> {
  const { data, error } = await createAdminClient().rpc("attach_founding_checkout_session", {
    p_reservation_id: input.reservationId,
    p_stripe_session_id: input.sessionId,
    p_stripe_customer_id: input.customerId,
    p_hold_expires_at: input.expiresAt,
  });
  throwIfError(error);
  const row = (Array.isArray(data) ? data[0] : data) as Reservation | null;
  if (!row) throw new Error("Checkout session was not attached");
  return row;
}

export async function releaseFoundingReservation(reservationId: string, sessionId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("release_founding_reservation", {
    p_reservation_id: reservationId,
    p_stripe_session_id: sessionId,
  });
  throwIfError(error);
  return data === true;
}

export async function expireUnattachedFoundingReservation(reservationId: string): Promise<void> {
  const result = await createAdminClient().from("founding_reservations").update({
    state: "EXPIRED",
    expired_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("reservation_id", reservationId).eq("state", "PENDING_CHECKOUT").is("stripe_session_id", null);
  throwIfError(result.error);
}

export async function fulfillFoundingCheckout(input: {
  campaignKey: string;
  priceId: string;
  productId: string;
  eventId: string;
  eventType: string;
  sessionId: string;
  paymentIntentId: string;
  customerId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  amountCents: number;
  currency: string;
  paidAt: string;
}) {
  const { data, error } = await createAdminClient().rpc("fulfill_founding_checkout", {
    p_campaign_key: input.campaignKey,
    p_price_id: input.priceId,
    p_product_id: input.productId,
    p_stripe_event_id: input.eventId,
    p_event_type: input.eventType,
    p_stripe_session_id: input.sessionId,
    p_payment_intent_id: input.paymentIntentId,
    p_stripe_customer_id: input.customerId,
    p_email: input.email,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: null,
    p_amount_cents: input.amountCents,
    p_currency: input.currency,
    p_paid_at: input.paidAt,
  });
  throwIfError(error);
  return (Array.isArray(data) ? data[0] : data) as {
    reservation_id: string | null;
    contact_id: string | null;
    membership_id: string | null;
    result: string;
  } | null;
}

export async function markFoundingSessionManualReview(
  campaignKey: string,
  sessionId: string,
  eventId: string,
  reason: string,
): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("mark_founding_session_manual_review", {
    p_campaign_key: campaignKey,
    p_stripe_session_id: sessionId,
    p_stripe_event_id: eventId,
    p_reason: reason,
  });
  throwIfError(error);
  const row = (Array.isArray(data) ? data[0] : data) as { reservation_id?: string | null; state?: string } | null;
  return row?.state === "MANUAL_REVIEW";
}

export async function claimEmailOutboxJobs(limit = 10): Promise<OutboxJob[]> {
  const client = createAdminClient();
  const { data, error } = await client
    .from("email_outbox")
    .select("id,dedupe_key,template,recipient,payload,state,attempts")
    .eq("state", "PENDING")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 25));
  throwIfError(error);
  const jobs: OutboxJob[] = [];
  for (const candidate of (data ?? []) as OutboxJob[]) {
    const claimed = await client
      .from("email_outbox")
      .update({ state: "PROCESSING", attempts: candidate.attempts + 1, updated_at: new Date().toISOString() })
      .eq("id", candidate.id)
      .eq("state", "PENDING")
      .select("id,dedupe_key,template,recipient,payload,state,attempts")
      .maybeSingle();
    throwIfError(claimed.error);
    if (claimed.data) jobs.push(claimed.data as OutboxJob);
  }
  return jobs;
}

export async function getFoundingEmailDetails(job: OutboxJob): Promise<FoundingEmailDetails | null> {
  const payload = job.payload ?? {};
  const contactId = typeof payload.contact_id === "string" ? payload.contact_id : null;
  const membershipId = typeof payload.membership_id === "string" ? payload.membership_id : null;
  if (!contactId || !membershipId) return null;
  const client = createAdminClient();
  const [contact, membership] = await Promise.all([
    client.from("contacts").select("first_name").eq("id", contactId).maybeSingle(),
    client.from("founding_memberships").select("service_start_at,service_end_at").eq("id", membershipId).maybeSingle(),
  ]);
  throwIfError(contact.error);
  throwIfError(membership.error);
  if (!contact.data || !membership.data) return null;
  return {
    recipient: job.recipient,
    firstName: String(contact.data.first_name || "there"),
    serviceStartAt: String(membership.data.service_start_at),
    serviceEndAt: String(membership.data.service_end_at),
  };
}

export async function markEmailOutboxSent(id: string, providerMessageId: string | null): Promise<void> {
  const result = await createAdminClient().from("email_outbox").update({
    state: "SENT",
    provider_message_id: providerMessageId,
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("state", "PROCESSING");
  throwIfError(result.error);
}

export async function markEmailOutboxFailed(id: string, attempts: number, errorMessage: string): Promise<void> {
  const exhausted = attempts >= 5;
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  const result = await createAdminClient().from("email_outbox").update({
    state: exhausted ? "FAILED" : "PENDING",
    next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    last_error_at: new Date().toISOString(),
    last_error: errorMessage.slice(0, 500),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("state", "PROCESSING");
  throwIfError(result.error);
}
