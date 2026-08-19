import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const text = (path) => readFileSync(new URL(path, root), "utf8");

test("founding server modules and route handlers exist", () => {
  for (const path of [
    "src/lib/founding/config.ts",
    "src/lib/founding/types.ts",
    "src/lib/founding/store.ts",
    "src/lib/founding/stripe.ts",
    "src/lib/founding/validation.ts",
    "src/lib/founding/fulfillment.ts",
    "src/lib/founding/welcome-email.ts",
    "src/app/api/founding/inventory/route.ts",
    "src/app/api/founding/checkout-session/route.ts",
    "src/app/api/webhooks/stripe/founding/route.ts",
    "src/app/api/founding/email-outbox/route.ts",
  ]) {
    assert.ok(existsSync(new URL(path, root)), `${path} is missing`);
  }
});

test("checkout is server-authoritative and webhook uses raw-body verification", () => {
  const checkout = text("src/app/api/founding/checkout-session/route.ts");
  const webhook = text("src/app/api/webhooks/stripe/founding/route.ts");
  assert.match(text("src/lib/founding/validation.ts"), /timingSafeEqual|constant.?time/i);
  assert.match(text("src/lib/founding/store.ts"), /create_founding_reservation/);
  assert.match(checkout, /expires_at/);
  assert.match(text("src/lib/founding/config.ts"), /price_1U5WCxK67H8U3fOqXS60McFP/);
  assert.match(webhook, /request\.text\(\)/);
  assert.match(text("src/lib/founding/stripe.ts"), /constructEvent/);
  assert.match(webhook, /checkout\.session\.completed/);
  assert.match(webhook, /checkout\.session\.expired/);
});

test("founding checkout configuration is documented and middleware routes are narrow", () => {
  const env = text(".env.example");
  for (const key of [
    "FOUNDING_CAMPAIGN_ENABLED",
    "FOUNDING_CHECKOUT_ENABLED",
    "FOUNDING_CAMPAIGN_KEY",
    "FOUNDING_STRIPE_PRICE_ID",
    "FOUNDING_STRIPE_PRODUCT_ID",
    "FOUNDING_EXPECTED_AMOUNT_CENTS",
    "FOUNDING_EXPECTED_CURRENCY",
    "FOUNDING_CAPACITY",
    "FOUNDING_SERVICE_TIMEZONE",
    "FOUNDING_SITE_ORIGIN",
    "FOUNDING_INTERNAL_API_SECRET",
    "FOUNDING_STRIPE_WEBHOOK_SECRET",
    "FOUNDING_SUPPORT_EMAIL",
    "FOUNDING_TERMS_URL",
    "FOUNDING_PRIVACY_URL",
    "FOUNDING_REFUND_POLICY_URL",
  ]) assert.match(env, new RegExp(`^${key}=`, "m"), `${key} missing`);

  const middleware = text("src/lib/supabase/middleware.ts");
  assert.match(middleware, /api\/founding\/inventory/);
  assert.match(middleware, /api\/webhooks\/stripe\/founding/);
  assert.doesNotMatch(middleware, /pathname\.startsWith\("\/api\/webhooks"\)/);
});
