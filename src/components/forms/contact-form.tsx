"use client";

import { useState } from "react";
import { Contact, ContactStatus, Source } from "@/lib/types";
import { createContact, updateContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";

const statusOptions: ContactStatus[] = [
  "Lead",
  "Trial",
  "Active Client",
  "Completed",
];

const sourceOptions: Source[] = [
  "Instagram",
  "Facebook",
  "Referral",
  "Website",
  "Google",
  "TikTok",
  "Other",
];

export function ContactForm({
  contact,
  onSuccess,
}: {
  contact?: Contact;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    first_name: contact?.first_name || "",
    last_name: contact?.last_name || "",
    phone: contact?.phone || "",
    email: contact?.email || "",
    fitness_goal: contact?.fitness_goal || "",
    status: contact?.status || "Lead",
    source: contact?.source || "",
    tags: (contact?.tags || []).join(", "),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        ...form,
        source: form.source as Source,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (contact) {
        await updateContact(contact.id, payload);
      } else {
        await createContact(payload as any /* eslint-disable-line @typescript-eslint/no-explicit-any */);
      }
      onSuccess();
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="first_name">First Name *</Label>
          <Input
            id="first_name"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last Name *</Label>
          <Input
            id="last_name"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fitness_goal">Fitness Goal</Label>
        <Textarea
          id="fitness_goal"
          value={form.fitness_goal}
          onChange={(e) => setForm({ ...form, fitness_goal: e.target.value })}
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status *</Label>
          <Select
            value={form.status}
            onValueChange={(v) =>
              setForm({ ...form, status: v as ContactStatus })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">Source</Label>
          <Select
            value={form.source}
            onValueChange={(v) => setForm({ ...form, source: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input
          id="tags"
          placeholder="e.g. VIP, Online Coaching, In-Person"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : contact ? "Update Contact" : "Add Contact"}
        </Button>
      </DialogFooter>
    </form>
  );
}
