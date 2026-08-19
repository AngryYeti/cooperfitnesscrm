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
  const migration = read("supabase/migrations/20260822100000_task7_fix_round2.sql");
  assert.match(migration, /insert into public\.founding_cohorts/i);
  assert.match(migration, /founding-fathers-2026/);
  assert.match(migration, /5\s*,\s*false\s*,\s*true\s*,\s*'America\/Toronto'/i);
  assert.match(migration, /on conflict\s*\(campaign_key\)\s*do update/i);
  assert.match(migration, /capacity\s*=\s*5/i);
  assert.match(migration, /checkout_enabled\s*=\s*false/i);
  assert.match(migration, /manual_full\s*=\s*true/i);
});

test("active-position index upgrade diagnoses duplicates before changing the index", () => {
  const migration = read("supabase/migrations/20260822100000_task7_fix_round2.sql");
  const preflight = migration.indexOf("duplicate active/manual-review position");
  const dropIndex = migration.indexOf("drop index if exists");
  assert.ok(preflight >= 0 && preflight < dropIndex);
  assert.match(migration, /group by cohort_id, position_number[\s\S]*having count\(\*\) > 1/i);
  assert.match(migration, /raise exception[\s\S]*using[\s\S]*hint/i);
  assert.match(migration, /operator remediation/i);
});

test("stale PROCESSING email recovery is explicit, linked, audited, and operator-gated", () => {
  const migration = read("supabase/migrations/20260822100000_task7_fix_round2.sql");
  const actions = read("src/lib/actions/founding.ts");
  const types = read("src/lib/types.ts");
  const dashboard = read("src/components/founding/founding-dashboard.tsx");
  assert.match(migration, /recover_founding_processing_email/);
  assert.match(migration, /state\s*=\s*'PROCESSING'[\s\S]*updated_at\s*<=\s*pg_catalog\.now\(\)\s*-\s*interval '30 minutes'/i);
  assert.match(migration, /founding_memberships[\s\S]*reservation_id\s*=\s*v_reservation\.reservation_id/i);
  assert.match(migration, /email_outbox[\s\S]*state\s*=\s*'PROCESSING'[\s\S]*payload[\s\S]*membership_id/i);
  assert.match(migration, /insert into public\.activities/);
  assert.match(migration, /I_HAVE_VERIFIED_EMAIL_NOT_SENT/);
  assert.match(migration, /grant execute on function public\.recover_founding_processing_email[\s\S]*to service_role/i);
  assert.match(actions, /recoverFoundingProcessingEmail/);
  assert.match(actions, /FOUNDING_EMAIL_RECOVERY_CONFIRMATION/);
  assert.match(actions, /FOUNDING_EMAIL_RECOVERY_AGE_MS\s*=\s*30\s*\*\s*60\s*\*\s*1000/);
  assert.match(actions, /emailRecoveryEligible[\s\S]*Date\.parse\(job\.updated_at\)/);
  assert.match(types, /FOUNDING_EMAIL_RECOVERY_CONFIRMATION\s*=\s*["']I_HAVE_VERIFIED_EMAIL_NOT_SENT["']/);
  assert.match(actions, /requireOperator/);
  assert.match(dashboard, /emailRecoveryEligible/);
  assert.match(dashboard, /FOUNDING_EMAIL_RECOVERY_CONFIRMATION/);
  assert.match(dashboard, /placeholder=\{FOUNDING_EMAIL_RECOVERY_CONFIRMATION\}/);
  assert.match(dashboard, /Recover email/);
});

test("dashboard occupied summary includes manual review", () => {
  const actions = read("src/lib/actions/founding.ts");
  const dashboard = read("src/components/founding/founding-dashboard.tsx");
  assert.match(actions, /pendingCount:\s*positions\.filter\([\s\S]*PENDING_CHECKOUT[\s\S]*MANUAL_REVIEW/);
  assert.match(dashboard, /Occupied holds|occupied/i);
});

test("launch seed stays manually full while the existing operator reopen action remains explicit", () => {
  const migration = read("supabase/migrations/20260822100000_task7_fix_round2.sql");
  const actions = read("src/lib/actions/founding.ts");
  const dashboard = read("src/components/founding/founding-dashboard.tsx");
  assert.match(migration, /manual_full\s*=\s*true/);
  assert.match(actions, /setFoundingCheckoutClosed[\s\S]*p_closed:\s*closed/);
  assert.match(dashboard, /Reopen checkout/);
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
