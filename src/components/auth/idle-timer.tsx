"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function IdleTimer() {
  const pathname = usePathname();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only run the idle timer on authenticated routes (not login)
    if (pathname === "/login" || pathname.startsWith("/api/")) {
      return;
    }

    const handleIdle = async () => {
      console.log("User idle for 30 minutes. Logging out...");
      const supabase = createClient();
      await supabase.auth.signOut();
      document.cookie = "cooper_fitness_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
      window.location.href = "/login";
    };

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(handleIdle, IDLE_TIMEOUT_MS);
    };

    // Events to track user activity
    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];

    // Initialize timer
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [pathname]);

  return null; // This component doesn't render anything
}
