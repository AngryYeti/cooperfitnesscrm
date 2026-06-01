"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CalendarEvent } from "@/lib/types";

export async function getCalendarEvents(startDate: string, endDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*, contacts(first_name, last_name)")
    .lte("start_time", endDate)
    .gte("end_time", startDate)
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as CalendarEvent[];
}

export async function createCalendarEvent(event: {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  contact_id?: string | null;
  color?: string;
  google_event_id?: string | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      title: event.title,
      description: event.description || null,
      start_time: event.start_time,
      end_time: event.end_time,
      all_day: event.all_day || false,
      contact_id: event.contact_id || null,
      color: event.color || "#2563eb",
      google_event_id: event.google_event_id || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (event.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name,last_name")
      .eq("id", event.contact_id)
      .single();

    await supabase.from("activities").insert({
      type: "calendar_event_created",
      contact_id: event.contact_id,
      contact_name: contact ? `${contact.first_name} ${contact.last_name}` : null,
      description: `Created calendar event: ${event.title}`,
    });
  }

  revalidatePath("/calendar");
  return data as CalendarEvent;
}

export async function updateCalendarEvent(
  id: string,
  event: Partial<{
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    all_day: boolean;
    contact_id: string | null;
    color: string;
    google_event_id: string | null;
  }>
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .update(event)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (event.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name,last_name")
      .eq("id", event.contact_id)
      .single();

    await supabase.from("activities").insert({
      type: "calendar_event_updated",
      contact_id: event.contact_id,
      contact_name: contact ? `${contact.first_name} ${contact.last_name}` : null,
      description: `Updated calendar event: ${event.title || data.title}`,
    });
  }

  revalidatePath("/calendar");
  return data as CalendarEvent;
}

export async function deleteCalendarEvent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/calendar");
}

export async function toggleEventCompleted(
  id: string,
  completed: boolean
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id, title, contact_id, contacts(first_name, last_name)")
    .single();

  if (error) throw new Error(error.message);

  if (data?.contact_id && data?.contacts) {
    const contact = data.contacts as unknown as {
      first_name: string;
      last_name: string;
    };
    await supabase.from("activities").insert({
      type: completed ? "calendar_event_completed" : "calendar_event_uncompleted",
      contact_id: data.contact_id,
      contact_name: `${contact.first_name} ${contact.last_name}`,
      description: `${completed ? "Completed" : "Reopened"} calendar event: ${data.title}`,
    });
  }

  revalidatePath("/calendar");
  return data;
}
