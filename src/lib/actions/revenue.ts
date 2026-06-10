"use server";

import { createClient } from "@/lib/supabase/server";
import type { Revenue } from "@/lib/types";

export async function getRevenueStats() {
  const supabase = await createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

  const [monthRes, lastMonthRes, yearRes, bestMonthRes, allRes] = await Promise.all([
    supabase
      .from("revenue")
      .select("amount_cents")
      .eq("status", "succeeded")
      .gte("stripe_created_at", startOfMonth),
    supabase
      .from("revenue")
      .select("amount_cents")
      .eq("status", "succeeded")
      .gte("stripe_created_at", startOfLastMonth)
      .lt("stripe_created_at", startOfMonth),
    supabase
      .from("revenue")
      .select("amount_cents")
      .eq("status", "succeeded")
      .gte("stripe_created_at", startOfYear),
    supabase
      .from("revenue")
      .select("amount_cents, stripe_created_at")
      .eq("status", "succeeded"),
    supabase
      .from("revenue")
      .select("amount_cents")
      .eq("status", "succeeded"),
  ]);

  const sum = (rows: { amount_cents: number }[] | null) =>
    (rows || []).reduce((s, r) => s + r.amount_cents, 0) / 100;

  const monthTotal = sum(monthRes.data);
  const lastMonthTotal = sum(lastMonthRes.data);
  const yearTotal = sum(yearRes.data);
  const allTotal = sum(allRes.data);

  const bestMonth = (() => {
    const data = bestMonthRes.data || [];
    if (data.length === 0) return 0;
    const byMonth: Record<string, number> = {};
    for (const row of data) {
      const key = row.stripe_created_at.slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + row.amount_cents;
    }
    return Math.max(...Object.values(byMonth)) / 100;
  })();

  return {
    monthTotal,
    lastMonthTotal,
    yearTotal,
    bestMonth,
    allTotal,
    transactionCount: allRes.data?.length || 0,
    monthChange: lastMonthTotal > 0
      ? Math.round(((monthTotal - lastMonthTotal) / lastMonthTotal) * 100)
      : monthTotal > 0 ? 100 : 0,
  };
}

export async function getMonthlyRevenue(months = 12) {
  const supabase = await createClient();
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const { data } = await supabase
    .from("revenue")
    .select("amount_cents, stripe_created_at")
    .eq("status", "succeeded")
    .gte("stripe_created_at", since.toISOString())
    .order("stripe_created_at", { ascending: true });

  const byMonth: Record<string, number> = {};
  for (const row of data || []) {
    const key = row.stripe_created_at.slice(0, 7);
    byMonth[key] = (byMonth[key] || 0) + row.amount_cents;
  }

  const result: { month: string; revenue: number }[] = [];
  const cursor = new Date(since.getFullYear(), since.getMonth(), 1);
  const now = new Date();
  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 7);
    result.push({ month: key, revenue: (byMonth[key] || 0) / 100 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

export async function getTransactions(limit = 100) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("revenue")
    .select("*, contacts(first_name, last_name, email)")
    .order("stripe_created_at", { ascending: false })
    .limit(limit);
  return (data || []) as Revenue[];
}
