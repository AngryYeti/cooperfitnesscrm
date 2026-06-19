"use server";

import { createClient } from "@/lib/supabase/server";

export async function getClientCommunications(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_communications")
    .select("*")
    .eq("contact_id", contactId)
    .order("date_received", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}
