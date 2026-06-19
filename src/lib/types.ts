export type ContactStatus = "Lead" | "Trial" | "Active Client" | "Completed";

export type Source =
  | "Instagram"
  | "Facebook"
  | "Referral"
  | "Website"
  | "Google"
  | "TikTok"
  | "Other";

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  fitness_goal: string | null;
  status: ContactStatus;
  source: Source | null;
  date_added: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  contact_id: string;
  content: string;
  created_at: string;
}

export interface FollowUp {
  id: string;
  contact_id: string;
  title: string;
  due_date: string;
  completed: boolean;
  created_at: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  items: string[];
  created_at: string;
}

export interface ClientChecklist {
  id: string;
  contact_id: string;
  template_id: string;
  items: {
    label: string;
    completed: boolean;
    completed_at: string | null;
  }[];
  created_at: string;
}

export interface Communication {
  id: string;
  contact_id: string;
  direction: "inbound" | "outbound";
  subject: string;
  body_text: string;
  sender_email: string | null;
  date_received: string;
  created_at: string;
}

export interface Revenue {
  id: string;
  stripe_event_id: string;
  contact_id: string | null;
  contacts?: { first_name: string; last_name: string; email: string | null } | null;
  product_name: string;
  amount_cents: number;
  currency: string;
  status: "succeeded" | "refunded" | "pending";
  source: "checkout.session" | "payment_intent";
  stripe_created_at: string;
  created_at: string;
}

export interface Activity {
  id: string;
  type: "contact_created" | "contact_updated" | "note_added" | "status_changed" | "follow_up_created" | "follow_up_completed" | "email_received";
  contact_id: string | null;
  contact_name: string | null;
  description: string;
  created_at: string;
}

export type CalendarEventPriority = "normal" | "urgent";
export type CalendarEventSource =
  | "website_inquiry"
  | "website_purchase"
  | "manual"
  | "cal"
  | "google";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  contact_id: string | null;
  contacts?: { first_name: string; last_name: string } | null;
  color: string | null;
  google_event_id: string | null;
  completed: boolean;
  completed_at: string | null;
  priority: CalendarEventPriority;
  source: CalendarEventSource | null;
  created_at: string;
}
