"use client";

import { useState } from "react";
import { Dumbbell, Sparkles, Mail, KeyRound, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Security: Only allow existing users (evan@cooper.fitness)
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setStep("code");
      setSuccessMsg("We sent an 8-digit login code to your email.");
    }

    setLoading(false);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-soft">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-foreground/[0.02] blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-foreground/[0.03] blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-floating mb-4">
            <Dumbbell className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient">Cooper Fitness</span> CRM
          </h1>
          <p className="text-muted-foreground mt-1.5 flex items-center justify-center gap-1.5 text-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Secure Coach Dashboard
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-7 shadow-floating">
          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="evan@cooper.fitness"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10 pl-9"
                  />
                </div>
              </div>
              
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}
              
              <Button
                type="submit"
                className="w-full h-10 shadow-soft"
                disabled={loading}
              >
                {loading ? "Sending Code..." : "Send Login Code"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-muted-foreground mt-2"
                onClick={() => setStep("code")}
                disabled={loading}
              >
                I already have a code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label htmlFor="code">Enter 8-Digit Code</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  {successMsg}
                </p>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    placeholder="12345678"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    className="h-10 pl-9 tracking-widest font-mono text-center"
                    maxLength={8}
                  />
                </div>
              </div>
              
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}
              
              <Button
                type="submit"
                className="w-full h-10 shadow-soft"
                disabled={loading || code.length !== 8}
              >
                {loading ? "Verifying..." : "Verify Code & Log In"}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
                disabled={loading}
              >
                Use a different email
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Secured by Email OTP
        </p>
      </div>
    </div>
  );
}
