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
  User,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  const forms = packet.intake_forms || [];
  const filledCount = forms.filter((f) => f.status !== "pending").length;
  const signedCount = forms.filter((f) => f.status === "signed").length;
  const onboardingLink = `${typeof window !== "undefined" ? window.location.origin : ""}/onboarding/${packet.access_token}`;
  const pct = forms.length > 0 ? (filledCount / forms.length) * 100 : 0;

  const statusVariant: Record<string, "outline" | "secondary" | "warning" | "success" | "destructive"> = {
    draft: "outline",
    sent: "secondary",
    in_progress: "warning",
    completed: "success",
    expired: "destructive",
  };

  return (
    <div className="space-y-6 max-w-3xl animate-fade-up">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Status",
            value: packet.status,
            icon: FileText,
            variant: statusVariant[packet.status] || "outline",
          },
          {
            label: "Forms Filled",
            value: `${filledCount}/${forms.length}`,
            icon: ClipboardCheck,
            variant: "outline" as const,
          },
          {
            label: "Signed",
            value: `${signedCount}`,
            icon: CheckCircle2,
            variant: "success" as const,
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
            <p className="text-sm font-medium">Client Intake Link</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted/40 border border-border/60 rounded-md px-3 py-2 truncate font-mono">
              {onboardingLink}
            </code>
            <Button
              size="icon"
              variant="outline"
              onClick={handleCopyLink}
              className="shrink-0 h-8 w-8"
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <a
              href={onboardingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button size="icon" variant="outline" className="h-8 w-8">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Send this link to the client so they can fill out their intake forms.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSend} disabled={sending} className="shadow-soft">
          <Send className="mr-2 h-4 w-4" />
          {sending ? "Sending..." : "Send Email Invite"}
        </Button>
        {packet.status !== "completed" && (
          <Button
            variant="outline"
            onClick={handleMarkComplete}
            disabled={completing}
            className="shadow-soft"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {completing ? "Marking..." : "Mark Complete"}
          </Button>
        )}
      </div>

      {sendError && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 text-sm text-destructive">
          {sendError}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Forms ({forms.length})</h2>
          {forms.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {Math.round(pct)}% complete
            </span>
          )}
        </div>
        {forms.length > 0 && (
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-foreground rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <div className="space-y-2">
          {forms.map((form) => (
            <Card
              key={form.id}
              className="border-border/60 shadow-soft hover:shadow-elevated transition-shadow"
            >
              <CardContent className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl shrink-0">
                    {FORM_ICONS[form.form_type] || "📄"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {form.form_title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {form.status === "signed" && form.signed_at
                        ? `Signed ${new Date(form.signed_at).toLocaleDateString()}`
                        : `Status: ${form.status}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={
                      form.status === "signed"
                        ? "success"
                        : form.status === "filled"
                          ? "warning"
                          : "outline"
                    }
                    className="text-[10px] capitalize"
                  >
                    {form.status}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingForm(form)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {documents.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Signed Documents</h2>
          <div className="space-y-2">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="border-border/60 shadow-soft"
              >
                <CardContent className="p-3.5 flex items-center justify-between">
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
                    className="shadow-soft"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    PDF
                  </Button>
                </CardContent>
              </Card>
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
          {editingForm &&
            (() => {
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
