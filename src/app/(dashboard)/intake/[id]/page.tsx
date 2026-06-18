"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Clock,
  FileText,
  ExternalLink,
  User,
  Mail,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPacketById,
  sendIntakePacket,
  deletePacket,
} from "@/lib/actions/intake";

export default function IntakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [packet, setPacket] = useState<{
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
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getPacketById(id);
      setPacket(p as any);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSend = async () => {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packetId: id }),
      });
      if (!res.ok) throw new Error("Failed to send");
      fetchData();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this packet?")) {
      await deletePacket(id);
      router.push("/intake");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl animate-fade-up">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!packet) return <p className="text-center py-12">Packet not found</p>;

  const contact = packet.contacts;

  const statusVariant: Record<string, "outline" | "secondary" | "warning" | "success" | "destructive"> = {
    draft: "outline",
    sent: "secondary",
    in_progress: "warning",
    completed: "success",
    expired: "destructive",
  };

  return (
    <div className="space-y-6 max-w-3xl animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/intake")}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {contact.first_name} {contact.last_name}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {contact.email}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive shadow-soft"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: "Packet Status",
            value: packet.status,
            icon: FileText,
            variant: statusVariant[packet.status] || "outline",
          },
          {
            label: "Intake Status",
            value: contact.intake_status?.replace(/_/g, " ") || "—",
            icon: Clock,
            variant: "secondary" as const,
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60 shadow-soft">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
              <Badge variant={stat.variant} className="text-xs capitalize">
                {stat.value}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm font-medium">Tally Integration</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {packet.status === "completed" 
              ? "The client has submitted the Tally.so intake form."
              : "Send the email invite to deliver the personalized Tally form link to the client."}
          </p>
          
          <div className="flex gap-2 mt-4">
            {packet.status === "draft" && (
              <Button onClick={handleSend} disabled={sending} className="shadow-soft">
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending..." : "Send Email Invite"}
              </Button>
            )}
            
            {packet.status === "completed" && packet.tally_submission_id && (
              <a 
                href={\`https://tally.so/workspace/\${process.env.NEXT_PUBLIC_TALLY_FORM_URL?.split('/')[4] || ''}/submissions\`} 
                target="_blank" 
                rel="noreferrer"
              >
                <Button className="shadow-soft">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Submission in Tally
                </Button>
              </a>
            )}
          </div>
          
          {sendError && (
            <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 text-sm text-destructive mt-3">
              {sendError}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
