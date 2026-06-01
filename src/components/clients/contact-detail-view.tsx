"use client";

import { useState } from "react";
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

const statusBadgeMap: Record<string, "lead" | "trial" | "active" | "completed"> = {
  Lead: "lead",
  Trial: "trial",
  "Active Client": "active",
  Completed: "completed",
};

const statusOptions = ["Lead", "Trial", "Active Client", "Completed"];

export function ContactDetailView({
  contact,
  notes: initialNotes,
  checklists: initialChecklists,
  followUps: initialFollowUps,
}: {
  contact: Contact;
  notes: Note[];
  checklists: ClientChecklist[];
  followUps: any[];
}) {
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
    await updateContact(contact.id, { status: newStatus as any });
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
            <h1 className="text-2xl font-bold tracking-tight">
              {contact.first_name} {contact.last_name}
            </h1>
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
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium truncate">
                {contact.email || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Phone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium">
                {contact.phone || "—"}
              </p>
            </div>
          </div>
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
          {contact.fitness_goal && (
            <div className="flex items-start gap-3 sm:col-span-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fitness Goal</p>
                <p className="text-sm">{contact.fitness_goal}</p>
              </div>
            </div>
          )}
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
