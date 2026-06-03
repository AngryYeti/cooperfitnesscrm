"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EventForm } from "@/components/forms/event-form";
import { useCalendarRefresh } from "./refresh-context";

type NewEventContextValue = {
  openNewEvent: (defaultDate?: Date) => void;
};

const NewEventContext = createContext<NewEventContextValue | null>(null);

export function NewEventProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);
  const router = useRouter();
  const { trigger: triggerCalendarRefresh } = useCalendarRefresh();

  const openNewEvent = useCallback((date?: Date) => {
    setDefaultDate(date);
    setOpen(true);
  }, []);

  const handleSuccess = () => {
    setOpen(false);
    setDefaultDate(undefined);
    triggerCalendarRefresh();
    router.refresh();
  };

  return (
    <NewEventContext.Provider value={{ openNewEvent }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
            <DialogDescription>
              Create a new calendar event
            </DialogDescription>
          </DialogHeader>
          <EventForm
            key={open ? "open" : "closed"}
            defaultDate={defaultDate}
            onSuccess={handleSuccess}
          />
        </DialogContent>
      </Dialog>
    </NewEventContext.Provider>
  );
}

export function useNewEvent() {
  const ctx = useContext(NewEventContext);
  if (!ctx) {
    throw new Error("useNewEvent must be used within a NewEventProvider");
  }
  return ctx;
}
