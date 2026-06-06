"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Check,
  Eye,
  EyeOff,
  PanelRightClose,
  PanelRightOpen,
  AlertTriangle,
} from "lucide-react";
import {
  getCalendarEvents,
  deleteCalendarEvent,
  toggleEventCompleted,
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
import { useNewEvent } from "@/components/calendar/new-event-provider";
import { useCalendarRefresh } from "@/components/calendar/refresh-context";
import { cn, lightenHex, getReadableTextColor } from "@/lib/utils";
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
  const eventsRef = useRef<RBEvent[]>([]);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [miniCalMonth, setMiniCalMonth] = useState(new Date());
  const [showCompleted, setShowCompleted] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { openNewEvent } = useNewEvent();
  const { register: registerRefresh, trigger: triggerRefresh } = useCalendarRefresh();

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
    const mapped = data.map((e) => ({
      id: e.id,
      title: e.title,
      start: new Date(e.start_time),
      end: e.all_day
        ? addDays(new Date(e.start_time), 1)
        : new Date(e.end_time),
      allDay: e.all_day,
      resource: e,
    }));
    setEvents(mapped);
    eventsRef.current = mapped;
  }, [getDateRange]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    return registerRefresh(fetchEvents);
  }, [registerRefresh, fetchEvents]);

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
        openNewEvent(new Date());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openNewEvent]);

  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
    setMiniCalMonth(newDate);
  }, []);

  const handleView = (newView: View) => setView(newView);

  const handleSelectSlot = (slot: SlotInfo) => {
    openNewEvent(slot.start);
  };

  const handleSelectEvent = (event: RBEvent) => {
    setSelectedEvent(event.resource || null);
    setShowEventDialog(true);
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

  const handleToggleCompleted = async () => {
    if (!selectedEvent) return;
    setToggling(true);
    const nextValue = !selectedEvent.completed;
    const updatedAt = nextValue ? new Date().toISOString() : null;

    setSelectedEvent({
      ...selectedEvent,
      completed: nextValue,
      completed_at: updatedAt,
    });
    setEvents((prev) => {
      const next = prev.map((e) =>
        e.id === selectedEvent.id && e.resource
          ? {
              ...e,
              resource: {
                ...e.resource,
                completed: nextValue,
                completed_at: updatedAt,
              },
            }
          : e
      );
      eventsRef.current = next;
      return next;
    });

    try {
      await toggleEventCompleted(selectedEvent.id, nextValue);
    } catch (err) {
      const revertedAt = nextValue ? null : new Date().toISOString();
      setSelectedEvent({
        ...selectedEvent,
        completed: !nextValue,
        completed_at: revertedAt,
      });
      setEvents((prev) => {
        const reverted = prev.map((e) =>
          e.id === selectedEvent.id && e.resource
            ? {
                ...e,
                resource: {
                  ...e.resource,
                  completed: !nextValue,
                  completed_at: revertedAt,
                },
              }
            : e
        );
        eventsRef.current = reverted;
        return reverted;
      });
      throw err;
    } finally {
      setToggling(false);
    }
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
    const latest = eventsRef.current.find((e) => e.id === event.id);
    const source = latest?.resource ?? event.resource;
    const baseColor = source?.color || "#3b82f6";
    const isCompleted = !!source?.completed;
    const isUrgent = source?.priority === "urgent" && !isCompleted;
    const bg = isCompleted ? lightenHex(baseColor, 0.7) : baseColor;
    const textColor = isCompleted ? getReadableTextColor(baseColor) : "#ffffff";

    return {
      style: {
        backgroundColor: bg,
        borderColor: bg,
        color: textColor,
        borderRadius: "6px",
        border: isUrgent ? "2px solid #dc2626" : "none",
        boxShadow: isUrgent
          ? `0 0 0 2px #dc262640, 0 2px 6px #dc262650`
          : isCompleted
            ? `inset 0 0 0 1px ${lightenHex(baseColor, 0.5)}40, 0 1px 2px ${baseColor}20`
            : `0 1px 2px ${baseColor}30`,
        opacity: isCompleted ? 0.85 : 1,
        textDecoration: isCompleted ? "line-through" : "none",
        textDecorationThickness: "1.5px",
        transition: "all 0.2s ease",
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
    <div className="flex gap-2 h-[calc(100vh-7rem)] min-h-[640px]">
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

          <div className="flex items-center gap-2">
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
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background shadow-soft hover:border-foreground/30 transition-colors"
                title="Show sidebar"
                aria-label="Show sidebar"
              >
                <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <DnDCalendar
            localizer={localizer}
            events={
              showCompleted
                ? events
                : events.filter((e) => !e.resource?.completed)
            }
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
            dayLayoutAlgorithm="no-overlap"
            eventPropGetter={eventPropGetter}
            dayPropGetter={dayPropGetter}
            toolbar={false}
            step={30}
            timeslots={2}
            scrollToTime={new Date(1970, 0, 1, 7, 0, 0)}
            components={{
              event: ({ event }: { event: RBEvent }) => {
                const contact = event.resource?.contacts;
                const contactName = contact
                  ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
                  : "";
                const isUrgent =
                  event.resource?.priority === "urgent" && !event.resource?.completed;
                return (
                  <div className="px-1.5 py-0.5 text-[11px] leading-tight min-w-0">
                    <div className="font-medium flex items-center gap-1 min-w-0">
                      {isUrgent && (
                        <AlertTriangle
                          className="h-2.5 w-2.5 shrink-0"
                          strokeWidth={3}
                          fill="currentColor"
                        />
                      )}
                      {event.resource?.completed && (
                        <Check className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
                      )}
                      <span className="truncate">{event.title}</span>
                    </div>
                    {contactName && (
                      <div className="opacity-80 truncate text-[10px]">
                        {contactName}
                      </div>
                    )}
                  </div>
                );
              },
            }}
          />
        </div>
      </div>

      <div className="hidden lg:flex items-center shrink-0 -mr-1">
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="h-12 w-7 rounded-md border border-border/60 bg-background shadow-soft hover:border-foreground/30 transition-colors flex items-center justify-center group"
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? (
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
          )}
        </button>
      </div>

      <aside
        className={cn(
          "hidden lg:flex flex-col shrink-0 overflow-hidden transition-[width,opacity,margin] duration-300 ease-in-out",
          sidebarOpen
            ? "w-64 opacity-100 ml-0"
            : "w-0 opacity-0 -ml-2 pointer-events-none"
        )}
      >
        <div className="space-y-1.5 mb-4">
          <Button
            onClick={() => openNewEvent(new Date())}
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
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Upcoming
            </p>
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              title={showCompleted ? "Hide completed" : "Show completed"}
            >
              {showCompleted ? (
                <>
                  <Eye className="h-3 w-3" /> Done
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3" /> Done
                </>
              )}
            </button>
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {events
              .filter((e) => e.start >= new Date())
              .sort((a, b) => a.start.getTime() - b.start.getTime())
              .slice(0, 6)
              .map((e) => {
                const baseColor = e.resource?.color || "#3b82f6";
                const isCompleted = !!e.resource?.completed;
                const dotColor = isCompleted
                  ? lightenHex(baseColor, 0.75)
                  : baseColor;
                return (
                  <button
                    key={e.id}
                    onClick={() => handleSelectEvent(e)}
                    className="w-full text-left rounded-md p-2 hover:bg-muted/60 transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full mt-1.5 shrink-0",
                          isCompleted && "ring-1 ring-current/30"
                        )}
                        style={{ backgroundColor: dotColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-xs font-medium truncate group-hover:text-foreground",
                            isCompleted &&
                              "line-through text-muted-foreground"
                          )}
                        >
                          {e.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {format(e.start, "MMM d, h:mm a")}
                          {e.resource?.contacts &&
                            ` · ${e.resource.contacts.first_name ?? ""} ${e.resource.contacts.last_name ?? ""}`.trim()}
                        </p>
                      </div>
                      {isCompleted && (
                        <Check className="h-3 w-3 text-muted-foreground mt-1" />
                      )}
                    </div>
                  </button>
                );
              })}
            {events.filter((e) => e.start >= new Date()).length === 0 && (
              <p className="text-xs text-muted-foreground py-3 text-center">
                No upcoming events
              </p>
            )}
          </div>
        </div>
      </aside>

      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="bg-background/95 backdrop-blur-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full mt-2 shrink-0",
                  selectedEvent?.completed && "ring-1 ring-current/30"
                )}
                style={{
                  backgroundColor: selectedEvent
                    ? selectedEvent.completed
                      ? lightenHex(selectedEvent.color || "#3b82f6", 0.7)
                      : selectedEvent.color || "#3b82f6"
                    : "#3b82f6",
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle
                    className={cn(
                      "break-words",
                      selectedEvent?.completed && "line-through"
                    )}
                  >
                    {selectedEvent?.title || "Event"}
                  </DialogTitle>
                  {selectedEvent?.priority === "urgent" && !selectedEvent.completed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      <AlertTriangle className="h-2.5 w-2.5" strokeWidth={3} />
                      Urgent
                    </span>
                  )}
                </div>
                {selectedEvent && (
                  <DialogDescription>
                    {format(
                      new Date(selectedEvent.start_time),
                      "EEEE, MMMM d, yyyy 'at' h:mm a"
                    )}
                    {selectedEvent.source && (
                      <>
                        {" · "}
                        <span className="text-muted-foreground">
                          {selectedEvent.source.replace(/_/g, " ")}
                        </span>
                      </>
                    )}
                  </DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <CompletionToggle
                eventId={selectedEvent.id}
                serverCompleted={selectedEvent.completed}
                serverCompletedAt={selectedEvent.completed_at}
                onToggle={handleToggleCompleted}
                pending={toggling}
              />

              {selectedEvent.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedEvent.description}
                </p>
              )}
              <EventForm
                key={selectedEvent?.id || "new"}
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

function CompletionToggle({
  eventId,
  serverCompleted,
  serverCompletedAt,
  onToggle,
  pending,
}: {
  eventId: string;
  serverCompleted: boolean;
  serverCompletedAt: string | null;
  onToggle: () => void | Promise<void>;
  pending: boolean;
}) {
  const [optimistic, setOptimistic] = useState(serverCompleted);
  const [error, setError] = useState<string | null>(null);
  const lastSyncedId = useRef(eventId);

  useEffect(() => {
    if (lastSyncedId.current !== eventId) {
      setOptimistic(serverCompleted);
      setError(null);
      lastSyncedId.current = eventId;
    }
  }, [eventId, serverCompleted]);

  const handleClick = async () => {
    if (pending || error) return;
    const previous = optimistic;
    const next = !optimistic;
    setOptimistic(next);
    setError(null);
    try {
      await onToggle();
    } catch (e: any) {
      setOptimistic(previous);
      if (e?.code === "MISSING_COLUMN" || e?.message?.includes("MISSING_COLUMN")) {
        setError(
          "Database needs a one-time update. Run supabase/calendar-completed-migration.sql in Supabase SQL Editor, then retry."
        );
      } else {
        setError(e?.message || "Couldn't save. Click to retry.");
      }
    }
  };

  return (
    <div className="space-y-1">
      <label
        className={cn(
          "flex items-center gap-3 rounded-lg border p-3 transition-all cursor-pointer select-none",
          optimistic
            ? "border-success/30 bg-success/5"
            : "border-border/60 hover:border-foreground/30 hover:bg-muted/30",
          pending && "opacity-60 pointer-events-none"
        )}
      >
        <input
          type="checkbox"
          checked={optimistic}
          onChange={handleClick}
          disabled={pending}
          className="h-5 w-5 rounded border-2 border-input text-success accent-success cursor-pointer shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {optimistic ? "Completed" : "Mark as complete"}
          </p>
          {optimistic && serverCompletedAt && (
            <p className="text-xs text-muted-foreground">
              Completed {format(new Date(serverCompletedAt), "MMM d, h:mm a")}
            </p>
          )}
          {!optimistic && (
            <p className="text-xs text-muted-foreground">
              Tick off when this event is done
            </p>
          )}
        </div>
      </label>
      {error && (
        <p className="text-xs text-destructive px-1 leading-relaxed">
          {error}
        </p>
      )}
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
