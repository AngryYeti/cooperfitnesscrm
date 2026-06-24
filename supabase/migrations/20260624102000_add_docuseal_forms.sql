-- Create form_templates table
CREATE TABLE IF NOT EXISTS form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  html_content TEXT NOT NULL,
  fields JSONB DEFAULT '[]'::jsonb,
  docuseal_template_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create client_forms table
CREATE TABLE IF NOT EXISTS client_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  template_id UUID REFERENCES form_templates(id) ON DELETE SET NULL,
  docuseal_submission_id INTEGER,
  docuseal_submitter_id INTEGER,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'received', 'completed')),
  signing_url TEXT,
  pdf_url TEXT,
  local_pdf_path TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_forms_contact_id ON client_forms(contact_id);
CREATE INDEX IF NOT EXISTS idx_client_forms_template_id ON client_forms(template_id);
CREATE INDEX IF NOT EXISTS idx_client_forms_status ON client_forms(status);

-- Enable RLS
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_forms ENABLE ROW LEVEL SECURITY;

-- Add authenticated RLS policies
DROP POLICY IF EXISTS "allow_all_authenticated" ON form_templates;
CREATE POLICY "allow_all_authenticated" ON form_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_authenticated" ON client_forms;
CREATE POLICY "allow_all_authenticated" ON client_forms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
