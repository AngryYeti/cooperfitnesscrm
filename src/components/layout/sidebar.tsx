"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CalendarClock,
  Mail,
  ClipboardCheck,
  Settings,
  Dumbbell,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Follow-Ups", href: "/follow-ups", icon: CalendarClock },
  { name: "Email", href: "/email", icon: Mail },
  { name: "Intake", href: "/intake", icon: ClipboardCheck },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border/60 bg-sidebar h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-soft">
          <Dumbbell className="h-4.5 w-4.5" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold tracking-tight">
            Cooper Fitness
          </span>
          <span className="text-[11px] text-muted-foreground -mt-0.5">
            Client CRM
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-foreground" />
                )}
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    isActive && "scale-110"
                  )}
                  strokeWidth={isActive ? 2.25 : 2}
                />
                <span>{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-border/60 bg-gradient-soft p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles className="h-3.5 w-3.5 text-foreground/70" />
          <span className="text-xs font-medium">Pro tip</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Press <Badge variant="outline" className="text-[10px] px-1 py-0 mx-0.5">N</Badge>
          on the calendar to quickly create a new event.
        </p>
      </div>

      <div className="p-4 border-t border-border/60 text-[11px] text-muted-foreground text-center">
        Cooper Fitness CRM
      </div>
    </aside>
  );
}
