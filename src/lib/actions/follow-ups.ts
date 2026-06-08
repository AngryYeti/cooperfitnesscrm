"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FollowUp } from "@/lib/types";
import { getFullName } from "@/lib/utils";

export async function getFollowUps() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*, contacts(first_name, last_name)")
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getOverdueFollowUps() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*, contacts(first_name, last_name)")
    .eq("completed", false)
    .lt("due_date", today)
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createFollowUp(contactId: string, title: string, dueDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .insert({ contact_id: contactId, title, due_date: dueDate })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: contact } = await supabase
    .from("contacts")
    .select("first_name, last_name")
    .eq("id", contactId)
    .single();

  const contactName = contact
    ? getFullName(contact.first_name, contact.last_name)
    : null;

  const { error: activityError } = await supabase.from("activities").insert({
    type: "follow_up_created",
    contact_id: contactId,
    contact_name: contactName,
    description: `Created follow-up: ${title}`,
  });

  if (activityError) {
    console.error("Failed to log activity:", activityError.message);
  }

  const { error: calError } = await supabase.from("calendar_events").insert({
    title: `Follow-up: ${title}`,
    description: contactName ? `Follow-up for ${contactName}` : "Follow-up",
    start_time: `${dueDate}T17:00:00+00:00`,
    end_time: `${dueDate}T18:00:00+00:00`,
    all_day: false,
    contact_id: contactId,
    color: "#f59e0b",
  });

  if (calError) {
    console.error("Failed to create calendar event:", calError.message);
    throw new Error(`Failed to create calendar event: ${calError.message}`);
  }

  revalidatePath("/follow-ups");
  revalidatePath("/");
  revalidatePath(`/clients/${contactId}`);
  revalidatePath("/calendar");
  return data as FollowUp;
}

export async function completeFollowUp(id: string, contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .update({ completed: true })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: contact } = await supabase
    .from("contacts")
    .select("first_name,last_name")
    .eq("id", contactId)
    .single();

  await supabase.from("activities").insert({
    type: "follow_up_completed",
    contact_id: contactId,
    contact_name: contact ? getFullName(contact.first_name, contact.last_name) : null,
    description: `Completed follow-up: ${data.title}`,
  });

  revalidatePath("/follow-ups");
  revalidatePath("/");
  revalidatePath(`/clients/${contactId}`);
  return data;
}

export async function deleteFollowUp(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("follow_ups").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/follow-ups");
  revalidatePath("/");
}
