"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCalendarEvent,
  updateCalendarEvent,
} from "@/lib/actions/calendar";
import { CalendarEvent } from "@/lib/types";
import { format, parseISO } from "date-fns";

const COLORS = [
  { value: "#2563eb", label: "Blue" },
  { value: "#16a34a", label: "Green" },
  { value: "#dc2626", label: "Red" },
  { value: "#ca8a04", label: "Yellow" },
  { value: "#9333ea", label: "Purple" },
  { value: "#ea580c", label: "Orange" },
  { value: "#0891b2", label: "Cyan" },
  { value: "#be123c", label: "Rose" },
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
  const [color, setColor] = useState(event?.color || "#2563eb");
  const [startDate, setStartDate] = useState(() => {
    const d = event ? parseISO(event.start_time) : defaultDate || new Date();
    return format(d, "yyyy-MM-dd");
  });
  const [startTime, setStartTime] = useState(() => {
    const d = event ? parseISO(event.start_time) : defaultDate || new Date();
    return format(d, "HH:mm");
  });
  const [endDate, setEndDate] = useState(() => {
    const d = event ? parseISO(event.end_time) : defaultDate || new Date();
    return format(d, "yyyy-MM-dd");
  });
  const [endTime, setEndTime] = useState(() => {
    const d = event ? parseISO(event.end_time) : defaultDate || new Date();
    return format(d, "HH:mm");
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const start = allDay
        ? `${startDate}T00:00:00`
        : `${startDate}T${startTime}:00`;
      const end = allDay
        ? `${endDate}T23:59:59`
        : `${endDate}T${endTime}:00`;

      if (event) {
        await updateCalendarEvent(event.id, {
          title: title.trim(),
          description: description.trim() || null,
          start_time: start,
          end_time: end,
          all_day: allDay,
          color,
        });
      } else {
        await createCalendarEvent({
          title: title.trim(),
          description: description.trim(),
          start_time: start,
          end_time: end,
          all_day: allDay,
          color,
        });
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllDay(e.target.checked)}
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
            required
          />
        </div>
        {!allDay && (
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)}
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
            required
          />
        </div>
        {!allDay && (
          <div className="space-y-2">
            <Label>End Time</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndTime(e.target.value)}
              required
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                color === c.value
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : event ? "Update Event" : "Create Event"}
      </Button>
    </form>
  );
}
