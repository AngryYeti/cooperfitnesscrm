"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Send,
  Trash2,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const STATUS_BADGES: Record<string, { label: string; variant: string; icon: React.ElementType }> = {
  draft: { label: "Draft", variant: "bg-gray-100 text-gray-700", icon: FileText },
  sent: { label: "Sent", variant: "bg-blue-100 text-blue-700", icon: Send },
  in_progress: { label: "In Progress", variant: "bg-amber-100 text-amber-700", icon: Clock },
  completed: { label: "Completed", variant: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  expired: { label: "Expired", variant: "bg-red-100 text-red-700", icon: AlertCircle },
};

const INTAKE_STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  started: "Intake Started",
  forms_pending: "Forms Pending",
  signed: "Signed",
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
      created_at: string;
      sent_at: string | null;
      completed_at: string | null;
      contacts: { first_name: string; last_name: string; email: string; intake_status: string };
      intake_forms: { id: string; form_type: string; form_title: string; status: string }[];
    }[]
  >([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContact, setSelectedContact] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([getAllPackets(), getContacts()]);
      setPackets(p as typeof packets);
      setContacts(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packetId,
          returnUrl: window.location.origin,
        }),
      });
      if (res.ok) {
        fetchData();
      }
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async (packetId: string) => {
    await deletePacket(packetId);
    fetchData();
  };

  const getFormProgress = (forms: { status: string }[]) => {
    const filled = forms.filter((f) => f.status !== "pending").length;
    return `${filled}/${forms.length}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Intake</h1>
          <p className="text-sm text-muted-foreground">
            Manage client onboarding forms and e-signatures
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          New Intake Packet
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Loading...</p>
      ) : packets.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No intake packets yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create one to start onboarding a client.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {packets.map((packet) => {
            const statusInfo = STATUS_BADGES[packet.status] || STATUS_BADGES.draft;
            const StatusIcon = statusInfo.icon;
            const intakeStatus = INTAKE_STATUS_LABELS[packet.contacts?.intake_status] || packet.contacts?.intake_status;
            return (
              <div
                key={packet.id}
                className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/intake/${packet.id}`}
                        className="font-semibold hover:underline truncate"
                      >
                        {packet.contacts?.first_name} {packet.contacts?.last_name}
                      </Link>
                      <Badge className={`${statusInfo.variant} text-[10px]`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Forms: {getFormProgress(packet.intake_forms)}</span>
                      <span>Status: {intakeStatus}</span>
                      <span>
                        Created:{" "}
                        {new Date(packet.created_at).toLocaleDateString()}
                      </span>
                      {packet.completed_at && (
                        <span>
                          Completed:{" "}
                          {new Date(packet.completed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {packet.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSend(packet.id)}
                        disabled={sending === packet.id}
                      >
                        <Send className="mr-1 h-3 w-3" />
                        {sending === packet.id ? "Sending..." : "Send"}
                      </Button>
                    )}
                    <Link href={`/intake/${packet.id}`}>
                      <Button size="sm" variant="ghost">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(packet.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
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
              className="w-full"
            >
              {creating ? "Creating..." : "Create Packet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
