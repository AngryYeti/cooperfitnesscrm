import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrationDirectoryPath = fileURLToPath(migrationsDirectory);
const migrationFile = readdirSync(migrationDirectoryPath)
  .filter((name) => name.endsWith("_add_founding_cohort_checkout.sql"))
  .sort()
  .at(-1);

assert.ok(migrationFile, "founding checkout migration should exist");
const sql = readFileSync(fileURLToPath(new URL(migrationFile, migrationsDirectory)), "utf8");

function has(pattern, message) {
  assert.match(sql, pattern, message);
}

test("founding checkout schema has the required tables and state constraints", () => {
  for (const table of [
    "founding_cohorts",
    "founding_reservations",
    "stripe_webhook_events",
    "founding_memberships",
    "email_outbox",
  ]) {
    has(new RegExp(`create table(?: if not exists)? public\\.${table}`, "i"), `${table} table is missing`);
    has(new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} must enable RLS`);
  }

  has(/capacity\s+integer[^,]*check\s*\(\s*capacity\s+between\s+1\s+and\s+5\s*\)/i, "cohort capacity must be between one and five");
  has(/checkout_enabled\s+boolean[^,]*default\s+false/i, "checkout must fail closed by default");
  has(/manual_full\s+boolean[^,]*default\s+false/i, "manual full must fail closed by default");
  has(/state\s+text[^,]*check\s*\([^)]*PENDING_CHECKOUT[^)]*PURCHASED[^)]*EXPIRED[^)]*MANUAL_REVIEW/is, "reservation states are incomplete");
  has(/processing_state\s+text[^,]*check\s*\([^)]*RECEIVED[^)]*PROCESSING[^)]*PROCESSED[^)]*FAILED/is, "webhook processing states are incomplete");
  has(/dedupe_key\s+text\s+not null/i, "email outbox needs a deterministic dedupe key");
  has(/dedupe_key\s+text\s+not null\s+unique/i, "email outbox dedupe key must be unique");
  has(/stripe_event_id\s+text\s+not null\s+unique/i, "Stripe event IDs must be unique");
});

test("contacts use a duplicate-safe normalized email uniqueness strategy", () => {
  has(/add column if not exists normalized_email\s+text/i, "normalized_email column is missing");
  has(/update public\.contacts[\s\S]*not exists[\s\S]*d\.email/is, "contact email backfill must leave duplicates untouched");
  has(/create unique index[^;]*contacts[^;]*normalized_email[^;]*where\s+normalized_email\s+is not null/is, "normalized email needs a partial unique index");
});

test("private state-machine functions are transactional and fail closed", () => {
  const privateFunctions = [
    "create_founding_reservation",
    "attach_founding_checkout_session",
    "release_founding_reservation",
    "fulfill_founding_checkout",
    "get_founding_inventory_state",
  ];
  for (const functionName of privateFunctions) {
    has(new RegExp(`create or replace function public\\.${functionName}`, "i"), `${functionName} is missing`);
    has(new RegExp(`revoke all on function public\\.${functionName}[^;]*from public`, "i"), `${functionName} must be private`);
    has(new RegExp(`revoke all on function public\\.${functionName}[^;]*from anon`, "i"), `${functionName} must deny anon`);
    has(new RegExp(`revoke all on function public\\.${functionName}[^;]*from authenticated`, "i"), `${functionName} must deny authenticated`);
    has(new RegExp(`grant execute on function public\\.${functionName}[^;]*to service_role`, "i"), `${functionName} must grant service_role`);
    const functionStart = sql.search(new RegExp(`create or replace function public\\.${functionName}`, "i"));
    const functionBody = sql.slice(functionStart, sql.indexOf("$function$;", functionStart));
    assert.match(functionBody, /security definer/i, `${functionName} must be a definer function`);
    assert.match(functionBody, /set search_path\s*=\s*''/i, `${functionName} must clear search_path`);
  }

  has(/create or replace function public\.create_founding_reservation[\s\S]*for update[\s\S]*capacity[\s\S]*pending_checkout[\s\S]*purchased/is, "reservation creation must lock capacity and count active positions");
  has(/create or replace function public\.fulfill_founding_checkout[\s\S]*stripe_webhook_events[\s\S]*on conflict[\s\S]*do nothing/is, "fulfillment must claim Stripe events idempotently");
  has(/create or replace function public\.fulfill_founding_checkout[\s\S]*founding_memberships[\s\S]*on conflict/is, "membership fulfillment must be replay safe");
  has(/create or replace function public\.fulfill_founding_checkout[\s\S]*stripe_payment_intent_id[\s\S]*MANUAL_REVIEW/is, "payment linkage mismatches must fail closed");
  has(/create or replace function public\.fulfill_founding_checkout[\s\S]*stripe_session_id[\s\S]*linkage mismatch[\s\S]*MANUAL_REVIEW/is, "session linkage mismatches must go to manual review");
  has(/create or replace function public\.fulfill_founding_checkout[\s\S]*begin[\s\S]*exception when others[\s\S]*stripe_webhook_events[\s\S]*FAILED/is, "fulfillment failures must preserve a failed event claim");
  has(/create or replace function public\.get_founding_inventory_state[\s\S]*returns table\s*\(\s*state text[\s\S]*'OPEN'[\s\S]*'HELD'[\s\S]*'FULL'|create or replace function public\.get_founding_inventory_state[\s\S]*'FULL'[\s\S]*'HELD'[\s\S]*'OPEN'/is, "inventory projection must be non-sensitive and state-limited");
  has(/get_founding_inventory_state[\s\S]*'FULL'[\s\S]*0::integer[\s\S]*where not exists/is, "unknown campaigns must fail closed deterministically");
});

test("capacity and idempotency are enforced by database constraints", () => {
  has(/unique index[^;]*founding_reservations[^;]*cohort_id[^;]*position_number[^;]*where[^;]*state\s+in\s*\('PENDING_CHECKOUT',\s*'PURCHASED'\)/is, "active positions need a uniqueness guard");
  has(/unique index[^;]*founding_reservations[^;]*payment_intent[^;]*where[^;]*stripe_payment_intent_id\s+is not null/is, "payment intents need an idempotency guard");
  has(/reservation_id[^,]*unique/i, "membership reservation linkage must be unique");
  has(/stripe_session_id[^,]*unique/i, "membership session linkage must be unique");
  has(/stripe_payment_intent_id[^,]*unique/i, "membership payment linkage must be unique");
  has(/check\s*\(\s*service_end_at\s*>\s*service_start_at\s*\)/i, "membership service dates need a database check");
  has(/service_timezone[\s\S]*founding_memberships[\s\S]*v_cohort\.service_timezone/is, "fulfillment must use cohort timezone");
  has(/founding_reservations[\s\S]*capacity[^\n]*5|capacity[^\n]*default\s+5/is, "the founding capacity must default to five");
});
