-- Add priority + source tracking to calendar events
-- Run this in Supabase SQL Editor

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'urgent')),
  ADD COLUMN IF NOT EXISTS source TEXT
    CHECK (source IN ('website_inquiry', 'website_purchase', 'manual', 'cal', 'google'));

CREATE INDEX IF NOT EXISTS calendar_events_priority_idx
  ON calendar_events (priority);

CREATE INDEX IF NOT EXISTS calendar_events_source_idx
  ON calendar_events (source);
