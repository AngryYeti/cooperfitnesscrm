-- Add completion tracking to calendar events
-- Run this in Supabase SQL Editor

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
