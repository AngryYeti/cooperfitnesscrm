"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContacts } from "@/lib/actions/contacts";
import { sendBulkEmails } from "@/lib/actions/email";
import type { Contact, ContactStatus } from "@/lib/types";

const STATUSES: ContactStatus[] = [
  "Lead",
  "Trial",
  "Active Client",
  "Completed",
];

const statusStyleMap: Record<ContactStatus, string> = {
  Lead: "bg-amber-100/80 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border-transparent",
  Trial: "bg-sky-100/80 text-sky-900 dark:bg-sky-500/20 dark:text-sky-300 border-transparent",
  "Active Client": "bg-emerald-100/80 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300 border-transparent",
  Completed: "bg-slate-100/80 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border-transparent",
};

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

  const insertVariable = (v: string) => {
    setBody((prev) => prev + v);
  };

  return (
    <div className="space-y-6 max-w-3xl animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email</h1>
        <p className="text-muted-foreground mt-1">
          Send promotional emails to your contacts
        </p>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Audience
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Filter by status</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {STATUSES.map((status) => {
                const isOn = selectedStatuses.has(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      isOn
                        ? statusStyleMap[status]
                        : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          {loadingContacts ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 rounded-md" />
              ))}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">
                  {filteredContacts.length}{" "}
                  {filteredContacts.length !== contacts.length && (
                    <span className="text-muted-foreground/70">
                      of {contacts.length}
                    </span>
                  )}{" "}
                  {filteredContacts.length === 1 ? "contact" : "contacts"}
                </Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleAllFiltered}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {allFilteredSelected ? "Deselect all" : "Select all filtered"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIds(new Set(contacts.filter((c) => c.email).map((c) => c.id)));
                      setResult(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Select all contacts
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 divide-y divide-border/40 max-h-64 overflow-y-auto bg-card">
                {filteredContacts.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground text-center">
                    No contacts match the selected statuses.
                  </p>
                ) : (
                  filteredContacts.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleContact(c.id)}
                          className="peer sr-only"
                        />
                        <div className="h-4 w-4 rounded border-2 border-input peer-checked:bg-foreground peer-checked:border-foreground transition-colors flex items-center justify-center">
                          {selectedIds.has(c.id) && (
                            <svg
                              className="h-2.5 w-2.5 text-background"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <path
                                d="M2 6L5 9L10 3"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {c.first_name} {c.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.email || "No email"}
                        </p>
                      </div>
                      <Badge className={`text-[10px] ${statusStyleMap[c.status]}`}>
                        {c.status}
                      </Badge>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Compose
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              className="min-h-[180px]"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Personalize:
              </span>
              {["first_name", "last_name", "full_name"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(`{{${v}}}`)}
                  className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted hover:bg-muted/70 text-foreground transition-colors"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {result && (
            <div
              className={`rounded-lg border p-4 text-sm animate-fade-up ${
                result.errors.length > 0
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-success/30 bg-success/5"
              }`}
            >
              <p
                className={
                  result.errors.length > 0
                    ? "text-destructive font-medium"
                    : "text-success font-medium"
                }
              >
                Sent {result.sent} of {result.total} emails
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-destructive text-xs">
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
            className="w-full h-11 shadow-soft"
            size="lg"
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
        </CardContent>
      </Card>
    </div>
  );
}
