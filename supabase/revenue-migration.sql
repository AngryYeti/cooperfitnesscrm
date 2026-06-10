-- Revenue tracking for Stripe purchases
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'succeeded'
    CHECK (status IN ('succeeded', 'refunded', 'pending')),
  source TEXT NOT NULL DEFAULT 'checkout.session'
    CHECK (source IN ('checkout.session', 'payment_intent')),
  stripe_created_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS revenue_contact_id_idx ON revenue(contact_id);
CREATE INDEX IF NOT EXISTS revenue_created_at_idx ON revenue(created_at);
CREATE INDEX IF NOT EXISTS revenue_status_created_idx ON revenue(status, created_at);

ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated" ON revenue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
