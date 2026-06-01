"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar as RBCalendar,
  dateFnsLocalizer,
  Views,
  type View,
  type SlotInfo,
} from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
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
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays as dateAddDays,
  isSameMonth,
  isSameDay,
  isToday,
  startOfWeek as dateStartOfWeek,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import { getCalendarEvents, deleteCalendarEvent } from "@/lib/actions/calendar";
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

const DnDCalendar = RBCalendar;

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: Views.DAY, label: "Day" },
  { value: Views.WEEK, label: "Week" },
  { value: Views.MONTH, label: "Month" },
];

export function CalendarView() {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<View>(Views.WEEK);
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

  const [miniCalMonth, setMiniCalMonth] = useState(new Date());

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
        end: e.all_day
          ? addDays(new Date(e.start_time), 1)
          : new Date(e.end_time),
        allDay: e.all_day,
        resource: e,
      }))
    );
  }, [getDateRange]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setSelectedSlot({ start: new Date(), end: new Date() });
        setShowCreateDialog(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
    setMiniCalMonth(newDate);
  }, []);

  const handleView = (newView: View) => setView(newView);

  const handleSelectSlot = ({ start, end }: SlotInfo) => {
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

  const goToToday = () => {
    const now = new Date();
    setDate(now);
    setMiniCalMonth(now);
  };

  const goPrev = () => {
    if (view === Views.MONTH) {
      const d = subMonths(date, 1);
      setDate(d);
      setMiniCalMonth(d);
    } else if (view === Views.WEEK) {
      const d = subWeeks(date, 1);
      setDate(d);
      setMiniCalMonth(d);
    } else {
      const d = subDays(date, 1);
      setDate(d);
      setMiniCalMonth(d);
    }
  };

  const goNext = () => {
    if (view === Views.MONTH) {
      const d = addMonths(date, 1);
      setDate(d);
      setMiniCalMonth(d);
    } else if (view === Views.WEEK) {
      const d = addWeeks(date, 1);
      setDate(d);
      setMiniCalMonth(d);
    } else {
      const d = addDays(date, 1);
      setDate(d);
      setMiniCalMonth(d);
    }
  };

  const headerLabel = useMemo(() => {
    if (view === Views.MONTH) {
      return format(date, "MMMM yyyy");
    }
    if (view === Views.WEEK) {
      const start = startOfWeek(date, { weekStartsOn: 0 });
      const end = endOfWeek(date, { weekStartsOn: 0 });
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
      }
      return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    }
    return format(date, "EEEE, MMMM d, yyyy");
  }, [view, date]);

  const eventPropGetter = useCallback((event: RBEvent) => {
    const color = event.resource?.color || "#3b82f6";
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        color: "#ffffff",
        borderRadius: "6px",
        border: "none",
        boxShadow: `0 1px 2px ${color}30`,
      },
    };
  }, []);

  const dayPropGetter = useCallback((day: Date) => {
    if (isToday(day)) {
      return {
        style: {
          backgroundColor: "color-mix(in srgb, currentColor 4%, transparent)",
        },
      };
    }
    return {};
  }, []);

  return (
    <div className="flex gap-4 h-[calc(100vh-7rem)] min-h-[640px]">
      <aside className="hidden xl:flex flex-col w-64 shrink-0">
        <div className="space-y-1.5 mb-4">
          <Button
            onClick={() => {
              setSelectedSlot({ start: new Date(), end: new Date() });
              setShowCreateDialog(true);
            }}
            className="w-full justify-start gap-2 shadow-soft"
            size="lg"
          >
            <Plus className="h-4 w-4" />
            Create event
          </Button>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-3 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setMiniCalMonth(subMonths(miniCalMonth, 1))}
              className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-semibold">
              {format(miniCalMonth, "MMMM yyyy")}
            </span>
            <button
              onClick={() => setMiniCalMonth(addMonths(miniCalMonth, 1))}
              className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <MiniCalendar
            month={miniCalMonth}
            selected={date}
            onSelect={(d) => {
              setDate(d);
              setMiniCalMonth(d);
            }}
          />
        </div>

        <div className="mt-4 rounded-xl border border-border/60 bg-card p-3 shadow-soft">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">
            Upcoming
          </p>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {events
              .filter((e) => e.start >= new Date())
              .sort((a, b) => a.start.getTime() - b.start.getTime())
              .slice(0, 6)
              .map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleSelectEvent(e)}
                  className="w-full text-left rounded-md p-2 hover:bg-muted/60 transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="h-2 w-2 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: e.resource?.color || "#3b82f6" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate group-hover:text-foreground">
                        {e.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(e.start, "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            {events.filter((e) => e.start >= new Date()).length === 0 && (
              <p className="text-xs text-muted-foreground py-3 text-center">
                No upcoming events
              </p>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-border/60 bg-card shadow-soft overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="h-8 shadow-soft"
            >
              Today
            </Button>
            <div className="flex items-center">
              <button
                onClick={goPrev}
                className="h-8 w-8 rounded-l-md border border-r-0 border-border hover:bg-muted flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goNext}
                className="h-8 w-8 rounded-r-md border border-border hover:bg-muted flex items-center justify-center transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <h2 className="text-lg font-semibold tracking-tight ml-1">
              {headerLabel}
            </h2>
          </div>

          <div className="flex items-center bg-muted/60 rounded-md p-0.5">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleView(opt.value)}
                className={`px-3 h-7 text-xs font-medium rounded-[5px] transition-all ${
                  view === opt.value
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <DnDCalendar
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
            eventPropGetter={eventPropGetter}
            dayPropGetter={dayPropGetter}
            toolbar={false}
            step={30}
            timeslots={2}
            scrollToTime={new Date(1970, 0, 1, 7, 0, 0)}
            components={{
              event: ({ event }: { event: RBEvent }) => (
                <div className="px-1.5 py-0.5 text-[11px] leading-tight font-medium">
                  {event.title}
                </div>
              ),
            }}
          />
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New event
            </DialogTitle>
            <DialogDescription>
              {selectedSlot?.start
                ? format(selectedSlot.start, "EEEE, MMMM d, yyyy")
                : "Create a new calendar event"}
            </DialogDescription>
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
            <div className="flex items-start gap-3">
              <div
                className="h-2.5 w-2.5 rounded-full mt-2 shrink-0"
                style={{ backgroundColor: selectedEvent?.color || "#3b82f6" }}
              />
              <div className="min-w-0">
                <DialogTitle className="break-words">
                  {selectedEvent?.title || "Event"}
                </DialogTitle>
                {selectedEvent && (
                  <DialogDescription>
                    {format(
                      new Date(selectedEvent.start_time),
                      "EEEE, MMMM d, yyyy 'at' h:mm a"
                    )}
                  </DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              {selectedEvent.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedEvent.description}
                </p>
              )}
              <EventForm
                event={selectedEvent}
                onSuccess={handleUpdateSuccess}
              />
              <div className="border-t border-border/60 pt-3 -mx-6 px-6 -mb-6 pb-0">
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleDelete}
                >
                  <X className="mr-2 h-4 w-4" />
                  Delete event
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniCalendar({
  month,
  selected,
  onSelect,
}: {
  month: Date;
  selected: Date;
  onSelect: (d: Date) => void;
}) {
  const monthStart = startOfMonth(month);
  const gridStart = dateStartOfWeek(monthStart, { weekStartsOn: 0 });

  const days: Date[] = [];
  let d = gridStart;
  for (let i = 0; i < 42; i++) {
    days.push(d);
    d = dateAddDays(d, 1);
  }

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div
            key={i}
            className="text-[10px] font-medium text-muted-foreground text-center py-1"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, month);
          const isSel = isSameDay(day, selected);
          const isT = isToday(day);
          return (
            <button
              key={i}
              onClick={() => onSelect(day)}
              className={`h-7 w-7 mx-auto rounded-full text-[11px] font-medium flex items-center justify-center transition-colors relative ${
                isSel
                  ? "bg-foreground text-background"
                  : isT
                    ? "bg-foreground/10 text-foreground hover:bg-foreground/15"
                    : inMonth
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground/50 hover:bg-muted/60"
              }`}
            >
              {day.getDate()}
              {isT && !isSel && (
                <span className="absolute bottom-0.5 h-0.5 w-0.5 rounded-full bg-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
