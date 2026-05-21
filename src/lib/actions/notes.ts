"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Note } from "@/lib/types";

export async function getNotesByContactId(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as Note[]) || [];
}

export async function createNote(contactId: string, content: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({ contact_id: contactId, content })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: contact } = await supabase
    .from("contacts")
    .select("first_name,last_name")
    .eq("id", contactId)
    .single();

  await supabase.from("activities").insert({
    type: "note_added",
    contact_id: contactId,
    contact_name: contact ? `${contact.first_name} ${contact.last_name}` : null,
    description: `Added a note to ${contact?.first_name} ${contact?.last_name}`,
  });

  revalidatePath(`/clients/${contactId}`);
  return data as Note;
}

export async function deleteNote(id: string, contactId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${contactId}`);
}
