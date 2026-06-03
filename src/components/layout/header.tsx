"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  CalendarDays,
  Mail,
  ClipboardCheck,
  Settings,
  Menu,
  Moon,
  Sun,
  LogOut,
  Search,
  Plus,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useNewEvent } from "@/components/calendar/new-event-provider";

const navItems = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Sessions", href: "/calendar", icon: CalendarDays },
  { name: "Messages", href: "/email", icon: Mail },
  { name: "Follow-Ups", href: "/follow-ups", icon: CalendarClock },
  { name: "Intake", href: "/intake", icon: ClipboardCheck },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { openNewEvent } = useNewEvent();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const currentPage = navItems.find(
    (item) => item.href === pathname || pathname.startsWith(`${item.href}/`)
  );

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 px-4 sm:px-6 bg-canvas/80 backdrop-blur-md">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {currentPage && (
        <div className="hidden lg:flex items-center gap-2 ml-1">
          <currentPage.icon
            className="h-4 w-4 text-muted-foreground"
            strokeWidth={2}
          />
          <h1 className="text-sm font-semibold tracking-tight">
            {currentPage.name}
          </h1>
        </div>
      )}

      <div className="flex-1" />

      <div className="hidden md:flex relative w-72 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients, events..."
          className="h-9 pl-9 text-sm rounded-full bg-card border-border/60 focus-visible:bg-card"
        />
      </div>

      <Button
        size="sm"
        variant="default"
        className="h-9 rounded-full px-4 bg-foreground text-background hover:bg-foreground/90 shadow-sm"
        onClick={() => openNewEvent()}
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">New Event</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        {mounted && theme === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full ring-offset-2 focus-visible:ring-2"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback
                className="text-xs font-semibold text-white"
                style={{ backgroundColor: "oklch(0.55 0.2 260)" }}
              >
                EC
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-0.5">
              <p className="text-sm font-medium">Evan Cooper</p>
              <p className="text-xs text-muted-foreground">
                evan@cooper.fitness
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {mobileOpen && (
        <div className="absolute top-16 left-0 right-0 border-b border-border/60 bg-canvas lg:hidden">
          <nav className="flex flex-col p-3 space-y-0.5">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60"
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
