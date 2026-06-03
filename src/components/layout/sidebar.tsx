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
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Messages", href: "/email", icon: Mail },
  { name: "Follow-Ups", href: "/follow-ups", icon: CalendarClock },
  { name: "Intake", href: "/intake", icon: ClipboardCheck },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-7">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-base font-bold text-white shrink-0"
          style={{ backgroundColor: "oklch(0.55 0.2 260)" }}
        >
          C
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[14px] font-semibold tracking-wide text-sidebar-foreground uppercase">
            Cooper
          </span>
          <span className="text-[11px] tracking-[0.12em] text-sidebar-foreground/60 uppercase">
            Fitness CRM
          </span>
        </div>
      </div>

      <div className="px-5 pb-2">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-sidebar-foreground/45 uppercase">
          Workspace
        </p>
      </div>

      <nav className="flex-1 px-3 pb-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon
                  className="h-[18px] w-[18px] shrink-0"
                  strokeWidth={1.75}
                />
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: "oklch(0.55 0.2 260)" }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <div className="rounded-xl bg-sidebar-accent/60 p-3 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white shrink-0"
            style={{ backgroundColor: "oklch(0.55 0.2 260)" }}
          >
            EC
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-[13px] font-semibold text-sidebar-accent-foreground truncate">
              Evan Cooper
            </span>
            <span className="text-[11px] text-sidebar-foreground/55 truncate">
              Head Coach
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-sidebar-border/60 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-sidebar-foreground/40" />
        <p className="text-[10px] text-sidebar-foreground/40">
          Press <kbd className="px-1 py-0.5 rounded bg-sidebar-accent/60 text-sidebar-foreground/70 text-[9px] font-mono">N</kbd> for new event
        </p>
      </div>
    </aside>
  );
}
