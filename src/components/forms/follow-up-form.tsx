"use client";

import { useState } from "react";
import { createFollowUp } from "@/lib/actions/follow-ups";
import { getContacts } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";

export function FollowUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [contactId, setContactId] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [contacts, setContacts] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contactsLoaded, setContactsLoaded] = useState(false);

  const loadContacts = async () => {
    if (contactsLoaded) return;
    const data = await getContacts();
    setContacts(data);
    setContactsLoaded(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId || !title.trim() || !dueDate) return;

    setLoading(true);
    setError("");

    try {
      await createFollowUp(contactId, title.trim(), dueDate);
      onSuccess();
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Contact</Label>
        <Select
          value={contactId}
          onValueChange={(v) => setContactId(v)}
          onOpenChange={(open) => {
            if (open) loadContacts();
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a contact" />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((contact) => (
              <SelectItem key={contact.id} value={contact.id}>
                {contact.first_name} {contact.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Follow up on trial session"
        />
      </div>
      <div className="space-y-2">
        <Label>Due Date</Label>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button
          type="submit"
          disabled={loading || !contactId || !title.trim() || !dueDate}
        >
          {loading ? "Saving..." : "Add Follow-Up"}
        </Button>
      </DialogFooter>
    </form>
  );
}
