"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Tag,
  Target,
  Trash2,
  CheckSquare,
  ListChecks,
  Clock,
  Check,
  Plus,
  Loader2,
  Pencil,
} from "lucide-react";
import { Contact, Note, ClientChecklist } from "@/lib/types";
import { format } from "date-fns";
import { createNote, deleteNote } from "@/lib/actions/notes";
import {
  assignChecklist,
  toggleChecklistItem,
} from "@/lib/actions/checklists";
import { createFollowUp, completeFollowUp } from "@/lib/actions/follow-ups";
import { updateContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getChecklistTemplates } from "@/lib/actions/checklists";
import { cn } from "@/lib/utils";

const statusBadgeMap: Record<string, "lead" | "trial" | "active" | "completed"> = {
  Lead: "lead",
  Trial: "trial",
  "Active Client": "active",
  Completed: "completed",
};

const statusOptions = ["Lead", "Trial", "Active Client", "Completed"];

export function ContactDetailView({
  contact: initialContact,
  notes: initialNotes,
  checklists: initialChecklists,
  followUps: initialFollowUps,
}: {
  contact: Contact;
  notes: Note[];
  checklists: ClientChecklist[];
  followUps: any[];
}) {
  const router = useRouter();
  const [contact, setContact] = useState(initialContact);
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [checklists, setChecklists] = useState(initialChecklists);
  const [followUps, setFollowUps] = useState(initialFollowUps);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  const saveField = (patch: Partial<Contact>) => {
    const previous = contact;
    setContact({ ...contact, ...patch });
    startTransition(async () => {
      try {
        await updateContact(contact.id, patch);
        router.refresh();
      } catch {
        setContact(previous);
      }
    });
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    const note = await createNote(contact.id, newNote.trim());
    setNotes([note, ...notes]);
    setNewNote("");
    setAddingNote(false);
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id, contact.id);
    setNotes(notes.filter((n) => n.id !== id));
  };

  const handleAddFollowUp = async () => {
    if (!followUpTitle.trim() || !followUpDate) return;
    await createFollowUp(contact.id, followUpTitle.trim(), followUpDate);
    setIsFollowUpOpen(false);
    setFollowUpTitle("");
    setFollowUpDate("");
  };

  const handleCompleteFollowUp = async (id: string) => {
    await completeFollowUp(id, contact.id);
    setFollowUps(followUps.map((fu) => (fu.id === id ? { ...fu, completed: true } : fu)));
  };

  const handleToggleChecklist = async (
    checklistId: string,
    itemIndex: number,
    completed: boolean
  ) => {
    await toggleChecklistItem(checklistId, itemIndex, completed, contact.id);
    setChecklists(
      checklists.map((cl) => {
        if (cl.id !== checklistId) return cl;
        const items = [...cl.items];
        items[itemIndex] = {
          ...items[itemIndex],
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        };
        return { ...cl, items };
      })
    );
  };

  const openAssignDialog = async () => {
    const data = await getChecklistTemplates();
    setTemplates(data);
    setIsAssignOpen(true);
  };

  const handleAssignTemplate = async (templateId: string) => {
    await assignChecklist(contact.id, templateId);
    setIsAssignOpen(false);
    window.location.reload();
  };

  const handleStatusChange = async (newStatus: string) => {
    saveField({ status: newStatus as any });
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/clients"
          className="hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-soft flex items-center justify-center text-lg font-semibold shrink-0">
            {contact.first_name[0]}
            {contact.last_name?.[0] || ""}
          </div>
          <div>
            <EditableNameField
              contact={contact}
              saving={isPending}
              onSave={(first, last) =>
                saveField({ first_name: first, last_name: last })
              }
            />
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Select value={contact.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-7 px-2.5 text-xs font-medium border-border/60">
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
              {contact.source && (
                <span className="text-xs text-muted-foreground">
                  via {contact.source}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsFollowUpOpen(true)}
          className="shadow-soft"
        >
          <Clock className="mr-2 h-4 w-4" />
          Follow-Up
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-5 grid gap-5 sm:grid-cols-2">
          <EditableInfoRow
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={contact.email || ""}
            placeholder="Add email"
            type="email"
            saving={isPending}
            onSave={(v) => saveField({ email: v || null })}
          />
          <EditableInfoRow
            icon={<Phone className="h-4 w-4" />}
            label="Phone"
            value={contact.phone || ""}
            placeholder="Add phone"
            type="tel"
            saving={isPending}
            onSave={(v) => saveField({ phone: v || null })}
          />
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date Added</p>
              <p className="text-sm font-medium">
                {format(new Date(contact.date_added), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <EditableInfoRow
            icon={<Target className="h-4 w-4" />}
            label="Fitness Goal"
            value={contact.fitness_goal || ""}
            placeholder="Add fitness goal"
            multiline
            saving={isPending}
            onSave={(v) => saveField({ fitness_goal: v || null })}
          />
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex items-start gap-3 sm:col-span-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Tag className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="followups">Follow-Ups</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <Button
              size="icon"
              className="shrink-0 self-end h-9 w-9 shadow-soft"
              disabled={addingNote || !newNote.trim()}
              onClick={handleAddNote}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {notes.map((note) => (
              <Card key={note.id} className="border-border/60 shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive shrink-0"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {notes.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No notes yet. Add your first note above.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="checklists" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Workflow Checklists</h3>
            <Button size="sm" variant="outline" onClick={openAssignDialog} className="shadow-soft">
              <ListChecks className="mr-2 h-4 w-4" />
              Assign Template
            </Button>
          </div>
          {checklists.map((checklist) => {
            const completed = checklist.items.filter((i: any) => i.completed).length;
            const total = checklist.items.length;
            const pct = total > 0 ? (completed / total) * 100 : 0;
            return (
              <Card key={checklist.id} className="border-border/60 shadow-soft">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Checklist</p>
                    <span className="text-xs text-muted-foreground">
                      {completed}/{total}
                    </span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {checklist.items.map((item: any, index: number) => (
                      <label
                        key={index}
                        className="flex items-center gap-3 cursor-pointer rounded-md px-1 py-1 hover:bg-muted/30 transition-colors"
                      >
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${
                            item.completed
                              ? "bg-foreground border-foreground"
                              : "border-input"
                          }`}
                          onClick={() =>
                            handleToggleChecklist(
                              checklist.id,
                              index,
                              !item.completed
                            )
                          }
                        >
                          {item.completed && (
                            <Check className="h-3 w-3 text-background" strokeWidth={3} />
                          )}
                        </div>
                        <span
                          className={`text-sm flex-1 ${
                            item.completed
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.completed_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.completed_at), "MMM d")}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {checklists.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No checklists assigned. Assign a template to get started.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="followups" className="space-y-2 mt-4">
          {followUps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No follow-ups scheduled.
              </p>
            </div>
          ) : (
            followUps.map((fu: any) => (
              <Card
                key={fu.id}
                className={`border-border/60 shadow-soft ${
                  fu.completed ? "opacity-50" : ""
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        fu.completed ? "bg-muted" : "bg-primary/10"
                      }`}
                    >
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{fu.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(fu.due_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  {fu.completed ? (
                    <Badge variant="success" className="text-[10px]">
                      Completed
                    </Badge>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-500/20"
                      onClick={() => handleCompleteFollowUp(fu.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isFollowUpOpen} onOpenChange={setIsFollowUpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Follow-Up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={followUpTitle}
                onChange={(e) => setFollowUpTitle(e.target.value)}
                placeholder="e.g. Check in on nutrition plan"
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddFollowUp}
              disabled={!followUpTitle.trim() || !followUpDate}
            >
              Add Follow-Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {templates.map((template) => (
              <Button
                key={template.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleAssignTemplate(template.id)}
              >
                <ListChecks className="mr-2 h-4 w-4" />
                {template.name}
              </Button>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No templates available. Create one in Settings.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditableNameField({
  contact,
  saving,
  onSave,
}: {
  contact: Contact;
  saving: boolean;
  onSave: (firstName: string, lastName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(contact.first_name);
  const [last, setLast] = useState(contact.last_name || "");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setFirst(contact.first_name);
      setLast(contact.last_name || "");
    }
  }, [contact.first_name, contact.last_name, editing]);

  useEffect(() => {
    if (editing) firstRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmedFirst = first.trim();
    const trimmedLast = last.trim();
    if (
      !trimmedFirst ||
      (trimmedFirst === contact.first_name &&
        trimmedLast === (contact.last_name || ""))
    ) {
      setEditing(false);
      setFirst(contact.first_name);
      setLast(contact.last_name || "");
      return;
    }
    onSave(trimmedFirst, trimmedLast);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <Input
          ref={firstRef}
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          onBlur={() => setTimeout(commit, 100)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setFirst(contact.first_name);
              setLast(contact.last_name || "");
              setEditing(false);
            }
          }}
          disabled={saving}
          className="h-9 text-lg font-bold w-40"
          placeholder="First"
        />
        <Input
          value={last}
          onChange={(e) => setLast(e.target.value)}
          onBlur={() => setTimeout(commit, 100)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setFirst(contact.first_name);
              setLast(contact.last_name || "");
              setEditing(false);
            }
          }}
          disabled={saving}
          className="h-9 text-lg font-bold w-40"
          placeholder="Last"
        />
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-2 rounded-md px-1 -ml-1 hover:bg-muted/60 transition-colors text-left"
      title="Click to edit name"
    >
      <h1 className="text-2xl font-bold tracking-tight">
        {contact.first_name} {contact.last_name}
      </h1>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function EditableInfoRow({
  icon,
  label,
  value,
  placeholder,
  type = "text",
  multiline = false,
  saving,
  onSave,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder: string;
  type?: "text" | "email" | "tel";
  multiline?: boolean;
  saving: boolean;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setTemp(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement) el.select();
      }
    }
  }, [editing]);

  const commit = () => {
    if (temp === value) {
      setEditing(false);
      return;
    }
    onSave(temp.trim());
    setEditing(false);
  };

  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {editing ? (
          multiline ? (
            <Textarea
              ref={inputRef as React.Ref<HTMLTextAreaElement>}
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              onBlur={() => setTimeout(commit, 100)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") {
                  setTemp(value);
                  setEditing(false);
                }
              }}
              disabled={saving}
              rows={2}
              className="mt-1 text-sm resize-none"
            />
          ) : (
            <Input
              ref={inputRef as React.Ref<HTMLInputElement>}
              type={type}
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              onBlur={() => setTimeout(commit, 100)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") {
                  setTemp(value);
                  setEditing(false);
                }
              }}
              disabled={saving}
              className="h-8 mt-0.5 text-sm"
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              "group flex items-center gap-1.5 rounded px-1 -ml-1 py-0.5 hover:bg-muted/60 transition-colors w-full text-left",
              saving && "opacity-60 pointer-events-none"
            )}
            title="Click to edit"
          >
            <p
              className={cn(
                "text-sm font-medium truncate flex-1",
                !value && "text-muted-foreground/60 italic font-normal"
              )}
            >
              {value || placeholder}
            </p>
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : (
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
