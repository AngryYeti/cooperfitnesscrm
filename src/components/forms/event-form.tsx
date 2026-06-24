"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCalendarEvent,
  updateCalendarEvent,
} from "@/lib/actions/calendar";
import { getContacts } from "@/lib/actions/contacts";
import type { CalendarEvent, Contact } from "@/lib/types";
import { getEventColor } from "@/lib/event-colors";
import { format, parseISO } from "date-fns";

const TASK_TYPES = [
  { value: "none", label: "None" },
  { value: "Consultation", label: "Consultation" },
  { value: "Document Review", label: "Document Review" },
  { value: "Follow Up", label: "Follow Up" },
  { value: "Weekly Check-In", label: "Weekly Check-In" },
];

const RECUR_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function EventForm({
  event,
  defaultDate,
  onSuccess,
}: {
  event?: CalendarEvent;
  defaultDate?: Date;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [allDay, setAllDay] = useState(event?.all_day || false);
  const [taskType, setTaskType] = useState("none");
  const [contactId, setContactId] = useState(event?.contact_id || "");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [contactsError, setContactsError] = useState(false);
  const [sendInvite, setSendInvite] = useState(false);

  const selectedContact = contacts.find((c) => c.id === contactId);
  const hasEmail = Boolean(selectedContact?.email);
  const [recurring, setRecurring] = useState("none");
  const [recurCount, setRecurCount] = useState(4);
  const [startDate, setStartDate] = useState(() => {
    const d = event ? parseISO(event.start_time) : defaultDate || new Date();
    return format(d, "yyyy-MM-dd");
  });
  const [startTime, setStartTime] = useState(() => {
    const d = event ? parseISO(event.start_time) : defaultDate || new Date();
    return format(d, "HH:mm");
  });
  const [endDate, setEndDate] = useState(() => {
    const d = event
      ? parseISO(event.end_time)
      : defaultDate
        ? defaultDate
        : new Date();
    return format(d, "yyyy-MM-dd");
  });
  const [endTime, setEndTime] = useState(() => {
    const d = event
      ? parseISO(event.end_time)
      : defaultDate
        ? defaultDate
        : new Date();
    return format(d, "HH:mm");
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const contactIdRef = useRef(contactId);
  useEffect(() => {
    contactIdRef.current = contactId;
  }, [contactId]);

  useEffect(() => {
    if (contactsLoaded || contactsError) return;
    getContacts()
      .then((data) => {
        setContacts(data);
        setContactsLoaded(true);
      })
      .catch(() => setContactsError(true));
  }, [contactsLoaded, contactsError]);

  const loadContacts = () => {
    if (contactsLoaded || contactsError) return;
    getContacts()
      .then((data) => {
        setContacts(data);
        setContactsLoaded(true);
      })
      .catch(() => setContactsError(true));
  };

  const handleTaskTypeChange = (value: string) => {
    setTaskType(value);
    if (value !== "none" && (!title || TASK_TYPES.some((t) => t.value === title))) {
      setTitle(value);
    }
  };

  const handleRecurringChange = (value: string) => {
    setRecurring(value);
    if (value === "weekly") setRecurCount(4);
    if (value === "monthly") setRecurCount(3);
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    const [h, m] = value.split(":").map(Number);
    const end = new Date(2020, 0, 1, h + 1, m);
    setEndTime(format(end, "HH:mm"));
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setEndDate(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError("");
    try {
      const finalTitle =
        taskType !== "none"
          ? `${taskType}: ${title.trim()}`
          : title.trim();

      const buildTimes = (offset = 0) => {
        const [sy, sm, sd] = startDate.split("-").map(Number);
        const [ey, em, ed] = endDate.split("-").map(Number);
        const [sh, smin] = startTime.split(":").map(Number);
        const [eh, emin] = endTime.split(":").map(Number);

        const startLocal = allDay
          ? new Date(sy, sm - 1, sd, 12, 0, 0)
          : new Date(sy, sm - 1, sd, sh, smin, 0);
        const endLocal = allDay
          ? new Date(ey, em - 1, ed, 12, 0, 0)
          : new Date(ey, em - 1, ed, eh, emin, 0);

        if (offset > 0) {
          if (recurring === "weekly") {
            startLocal.setDate(startLocal.getDate() + offset * 7);
            endLocal.setDate(endLocal.getDate() + offset * 7);
          } else {
            startLocal.setMonth(startLocal.getMonth() + offset);
            endLocal.setMonth(endLocal.getMonth() + offset);
          }
        }

        return {
          start: startLocal.toISOString(),
          end: endLocal.toISOString(),
        };
      };

      if (event) {
        const { start, end } = buildTimes();
        await updateCalendarEvent(
          event.id,
          {
            title: finalTitle,
            description: description.trim() || null,
            start_time: start,
            end_time: end,
            all_day: allDay,
            contact_id: contactIdRef.current || null,
            color: event.color || getEventColor(finalTitle),
          },
          sendInvite
        );
      } else {
        const count = recurring === "none" ? 1 : recurCount;
        for (let i = 0; i < count; i++) {
          const { start, end } = buildTimes(i);
          await createCalendarEvent(
            {
              title: finalTitle,
              description: description.trim(),
              start_time: start,
              end_time: end,
              all_day: allDay,
              contact_id: contactIdRef.current || null,
              color: getEventColor(finalTitle),
            },
            sendInvite
          );
        }
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Task Type</Label>
        <Select value={taskType} onValueChange={handleTaskTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {TASK_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Client</Label>
        <Select
          value={contactId}
          onValueChange={(val) => {
            setContactId(val);
            setSendInvite(false);
          }}
          onOpenChange={(open) => {
            if (open) loadContacts();
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a client (optional)" />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {contactId && (
          <div className="pt-1">
            {hasEmail ? (
              <div className="flex items-center gap-2">
                <input
                  id="sendInvite"
                  type="checkbox"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                />
                <Label htmlFor="sendInvite" className="font-normal text-xs text-muted-foreground cursor-pointer select-none">
                  Send calendar invite (.ics + Google Calendar link) to client
                </Label>
              </div>
            ) : (
              <p className="text-[11px] text-amber-600 font-medium leading-relaxed">
                ⚠️ Selected client does not have an email address on file. Invitation cannot be sent.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details"
          rows={2}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="allDay"
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="allDay" className="font-normal">
          All day
        </Label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            required
          />
        </div>
        {!allDay && (
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              required
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
        {!allDay && (
          <div className="space-y-2">
            <Label>End Time</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        )}
      </div>

      {!event && (
        <>
          <div className="space-y-2">
            <Label>Repeat</Label>
            <Select value={recurring} onValueChange={handleRecurringChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECUR_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {recurring !== "none" && (
            <div className="space-y-2">
              <Label>Number of occurrences</Label>
              <Input
                type="number"
                min={2}
                max={52}
                value={recurCount}
                onChange={(e) => setRecurCount(Number(e.target.value))}
              />
            </div>
          )}
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? "Saving..."
          : event
            ? "Update Event"
            : recurring !== "none"
              ? `Create ${recurCount} Events`
              : "Create Event"}
      </Button>
    </form>
  );
}
