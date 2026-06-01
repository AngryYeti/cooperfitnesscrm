"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Circle,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFormTemplate } from "@/components/intake/form-templates";
import { FormRenderer } from "@/components/intake/form-renderer";
import {
  saveFormData,
  getPacketByToken,
  submitForSigning,
} from "@/lib/actions/intake";

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
  const [allDone, setAllDone] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [signingError, setSigningError] = useState("");

  useEffect(() => {
    (async () => {
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
    })();
  }, [token]);

  const forms = packet?.intake_forms || [];
  const currentForm = forms[currentIndex];
  const template = currentForm ? getFormTemplate(currentForm.form_type) : null;
  const filledCount = forms.filter((f) => f.status !== "pending").length;
  const pct = forms.length > 0 ? (filledCount / forms.length) * 100 : 0;

  const handleSubmit = async (formData: Record<string, string>) => {
    if (!currentForm || !packet) return;
    setSaving(true);
    try {
      await saveFormData(currentForm.id, formData);

      setPacket((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          intake_forms: prev.intake_forms.map((f) =>
            f.id === currentForm.id
              ? { ...f, status: "filled", form_data: formData }
              : f
          ),
        };
      });

      if (currentIndex < forms.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setAllDone(true);
        setSigning(true);
        try {
          const result = await submitForSigning(packet.id);
          if (result.signingUrl) {
            setSigningUrl(result.signingUrl);
          }
        } catch (err) {
          setSigningError(
            err instanceof Error ? err.message : "Failed to start signing"
          );
        } finally {
          setSigning(false);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
        <div className="text-center space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-floating animate-pulse">
            <Dumbbell className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <p className="text-muted-foreground text-sm">Loading your forms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft px-4">
        <div className="text-center space-y-3 max-w-md">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
            <Circle className="h-6 w-6 text-destructive" />
          </div>
          <p className="text-destructive text-lg font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft px-4">
        <div className="text-center space-y-5 max-w-md mx-auto animate-fade-up">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-floating">
            <CheckCircle2 className="h-8 w-8" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              All Forms Completed!
            </h1>
            <p className="text-muted-foreground mt-1">
              Great work, {packet?.contacts?.first_name}.
            </p>
          </div>

          {signing && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Preparing your documents for signature...
              </p>
              <div className="h-1.5 w-48 mx-auto bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-foreground animate-pulse w-2/3 rounded-full" />
              </div>
            </div>
          )}

          {signingUrl && !signing && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Your documents are ready. Click below to review and sign.
              </p>
              <a href={signingUrl} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="w-full shadow-floating">
                  Sign Documents
                </Button>
              </a>
            </div>
          )}

          {signingError && !signing && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{signingError}</p>
              <p className="text-muted-foreground text-sm">
                Your forms have been saved. Your coach will follow up with
                signing instructions.
              </p>
            </div>
          )}

          {!signing && !signingUrl && !signingError && (
            <p className="text-muted-foreground text-sm">
              Thank you, {packet?.contacts?.first_name}. Your intake forms
              have been submitted successfully.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="sticky top-0 z-40 border-b border-border/60 glass">
        <div className="max-w-2xl mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground">
              <Dumbbell className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-semibold">Cooper Fitness</p>
              <p className="text-[10px] text-muted-foreground">Client Intake</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {filledCount}/{forms.length}
            </span>
            <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="animate-fade-up">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome, {packet?.contacts?.first_name}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Please complete each form below. Your progress is saved
            automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {forms.map((f, i) => {
            const isFilled = f.status !== "pending";
            const isCurrent = i === currentIndex;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`text-xs px-2.5 h-7 rounded-full transition-all flex items-center gap-1 font-medium ${
                  isCurrent
                    ? "bg-foreground text-background shadow-soft"
                    : isFilled
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {isFilled ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                {i + 1}
              </button>
            );
          })}
        </div>

        {template && currentForm && (
          <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-soft animate-fade-up">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">{template.title}</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                {template.description}
              </p>
              {template.requiresSignature && (
                <Badge variant="warning" className="mt-2 text-[10px]">
                  Requires E-Signature
                </Badge>
              )}
            </div>

            {currentForm.status !== "pending" ? (
              <div className="text-center py-8 space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium">Form completed</p>
                  <p className="text-xs text-muted-foreground">
                    You can review or update it anytime
                  </p>
                </div>
                {currentIndex < forms.length - 1 && (
                  <Button
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                    className="mt-2 shadow-soft"
                  >
                    Next Form
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <FormRenderer
                key={currentForm.id}
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
            className="shadow-soft"
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
            className="shadow-soft"
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
