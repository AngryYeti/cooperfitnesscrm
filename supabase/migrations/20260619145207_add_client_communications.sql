CREATE TABLE client_communications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  body_text TEXT,
  sender_email TEXT,
  date_received TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: Depending on existing RLS policies in this CRM, we might want to enable RLS.
-- For simplicity and alignment with the rest of this standalone CRM, we'll allow authenticated access.
ALTER TABLE client_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to client_communications"
  ON client_communications
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
