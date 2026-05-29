"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFormTemplate } from "@/components/intake/form-templates";
import { FormRenderer } from "@/components/intake/form-renderer";
import { saveFormData, getPacketByToken, submitForSigning } from "@/lib/actions/intake";

export default function OnboardingPage() {
  const { token } = useParams<{ token: string }>();
  const [packet, setPacket] = useState<{
    id: string;
    contact_id: string;
    status: string;
    contacts: { first_name: string; last_name: string; email: string };
    intake_forms: {
      id: string;
      form_type: string;
      form_title: string;
      status: string;
      form_data: Record<string, string>;
    }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [signingError, setSigningError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const data = await getPacketByToken(token);
      if (!data) {
        setError("Invalid or expired intake link.");
        return;
      }
      setPacket(data as typeof packet);
    } catch {
      setError("Invalid or expired intake link.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const forms = packet?.intake_forms || [];
  const currentForm = forms[currentIndex];
  const template = currentForm ? getFormTemplate(currentForm.form_type) : null;
  const filledCount = forms.filter((f) => f.status !== "pending").length;

  const handleSubmit = async (formData: Record<string, string>) => {
    if (!currentForm) return;
    setSaving(true);
    try {
      await saveFormData(currentForm.id, formData);
      if (currentIndex < forms.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setCompleted(true);
        if (packet) {
          setSigning(true);
          try {
            const result = await submitForSigning(packet.id);
            if (result.signingUrl) {
              setSigningUrl(result.signingUrl);
            }
          } catch (err) {
            setSigningError(err instanceof Error ? err.message : "Failed to start signing");
          } finally {
            setSigning(false);
          }
        }
      }
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto p-8">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
          <h1 className="text-2xl font-bold">All Forms Completed!</h1>

          {signing && (
            <div className="space-y-2">
              <p className="text-muted-foreground">Preparing your documents for signature...</p>
              <div className="h-2 w-48 mx-auto bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse w-2/3 rounded-full" />
              </div>
            </div>
          )}

          {signingUrl && !signing && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Your documents are ready. Click below to review and sign.
              </p>
              <a href={signingUrl} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="w-full">
                  Sign Documents
                </Button>
              </a>
            </div>
          )}

          {signingError && !signing && (
            <p className="text-sm text-destructive">{signingError}</p>
          )}

          {!signing && !signingUrl && !signingError && (
            <p className="text-muted-foreground">
              Thank you, {packet?.contacts?.first_name}. Your intake forms have been submitted successfully.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Dumbbell className="h-4 w-4" />
            </div>
            <span className="font-semibold">Cooper Fitness</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {filledCount}/{forms.length} completed
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Welcome, {packet?.contacts?.first_name}!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Please complete each form below. Your progress is saved automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {forms.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                i === currentIndex
                  ? "bg-primary text-primary-foreground"
                  : f.status !== "pending"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.status !== "pending" && (
                <CheckCircle2 className="inline h-3 w-3 mr-1" />
              )}
              {i + 1}
            </button>
          ))}
        </div>

        {template && currentForm && (
          <div className="border rounded-lg p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{template.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {template.description}
              </p>
              {template.requiresSignature && (
                <Badge className="mt-2 bg-amber-100 text-amber-700 text-[10px]">
                  Requires E-Signature
                </Badge>
              )}
            </div>

            {currentForm.status !== "pending" ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <p className="text-sm text-muted-foreground">
                  This form has been completed.
                </p>
                {currentIndex < forms.length - 1 && (
                  <Button onClick={() => setCurrentIndex(currentIndex + 1)}>
                    Next Form <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <FormRenderer
                template={template}
                initialData={currentForm.form_data as Record<string, string>}
                onSubmit={handleSubmit}
                submitting={saving}
              />
            )}
          </div>
        )}

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setCurrentIndex(Math.min(forms.length - 1, currentIndex + 1))
            }
            disabled={currentIndex >= forms.length - 1}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
