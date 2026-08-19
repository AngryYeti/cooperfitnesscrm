import "server-only";
import type { FoundingConfig } from "./types";

const EXPECTED_PRICE_ID = "price_1U5WCxK67H8U3fOqXS60McFP";
const APPROVED_PRODUCT_ID = "prod_V5hcsMgIEK4Srk";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class FoundingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoundingConfigError";
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new FoundingConfigError(`Missing founding configuration: ${name}`);
  return value;
}

function boolean(name: string): boolean {
  const value = required(name).toLowerCase();
  if (value !== "true" && value !== "false") {
    throw new FoundingConfigError(`Invalid founding boolean: ${name}`);
  }
  return value === "true";
}

function url(name: string): string {
  const value = required(name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new FoundingConfigError(`Invalid founding URL: ${name}`);
  }
  if (parsed.protocol !== "https:") {
    throw new FoundingConfigError(`Founding URL must use HTTPS: ${name}`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function timezone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    throw new FoundingConfigError("Invalid founding service timezone");
  }
  return value;
}

export function getFoundingConfig(): FoundingConfig {
  const campaignEnabled = boolean("FOUNDING_CAMPAIGN_ENABLED");
  const checkoutEnabled = boolean("FOUNDING_CHECKOUT_ENABLED");
  const campaignKey = required("FOUNDING_CAMPAIGN_KEY");
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(campaignKey)) {
    throw new FoundingConfigError("Invalid founding campaign key");
  }

  const stripePriceId = required("FOUNDING_STRIPE_PRICE_ID");
  if (stripePriceId !== EXPECTED_PRICE_ID) {
    throw new FoundingConfigError("Founding Stripe Price ID is not the approved price");
  }
  const stripeProductId = required("FOUNDING_STRIPE_PRODUCT_ID");
  if (stripeProductId !== APPROVED_PRODUCT_ID) {
    throw new FoundingConfigError("Founding Stripe Product ID is not the approved product");
  }
  const expectedAmountCents = Number(required("FOUNDING_EXPECTED_AMOUNT_CENTS"));
  if (!Number.isInteger(expectedAmountCents) || expectedAmountCents !== 29900) {
    throw new FoundingConfigError("Founding amount must be exactly 29900 cents");
  }
  const expectedCurrency = required("FOUNDING_EXPECTED_CURRENCY").toLowerCase();
  if (expectedCurrency !== "usd") {
    throw new FoundingConfigError("Founding currency must be usd");
  }
  const capacity = Number(required("FOUNDING_CAPACITY"));
  if (!Number.isInteger(capacity) || capacity !== 5) {
    throw new FoundingConfigError("Founding capacity must be exactly five");
  }
  const serviceTimezone = timezone(required("FOUNDING_SERVICE_TIMEZONE"));
  const siteOrigin = url("FOUNDING_SITE_ORIGIN");
  const internalApiSecret = required("FOUNDING_INTERNAL_API_SECRET");
  const stripeWebhookSecret = required("FOUNDING_STRIPE_WEBHOOK_SECRET");
  if (internalApiSecret.length < 32 || stripeWebhookSecret.length < 16) {
    throw new FoundingConfigError("Founding secrets are too short");
  }
  const supportEmail = required("FOUNDING_SUPPORT_EMAIL");
  if (!EMAIL_PATTERN.test(supportEmail) || supportEmail.length > 254) {
    throw new FoundingConfigError("Invalid founding support email");
  }

  return {
    campaignEnabled,
    checkoutEnabled,
    campaignKey,
    stripePriceId,
    stripeProductId,
    expectedAmountCents,
    expectedCurrency: "usd",
    capacity,
    serviceTimezone,
    siteOrigin,
    internalApiSecret,
    stripeWebhookSecret,
    supportEmail,
    termsUrl: url("FOUNDING_TERMS_URL"),
    privacyUrl: url("FOUNDING_PRIVACY_URL"),
    refundPolicyUrl: url("FOUNDING_REFUND_POLICY_URL"),
  };
}

export { APPROVED_PRODUCT_ID, EXPECTED_PRICE_ID };
