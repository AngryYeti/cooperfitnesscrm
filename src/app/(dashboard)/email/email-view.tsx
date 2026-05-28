"use client";

import { useState, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getContacts } from "@/lib/actions/contacts";
import { sendBulkEmails } from "@/lib/actions/email";
import type { Contact, ContactStatus } from "@/lib/types";

const STATUSES: ContactStatus[] = [
  "Lead",
  "Trial",
  "Active Client",
  "Completed",
];

export function EmailView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ContactStatus>>(
    new Set(["Lead", "Trial", "Active Client"])
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: number;
    errors: string[];
    total: number;
  } | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const data = await getContacts();
      setContacts(data);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const toggleStatus = (status: ContactStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
    setSelectedIds(new Set());
    setResult(null);
  };

  const filteredContacts = contacts.filter((c) =>
    selectedStatuses.has(c.status)
  );

  const allFilteredSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((c) => selectedIds.has(c.id));

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    }
    setResult(null);
  };

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setResult(null);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;

    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setSending(true);
    setResult(null);
    try {
      const res = await sendBulkEmails(ids, subject.trim(), body);
      setResult(res);
    } catch (err) {
      setResult({
        sent: 0,
        errors: [err instanceof Error ? err.message : "Failed to send emails"],
        total: ids.length,
      });
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: ContactStatus) => {
    switch (status) {
      case "Lead":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Trial":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Active Client":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Completed":
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email</h1>
        <p className="text-muted-foreground">
          Send promotional emails to your contacts
        </p>
      </div>

      <div className="space-y-2">
        <Label>Filter by Status</Label>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatus(status)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedStatuses.has(status)
                  ? getStatusColor(status)
                  : "bg-muted text-muted-foreground border-transparent"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {loadingContacts ? (
        <p className="text-sm text-muted-foreground">Loading contacts...</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>
              Contacts ({filteredContacts.length})
            </Label>
            <button
              type="button"
              onClick={toggleAllFiltered}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {allFilteredSelected ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No contacts match the selected statuses.
              </p>
            ) : (
              filteredContacts.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleContact(c.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.email || "No email"}
                    </p>
                  </div>
                  <Badge
                    className={`text-[10px] ${getStatusColor(c.status)}`}
                  >
                    {c.status}
                  </Badge>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject line"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Body</Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your email..."
          rows={8}
        />
        <p className="text-xs text-muted-foreground">
          Use {"{{first_name}}"}, {"{{last_name}}"}, or {"{{full_name}}"} to personalize each email.
        </p>
      </div>

      {result && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            result.errors.length > 0
              ? "border-destructive/50 bg-destructive/5"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p
            className={
              result.errors.length > 0
                ? "text-destructive font-medium"
                : "text-emerald-700 font-medium"
            }
          >
            Sent {result.sent} of {result.total} emails
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-destructive">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button
        onClick={handleSend}
        disabled={
          sending ||
          selectedIds.size === 0 ||
          !subject.trim() ||
          !body.trim()
        }
        className="w-full"
      >
        {sending ? (
          <>Sending...</>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send to {selectedIds.size} contact
            {selectedIds.size !== 1 ? "s" : ""}
          </>
        )}
      </Button>
    </div>
  );
}
