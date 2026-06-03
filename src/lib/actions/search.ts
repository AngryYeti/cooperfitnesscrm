"use server";

import { createClient } from "@/lib/supabase/server";
import type { Contact, CalendarEvent, FollowUp } from "@/lib/types";

const SYNONYMS: Record<string, string[]> = {
  wk: ["week", "weekly"],
  fu: ["follow"],
  "f/u": ["follow"],
  appt: ["appointment"],
  eval: ["evaluation", "evaluations"],
  chk: ["check", "checkin", "check-in"],
  parq: ["par-q", "parq+"],
  intake: ["onboarding"],
  "1-1": ["1 on 1", "1:1", "one on one"],
  pt: ["personal training"],
};

export type SearchResults = {
  query: string;
  contacts: (Contact & { matched_field?: string })[];
  events: (CalendarEvent & { matched_field?: string })[];
  followUps: (FollowUp & { matched_field?: string; contact_name?: string })[];
  total: number;
};

function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function expandQuery(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();
  const escaped = escapeIlike(trimmed);

  const terms = new Set<string>([escaped]);
  if (SYNONYMS[lower]) {
    for (const syn of SYNONYMS[lower]) {
      terms.add(escapeIlike(syn));
    }
  }
  return Array.from(terms);
}

function buildOrClauses(fields: string[], terms: string[]): string {
  const clauses: string[] = [];
  for (const field of fields) {
    for (const term of terms) {
      clauses.push(`${field}.ilike.%${term}%`);
    }
  }
  return clauses.join(",");
}

function detectMatchedField(
  record: Record<string, any>,
  fields: string[],
  terms: string[]
): string {
  const lower = (v: any) => (v ? String(v).toLowerCase() : "");
  for (const term of terms) {
    for (const field of fields) {
      if (lower(record[field]).includes(term.toLowerCase())) {
        return field;
      }
    }
  }
  return fields[0];
}

export async function globalSearch(rawQuery: string): Promise<SearchResults> {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return { query: "", contacts: [], events: [], followUps: [], total: 0 };
  }

  const terms = expandQuery(trimmed);
  if (terms.length === 0) {
    return { query: trimmed, contacts: [], events: [], followUps: [], total: 0 };
  }

  const supabase = await createClient();

  const contactFilter = buildOrClauses(
    ["first_name", "last_name", "email", "phone"],
    terms
  );
  const eventFilter = buildOrClauses(["title", "description"], terms);
  const followUpFilter = buildOrClauses(["title"], terms);

  const [contactsRes, eventsRes, followUpsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .or(contactFilter)
      .order("date_added", { ascending: false })
      .limit(25),
    supabase
      .from("calendar_events")
      .select("*, contacts(first_name, last_name)")
      .or(eventFilter)
      .order("start_time", { ascending: false })
      .limit(25),
    supabase
      .from("follow_ups")
      .select("*, contacts(first_name, last_name)")
      .or(followUpFilter)
      .order("due_date", { ascending: true })
      .limit(25),
  ]);

  const contactFields = ["first_name", "last_name", "email", "phone"];
  const eventFields = ["title", "description"];
  const followUpFields = ["title"];

  const contacts = ((contactsRes.data as any[]) || []).map((c) => ({
    ...c,
    matched_field: detectMatchedField(c, contactFields, terms),
  }));

  const events = ((eventsRes.data as any[]) || []).map((e) => ({
    ...e,
    matched_field: detectMatchedField(e, eventFields, terms),
  }));

  const followUps = ((followUpsRes.data as any[]) || []).map((f) => ({
    ...f,
    contact_name: f.contacts
      ? `${f.contacts.first_name} ${f.contacts.last_name}`.trim()
      : undefined,
    matched_field: detectMatchedField(f, followUpFields, terms),
  }));

  return {
    query: trimmed,
    contacts: contacts as any,
    events: events as any,
    followUps: followUps as any,
    total: contacts.length + events.length + followUps.length,
  };
}
