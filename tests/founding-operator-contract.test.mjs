import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("founding operator action module is server-only and authenticated", () => {
  const source = read("src/lib/actions/founding.ts");
  assert.match(source, /["']use server["']/);
  assert.match(source, /createClient\(\)/);
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /getFoundingDashboard/);
  assert.match(source, /setFoundingCheckoutClosed/);
  assert.match(source, /retryFoundingEmail/);
  assert.match(source, /markFoundingManualReview/);
  assert.match(source, /FOUNDING_CAMPAIGN_KEY/);
  assert.doesNotMatch(source, /sendEmail|STRIPE_SECRET|SUPABASE_SERVICE_ROLE_KEY/);
});

test("founding operator reads are shaped to safe operational fields", () => {
  const source = read("src/lib/actions/founding.ts");
  assert.match(source, /reservation_id/);
  assert.match(source, /hold_expires_at/);
  assert.match(source, /purchaseState|fulfillmentState/);
  assert.match(source, /service_start_at/);
  assert.match(source, /service_end_at/);
  assert.match(source, /contact_id/);
  assert.match(source, /email_outbox/);
  assert.match(source, /return .*positions/s);
  assert.match(source, /FoundingDashboardPosition/);
  assert.doesNotMatch(source, /stripe_payment_intent_id|stripe_customer_id|raw_body|payment_method/);
});

test("manual controls preserve campaign and outbox invariants", () => {
  const source = read("src/lib/actions/founding.ts");
  assert.match(source, /manual_full/);
  assert.match(source, /checkout_enabled/);
  assert.match(source, /founding_welcome/);
  assert.match(source, /PENDING/);
  assert.match(source, /MANUAL_REVIEW/);
  assert.match(source, /\.eq\(["']cohort_id["']/);
  assert.match(source, /revalidatePath\(["']\/founding["']/);
});

test("founding page and dashboard render all five positions and controls", () => {
  const page = read("src/app/(dashboard)/founding/page.tsx");
  const dashboard = read("src/components/founding/founding-dashboard.tsx");
  const sidebar = read("src/components/layout/sidebar.tsx");
  assert.match(page, /getFoundingDashboard/);
  assert.match(page, /FoundingDashboard/);
  assert.match(dashboard, /length: 5|Array\.from\(\{ length: 5 \}\)/);
  assert.match(dashboard, /Close checkout|Reopen checkout/);
  assert.match(dashboard, /Retry email/);
  assert.match(dashboard, /manual review/i);
  assert.match(sidebar, /name: ["']Founding["']/);
  assert.match(sidebar, /href: ["']\/founding["']/);
});
