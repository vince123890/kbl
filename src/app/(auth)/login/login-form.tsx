"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/lib/auth/actions";
import { Alert, SubmitButton, TextField } from "@/components/form";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      {notice && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">{notice}</p>}
      <TextField name="email" label="Email" type="email" required autoComplete="username" />
      <TextField name="password" label="Password" type="password" required autoComplete="current-password" />
      <Alert result={state} />
      <SubmitButton className="w-full" pendingText="Masuk…">
        Masuk
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-foreground underline decoration-brand decoration-2 underline-offset-4 hover:bg-brand-soft">
          Lupa password?
        </Link>
      </p>
    </form>
  );
}
