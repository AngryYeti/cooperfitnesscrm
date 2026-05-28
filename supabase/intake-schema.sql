-- Client Intake & Onboarding System
-- Run this in Supabase SQL Editor

-- Intake packets (one per client onboarding)
CREATE TABLE IF NOT EXISTS intake_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','in_progress','completed','expired')),
  access_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  docusign_envelope_id TEXT,
  signing_url TEXT,
  coach_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Intake form items within a packet
CREATE TABLE IF NOT EXISTS intake_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id UUID NOT NULL REFERENCES intake_packets(id) ON DELETE CASCADE,
  form_type TEXT NOT NULL,
  form_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','filled','signed','skipped')),
  form_data JSONB DEFAULT '{}'::jsonb,
  docusign_document_id TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signed documents storage
CREATE TABLE IF NOT EXISTS intake_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id UUID NOT NULL REFERENCES intake_packets(id) ON DELETE CASCADE,
  form_id UUID REFERENCES intake_forms(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  docusign_envelope_id TEXT,
  docusign_document_id TEXT,
  pdf_url TEXT,
  pdf_data TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit trail
CREATE TABLE IF NOT EXISTS intake_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id UUID REFERENCES intake_packets(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add intake_status to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS intake_status TEXT DEFAULT 'not_started' CHECK (intake_status IN ('not_started','started','forms_pending','signed','ready_for_onboarding'));

-- Enable RLS
ALTER TABLE intake_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_audit ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "allow_all_authenticated" ON intake_packets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON intake_forms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON intake_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON intake_audit FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public access for intake form (client-facing via token)
CREATE POLICY "allow_public_intake_packets" ON intake_packets FOR SELECT USING (true);
CREATE POLICY "allow_public_intake_forms" ON intake_forms FOR ALL USING (true);
