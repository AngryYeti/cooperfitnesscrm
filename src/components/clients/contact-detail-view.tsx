/* eslint-disable @typescript-eslint/no-explicit-any */
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
  ListChecks,
  Clock,
  Check,
  Plus,
  Send,
  Loader2,
  Pencil,
  FileText,
  RefreshCw,
  ExternalLink,
  Eye,
} from "lucide-react";
import { Contact, Note, ClientChecklist, Communication, ContactStatus } from "@/lib/types";
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
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  
  
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
import { getFormTemplates, sendFormToClient, syncDocuSealSubmissions } from "@/lib/actions/forms";
import { cn, getFullName, groupCommunicationsIntoThreads } from "@/lib/utils";

const statusOptions = ["Lead", "Trial", "Active Client", "Completed"];

export function ContactDetailView({
  contact: initialContact,
  notes: initialNotes,
  checklists: initialChecklists,
  followUps: initialFollowUps,
  communications: initialCommunications,
  forms: initialForms,
}: {
  contact: Contact;
  notes: Note[];
  checklists: ClientChecklist[];
  followUps: any[];
  communications?: Communication[];
  forms?: any[];
}) {
  const router = useRouter();
  const [contact, setContact] = useState(initialContact);
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [checklists, setChecklists] = useState(initialChecklists);
  const [followUps, setFollowUps] = useState(initialFollowUps);
  const [communications, setCommunications] = useState(initialCommunications || []);
  const [forms] = useState<any[]>(initialForms || []);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  
  // Email Reply State
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  const [isSendFormOpen, setIsSendFormOpen] = useState(false);
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  const [sendingForm, setSendingForm] = useState(false);
  const [syncingForms, setSyncingForms] = useState(false);

  const handleSendForm = async (templateId: string) => {
    setSendingForm(true);
    try {
      await sendFormToClient(contact.id, templateId);
      setIsSendFormOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to send form");
    } finally {
      setSendingForm(false);
    }
  };

  const handleSyncForms = async () => {
    setSyncingForms(true);
    try {
      const res = await syncDocuSealSubmissions();
      if (res.updated > 0) {
        window.location.reload();
      } else {
        alert("Forms are up to date.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to sync forms status: " + err.message);
    } finally {
      setSyncingForms(false);
    }
  };

  const openSendFormDialog = async () => {
    const data = await getFormTemplates();
    setFormTemplates(data);
    setIsSendFormOpen(true);
  };

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
    try {
      const note = await createNote(contact.id, newNote.trim());
      setNotes([note, ...notes]);
      setNewNote("");
      setAddingNote(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendReply = async () => {
    if (!replySubject.trim() || !replyBody.trim()) return;
    
    setSendingReply(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contact.id,
          subject: replySubject,
          body_text: replyBody,
        }),
      });
      
      if (!res.ok) throw new Error("Failed to send reply");
      
      // Optimistically add to UI
      const newComm: Communication = {
        id: crypto.randomUUID(),
        contact_id: contact.id,
        direction: "outbound",
        sender_email: "You",
        subject: replySubject,
        body_text: replyBody,
        date_received: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setCommunications([newComm, ...communications]);
      setReplyingTo(null);
      setReplySubject("");
      setReplyBody("");
    } catch (err) {
      console.error(err);
      alert("Failed to send email");
    } finally {
      setSendingReply(false);
    }
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
    saveField({ status: newStatus as ContactStatus });
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
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="followups">Follow-Ups</TabsTrigger>
        </TabsList>

        <TabsContent value="forms" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">DocuSeal Forms</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncForms}
                disabled={syncingForms}
                className="h-8 px-2.5 text-xs shadow-soft"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncingForms && "animate-spin")} />
                Sync Status
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={openSendFormDialog}
                className="h-8 px-2.5 text-xs shadow-soft"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Send Form
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            {forms.map((form) => (
              <Card key={form.id} className="border-border/60 shadow-soft">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{form.form_templates?.name || "Custom Form"}</p>
                      <p className="text-xs text-muted-foreground">
                        Sent on {format(new Date(form.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge 
                      variant={
                        form.status === "completed" 
                          ? "success" 
                          : form.status === "received" 
                            ? "secondary" 
                            : "outline"
                      }
                      className="capitalize"
                    >
                      {form.status === "received" ? "received (viewed)" : form.status}
                    </Badge>
                    
                    {form.status === "completed" ? (
                      <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                        <a href={`/api/forms/download/${form.id}`} target="_blank" rel="noopener noreferrer">
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          View Form
                        </a>
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1">
                        {form.signing_url && (
                          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                            <a href={form.signing_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              Sign
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {forms.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No forms sent yet. Click Send Form to request a signature.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

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

        <TabsContent value="emails" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Email History</h3>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">Powered by Zoho</span>
          </div>
          <div className="space-y-4">
            {groupCommunicationsIntoThreads(communications || []).map((thread) => {
              const latestEmail = thread[thread.length - 1];
              return (
                <Card key={latestEmail.id} className="border-border/60 shadow-soft overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 border-b text-xs font-medium text-muted-foreground flex items-center justify-between">
                    <span>{thread.length} message{thread.length > 1 ? "s" : ""} in thread</span>
                    <span>Last updated: {format(new Date(latestEmail.date_received), "MMM d, h:mm a")}</span>
                  </div>
                  <CardContent className="p-0 flex flex-col">
                    {thread.map((email, idx) => (
                      <div 
                        key={email.id} 
                        className={`p-4 ${idx > 0 ? "border-t border-border/40 pl-8 bg-muted/10 relative" : ""}`}
                      >
                        {idx > 0 && (
                          <div className="absolute left-4 top-0 bottom-0 w-px bg-border/60"></div>
                        )}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                                <Mail className="h-3 w-3" />
                              </div>
                              <p className="text-sm font-medium">{email.subject}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant={email.direction === "inbound" ? "secondary" : "outline"} className="text-[10px]">
                                {email.direction}
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(email.date_received), "MMM d, h:mm a")}
                              </p>
                            </div>
                          </div>
                          <div className="pl-8 pt-1">
                            <p className="text-xs text-muted-foreground mb-2">
                              {email.direction === "inbound" ? `From: ${email.sender_email}` : `To: ${contact.email}`}
                            </p>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground bg-muted/30 p-3 rounded-md border border-border/50">
                              {email.body_text}
                            </div>
                            
                            {/* Reply Button (Only show on the most recent email in the thread if it's inbound) */}
                            {idx === thread.length - 1 && email.direction === "inbound" && (
                              <div className="mt-3">
                                {replyingTo === email.id ? (
                                  <div className="space-y-3 mt-4 animate-fade-up bg-card border rounded-lg p-4 shadow-sm relative z-10">
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="text-sm font-medium flex items-center gap-2">
                                        <Send className="h-3 w-3" /> Send Reply
                                      </h4>
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setReplyingTo(null)}>Cancel</Button>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs">Subject</Label>
                                      <Input 
                                        value={replySubject} 
                                        onChange={e => setReplySubject(e.target.value)} 
                                        placeholder="Re: ..." 
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs">Message</Label>
                                      <Textarea 
                                        value={replyBody} 
                                        onChange={e => setReplyBody(e.target.value)} 
                                        placeholder="Write your reply..." 
                                        className="min-h-[100px] text-sm"
                                      />
                                    </div>
                                    <Button 
                                      size="sm" 
                                      className="w-full" 
                                      onClick={handleSendReply}
                                      disabled={sendingReply || !replySubject.trim() || !replyBody.trim()}
                                    >
                                      {sendingReply ? "Sending..." : "Send Email"}
                                    </Button>
                                  </div>
                                ) : (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-xs h-8"
                                    onClick={() => {
                                      setReplyingTo(email.id);
                                      setReplySubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
                                    }}
                                  >
                                    <Send className="mr-2 h-3 w-3" /> Reply
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
            {(!communications || communications.length === 0) && (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No emails synced yet. Incoming emails will appear here automatically.
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

      <Dialog open={isSendFormOpen} onOpenChange={setIsSendFormOpen}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle>Send Form to Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {formTemplates.map((tmpl) => (
              <Button
                key={tmpl.id}
                variant="outline"
                className="w-full justify-start h-11 text-sm font-medium"
                disabled={sendingForm}
                onClick={() => handleSendForm(tmpl.id)}
              >
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                {tmpl.name}
              </Button>
            ))}
            {formTemplates.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No form templates available. Create one in the Forms tab.
              </p>
            )}
          </div>
          {sendingForm && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Preparing DocuSeal signature request...
            </div>
          )}
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
  const [prevFirst, setPrevFirst] = useState(contact.first_name);
  const [prevLast, setPrevLast] = useState(contact.last_name || "");
  const firstRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  if (!editing && (contact.first_name !== prevFirst || (contact.last_name || "") !== prevLast)) {
    setPrevFirst(contact.first_name);
    setPrevLast(contact.last_name || "");
    setFirst(contact.first_name);
    setLast(contact.last_name || "");
  }

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

  const cancel = () => {
    setFirst(contact.first_name);
    setLast(contact.last_name || "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        ref={groupRef}
        className="flex items-center gap-1.5 flex-wrap"
        onBlur={(e) => {
          if (!groupRef.current?.contains(e.relatedTarget as Node)) {
            commit();
          }
        }}
      >
        <Input
          ref={firstRef}
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          disabled={saving}
          className="h-9 text-lg font-bold w-40"
          placeholder="First"
        />
        <Input
          value={last}
          onChange={(e) => setLast(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
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
        {getFullName(contact.first_name, contact.last_name)}
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
  const [prevValue, setPrevValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  if (!editing && value !== prevValue) {
    setPrevValue(value);
    setTemp(value);
  }

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
