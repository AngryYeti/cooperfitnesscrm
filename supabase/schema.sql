-- Cooper Fitness CRM Database Schema
-- Run this in your Supabase SQL Editor

-- Enable RLS
alter table if exists contacts force row level security;
alter table if exists notes force row level security;
alter table if exists follow_ups force row level security;
alter table if exists checklist_templates force row level security;
alter table if exists client_checklists force row level security;
alter table if exists activities force row level security;

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  fitness_goal TEXT,
  status TEXT NOT NULL DEFAULT 'Lead' CHECK (status IN ('Lead', 'Trial', 'Active Client', 'Completed')),
  source TEXT CHECK (source IN ('Instagram', 'Facebook', 'Referral', 'Website', 'Google', 'TikTok', 'Other')),
  date_added TIMESTAMPTZ NOT NULL DEFAULT now(),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Follow-ups table
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Checklist templates
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  items TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client checklists
CREATE TABLE IF NOT EXISTS client_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity log
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('contact_created', 'contact_updated', 'note_added', 'status_changed', 'follow_up_created', 'follow_up_completed', 'calendar_event_created', 'calendar_event_updated')),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name TEXT,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  color TEXT DEFAULT '#2563eb',
  google_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (single-user CRM)
CREATE POLICY "allow_all_authenticated" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON checklist_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON client_checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed data
INSERT INTO contacts (first_name, last_name, phone, email, fitness_goal, status, source, date_added, tags)
VALUES
  ('Sarah', 'Johnson', '555-0123', 'sarah@email.com', 'Lose 20 lbs and build lean muscle', 'Active Client', 'Instagram', now() - interval '2 months', ARRAY['VIP', 'Online Coaching']),
  ('Mike', 'Chen', '555-0456', 'mike@email.com', 'Training for first marathon', 'Trial', 'Referral', now() - interval '1 week', ARRAY['In-Person']),
  ('Jessica', 'Williams', '555-0789', 'jessica@email.com', 'Postpartum strength recovery', 'Lead', 'Facebook', now() - interval '3 days', ARRAY[]::text[]),
  ('David', 'Martinez', '555-0321', 'david@email.com', 'Body recomposition - bulk to 180 lbs', 'Active Client', 'Website', now() - interval '1 month', ARRAY['Semi-Private']),
  ('Emily', 'Thompson', '555-0654', 'emily@email.com', 'Improve mobility and reduce back pain', 'Completed', 'Google', now() - interval '4 months', ARRAY[]::text[]),
  ('James', 'Anderson', '555-0987', 'james@email.com', 'Powerlifting competition prep', 'Lead', 'TikTok', now() - interval '1 day', ARRAY[]::text[]);

INSERT INTO checklist_templates (name, items)
VALUES
  ('New Client Onboarding', ARRAY['Consultation Booked', 'Payment Received', 'Workout Plan Sent', 'Nutrition Guidance Sent', 'Progress Photos Received', 'Weekly Check-In Completed']),
  ('Trial to Active Conversion', ARRAY['Trial Session Completed', 'Feedback Call Done', 'Package Presented', 'Payment Received', 'Welcome Email Sent']);

INSERT INTO follow_ups (contact_id, title, due_date, completed)
SELECT id, 'Weekly check-in call', (now() + interval '3 days')::date, false
FROM contacts WHERE first_name = 'Sarah' AND last_name = 'Johnson';

INSERT INTO follow_ups (contact_id, title, due_date, completed)
SELECT id, 'Send trial workout plan', (now() - interval '1 day')::date, false
FROM contacts WHERE first_name = 'Mike' AND last_name = 'Chen';
