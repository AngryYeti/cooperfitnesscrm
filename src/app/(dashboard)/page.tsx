import Link from "next/link";
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  ArrowRight,
  TrendingUp,
  Activity,
  Calendar as CalendarIcon,
  Target,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDashboardStats, getContacts } from "@/lib/actions/contacts";
import { getRecentActivities } from "@/lib/actions/activities";
import { getOverdueFollowUps } from "@/lib/actions/follow-ups";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const iconMap = {
  Users,
  UserCheck,
  Clock,
  UserX,
};

const statusBadgeMap: Record<string, "lead" | "trial" | "active" | "completed"> = {
  Lead: "lead",
  Trial: "trial",
  "Active Client": "active",
  Completed: "completed",
};

export default async function DashboardPage() {
  const [stats, activities, overdueFollowUps, recentContacts] =
    await Promise.all([
      getDashboardStats(),
      getRecentActivities(8),
      getOverdueFollowUps(),
      getContacts(),
    ]);

  const topContacts = recentContacts.slice(0, 5);

  const statCards = [
    {
      title: "Total Leads",
      value: stats.totalLeads,
      icon: Users,
      href: "/clients?status=Lead",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      trend: "Active prospects",
    },
    {
      title: "Active Clients",
      value: stats.activeClients,
      icon: UserCheck,
      href: "/clients?status=Active+Client",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      trend: "Currently coaching",
    },
    {
      title: "Pending Follow-Ups",
      value: stats.pendingFollowUps,
      icon: Clock,
      href: "/follow-ups",
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-500/10",
      trend: "Awaiting action",
    },
    {
      title: "Completed",
      value: stats.completedClients,
      icon: UserX,
      href: "/clients?status=Completed",
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-500/10",
      trend: "Past clients",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, <span className="text-gradient">Coach</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your clients today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="shadow-soft">
            <Link href="/calendar">
              <CalendarIcon className="mr-2 h-4 w-4" />
              View Calendar
            </Link>
          </Button>
          <Button asChild className="shadow-soft">
            <Link href="/clients">
              <Target className="mr-2 h-4 w-4" />
              Manage Clients
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.title}
              href={stat.href}
              className="group"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Card className="shadow-soft hover:shadow-elevated transition-all duration-200 group-hover:-translate-y-0.5 cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} strokeWidth={2} />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold tracking-tight mt-1">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.trend}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {overdueFollowUps.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-gradient-to-br from-destructive/5 to-destructive/[0.02] p-5 shadow-soft">
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
                className="flex items-center justify-between text-sm rounded-lg px-3 py-2.5 hover:bg-background/60 transition-colors"
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No recent activity
              </p>
            ) : (
              activities.map((activity, i) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 py-2.5 px-2 rounded-md hover:bg-muted/40 transition-colors"
                  style={{ animationDelay: `${i * 30}ms` }}
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
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">Recent Contacts</CardTitle>
            </div>
            <Link href="/clients">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
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
                    <div className="h-8 w-8 rounded-full bg-gradient-soft flex items-center justify-center text-xs font-medium shrink-0">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
