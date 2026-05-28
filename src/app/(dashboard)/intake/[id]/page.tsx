"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  getPacketById,
  sendIntakePacket,
  markPacketComplete,
  getPacketDocuments,
} from "@/lib/actions/intake";

const FORM_ICONS: Record<string, string> = {
  parq: "📋",
  consent: "🛡️",
  liability: "⚠️",
  agreement: "📝",
  goals: "🎯",
  nutrition: "🍎",
  progress: "📊",
  emergency: "📞",
  media: "📷",
  privacy: "🔒",
};

export default function IntakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [packet, setPacket] = useState<{
    id: string;
    contact_id: string;
    status: string;
    access_token: string;
    signing_url: string | null;
    coach_notes: string | null;
    created_at: string;
    sent_at: string | null;
    completed_at: string | null;
    contacts: { first_name: string; last_name: string; email: string; intake_status: string };
    intake_forms: {
      id: string;
      form_type: string;
      form_title: string;
      status: string;
      form_data: Record<string, unknown>;
      signed_at: string | null;
    }[];
  } | null>(null);
  const [documents, setDocuments] = useState<{ id: string; document_name: string; pdf_data: string; signed_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getPacketById(id);
      setPacket(p as typeof packet);
      const d = await getPacketDocuments(id);
      setDocuments(d as typeof documents);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSend = async () => {
    setSending(true);
    try {
      await sendIntakePacket(id, window.location.origin);
      fetchData();
    } finally {
      setSending(false);
    }
  };

  const handleMarkComplete = async () => {
    setCompleting(true);
    try {
      await markPacketComplete(id);
      fetchData();
    } finally {
      setCompleting(false);
    }
  };

  const handleDownload = (doc: { document_name: string; pdf_data: string }) => {
    const byteChars = atob(doc.pdf_data);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.document_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-muted-foreground text-center py-12">Loading...</p>;
  if (!packet) return <p className="text-center py-12">Packet not found</p>;

  const contact = packet.contacts;
  const forms = packet.intake_forms || [];
  const filledCount = forms.filter((f) => f.status !== "pending").length;
  const signedCount = forms.filter((f) => f.status === "signed").length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/intake")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {contact.first_name} {contact.last_name}
          </h1>
          <p className="text-sm text-muted-foreground">{contact.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Status", value: packet.status, icon: FileText },
          { label: "Forms Filled", value: `${filledCount}/${forms.length}`, icon: ClipboardCheck },
          { label: "Signed", value: `${signedCount}`, icon: CheckCircle2 },
          { label: "Intake Status", value: contact.intake_status?.replace(/_/g, " ") || "—", icon: Clock },
        ].map((stat) => (
          <div key={stat.label} className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-semibold capitalize">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {packet.status === "draft" && (
          <Button onClick={handleSend} disabled={sending}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : "Send Intake Link"}
          </Button>
        )}
        {packet.status !== "completed" && (
          <Button variant="outline" onClick={handleMarkComplete} disabled={completing}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {completing ? "Marking..." : "Mark Complete"}
          </Button>
        )}
      </div>

      {packet.signing_url && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <p className="text-sm font-medium mb-2">Signing Link</p>
          <a
            href={packet.signing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline break-all"
          >
            {packet.signing_url}
          </a>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Forms ({forms.length})</h2>
        <div className="space-y-2">
          {forms.map((form) => (
            <div
              key={form.id}
              className="flex items-center justify-between border rounded-lg p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{FORM_ICONS[form.form_type] || "📄"}</span>
                <div>
                  <p className="text-sm font-medium">{form.form_title}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    Status: {form.status}
                    {form.signed_at && ` — Signed ${new Date(form.signed_at).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <Badge
                className={
                  form.status === "signed"
                    ? "bg-emerald-100 text-emerald-700"
                    : form.status === "filled"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                }
              >
                {form.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {documents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Signed Documents</h2>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <p className="text-sm font-medium">{doc.document_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Signed {new Date(doc.signed_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="mr-1 h-3 w-3" />
                  PDF
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
