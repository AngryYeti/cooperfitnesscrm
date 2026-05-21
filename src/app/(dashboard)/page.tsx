import Link from "next/link";
import { Users, UserCheck, Clock, UserX, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardStats, getContacts } from "@/lib/actions/contacts";
import { getRecentActivities } from "@/lib/actions/activities";
import { getOverdueFollowUps } from "@/lib/actions/follow-ups";
import { formatDistanceToNow } from "date-fns";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const activities = await getRecentActivities(10);
  const overdueFollowUps = await getOverdueFollowUps();
  const recentContacts = await getContacts();
  const top5Contacts = recentContacts.slice(0, 5);

  const statCards = [
    {
      title: "Total Leads",
      value: stats.totalLeads,
      icon: Users,
      href: "/clients?status=Lead",
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Active Clients",
      value: stats.activeClients,
      icon: UserCheck,
      href: "/clients?status=Active+Client",
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Pending Follow-Ups",
      value: stats.pendingFollowUps,
      icon: Clock,
      href: "/follow-ups",
      color: "text-sky-600 dark:text-sky-400",
    },
    {
      title: "Completed Clients",
      value: stats.completedClients,
      icon: UserX,
      href: "/clients?status=Completed",
      color: "text-slate-600 dark:text-slate-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your coaching business
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {overdueFollowUps.length > 0 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-destructive">
              Overdue Follow-Ups ({overdueFollowUps.length})
            </h3>
            <Link href="/follow-ups">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {overdueFollowUps.slice(0, 3).map((fu: any) => (
              <div
                key={fu.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {fu.contacts?.first_name} {fu.contacts?.last_name} — {fu.title}
                </span>
                <span className="text-destructive font-medium">
                  Due {formatDistanceToNow(new Date(fu.due_date), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm">{activity.description}</p>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Contacts</CardTitle>
            <Link href="/clients">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {top5Contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts yet</p>
            ) : (
              top5Contacts.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/clients/${contact.id}`}
                  className="flex items-center justify-between rounded-md p-2 hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {contact.status}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
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
