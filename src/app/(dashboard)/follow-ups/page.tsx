"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Trash2, Calendar, Mail } from "lucide-react";
import { format } from "date-fns";
import {
  getFollowUps,
  completeFollowUp,
  deleteFollowUp,
} from "@/lib/actions/follow-ups";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FollowUpForm } from "@/components/forms/follow-up-form";

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<any[]>([]);
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
    } catch (err) {
      alert("Failed to send reminders.");
    } finally {
      setSending(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const pending = followUps.filter((fu) => !fu.completed);
  const completed = followUps.filter((fu) => fu.completed);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-Ups</h1>
          <p className="text-muted-foreground">Track reminders and tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendReminders}
            disabled={sending}
          >
            <Mail className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : "Email Reminders"}
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Calendar className="mr-2 h-4 w-4" />
            New Follow-Up
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading follow-ups...
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Pending ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending follow-ups</p>
            ) : (
              <div className="grid gap-3">
                {pending.map((fu) => {
                  const isOverdue = fu.due_date < today;
                  return (
                    <Card
                      key={fu.id}
                      className={isOverdue ? "border-destructive/50" : ""}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {fu.contacts?.first_name} {fu.contacts?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {fu.title}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              isOverdue
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            Due {format(new Date(fu.due_date), "MMM d, yyyy")}
                            {isOverdue && " (Overdue)"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              handleComplete(fu.id, fu.contact_id)
                            }
                          >
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(fu.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
              <h2 className="text-lg font-semibold mb-3">
                Completed ({completed.length})
              </h2>
              <div className="grid gap-3">
                {completed.map((fu) => (
                  <Card key={fu.id} className="opacity-60">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {fu.contacts?.first_name} {fu.contacts?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {fu.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Due {format(new Date(fu.due_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge variant="secondary">Done</Badge>
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
