"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Send,
  Trash2,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserPlus,
  Inbox,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getContacts } from "@/lib/actions/contacts";
import {
  createIntakePacket,
  getAllPackets,
  deletePacket,
} from "@/lib/actions/intake";
import type { Contact } from "@/lib/types";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" | "outline"; icon: React.ElementType }> = {
  draft: { label: "Draft", variant: "outline", icon: FileText },
  sent: { label: "Sent", variant: "secondary", icon: Send },
  in_progress: { label: "In Progress", variant: "warning", icon: Clock },
  completed: { label: "Completed", variant: "success", icon: CheckCircle2 },
  expired: { label: "Expired", variant: "destructive", icon: AlertCircle },
};

const INTAKE_STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  started: "Intake Started",
  forms_pending: "Forms Pending",
  signed: "Signed",
  completed: "Completed",
  ready_for_onboarding: "Ready for Onboarding",
};

export function IntakeDashboard() {
  const [packets, setPackets] = useState<
    {
      id: string;
      contact_id: string;
      status: string;
      access_token: string;
      signing_url: string | null;
      tally_submission_id: string | null;
      created_at: string;
      sent_at: string | null;
      completed_at: string | null;
      contacts: { first_name: string; last_name: string; email: string; intake_status: string };
    }[]
  >([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContact, setSelectedContact] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getContacts();
      setContacts(c);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    }
    try {
      const p = await getAllPackets();
      setPackets(p as typeof packets);
    } catch (err) {
      console.error("Failed to load packets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!selectedContact) return;
    setCreating(true);
    try {
      await createIntakePacket(selectedContact);
      setShowCreate(false);
      setSelectedContact("");
      fetchData();
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (packetId: string) => {
    setSending(packetId);
    setSendErrors((prev) => ({ ...prev, [packetId]: "" }));
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send");
      }
      fetchData();
    } catch (err) {
      setSendErrors((prev) => ({ ...prev, [packetId]: err instanceof Error ? err.message : "Failed to send" }));
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async (packetId: string) => {
    await deletePacket(packetId);
    fetchData();
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Intake</h1>
          <p className="text-muted-foreground mt-1">
            Manage client onboarding forms and e-signatures via Tally.so
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shadow-soft">
          <UserPlus className="mr-2 h-4 w-4" />
          New Intake Packet
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : packets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-16 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No intake packets yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create one to start onboarding a client
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            className="mt-4 shadow-soft"
            size="sm"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Create first packet
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {packets.map((packet) => {
            const statusInfo = STATUS_BADGES[packet.status] || STATUS_BADGES.draft;
            const StatusIcon = statusInfo.icon;
            const intakeStatus =
              INTAKE_STATUS_LABELS[packet.contacts?.intake_status] ||
              packet.contacts?.intake_status;
              
            return (
              <Card
                key={packet.id}
                className="border-border/60 shadow-soft hover:shadow-elevated transition-shadow group"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Link
                          href={`/clients/${packet.contact_id}`}
                          className="font-semibold hover:underline decoration-foreground/30 underline-offset-2 truncate"
                        >
                          {packet.contacts?.first_name} {packet.contacts?.last_name}
                        </Link>
                        <Badge variant={statusInfo.variant} className="text-[10px]">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="text-xs text-muted-foreground flex items-center gap-3">
                          <span>Created {new Date(packet.created_at).toLocaleDateString()}</span>
                          {intakeStatus && (
                            <span className="hidden sm:inline">· {intakeStatus}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sendErrors[packet.id] && (
                        <div className="flex items-center text-xs text-destructive mr-1 max-w-[150px] truncate" title={sendErrors[packet.id]}>
                          <AlertCircle className="h-3.5 w-3.5 mr-1 shrink-0" />
                          <span className="truncate">Failed</span>
                        </div>
                      )}
                      
                      {packet.status === "completed" && (
                        <div className="flex items-center text-emerald-600 text-sm font-medium mr-1">
                          <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          Done
                        </div>
                      )}
                      
                      {packet.status === "sent" && !sendErrors[packet.id] && (
                        <div className="flex items-center text-amber-500 text-sm font-medium mr-1">
                          <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          Sent
                        </div>
                      )}

                      {(packet.status === "draft" || packet.status === "sent") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSend(packet.id)}
                          disabled={sending === packet.id}
                          className="shadow-soft"
                        >
                          <Send className="mr-1.5 h-3 w-3" />
                          {sending === packet.id 
                            ? "Sending..." 
                            : packet.status === "sent" ? "Resend" : "Send"}
                        </Button>
                      )}
                      
                      {packet.status === "completed" && packet.tally_submission_id && (
                        <a 
                          href={`https://tally.so/workspace/${process.env.NEXT_PUBLIC_TALLY_FORM_URL?.split('/')[4] || ''}/submissions`} 
                          target="_blank" 
                          rel="noreferrer"
                        >
                          <Button size="sm" variant="outline">
                            Submission
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                      
                      <Link href={`/clients/${packet.contact_id}`}>
                        <Button size="sm" variant="ghost">
                          View Client
                          <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                        onClick={() => handleDelete(packet.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Intake Packet</DialogTitle>
            <DialogDescription>
              Select a client to start their intake process
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Select value={selectedContact} onValueChange={setSelectedContact}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleCreate}
              disabled={!selectedContact || creating}
              className="w-full shadow-soft"
            >
              {creating ? "Creating..." : "Create Packet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
