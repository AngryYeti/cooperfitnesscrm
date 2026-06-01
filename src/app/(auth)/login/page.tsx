"use client";

import { useState } from "react";
import { Dumbbell, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      window.location.href = "/";
    }

    setLoading(false);
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
            Your coaching command center
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-7 shadow-floating">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10"
              />
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
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Cooper Fitness CRM · Coach dashboard
        </p>
      </div>
    </div>
  );
}
