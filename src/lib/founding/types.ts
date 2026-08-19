export type FoundingInventoryState = "OPEN" | "HELD" | "FULL";
export type ReservationState =
  | "PENDING_CHECKOUT"
  | "PURCHASED"
  | "EXPIRED"
  | "MANUAL_REVIEW";

export interface FoundingConfig {
  campaignEnabled: boolean;
  checkoutEnabled: boolean;
  campaignKey: string;
  stripePriceId: string;
  stripeProductId: string;
  expectedAmountCents: number;
  expectedCurrency: "usd";
  capacity: number;
  serviceTimezone: string;
  siteOrigin: string;
  internalApiSecret: string;
  stripeWebhookSecret: string;
  supportEmail: string;
  termsUrl: string;
  privacyUrl: string;
  refundPolicyUrl: string;
}

export interface Reservation {
  reservation_id: string;
  position_number: number;
  state: ReservationState;
  hold_expires_at: string;
}

export interface InventoryState {
  state: FoundingInventoryState;
  purchased_count: number;
  pending_count: number;
  capacity: number;
}

export interface Purchaser {
  name: string;
  email: string;
}

export interface OutboxJob {
  id: string;
  dedupe_key: string;
  template: string;
  recipient: string;
  payload: Record<string, unknown>;
  state: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";
  attempts: number;
}

export interface FoundingEmailDetails {
  recipient: string;
  firstName: string;
  serviceStartAt: string;
  serviceEndAt: string;
}
