"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  ClipboardCheck,
  ExternalLink,
  Copy,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getPacketById,
  sendIntakePacket,
  markPacketComplete,
  getPacketDocuments,
  saveFormData,
} from "@/lib/actions/intake";
import { getFormTemplate } from "@/components/intake/form-templates";
import { FormRenderer } from "@/components/intake/form-renderer";

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
  const [sendError, setSendError] = useState("");
  const [copied, setCopied] = useState(false);
  const [editingForm, setEditingForm] = useState<{
    id: string;
    form_type: string;
    form_title: string;
    form_data: Record<string, unknown>;
  } | null>(null);
  const [saving, setSaving] = useState(false);

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
    setSendError("");
    try {
      await sendIntakePacket(id, window.location.origin);
      fetchData();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
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

  const handleCopyLink = () => {
    const link = `${window.location.origin}/onboarding/${packet?.access_token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveForm = async (formData: Record<string, string>) => {
    if (!editingForm) return;
    setSaving(true);
    try {
      await saveFormData(editingForm.id, formData);
      setEditingForm(null);
      fetchData();
    } finally {
      setSaving(false);
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
  const onboardingLink = `${typeof window !== "undefined" ? window.location.origin : ""}/onboarding/${packet.access_token}`;

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

      <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
        <p className="text-sm font-medium">Client Intake Link</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-background border rounded px-3 py-2 truncate">
            {onboardingLink}
          </code>
          <Button size="sm" variant="outline" onClick={handleCopyLink}>
            {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
          <a href={onboardingLink} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          Send this link to the client so they can fill out their intake forms.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSend} disabled={sending}>
          <Send className="mr-2 h-4 w-4" />
          {sending ? "Sending..." : "Send Email Invite"}
        </Button>
        {packet.status !== "completed" && (
          <Button variant="outline" onClick={handleMarkComplete} disabled={completing}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {completing ? "Marking..." : "Mark Complete"}
          </Button>
        )}
      </div>

      {sendError && (
        <div className="border border-destructive/50 bg-destructive/5 rounded-lg p-3 text-sm text-destructive">
          {sendError}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Forms ({forms.length})</h2>
        <div className="space-y-2">
          {forms.map((form) => (
            <div
              key={form.id}
              className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/30 transition-colors"
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
              <div className="flex items-center gap-2">
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
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingForm(form)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
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

      <Dialog open={!!editingForm} onOpenChange={() => setEditingForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingForm?.form_title}</DialogTitle>
            <DialogDescription>
              Fill out this form on behalf of the client
            </DialogDescription>
          </DialogHeader>
          {editingForm && (() => {
            const template = getFormTemplate(editingForm.form_type);
            if (!template) return <p>Form template not found</p>;
            return (
              <FormRenderer
                template={template}
                initialData={editingForm.form_data as Record<string, string>}
                onSubmit={handleSaveForm}
                submitting={saving}
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
