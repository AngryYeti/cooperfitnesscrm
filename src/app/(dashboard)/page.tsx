import Link from "next/link";
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Plus,
  Search,
  Bell,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDashboardStats, getContacts } from "@/lib/actions/contacts";
import { getRecentActivities } from "@/lib/actions/activities";
import { getOverdueFollowUps } from "@/lib/actions/follow-ups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function DashboardPage() {
  const [stats, activities, overdueFollowUps, recentContacts] =
    await Promise.all([
      getDashboardStats(),
      getRecentActivities(8),
      getOverdueFollowUps(),
      getContacts(),
    ]);

  const topContacts = recentContacts.slice(0, 5);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const leadsThisMonth = recentContacts.filter(
    (c: any) =>
      c.status === "Lead" && new Date(c.date_added) >= startOfMonth
  ).length;
  const completedThisYear = recentContacts.filter(
    (c: any) =>
      c.status === "Completed" && new Date(c.date_added) >= startOfYear
  ).length;
  const overdueCount = overdueFollowUps.length;

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const subtitle = `${stats.activeClients} active client${
    stats.activeClients === 1 ? "" : "s"
  }, ${stats.pendingFollowUps} follow-up${
    stats.pendingFollowUps === 1 ? "" : "s"
  } waiting. Your roster is steady — let's keep it that way.`;

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-card border border-border/60 px-3 py-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "oklch(0.55 0.2 260)" }}
            />
            <span className="text-xs font-medium text-muted-foreground">
              Now accepting new clients
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[0.95] text-foreground">
            {greeting},
            <br />
            <span className="text-foreground">Evan.</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:block relative w-72">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients, programs..."
              className="h-11 pl-11 text-sm rounded-full bg-card border-border/60 focus-visible:bg-card"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full bg-card border border-border/60"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <Button
            asChild
            className="h-11 rounded-full px-5 bg-foreground text-background hover:bg-foreground/90 shadow-sm"
          >
            <Link href="/clients">
              <Plus className="h-4 w-4" />
              New client
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <Link href="/clients?status=Active+Client" className="group">
          <div className="rounded-2xl bg-foreground p-7 text-background shadow-soft transition-transform group-hover:-translate-y-0.5 h-full flex flex-col justify-between min-h-[200px]">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-background/60">
                Active Clients
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-trend-up-bg px-2 py-0.5 text-[11px] font-semibold text-trend-up">
                <span className="h-1 w-1 rounded-full bg-trend-up" />
                Steady
              </span>
            </div>
            <div>
              <p className="text-6xl font-bold tracking-tight leading-none">
                {stats.activeClients}
              </p>
              <p className="text-sm text-background/60 mt-2">
                {recentContacts.length} total in roster
              </p>
            </div>
          </div>
        </Link>

        <Link href="/clients?status=Lead" className="group">
          <div className="rounded-2xl bg-card border border-border/60 p-7 text-card-foreground shadow-soft transition-transform group-hover:-translate-y-0.5 h-full flex flex-col justify-between min-h-[200px]">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Total Leads
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-trend-info-bg px-2 py-0.5 text-[11px] font-semibold text-trend-info">
                <TrendingUp className="h-2.5 w-2.5" />
                +{leadsThisMonth} this month
              </span>
            </div>
            <div>
              <p className="text-6xl font-bold tracking-tight leading-none">
                {stats.totalLeads}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Active prospects
              </p>
            </div>
          </div>
        </Link>

        <Link href="/follow-ups" className="group">
          <div className="rounded-2xl bg-card border border-border/60 p-7 text-card-foreground shadow-soft transition-transform group-hover:-translate-y-0.5 h-full flex flex-col justify-between min-h-[200px]">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Pending Follow-Ups
              </p>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  overdueCount > 0
                    ? "bg-trend-down-bg text-trend-down"
                    : "bg-trend-up-bg text-trend-up"
                }`}
              >
                {overdueCount > 0 ? (
                  <TrendingDown className="h-2.5 w-2.5" />
                ) : (
                  <TrendingUp className="h-2.5 w-2.5" />
                )}
                {overdueCount > 0
                  ? `${overdueCount} overdue`
                  : "All clear"}
              </span>
            </div>
            <div>
              <p className="text-6xl font-bold tracking-tight leading-none">
                {stats.pendingFollowUps}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Awaiting action
              </p>
            </div>
          </div>
        </Link>

        <Link href="/clients?status=Completed" className="group">
          <div className="rounded-2xl bg-card border border-border/60 p-7 text-card-foreground shadow-soft transition-transform group-hover:-translate-y-0.5 h-full flex flex-col justify-between min-h-[200px]">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Completed
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-trend-up-bg px-2 py-0.5 text-[11px] font-semibold text-trend-up">
                <TrendingUp className="h-2.5 w-2.5" />
                +{completedThisYear} this year
              </span>
            </div>
            <div>
              <p className="text-6xl font-bold tracking-tight leading-none">
                {stats.completedClients}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Past clients
              </p>
            </div>
          </div>
        </Link>
      </section>

      {overdueFollowUps.length > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-destructive" />
              </div>
              <h3 className="font-semibold text-destructive">
                Overdue Follow-Ups ({overdueFollowUps.length})
              </h3>
            </div>
            <Link href="/follow-ups">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="space-y-1.5">
            {overdueFollowUps.slice(0, 3).map((fu: any) => (
              <div
                key={fu.id}
                className="flex items-center justify-between text-sm rounded-lg px-3 py-2.5 bg-card/60 hover:bg-card transition-colors"
              >
                <span className="font-medium">
                  {fu.contacts?.first_name} {fu.contacts?.last_name}{" "}
                  <span className="text-muted-foreground font-normal">
                    — {fu.title}
                  </span>
                </span>
                <span className="text-destructive text-xs font-medium">
                  {formatDistanceToNow(new Date(fu.due_date), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-card border border-border/60 p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "oklch(0.93 0.06 260)" }}
              >
                <Activity
                  className="h-3.5 w-3.5"
                  style={{ color: "oklch(0.45 0.18 260)" }}
                />
              </div>
              <h2 className="text-base font-semibold">Recent Activity</h2>
            </div>
          </div>
          <div className="space-y-1">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No recent activity
              </p>
            ) : (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 py-2.5 px-2 rounded-md hover:bg-muted/40 transition-colors"
                >
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground/40 shrink-0" />
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p className="text-sm leading-relaxed">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border/60 p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "oklch(0.93 0.06 260)" }}
              >
                <Users
                  className="h-3.5 w-3.5"
                  style={{ color: "oklch(0.45 0.18 260)" }}
                />
              </div>
              <h2 className="text-base font-semibold">Recent Contacts</h2>
            </div>
            <Link href="/clients">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="space-y-1">
            {topContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No contacts yet
              </p>
            ) : (
              topContacts.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/clients/${contact.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                      style={{ backgroundColor: "oklch(0.55 0.2 260)" }}
                    >
                      {contact.first_name[0]}
                      {contact.last_name?.[0] || ""}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {contact.first_name} {contact.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contact.status}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {formatDistanceToNow(new Date(contact.date_added), {
                      addSuffix: true,
                    })}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
