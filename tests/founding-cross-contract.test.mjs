import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const publicRoot = new URL("../cooper-fitness-founding/", root);
const readPublic = (path) => readFileSync(new URL(path, publicRoot), "utf8");

test("checkout metadata and redirect paths match the public verifier contract", () => {
  const stripe = read("src/lib/founding/stripe.ts");
  assert.match(stripe, /campaign:\s*["']founding-fathers-2026["']/);
  assert.match(stripe, /offer:\s*["']12-week-coaching["']/);
  assert.match(stripe, /cohort:\s*["']founding["']/);
  assert.match(stripe, /campaign_key:\s*input\.config\.campaignKey/);
  assert.match(stripe, /reservation_id:\s*input\.reservationId/);
  assert.match(stripe, /cancel_url:\s*`\$\{input\.config\.siteOrigin\}\/founding\/cancel`/);
  assert.doesNotMatch(stripe, /founding\/cancelled/);
});

test("CRM checkout and public session verifier share the same exact offer contract", () => {
  const verifier = readPublic("src/lib/founding/session-status.ts");
  const env = read(".env.example");
  assert.match(verifier, /FOUNDING_CAMPAIGN\s*=\s*["']founding-fathers-2026["']/);
  assert.match(verifier, /FOUNDING_OFFER\s*=\s*["']12-week-coaching["']/);
  assert.match(verifier, /FOUNDING_COHORT\s*=\s*["']founding["']/);
  assert.match(verifier, /FOUNDING_AMOUNT\s*=\s*39900/);
  assert.match(verifier, /FOUNDING_CURRENCY\s*=\s*["']usd["']/);
  assert.match(readPublic("src/app/(marketing)/founding/cancel/page.tsx"), /No payment was taken/);
  assert.match(env, /^FOUNDING_CAMPAIGN_KEY=founding-fathers-2026$/m);
});

test("founding origin allows only local HTTP and keeps production HTTPS-only", () => {
  const config = read("src/lib/founding/config.ts");
  assert.match(config, /parsed\.hostname\s*===\s*["']localhost["']/);
  assert.match(config, /parsed\.hostname\s*===\s*["']127\.0\.0\.1["']/);
  assert.match(config, /parsed\.protocol\s*!==\s*["']https:["'][\s\S]*localHttp/);
});

test("paid-session retrieval does not expand customer details", () => {
  const stripe = read("src/lib/founding/stripe.ts");
  assert.match(stripe, /checkout\.sessions\.retrieve\(sessionId\)/);
  assert.doesNotMatch(stripe, /retrieve\(sessionId,\s*\{\s*expand:\s*\[[^\]]*customer_details/);
});

test("fulfillment uses the reservation's authoritative purchaser names", () => {
  const sql = read("supabase/migrations/20260820100000_harden_founding_crm_contracts.sql");
  assert.match(sql, /v_reservation\.first_name/);
  assert.match(sql, /v_reservation\.last_name/);
  assert.doesNotMatch(sql, /coalesce\(nullif\(pg_catalog\.btrim\(p_first_name\)/);
});

test("manual-review fallback is an atomic, campaign-scoped RPC", () => {
  const store = read("src/lib/founding/store.ts");
  const fulfillment = read("src/lib/founding/fulfillment.ts");
  const sql = read("supabase/migrations/20260820100000_harden_founding_crm_contracts.sql");
  const fallback = store.slice(store.indexOf("export async function markFoundingSessionManualReview"));
  assert.match(store, /mark_founding_session_manual_review/);
  assert.match(store, /p_campaign_key/);
  assert.match(fulfillment, /config\.campaignKey/);
  assert.match(sql, /mark_founding_session_manual_review[\s\S]*founding_cohorts[\s\S]*for update[\s\S]*founding_reservations[\s\S]*for update/i);
  assert.match(sql, /mark_founding_session_manual_review[\s\S]*stripe_webhook_events[\s\S]*on conflict/i);
  assert.match(sql, /v_reservation\.state\s*<>\s*'PURCHASED'/i);
  assert.doesNotMatch(fallback, /from\(["']founding_reservations["']\)[\s\S]*\.update/);
});

test("fulfillment RPC pins campaign, event, price, amount, and currency", () => {
  const store = read("src/lib/founding/store.ts");
  const sql = read("supabase/migrations/20260820100000_harden_founding_crm_contracts.sql");
  assert.match(store, /p_campaign_key/);
  assert.match(store, /p_price_id/);
  assert.match(store, /p_product_id/);
  assert.match(sql, /p_campaign_key[^\n]*text[\s\S]*founding-fathers-2026/);
  assert.match(sql, /p_event_type[\s\S]{0,160}'checkout\.session\.completed'/i);
  assert.match(sql, /p_price_id[\s\S]{0,160}'price_1UBFsOK67H8U3fOqRw3dEIhw'/i);
  assert.match(sql, /p_product_id[\s\S]{0,160}'prod_VBd8KVVN9wW0cM'/i);
  assert.match(sql, /p_amount_cents[\s\S]{0,40}<>\s*39900/i);
  assert.match(sql, /p_currency[\s\S]{0,160}'usd'/i);
});

test("email retry requires purchased membership linkage", () => {
  const sql = read("supabase/migrations/20260820100000_harden_founding_crm_contracts.sql");
  assert.match(sql, /retry_founding_email[\s\S]*v_reservation\.state\s*<>\s*'PURCHASED'/i);
  assert.match(sql, /retry_founding_email[\s\S]*founding_memberships[\s\S]*reservation_id\s*=\s*v_reservation\.reservation_id/i);
  assert.match(sql, /retry_founding_email[\s\S]*payload\s*->>\s*'membership_id'\s*=\s*v_membership\.id::text/i);
});

test("new privileged contract functions fail closed at the SQL boundary", () => {
  const sql = read("supabase/migrations/20260820100000_harden_founding_crm_contracts.sql");
  assert.match(sql, /mark_founding_session_manual_review[\s\S]*security definer[\s\S]*set search_path\s*=\s*''/i);
  assert.match(sql, /fulfill_founding_checkout[\s\S]*security definer[\s\S]*set search_path\s*=\s*''/i);
  assert.match(sql, /retry_founding_email[\s\S]*security definer[\s\S]*set search_path\s*=\s*''/i);
  assert.match(sql, /grant execute on function public\.fulfill_founding_checkout[\s\S]*to service_role/i);
  assert.match(sql, /revoke all on function public\.fulfill_founding_checkout[\s\S]*from authenticated/i);
});
