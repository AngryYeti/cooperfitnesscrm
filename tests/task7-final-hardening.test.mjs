import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("manual review remains an occupied position across all capacity paths", () => {
  const base = read("supabase/migrations/20260817170000_add_founding_cohort_checkout.sql");
  const hardening = read("supabase/migrations/20260821100000_task7_state_safety.sql");
  const contract = read("supabase/migrations/20260820100000_harden_founding_crm_contracts.sql");
  assert.match(hardening, /unique index[\s\S]*state\s+in\s*\([^)]*MANUAL_REVIEW/i);
  assert.match(hardening, /create_founding_reservation[\s\S]*state\s+in\s*\([^)]*MANUAL_REVIEW/i);
  assert.match(hardening, /get_founding_inventory_state[\s\S]*MANUAL_REVIEW/i);
  assert.match(hardening, /pending_count[\s\S]*state = 'MANUAL_REVIEW'/i);
  assert.match(hardening, /counts\.pending_count\s*>=\s*\(c\.capacity\s*-\s*counts\.purchased_count\)/i);
  assert.match(base, /state\s+in\s*\([^)]*MANUAL_REVIEW/i);
  assert.match(contract, /mark_founding_session_manual_review[\s\S]*state\s+<>\s*'PURCHASED'[\s\S]*MANUAL_REVIEW/i);
  assert.match(contract, /mark_founding_session_manual_review[\s\S]*stripe_webhook_events[\s\S]*on conflict/i);
});

test("service start uses signed completion event time, not session creation", () => {
  const stripe = read("src/lib/founding/stripe.ts");
  const fulfillment = read("src/lib/founding/fulfillment.ts");
  assert.doesNotMatch(stripe, /session\.created/);
  assert.match(fulfillment, /event\.created/);
  assert.match(fulfillment, /Number\.isSafeInteger\(event\.created\)/);
  assert.match(fulfillment, /Number\.isFinite\(completedAtDate\.getTime\(\)\)/);
  assert.match(fulfillment, /paidAt/);
});

test("campaign seed is idempotent and disabled by default", () => {
  const migration = read("supabase/migrations/20260821100000_task7_state_safety.sql");
  assert.match(migration, /insert into public\.founding_cohorts/i);
  assert.match(migration, /founding-fathers-2026/);
  assert.match(migration, /5\s*,\s*false\s*,\s*false\s*,\s*'America\/Toronto'/i);
  assert.match(migration, /checkout_enabled[\s\S]*false/i);
  assert.match(migration, /on conflict\s*\(campaign_key\)\s*do nothing/i);
});

test("outbox worker does not automatically reclaim PROCESSING jobs", () => {
  const store = read("src/lib/founding/store.ts");
  assert.doesNotMatch(store, /recovered|staleBefore|updated_at["']\s*\)/i);
  assert.doesNotMatch(store, /lt\(["']updated_at["']/);
  assert.match(store, /\.eq\(["']state["'],\s*["']PENDING["']\)/);
});

test("privileged reservations require exactly a 30-minute hold", () => {
  const store = read("src/lib/founding/store.ts");
  const migration = read("supabase/migrations/20260821100000_task7_state_safety.sql");
  assert.match(store, /p_hold_minutes:\s*30/);
  assert.match(migration, /p_hold_minutes[\s\S]*distinct from\s*30/i);
  assert.match(migration, /revoke all on function public\.create_founding_reservation/i);
  assert.match(migration, /grant execute on function public\.create_founding_reservation/i);
});

test("CRM inventory is server-authenticated and uncached", () => {
  const route = read("src/app/api/founding/inventory/route.ts");
  assert.match(route, /hasValidBearer/);
  assert.match(route, /FOUNDING_INTERNAL_API_SECRET|internalApiSecret/);
  assert.match(route, /Cache-Control["']?\s*:\s*["']no-store/i);
});

test("expired release requires exact public metadata parity", () => {
  const stripe = read("src/lib/founding/stripe.ts");
  assert.match(stripe, /getSessionReservationId[\s\S]*metadata\?\.campaign/);
  assert.match(stripe, /getSessionReservationId[\s\S]*metadata\?\.offer/);
  assert.match(stripe, /getSessionReservationId[\s\S]*metadata\?\.cohort/);
});
