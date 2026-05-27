"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
} from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  endOfWeek,
  subDays,
  addDays,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";

import {
  getCalendarEvents,
  deleteCalendarEvent,
} from "@/lib/actions/calendar";
import type { CalendarEvent } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EventForm } from "@/components/forms/event-form";
import { Plus, Trash2 } from "lucide-react";
import "./calendar.css";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

interface RBEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: CalendarEvent;
}

export function CalendarView() {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<View>(Views.MONTH);
  const [events, setEvents] = useState<RBEvent[]>([]);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [showEventDialog, setShowEventDialog] = useState(false);

  const getDateRange = useCallback(() => {
    if (view === Views.MONTH) {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const start = startOfWeek(monthStart, { weekStartsOn: 0 });
      const end = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return { start, end };
    }
    if (view === Views.WEEK) {
      const start = startOfWeek(date, { weekStartsOn: 0 });
      const end = endOfWeek(date, { weekStartsOn: 0 });
      return { start: subDays(start, 1), end: addDays(end, 1) };
    }
    return { start: startOfDay(date), end: endOfDay(date) };
  }, [date, view]);

  const fetchEvents = useCallback(async () => {
    const range = getDateRange();
    const data = await getCalendarEvents(
      range.start.toISOString(),
      range.end.toISOString()
    );
    setEvents(
      data.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.start_time),
        end: new Date(e.end_time),
        allDay: e.all_day,
        resource: e,
      }))
    );
  }, [getDateRange]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleNavigate = (newDate: Date) => setDate(newDate);
  const handleView = (newView: View) => setView(newView);

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    setSelectedSlot({ start, end });
    setShowCreateDialog(true);
  };

  const handleSelectEvent = (event: RBEvent) => {
    setSelectedEvent(event.resource || null);
    setShowEventDialog(true);
  };

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    setSelectedSlot(null);
    fetchEvents();
  };

  const handleUpdateSuccess = () => {
    setShowEventDialog(false);
    setSelectedEvent(null);
    fetchEvents();
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    await deleteCalendarEvent(selectedEvent.id);
    setShowEventDialog(false);
    setSelectedEvent(null);
    fetchEvents();
  };

  const getEventDateDisplay = (event: CalendarEvent) => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    if (event.all_day) return format(start, "MMMM d, yyyy");
    const sameDay =
      format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");
    if (sameDay) {
      return `${format(start, "MMMM d, yyyy 'at' h:mm a")} - ${format(end, "h:mm a")}`;
    }
    return `${format(start, "MMM d, yyyy h:mm a")} - ${format(end, "MMM d, yyyy h:mm a")}`;
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Manage your schedule and appointments
            </p>
          </div>
          <Button
            onClick={() => {
              setSelectedSlot({ start: new Date(), end: new Date() });
              setShowCreateDialog(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        </div>

        <div className="bg-card border rounded-lg overflow-hidden relative">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            date={date}
            view={view}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            onNavigate={handleNavigate}
            onView={handleView}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            popup
            eventPropGetter={(event: RBEvent) => ({
              style: {
                backgroundColor: event.resource?.color || "#2563eb",
                borderColor: event.resource?.color || "#2563eb",
                color: "#ffffff",
                borderRadius: "4px",
                border: "none",
              },
            })}
            style={{ height: "calc(100vh - 210px)", minHeight: 500 }}
          />
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
            <DialogDescription>Create a new calendar event</DialogDescription>
          </DialogHeader>
          <EventForm
            defaultDate={selectedSlot?.start}
            onSuccess={handleCreateSuccess}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title || "Event"}</DialogTitle>
            {selectedEvent && (
              <DialogDescription>
                {getEventDateDisplay(selectedEvent)}
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              {selectedEvent.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedEvent.description}
                </p>
              )}
              <EventForm
                event={selectedEvent}
                onSuccess={handleUpdateSuccess}
              />
              <div className="border-t pt-4">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Event
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
