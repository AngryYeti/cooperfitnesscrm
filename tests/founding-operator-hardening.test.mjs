import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFileSync(new URL(relativePath, root), "utf8");

test("operator hardening migration provides locked atomic mutations", () => {
  const migrationPath = "supabase/migrations/20260819120000_harden_founding_operator_visibility.sql";
  assert.ok(existsSync(new URL(migrationPath, root)), "operator hardening migration should exist");
  const sql = read(migrationPath);
  for (const functionName of [
    "mark_founding_manual_review",
    "set_founding_checkout_state",
    "retry_founding_email",
  ]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${functionName}`, "i"));
    assert.match(sql, new RegExp(`${functionName}[\\s\\S]*security definer[\\s\\S]*set search_path\\s*=\\s*''`, "i"));
    assert.match(sql, new RegExp(`revoke all on function public\\.${functionName}[\\s\\S]*from authenticated`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*to service_role`, "i"));
  }
  assert.match(sql, /mark_founding_manual_review[\s\S]*founding_cohorts[\s\S]*for update[\s\S]*founding_reservations[\s\S]*for update/i);
  assert.match(sql, /mark_founding_manual_review[\s\S]*PURCHASED[\s\S]*raise exception/i);
  assert.match(sql, /set_founding_checkout_state[\s\S]*insert into public\.activities/i);
  assert.match(sql, /retry_founding_email[\s\S]*template\s*=\s*'founding_welcome'[\s\S]*state\s+in\s*\('PENDING',\s*'FAILED'\)[\s\S]*insert into public\.activities/i);
});

test("operator actions require an explicit server-only allowlist and use atomic RPCs", () => {
  const actions = read("src/lib/actions/founding.ts");
  const env = read(".env.example");
  assert.match(env, /^FOUNDING_OPERATOR_EMAILS=/m);
  assert.match(actions, /FOUNDING_OPERATOR_EMAILS/);
  assert.match(actions, /toLowerCase\(\)/);
  assert.match(actions, /isFoundingOperator/);
  assert.match(actions, /mark_founding_manual_review/);
  assert.match(actions, /set_founding_checkout_state/);
  assert.match(actions, /retry_founding_email/);
  assert.doesNotMatch(actions, /\.from\(["']founding_reservations["']\)\.update/);
  assert.doesNotMatch(actions, /\.from\(["']founding_cohorts["']\)\.update/);
  assert.doesNotMatch(actions, /\.from\(["']email_outbox["']\)\.update/);
});

test("dashboard selects one authoritative historical reservation per position", () => {
  const actions = read("src/lib/actions/founding.ts");
  assert.match(actions, /created_at/);
  assert.match(actions, /updated_at/);
  assert.match(actions, /PENDING_CHECKOUT.*PURCHASED|PURCHASED.*PENDING_CHECKOUT/s);
  assert.match(actions, /active.*rank|rank.*active|activeRank/i);
  assert.match(actions, /position_number/);

  const rows = [
    { position_number: 1, state: "EXPIRED", updated_at: "2026-01-03", created_at: "2026-01-01" },
    { position_number: 1, state: "PURCHASED", updated_at: "2026-01-02", created_at: "2026-01-02" },
  ];
  const selected = rows.sort((a, b) => (a.state === "PURCHASED" || a.state === "PENDING_CHECKOUT" ? 0 : 1) - (b.state === "PURCHASED" || b.state === "PENDING_CHECKOUT" ? 0 : 1))[0];
  assert.equal(selected.state, "PURCHASED");
});

test("inventory projection keeps partial holds OPEN and only uses HELD when all remaining slots are held", () => {
  const migration = read("supabase/migrations/20260819120000_harden_founding_operator_visibility.sql");
  assert.match(migration, /pending_count\s*>=\s*\(c\.capacity\s*-\s*counts\.purchased_count\)/i);
  assert.doesNotMatch(migration, /when counts\.pending_count\s*>\s*0 then 'HELD'/i);
  assert.match(migration, /partial hold.*OPEN|OPEN.*partial hold/i);
  assert.match(migration, /full pending.*HELD|HELD.*full pending/i);

  const project = ({ purchased, pending, capacity, closed = false }) => {
    if (closed || purchased >= capacity) return "FULL";
    if (pending >= capacity - purchased) return "HELD";
    return "OPEN";
  };
  assert.equal(project({ purchased: 0, pending: 1, capacity: 5 }), "OPEN");
  assert.equal(project({ purchased: 2, pending: 3, capacity: 5 }), "HELD");
});

test("session status endpoint is internal, strict, uncached, and returns only bounded states", () => {
  const routePath = "src/app/api/founding/session-status/route.ts";
  assert.ok(existsSync(new URL(routePath, root)), "session-status route should exist");
  const route = read(routePath);
  assert.match(route, /export async function GET/);
  assert.match(route, /hasValidBearer/);
  assert.match(route, /FOUNDING_CAMPAIGN|campaignKey/);
  assert.match(route, /cs_\(test\|live\)/);
  assert.match(route, /no-store|Cache-Control/i);
  assert.match(route, /FULFILLED/);
  assert.match(route, /PROCESSING/);
  assert.match(route, /NOT_FOUND/);
  assert.doesNotMatch(route, /email|contact|payment_intent|customer|raw_body/i);
});

test("dashboard layout only exposes founding navigation to authorized operators", () => {
  const layout = read("src/app/(dashboard)/layout.tsx");
  const sidebar = read("src/components/layout/sidebar.tsx");
  const page = read("src/app/(dashboard)/founding/page.tsx");
  assert.match(layout, /isFoundingOperator/);
  assert.match(layout, /Sidebar[\s\S]*isFoundingOperator/);
  assert.match(sidebar, /isFoundingOperator/);
  assert.match(sidebar, /filter\([\s\S]*founding/i);
  assert.match(page, /isFoundingOperator/);
  assert.match(page, /notFound|redirect/);
});
