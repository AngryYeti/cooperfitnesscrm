"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Package, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getRevenueStats, getMonthlyRevenue, getTransactions } from "@/lib/actions/revenue";
import { getFullName } from "@/lib/utils";
import type { Revenue } from "@/lib/types";

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents);
}

interface Stats {
  monthTotal: number;
  lastMonthTotal: number;
  yearTotal: number;
  bestMonth: number;
  allTotal: number;
  transactionCount: number;
  monthChange: number;
}

interface MonthlyPoint {
  month: string;
  revenue: number;
}

const statusColors: Record<string, string> = {
  succeeded: "bg-green-500/15 text-green-600",
  refunded: "bg-red-500/15 text-red-600",
  pending: "bg-yellow-500/15 text-yellow-600",
};

const sourceLabels: Record<string, string> = {
  "checkout.session": "Checkout",
  "payment_intent": "Payment Intent",
};

export function RevenueView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([]);
  const [transactions, setTransactions] = useState<Revenue[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [s, m, t] = await Promise.all([
      getRevenueStats(),
      getMonthlyRevenue(12),
      getTransactions(100),
    ]);
    setStats(s);
    setMonthly(m);
    setTransactions(t);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-up">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-muted rounded-2xl animate-pulse" />
        <div className="h-96 bg-muted rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      label: "This Month",
      value: fmt(stats.monthTotal),
      trend: stats.monthChange,
      icon: DollarSign,
    },
    {
      label: "Last Month",
      value: fmt(stats.lastMonthTotal),
      trend: null,
      icon: Calendar,
    },
    {
      label: "Year to Date",
      value: fmt(stats.yearTotal),
      trend: null,
      icon: TrendingUp,
    },
    {
      label: "Best Month",
      value: fmt(stats.bestMonth),
      trend: null,
      icon: Package,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Revenue</h1>
        <p className="text-muted-foreground mt-1">
          {stats.transactionCount} total transaction{stats.transactionCount === 1 ? "" : "s"} — {fmt(stats.allTotal)} all time
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-card border border-border/60 p-5 shadow-soft flex flex-col justify-between min-h-[130px]"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                {card.label}
              </p>
              {card.trend !== null && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    card.trend >= 0
                      ? "bg-trend-up-bg text-trend-up"
                      : "bg-trend-down-bg text-trend-down"
                  }`}
                >
                  {card.trend >= 0 ? (
                    <TrendingUp className="h-2.5 w-2.5" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5" />
                  )}
                  {card.trend >= 0 ? "+" : ""}
                  {card.trend}%
                </span>
              )}
            </div>
            <p className="text-3xl font-bold tracking-tight leading-none mt-3">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-card border border-border/60 p-6 shadow-soft">
        <h2 className="text-sm font-semibold mb-4">Monthly Revenue</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                formatter={(value) => [fmt(Number(value)), "Revenue"]}
                labelFormatter={(label) => format(new Date(label + "-01"), "MMMM yyyy")}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: 13,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--foreground)"
                strokeWidth={2}
                fill="url(#revenueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl bg-card border border-border/60 shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60">
          <h2 className="text-sm font-semibold">Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left py-3 px-6 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Date</th>
                <th className="text-left py-3 px-6 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Customer</th>
                <th className="text-left py-3 px-6 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Product</th>
                <th className="text-right py-3 px-6 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Amount</th>
                <th className="text-left py-3 px-6 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Status</th>
                <th className="text-left py-3 px-6 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Source</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No transactions yet. Revenue will appear here when Stripe purchases come in.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-6 whitespace-nowrap">
                      {format(new Date(tx.stripe_created_at), "MMM d, yyyy")}
                    </td>
                    <td className="py-3 px-6">
                      {tx.contacts ? (
                        <Link
                          href={`/clients/${tx.contact_id}`}
                          className="inline-flex items-center gap-1 hover:underline text-foreground font-medium"
                        >
                          {getFullName(tx.contacts.first_name, tx.contacts.last_name)}
                          <ArrowUpRight className="h-3 w-3 opacity-40" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-6 max-w-[200px] truncate">{tx.product_name}</td>
                    <td className="py-3 px-6 text-right font-medium whitespace-nowrap">
                      {fmt(tx.amount_cents / 100)}
                    </td>
                    <td className="py-3 px-6">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusColors[tx.status] || ""}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-muted-foreground">
                      {sourceLabels[tx.source] || tx.source}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
