"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  FoundingDashboardData,
  FoundingDashboardPosition,
  FoundingEmailState,
  FoundingFulfillmentState,
  FoundingPositionState,
} from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Operator = { id: string; email: string };
type Cohort = {
  id: string;
  campaign_key: string;
  capacity: 5;
  checkout_enabled: boolean;
  manual_full: boolean;
  service_timezone: string;
};

function operationFailure(message: string): never {
  throw new Error(message);
}

function databaseFailure(message: string): never {
  console.error(`[founding-operator] ${message}`);
  return operationFailure(message);
}

function campaignKey(): string {
  const value = process.env.FOUNDING_CAMPAIGN_KEY?.trim();
  if (!value || !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(value)) {
    return operationFailure("Founding campaign is unavailable");
  }
  return value;
}

function validId(value: string, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    return operationFailure(`Invalid ${label}`);
  }
  return value;
}

async function requireOperator(): Promise<Operator> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id || !data.user.email) {
    return operationFailure("Not authorized");
  }
  return { id: data.user.id, email: data.user.email };
}

async function getCampaign(client: ReturnType<typeof createAdminClient>): Promise<Cohort> {
  const key = campaignKey();
  const { data, error } = await client
    .from("founding_cohorts")
    .select("id,campaign_key,capacity,checkout_enabled,manual_full,service_timezone")
    .eq("campaign_key", key)
    .maybeSingle();
  if (error || !data || Number(data.capacity) !== 5) {
    return databaseFailure("Founding campaign is unavailable");
  }
  return data as Cohort;
}

function valueFromPayload(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function safeManualReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return reason ? reason.slice(0, 240) : null;
}

function stateOf(value: unknown): FoundingPositionState {
  if (
    value === "PENDING_CHECKOUT" ||
    value === "PURCHASED" ||
    value === "EXPIRED" ||
    value === "MANUAL_REVIEW"
  ) {
    return value;
  }
  return "AVAILABLE";
}

function emailStateOf(value: unknown): FoundingEmailState {
  if (
    value === "PENDING" ||
    value === "PROCESSING" ||
    value === "SENT" ||
    value === "FAILED" ||
    value === "CANCELLED"
  ) {
    return value;
  }
  return "NOT_QUEUED";
}

function fulfillmentStateOf(
  state: FoundingPositionState,
  hasMembership: boolean,
): FoundingFulfillmentState {
  if (state === "MANUAL_REVIEW") return "MANUAL_REVIEW";
  if (hasMembership) return "FULFILLED";
  if (state === "PURCHASED") return "PENDING";
  return "NOT_STARTED";
}

