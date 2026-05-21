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

export interface Activity {
  id: string;
  type: "contact_created" | "contact_updated" | "note_added" | "status_changed" | "follow_up_created" | "follow_up_completed";
  contact_id: string | null;
  contact_name: string | null;
  description: string;
  created_at: string;
}
