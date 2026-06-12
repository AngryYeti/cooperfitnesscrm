"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Trash2, Calendar, Mail, Inbox } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  getFollowUps,
  completeFollowUp,
  deleteFollowUp,
} from "@/lib/actions/follow-ups";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FollowUpForm } from "@/components/forms/follow-up-form";

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFollowUps();
      setFollowUps(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFollowUps();
  }, [fetchFollowUps]);

  const handleComplete = async (id: string, contactId: string) => {
    await completeFollowUp(id, contactId);
    fetchFollowUps();
  };

  const handleDelete = async (id: string) => {
    await deleteFollowUp(id);
    fetchFollowUps();
  };

  const handleSendReminders = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/send-reminders", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Sent ${data.sent} reminder(s) to your email.`);
        fetchFollowUps();
      } else {
        alert(data.error || "Failed to send reminders.");
      }
    } catch (_err) {
      alert("Failed to send reminders.");
    } finally {
      setSending(false);
    }
  };

  const today = new Date();
  const pending = followUps.filter((fu) => !fu.completed);
  const completed = followUps.filter((fu) => fu.completed);
  const overdue = pending.filter((fu) => isPast(new Date(fu.due_date)));

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Follow-Ups</h1>
          <p className="text-muted-foreground mt-1">
            Track reminders and tasks for your clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendReminders}
            disabled={sending}
            className="shadow-soft"
          >
            <Mail className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : "Email Reminders"}
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="shadow-soft">
            <Calendar className="mr-2 h-4 w-4" />
            New Follow-Up
          </Button>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5">
          <div className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
          <p className="text-sm font-medium text-destructive">
            {overdue.length} overdue follow-up{overdue.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Pending ({pending.length})
              </h2>
            </div>
            {pending.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-12 text-center">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-2">
                  <Inbox className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No pending follow-ups</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((fu) => {
                  const dueDate = new Date(fu.due_date);
                  const isOverdue = isPast(dueDate);
                  return (
                    <Card
                      key={fu.id}
                      className={`shadow-soft hover:shadow-elevated transition-shadow ${
                        isOverdue
                          ? "border-destructive/30"
                          : "border-border/60"
                      }`}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                              isOverdue ? "bg-destructive/10" : "bg-primary/10"
                            }`}
                          >
                            <Calendar
                              className={`h-4 w-4 ${
                                isOverdue ? "text-destructive" : ""
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {fu.contacts?.first_name} {fu.contacts?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {fu.title}
                            </p>
                            <p
                              className={`text-xs mt-0.5 ${
                                isOverdue
                                  ? "text-destructive font-medium"
                                  : "text-muted-foreground"
                              }`}
                            >
                              Due {format(dueDate, "MMM d, yyyy")}
                              <span className="text-muted-foreground/70">
                                {" "}
                                ({formatDistanceToNow(dueDate, { addSuffix: true })})
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-500/20"
                            onClick={() => handleComplete(fu.id, fu.contact_id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(fu.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Completed ({completed.length})
              </h2>
              <div className="space-y-2">
                {completed.map((fu) => (
                  <Card key={fu.id} className="border-border/40 opacity-60">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Check className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate line-through text-muted-foreground">
                            {fu.contacts?.first_name} {fu.contacts?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {fu.title}
                          </p>
                        </div>
                      </div>
                      <Badge variant="success" className="text-[10px]">Done</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Follow-Up</DialogTitle>
          </DialogHeader>
          <FollowUpForm
            onSuccess={() => {
              setIsCreateOpen(false);
              fetchFollowUps();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
