"use client";

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";

type CalendarRefreshContextValue = {
  register: (fn: () => void) => () => void;
  trigger: () => void;
};

const CalendarRefreshContext = createContext<CalendarRefreshContextValue | null>(null);

export function CalendarRefreshProvider({ children }: { children: ReactNode }) {
  const ref = useRef<(() => void) | null>(null);

  const register = useCallback((fn: () => void) => {
    ref.current = fn;
    return () => {
      if (ref.current === fn) ref.current = null;
    };
  }, []);

  const trigger = useCallback(() => {
    ref.current?.();
  }, []);

  return (
    <CalendarRefreshContext.Provider value={{ register, trigger }}>
      {children}
    </CalendarRefreshContext.Provider>
  );
}

export function useCalendarRefresh() {
  const ctx = useContext(CalendarRefreshContext);
  if (!ctx) {
    return {
      register: () => () => {},
      trigger: () => {},
    };
  }
  return ctx;
}
