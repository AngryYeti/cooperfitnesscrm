"use server";

import { createClient } from "@/lib/supabase/server";
import { Activity } from "@/lib/types";

export async function getRecentActivities(limit: number = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data as Activity[]) || [];
}
