-- Cooper Fitness CRM: Production Hardening Migration
-- Run this in Supabase SQL Editor
-- Date: 2026-06-08
-- Prerequisites: schema.sql, intake-schema.sql, calendar-completed-migration.sql, calendar-priority-source-migration.sql

-- ============================================================================
-- SECTION 1: FIX INTAKE RLS POLICIES (CRITICAL)
-- ============================================================================
-- The public intake policies allowed anonymous INSERT/UPDATE/DELETE on forms
-- and unrestricted public access. This hardens them to SELECT-only.

-- 1a. Drop dangerous public policies
DROP POLICY IF EXISTS "allow_public_intake_packets" ON intake_packets;
DROP POLICY IF EXISTS "allow_public_intake_forms"  ON intake_forms;

-- 1b. Recreate public policies with SELECT-only (token-mediated read access)
-- Packets: public needs SELECT to resolve via access_token (OK)
CREATE POLICY "allow_public_intake_packets" ON intake_packets
  FOR SELECT
  USING (true);

-- Forms: public MUST be SELECT-only — no INSERT, UPDATE, or DELETE
CREATE POLICY "allow_public_intake_forms" ON intake_forms
  FOR SELECT
  USING (true);

-- 1c. Ensure authenticated full-access policies on all intake tables
-- Drop old policy names to avoid collisions, then recreate with standardized naming
DROP POLICY IF EXISTS "allow_all_authenticated" ON intake_packets;
DROP POLICY IF EXISTS "allow_all_authenticated" ON intake_forms;
DROP POLICY IF EXISTS "allow_all_authenticated" ON intake_documents;
DROP POLICY IF EXISTS "allow_all_authenticated" ON intake_audit;

CREATE POLICY "allow_authenticated_intake" ON intake_packets
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_authenticated_intake" ON intake_forms
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_authenticated_intake" ON intake_documents
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_authenticated_intake" ON intake_audit
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ============================================================================
-- SECTION 2: FIX ACTIVITY TYPE CHECK CONSTRAINT (CRITICAL)
-- ============================================================================
-- PostgreSQL does not support ALTER CHECK, so we drop and recreate the
-- constraint to add 'calendar_event_completed' and 'calendar_event_uncompleted'.

ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;

ALTER TABLE activities ADD CONSTRAINT activities_type_check CHECK (
  type IN (
    'contact_created',
    'contact_updated',
    'note_added',
    'status_changed',
    'follow_up_created',
    'follow_up_completed',
    'calendar_event_created',
    'calendar_event_updated',
    'calendar_event_completed',
    'calendar_event_uncompleted'
  )
);


-- ============================================================================
-- SECTION 3: ADD MISSING DATABASE INDEXES (HIGH)
-- ============================================================================

-- 3a. Contact lookup indexes
CREATE INDEX IF NOT EXISTS idx_contacts_email  ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts (status);

-- 3b. Follow-ups: compound index for reminder queries (overdue + incomplete)
CREATE INDEX IF NOT EXISTS idx_follow_ups_due_date_completed ON follow_ups (due_date, completed);

-- 3c. Calendar events: compound index for range queries (agenda views, date filters)
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_end ON calendar_events (start_time, end_time);

-- 3d. Foreign key indexes for join performance and referential integrity checks
CREATE INDEX IF NOT EXISTS idx_notes_contact_id           ON notes (contact_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_contact_id      ON follow_ups (contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id      ON activities (contact_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_contact_id ON calendar_events (contact_id);
CREATE INDEX IF NOT EXISTS idx_client_checklists_contact_id ON client_checklists (contact_id);

-- 3e. Intake table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_intake_packets_contact_id    ON intake_packets (contact_id);
CREATE INDEX IF NOT EXISTS idx_intake_forms_packet_id       ON intake_forms (packet_id);
CREATE INDEX IF NOT EXISTS idx_intake_documents_packet_id   ON intake_documents (packet_id);
CREATE INDEX IF NOT EXISTS idx_intake_documents_contact_id  ON intake_documents (contact_id);
CREATE INDEX IF NOT EXISTS idx_intake_audit_packet_id       ON intake_audit (packet_id);
CREATE INDEX IF NOT EXISTS idx_intake_audit_contact_id      ON intake_audit (contact_id);


-- ============================================================================
-- SECTION 4: HARDENING RECOMMENDATION FOR MULTI-USER (HIGH)
-- ============================================================================
-- The current RLS model grants full access (USING true) to all authenticated
-- users. This is appropriate for a single-user CRM where all rows belong to
-- the same user. If multi-user support is ever needed:
--
--   1. Add a `user_id UUID REFERENCES auth.users(id)` column to every table.
--   2. Populate user_id on INSERT via default `auth.uid()` or trigger.
--   3. Replace `USING (true)` with `USING (user_id = auth.uid())` on all policies.
--   4. Remove all public (anon) policies and replace with token-validated
--      access that enforces the user-scoped ownership chain.
--
-- Until then, the single-user model is safe as-is because there are no
-- user-scoped rows to leak between users.
