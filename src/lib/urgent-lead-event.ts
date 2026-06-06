import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEventSource } from "@/lib/types";

export interface CreateUrgentLeadEventParams {
  supabase: SupabaseClient;
  contactId: string;
  contactName: string;
  source: CalendarEventSource;
  contextLabel: string;
  amount?: number | null;
  hoursOut?: number;
}

export async function createUrgentLeadEvent({
  supabase,
  contactId,
  contactName,
  source,
  contextLabel,
  amount,
  hoursOut = 24,
}: CreateUrgentLeadEventParams) {
  const start = new Date(Date.now() + hoursOut * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const amountSuffix =
    typeof amount === "number" && amount > 0 ? ` ($${amount.toFixed(2)})` : "";

  const title = `Follow up: ${contextLabel} — ${contactName}${amountSuffix}`;
  const description =
    typeof amount === "number" && amount > 0
      ? `Auto-scheduled from website ${source === "website_purchase" ? "purchase" : "inquiry"}. Amount: $${amount.toFixed(2)}.`
      : `Auto-scheduled from website ${source === "website_purchase" ? "purchase" : "inquiry"}.`;

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      title,
      description,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      all_day: false,
      contact_id: contactId,
      color: "#dc2626",
      priority: "urgent",
      source,
    })
    .select("id, start_time, end_time, priority, source")
    .single();

  if (error) {
    console.error(`[${source}] failed to create urgent calendar event:`, error.message);
    return null;
  }

  return data;
}
