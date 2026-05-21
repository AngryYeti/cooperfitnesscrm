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
  Plus,
  Trash2,
  CheckSquare,
  ListChecks,
  Clock,
  Check,
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

const statusBadgeMap: Record<string, string> = {
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
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/clients" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {contact.first_name} {contact.last_name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={statusBadgeMap[contact.status] as any}>
              {contact.status}
            </Badge>
            {contact.source && (
              <span className="text-xs text-muted-foreground">
                via {contact.source}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsFollowUpOpen(true)}>
            <Clock className="mr-2 h-4 w-4" />
            Follow-Up
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm">{contact.phone || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm">{contact.email || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Date Added</p>
                  <p className="text-sm">
                    {format(new Date(contact.date_added), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Select
                    value={contact.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="h-8 w-[180px] text-sm">
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
              </div>
              {contact.fitness_goal && (
                <div className="sm:col-span-2 flex items-start gap-3">
                  <Target className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fitness Goal</p>
                    <p className="text-sm">{contact.fitness_goal}</p>
                  </div>
                </div>
              )}
              {contact.tags && contact.tags.length > 0 && (
                <div className="sm:col-span-2 flex items-start gap-3">
                  <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1">
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

          <Tabs defaultValue="notes">
            <TabsList>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="checklists">Checklists</TabsTrigger>
              <TabsTrigger value="followups">Follow-Ups</TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                />
                <Button
                  size="sm"
                  className="shrink-0 self-end"
                  disabled={addingNote || !newNote.trim()}
                  onClick={handleAddNote}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {notes.map((note) => (
                  <Card key={note.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm">{note.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {notes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No notes yet. Add your first note above.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="checklists" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Workflow Checklists</h3>
                <Button size="sm" variant="outline" onClick={openAssignDialog}>
                  <ListChecks className="mr-2 h-4 w-4" />
                  Assign Template
                </Button>
              </div>
              {checklists.map((checklist) => (
                <Card key={checklist.id}>
                  <CardContent className="p-4 space-y-2">
                    {checklist.items.map((item: any, index: number) => (
                      <label
                        key={index}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded border ${
                            item.completed
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30"
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
                            <Check className="h-3.5 w-3.5 text-primary-foreground" />
                          )}
                        </div>
                        <span
                          className={`text-sm ${
                            item.completed
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.completed_at && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(item.completed_at), "MMM d")}
                          </span>
                        )}
                      </label>
                    ))}
                  </CardContent>
                </Card>
              ))}
              {checklists.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No checklists assigned. Assign a template to get started.
                </p>
              )}
            </TabsContent>

            <TabsContent value="followups" className="space-y-4 mt-4">
              {followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No follow-ups scheduled.
                </p>
              ) : (
                followUps.map((fu: any) => (
                  <Card key={fu.id} className={fu.completed ? "opacity-50" : ""}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{fu.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {format(new Date(fu.due_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      {fu.completed ? (
                        <Badge variant="secondary">Completed</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCompleteFollowUp(fu.id)}
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

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
              />
            </div>
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
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
