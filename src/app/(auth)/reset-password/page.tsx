"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/auth/actions";
import { Alert, SubmitButton, TextField } from "@/components/form";

export default function ResetPasswordPage() {
  const [state, action] = useActionState(resetPasswordAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">Buat password baru. Minimal 8 karakter, huruf dan angka.</p>
      <TextField name="next" label="Password baru" type="password" required autoComplete="new-password" error={fe?.next} />
      <TextField name="confirm" label="Ulangi password baru" type="password" required autoComplete="new-password" error={fe?.confirm} />
      <Alert result={state} />
      <SubmitButton className="w-full">Simpan password</SubmitButton>
    </form>
  );
}