export async function getFoundingDashboard(): Promise<FoundingDashboardData> {
  await requireOperator();
  const client = createAdminClient();
  try {
    const cohort = await getCampaign(client);
    const reservationsResult = await client
      .from("founding_reservations")
      .select("reservation_id,position_number,state,hold_expires_at,purchased_at,cohort_id")
      .eq("cohort_id", cohort.id)
      .order("position_number", { ascending: true });
    if (reservationsResult.error) return databaseFailure("Founding dashboard unavailable");

    const reservations = (reservationsResult.data ?? []) as Array<{
      reservation_id: string;
      position_number: number;
      state: string;
      hold_expires_at: string | null;
      purchased_at: string | null;
      cohort_id: string;
    }>;
    const reservationIds = reservations.map((row) => row.reservation_id);

    const memberships: Array<{
      reservation_id: string;
      contact_id: string;
      service_start_at: string;
      service_end_at: string;
      service_timezone: string;
      lifecycle_state: string;
      contacts:
        | { id: string; first_name: string; last_name: string; email: string | null }
        | Array<{ id: string; first_name: string; last_name: string; email: string | null }>
        | null;
    }> = [];
    const outbox: Array<{
      id: string;
      state: string;
      attempts: number;
      next_attempt_at: string | null;
      last_error: string | null;
      payload: unknown;
    }> = [];
    const events: Array<{
      reservation_id: string | null;
      event_type: string;
      processing_state: string;
      error_summary: string | null;
    }> = [];

    if (reservationIds.length > 0) {
      const [membershipResult, outboxResult, eventsResult] = await Promise.all([
        client
          .from("founding_memberships")
          .select("reservation_id,contact_id,service_start_at,service_end_at,service_timezone,lifecycle_state,contacts(id,first_name,last_name,email)")
          .in("reservation_id", reservationIds),
        client
          .from("email_outbox")
          .select("id,state,attempts,next_attempt_at,last_error,payload")
          .eq("template", "founding_welcome"),
        client
          .from("stripe_webhook_events")
          .select("reservation_id,event_type,processing_state,error_summary")
          .in("reservation_id", reservationIds)
          .order("created_at", { ascending: false }),
      ]);
      if (membershipResult.error || outboxResult.error || eventsResult.error) {
        return databaseFailure("Founding dashboard unavailable");
      }
      memberships.push(...((membershipResult.data ?? []) as unknown as typeof memberships));
      outbox.push(...((outboxResult.data ?? []) as typeof outbox));
      events.push(...((eventsResult.data ?? []) as typeof events));
    }

    const membershipByReservation = new Map(memberships.map((row) => [row.reservation_id, row]));
    const outboxByReservation = new Map<string, (typeof outbox)[number]>();
    for (const job of outbox) {
      const reservationId = valueFromPayload(job.payload, "reservation_id");
      if (reservationId && reservationIds.includes(reservationId) && !outboxByReservation.has(reservationId)) {
        outboxByReservation.set(reservationId, job);
      }
    }
    const eventErrorByReservation = new Map<string, string>();
    for (const event of events) {
      if (!event.reservation_id || eventErrorByReservation.has(event.reservation_id)) continue;
      if (event.event_type === "operator.manual_review") {
        const reason = safeManualReason(event.error_summary);
        if (reason) eventErrorByReservation.set(event.reservation_id, reason);
      } else if (event.processing_state === "FAILED") {
        eventErrorByReservation.set(event.reservation_id, "Checkout fulfillment requires operator review");
      }
    }

    const byPosition = new Map(reservations.map((row) => [Number(row.position_number), row]));
    const positions: FoundingDashboardPosition[] = Array.from({ length: cohort.capacity }, (_, index) => {
      const row = byPosition.get(index + 1);
      if (!row) {
        return {
          positionNumber: index + 1,
          reservationId: null,
          state: "AVAILABLE",
          holdExpiresAt: null,
          purchasedAt: null,
          fulfillmentState: "NOT_STARTED",
          emailState: "NOT_QUEUED",
          emailAttempts: 0,
          emailNextAttemptAt: null,
          contact: null,
          serviceStartAt: null,
          serviceEndAt: null,
          serviceTimezone: cohort.service_timezone,
          operationalError: null,
        };
      }
      const state = stateOf(row.state);
      const membership = membershipByReservation.get(row.reservation_id);
      const job = outboxByReservation.get(row.reservation_id);
      const contact = membership
        ? Array.isArray(membership.contacts)
          ? membership.contacts[0] ?? null
          : membership.contacts
        : null;
      const operationalError =
        eventErrorByReservation.get(row.reservation_id) ??
        (job?.state === "FAILED" ? "Onboarding email delivery needs operator attention" : null);
      return {
        positionNumber: index + 1,
        reservationId: row.reservation_id,
        state,
        holdExpiresAt: state === "PENDING_CHECKOUT" ? row.hold_expires_at : null,
        purchasedAt: row.purchased_at,
        fulfillmentState: fulfillmentStateOf(state, Boolean(membership)),
        emailState: emailStateOf(job?.state),
        emailAttempts: Number(job?.attempts ?? 0),
        emailNextAttemptAt: job?.next_attempt_at ?? null,
        contact: contact
          ? {
              id: contact.id,
              firstName: String(contact.first_name || ""),
              lastName: String(contact.last_name || ""),
              email: contact.email ? String(contact.email) : null,
            }
          : null,
        serviceStartAt: membership?.service_start_at ?? null,
        serviceEndAt: membership?.service_end_at ?? null,
        serviceTimezone: membership?.service_timezone ?? cohort.service_timezone,
        operationalError,
      };
    });

    return {
      campaignKey: cohort.campaign_key,
      capacity: cohort.capacity,
      checkoutEnabled: cohort.checkout_enabled,
      manualFull: cohort.manual_full,
      purchasedCount: positions.filter((position) => position.state === "PURCHASED").length,
      pendingCount: positions.filter((position) => position.state === "PENDING_CHECKOUT").length,
      positions,
    };
  } catch (error) {
    if (error instanceof Error && (error.message === "Not authorized" || error.message === "Founding campaign is unavailable")) {
      throw error;
    }
    return databaseFailure("Founding dashboard unavailable");
  }
}

