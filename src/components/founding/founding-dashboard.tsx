"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock3, Mail, ShieldAlert, Users } from "lucide-react";
import {
  markFoundingManualReview,
  recoverFoundingProcessingEmail,
  retryFoundingEmail,
  setFoundingCheckoutClosed,
} from "@/lib/actions/founding";
import type { FoundingDashboardData, FoundingDashboardPosition } from "@/lib/types";
import { FOUNDING_EMAIL_RECOVERY_CONFIRMATION } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function dateLabel(value: string | null, timezone?: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone || undefined,
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function stateLabel(state: FoundingDashboardPosition["state"]): string {
  return {
    AVAILABLE: "Available",
    PENDING_CHECKOUT: "Held for checkout",
    PURCHASED: "Purchased",
    EXPIRED: "Expired",
    MANUAL_REVIEW: "Manual review",
  }[state];
}

function badgeVariant(state: FoundingDashboardPosition["state"]): "success" | "warning" | "destructive" | "outline" {
  if (state === "PURCHASED") return "success";
  if (state === "MANUAL_REVIEW") return "destructive";
  if (state === "PENDING_CHECKOUT") return "warning";
  return "outline";
}

export function FoundingDashboard({ initialData }: { initialData: FoundingDashboardData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [recoveryConfirmations, setRecoveryConfirmations] = useState<Record<string, string>>({});

  const runAction = (action: () => Promise<unknown>) => {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Action could not be completed");
      }
    });
  };

  const positions = Array.from({ length: 5 }, (_, index) =>
    initialData.positions.find((position) => position.positionNumber === index + 1) ?? {
      positionNumber: index + 1,
      reservationId: null,
      state: "AVAILABLE" as const,
      holdExpiresAt: null,
      purchasedAt: null,
      fulfillmentState: "NOT_STARTED" as const,
      emailState: "NOT_QUEUED" as const,
      emailAttempts: 0,
      emailNextAttemptAt: null,
      emailProcessingSince: null,
      emailRecoveryEligible: false,
      contact: null,
      serviceStartAt: null,
      serviceEndAt: null,
      serviceTimezone: null,
      operationalError: null,
    },
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" />
            Operator workspace
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Founding cohort</h1>
          <p className="mt-1 text-muted-foreground">Five positions, checkout state, and onboarding follow-through.</p>
        </div>
        <Button
          variant={initialData.manualFull ? "outline" : "destructive"}
          disabled={isPending}
          onClick={() => runAction(() => setFoundingCheckoutClosed(!initialData.manualFull))}
        >
          {initialData.manualFull ? "Reopen checkout" : "Close checkout"}
        </Button>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-5"><Users className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Purchased</p><p className="text-2xl font-semibold">{initialData.purchasedCount} / {initialData.capacity}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><Clock3 className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Occupied holds / review</p><p className="text-2xl font-semibold">{initialData.pendingCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><ShieldAlert className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Checkout</p><p className="text-2xl font-semibold">{initialData.manualFull ? "Closed" : initialData.checkoutEnabled ? "Open" : "Disabled"}</p></div></CardContent></Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {positions.map((position) => {
          const canRetryEmail = position.emailState === "FAILED" || position.emailState === "PENDING";
          const hasReservation = Boolean(position.reservationId);
          const canRecoverEmail = position.emailState === "PROCESSING" && hasReservation && position.emailRecoveryEligible;
          return (
            <Card key={position.positionNumber} className="overflow-hidden">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Position {position.positionNumber}</CardTitle>
                    <CardDescription className="mt-1">
                      {position.contact ? `${position.contact.firstName} ${position.contact.lastName}`.trim() : "No reservation yet"}
                    </CardDescription>
                  </div>
                  <Badge variant={badgeVariant(position.state)}>{stateLabel(position.state)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><p className="text-xs text-muted-foreground">Contact</p><p className="font-medium">{position.contact?.email || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Reservation expiry</p><p className="font-medium">{dateLabel(position.holdExpiresAt, position.serviceTimezone)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Fulfillment</p><p className="font-medium">{position.fulfillmentState.replaceAll("_", " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Onboarding email</p><p className="font-medium">{position.emailState.replaceAll("_", " ")}{position.emailAttempts ? ` · ${position.emailAttempts} attempt${position.emailAttempts === 1 ? "" : "s"}` : ""}</p></div>
                  <div><p className="text-xs text-muted-foreground">Service start</p><p className="font-medium">{dateLabel(position.serviceStartAt, position.serviceTimezone)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Service end</p><p className="font-medium">{dateLabel(position.serviceEndAt, position.serviceTimezone)}</p></div>
                </div>

                {position.operationalError && (
                  <div className="rounded-lg border border-warning/30 bg-warning/[0.08] px-3 py-2 text-sm text-foreground">
                    <span className="font-medium">Operational note:</span> {position.operationalError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
                  {canRetryEmail && hasReservation && (
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => runAction(() => retryFoundingEmail(position.reservationId as string))}>
                      <Mail className="h-3.5 w-3.5" />
                      Retry email
                    </Button>
                  )}
                  {canRecoverEmail && (
                    <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-2">
                      <Input
                        aria-label={`Recovery confirmation for position ${position.positionNumber}`}
                        placeholder={FOUNDING_EMAIL_RECOVERY_CONFIRMATION}
                        value={recoveryConfirmations[position.reservationId as string] || ""}
                        onChange={(event) => setRecoveryConfirmations((current) => ({ ...current, [position.reservationId as string]: event.target.value }))}
                        maxLength={FOUNDING_EMAIL_RECOVERY_CONFIRMATION.length}
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPending || recoveryConfirmations[position.reservationId as string] !== FOUNDING_EMAIL_RECOVERY_CONFIRMATION}
                        onClick={() => runAction(() => recoverFoundingProcessingEmail(position.reservationId as string, recoveryConfirmations[position.reservationId as string]))}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Recover email
                      </Button>
                    </div>
                  )}
                  {position.reservationId && position.state !== "MANUAL_REVIEW" && position.state !== "PURCHASED" && (
                    <div className="flex min-w-[240px] flex-1 items-center gap-2">
                      <Input
                        aria-label={`Manual review reason for position ${position.positionNumber}`}
                        placeholder="Reason for manual review"
                        value={reviewReasons[position.reservationId] || ""}
                        onChange={(event) => setReviewReasons((current) => ({ ...current, [position.reservationId as string]: event.target.value }))}
                        maxLength={240}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending || !(reviewReasons[position.reservationId] || "").trim()}
                        onClick={() => runAction(() => markFoundingManualReview(position.reservationId as string, reviewReasons[position.reservationId as string]))}
                      >
                        Mark review
                      </Button>
                    </div>
                  )}
                  {position.state === "MANUAL_REVIEW" && <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><CheckCircle2 className="h-3.5 w-3.5" /> Review queued</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
