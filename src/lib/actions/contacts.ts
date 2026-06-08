"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Contact, ContactStatus, Source } from "@/lib/types";
import { getFullName } from "@/lib/utils";

export async function getContacts(status?: ContactStatus) {
  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("*")
    .order("date_added", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as Contact[]) || [];
}

export async function getContactById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as Contact;
}

export async function createContact(contact: {
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  fitness_goal?: string;
  status: ContactStatus;
  source?: Source;
  tags?: string[];
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      ...contact,
      date_added: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("activities").insert({
    type: "contact_created",
    contact_id: data.id,
    contact_name: getFullName(contact.first_name, contact.last_name),
    description: `Added ${getFullName(contact.first_name, contact.last_name)} as a ${contact.status}`,
  });

  revalidatePath("/clients");
  revalidatePath("/");
  return data as Contact;
}

export async function updateContact(
  id: string,
  updates: Partial<Contact>
) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("contacts")
    .select("status")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("contacts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (updates.status && existing && existing.status !== updates.status) {
    await supabase.from("activities").insert({
      type: "status_changed",
      contact_id: id,
      contact_name: getFullName(data.first_name, data.last_name),
      description: `Status changed from ${existing.status} to ${updates.status}`,
    });
  } else {
    await supabase.from("activities").insert({
      type: "contact_updated",
      contact_id: id,
      contact_name: getFullName(data.first_name, data.last_name),
      description: `Updated ${getFullName(data.first_name, data.last_name)}'s profile`,
    });
  }

  revalidatePath("/clients");
  revalidatePath("/");
  revalidatePath(`/clients/${id}`);
  return data as Contact;
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/clients");
  revalidatePath("/");
}

export async function searchContacts(query: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`
    )
    .order("date_added", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as Contact[]) || [];
}

export async function getDashboardStats() {
  const supabase = await createClient();
  const { data: contacts, error } = await supabase.from("contacts").select("status");
  if (error) throw new Error(error.message);

  const stats = {
    totalLeads: contacts?.filter((c) => c.status === "Lead").length || 0,
    activeClients:
      contacts?.filter((c) => c.status === "Active Client").length || 0,
    pendingFollowUps: 0,
    completedClients:
      contacts?.filter((c) => c.status === "Completed").length || 0,
  };

  const { data: followUps } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("completed", false);

  stats.pendingFollowUps = followUps?.length || 0;

  return stats;
}
