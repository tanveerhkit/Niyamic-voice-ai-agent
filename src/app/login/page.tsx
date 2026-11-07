"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { HOME_FOR, type Role, roleForLoginId, signIn, useRole } from "@/lib/auth";
import { Wordmark } from "@/components/brand";
import { Button, Input, Label, Panel } from "@/components/ui";

/** A supervisor returns to the page that sent them here; a customer always gets the support page. */
function destination(role: Role, next: string | null) {
  if (
    role === "supervisor" &&
    next?.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/login") &&
    !next.startsWith("/support")
  ) {
    return next;
  }
  return HOME_FOR[role];
}

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const role = useRole();
  const [loginId, setLoginId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role) router.replace(destination(role, next));
  }, [role, next, router]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const matched = roleForLoginId(loginId);
    if (!matched) {
      setError("That login ID isn't recognised.");
      return;
    }
    signIn(matched);
  };

  // Signed in already, or not yet checked: the effect above takes it from here.
  if (role !== null) return null;

  return (
    <Panel className="w-full max-w-sm p-6">
      <h1 className="font-display text-[26px] font-light tracking-[-0.02em] text-ink">Sign in</h1>
      <p className="mt-1 text-[11.5px] text-muted">Enter your login ID to continue.</p>
      <form onSubmit={submit} className="mt-6" noValidate>
        <Label htmlFor="login-id">Login ID</Label>
        <Input
          id="login-id"
          name="username"
          value={loginId}
          onChange={(event) => {
            setLoginId(event.target.value);
            setError(null);
          }}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "login-error" : undefined}
        />
        {error ? (
          <p id="login-error" className="mt-2 text-[11px] text-red">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" className="mt-5 w-full" disabled={!loginId.trim()}>
          Continue
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </form>
    </Panel>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg p-4">
      <Wordmark size="lg" />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
