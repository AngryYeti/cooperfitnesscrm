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
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function configuredOperatorEmails(): Set<string> {
  const raw = process.env.FOUNDING_OPERATOR_EMAILS?.trim();
  if (!raw) return new Set();
  const values = raw.split(",").map((value) => value.trim().toLowerCase());
  if (values.some((value) => !EMAIL_PATTERN.test(value) || value.length > 254)) return new Set();
  return new Set(values);
}

async function authenticatedOperator(): Promise<Operator | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id || !data.user.email) {
    return null;
  }
  return { id: data.user.id, email: data.user.email.trim().toLowerCase() };
}

export async function isFoundingOperator(): Promise<boolean> {
  const operator = await authenticatedOperator();
  return Boolean(operator && configuredOperatorEmails().has(operator.email));
}

async function requireOperator(): Promise<Operator> {
  const operator = await authenticatedOperator();
  if (!operator || !configuredOperatorEmails().has(operator.email)) {
    return operationFailure("Not authorized");
  }
  return operator;
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

type DashboardReservation = {
  reservation_id: string;
  position_number: number;
  state: string;
  hold_expires_at: string | null;
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
  cohort_id: string;
};

function reservationRank(row: DashboardReservation): [number, string, string, string] {
  const activeRank = row.state === "PURCHASED" || row.state === "PENDING_CHECKOUT" || row.state === "MANUAL_REVIEW" ? 0 : 1;
  return [activeRank, row.updated_at || "", row.created_at || "", row.reservation_id];
}

function selectAuthoritativeReservations(rows: DashboardReservation[]): DashboardReservation[] {
  const selected = new Map<number, DashboardReservation>();
  for (const row of rows) {
    const current = selected.get(Number(row.position_number));
    if (!current) {
      selected.set(Number(row.position_number), row);
      continue;
    }
    const next = reservationRank(row);
    const previous = reservationRank(current);
    if (
      next[0] < previous[0] ||
      (next[0] === previous[0] &&
        (next[1] > previous[1] ||
          (next[1] === previous[1] &&
            (next[2] > previous[2] || (next[2] === previous[2] && next[3] > previous[3])))))
    ) {
      selected.set(Number(row.position_number), row);
    }
  }
  return [...selected.values()];
}

export async function getFoundingDashboard(): Promise<FoundingDashboardData> {
  await requireOperator();
  const client = createAdminClient();
  try {
    const cohort = await getCampaign(client);
    const reservationsResult = await client
      .from("founding_reservations")
      .select("reservation_id,position_number,state,hold_expires_at,purchased_at,created_at,updated_at,cohort_id")
      .eq("cohort_id", cohort.id)
      .order("position_number", { ascending: true })
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (reservationsResult.error) return databaseFailure("Founding dashboard unavailable");

    const reservations = selectAuthoritativeReservations(
      (reservationsResult.data ?? []) as DashboardReservation[],
    );
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
  const operator = await requireOperator();
  if (typeof closed !== "boolean") return operationFailure("Invalid checkout state");
  const client = createAdminClient();
  const { data, error } = await client.rpc("set_founding_checkout_state", {
    p_campaign_key: campaignKey(),
    p_closed: closed,
    p_operator_email: operator.email,
  });
  if (error) return databaseFailure("Unable to update founding checkout state");
  const result = (Array.isArray(data) ? data[0] : data) as { manual_full?: boolean } | null;
  if (!result || typeof result.manual_full !== "boolean") return databaseFailure("Unable to update founding checkout state");
  revalidatePath("/founding");
  return { manualFull: result.manual_full };
}

export async function retryFoundingEmail(reservationId: string) {
  const operator = await requireOperator();
  const id = validId(reservationId, "reservation");
  const client = createAdminClient();
  const { data, error } = await client.rpc("retry_founding_email", {
    p_campaign_key: campaignKey(),
    p_reservation_id: id,
    p_operator_email: operator.email,
  });
  if (error) return databaseFailure("Unable to retry onboarding email");
  const result = (Array.isArray(data) ? data[0] : data) as { reservation_id?: string; state?: string } | null;
  if (!result || result.reservation_id !== id || result.state !== "PENDING") return databaseFailure("Unable to retry onboarding email");
  revalidatePath("/founding");
  return { reservationId: id, state: "PENDING" as const };
}

export async function markFoundingManualReview(reservationId: string, reason: string) {
  const operator = await requireOperator();
  const id = validId(reservationId, "reservation");
  const cleanReason = safeManualReason(reason);
  if (!cleanReason || cleanReason.length < 3) return operationFailure("A review reason is required");
  const client = createAdminClient();
  const { data, error } = await client.rpc("mark_founding_manual_review", {
    p_campaign_key: campaignKey(),
    p_reservation_id: id,
    p_reason: cleanReason,
    p_operator_email: operator.email,
  });
  if (error) return databaseFailure("Unable to mark founding reservation for review");
  const result = (Array.isArray(data) ? data[0] : data) as { reservation_id?: string; state?: string; reason?: string } | null;
  if (!result || result.reservation_id !== id || result.state !== "MANUAL_REVIEW") return databaseFailure("Unable to mark founding reservation for review");
  revalidatePath("/founding");
  return { reservationId: id, state: "MANUAL_REVIEW" as const, reason: result.reason || cleanReason };
}