export async function setFoundingCheckoutClosed(closed: boolean) {
  await requireOperator();
  if (typeof closed !== "boolean") return operationFailure("Invalid checkout state");
  const client = createAdminClient();
  const cohort = await getCampaign(client);
  const { data, error } = await client
    .from("founding_cohorts")
    .update({ manual_full: closed, updated_at: new Date().toISOString() })
    .eq("id", cohort.id)
    .eq("campaign_key", campaignKey())
    .select("manual_full")
    .maybeSingle();
  if (error || !data) return databaseFailure("Unable to update founding checkout state");
  await client.from("activities").insert({
    type: "contact_updated",
    contact_id: null,
    contact_name: null,
    description: `Founding checkout ${closed ? "closed" : "reopened"} by operator`,
  });
  revalidatePath("/founding");
  return { manualFull: Boolean(data.manual_full) };
}

export async function retryFoundingEmail(reservationId: string) {
  await requireOperator();
  const id = validId(reservationId, "reservation");
  const client = createAdminClient();
  const cohort = await getCampaign(client);
  const { data: reservation, error: reservationError } = await client
    .from("founding_reservations")
    .select("reservation_id,cohort_id")
    .eq("reservation_id", id)
    .eq("cohort_id", cohort.id)
    .maybeSingle();
  if (reservationError || !reservation) return operationFailure("Founding reservation not found");
  const { data: jobs, error: jobError } = await client
    .from("email_outbox")
    .select("id,state,attempts,payload")
    .eq("template", "founding_welcome");
  const job = ((jobs ?? []) as Array<{ id: string; state: string; attempts: number; payload: unknown }>).find(
    (candidate) => valueFromPayload(candidate.payload, "reservation_id") === id,
  );
  if (jobError || !job) return operationFailure("Onboarding email job not found");
  if (job.state !== "FAILED" && job.state !== "PENDING") {
    return operationFailure("Only pending or failed onboarding emails can be retried");
  }
  const { data, error } = await client
    .from("email_outbox")
    .update({
      state: "PENDING",
      next_attempt_at: new Date().toISOString(),
      last_error_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
  })
    .eq("id", job.id)
    .eq("template", "founding_welcome")
    .eq("payload->>reservation_id", id)
    .eq("state", job.state)
    .select("id,state")
    .maybeSingle();
  if (error || !data) return databaseFailure("Unable to retry onboarding email");
  await client.from("activities").insert({
    type: "contact_updated",
    contact_id: null,
    contact_name: null,
    description: "Founding onboarding email requeued by operator",
  });
  revalidatePath("/founding");
  return { reservationId: id, state: "PENDING" as const };
}

export async function markFoundingManualReview(reservationId: string, reason: string) {
  await requireOperator();
  const id = validId(reservationId, "reservation");
  const cleanReason = safeManualReason(reason);
  if (!cleanReason || cleanReason.length < 3) return operationFailure("A review reason is required");
  const client = createAdminClient();
  const cohort = await getCampaign(client);
  const { data: reservation, error: reservationError } = await client
    .from("founding_reservations")
    .select("reservation_id,cohort_id,position_number,state")
    .eq("reservation_id", id)
    .eq("cohort_id", cohort.id)
    .maybeSingle();
  if (reservationError || !reservation) return operationFailure("Founding reservation not found");
  if (reservation.state === "PURCHASED") {
    return operationFailure("Purchased founding memberships cannot be moved to manual review");
  }
  const { data: updated, error: updateError } = await client
    .from("founding_reservations")
    .update({ state: "MANUAL_REVIEW", updated_at: new Date().toISOString() })
    .eq("reservation_id", id)
    .eq("cohort_id", cohort.id)
    .select("reservation_id,state")
    .maybeSingle();
  if (updateError || !updated) return databaseFailure("Unable to mark founding reservation for review");

  const eventId = `operator_review:${id}`;
  const { error: eventError } = await client.from("stripe_webhook_events").upsert(
    {
      stripe_event_id: eventId,
      event_type: "operator.manual_review",
      processing_state: "FAILED",
      error_summary: cleanReason,
      reservation_id: id,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_event_id" },
  );
  if (eventError) return databaseFailure("Unable to record founding review reason");
  await client.from("activities").insert({
    type: "contact_updated",
    contact_id: null,
    contact_name: null,
    description: `Founding position ${Number(reservation.position_number)} marked for manual review: ${cleanReason}`,
  });
  revalidatePath("/founding");
  return { reservationId: updated.reservation_id as string, state: "MANUAL_REVIEW" as const, reason: cleanReason };
}
