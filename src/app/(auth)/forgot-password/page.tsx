"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { Alert, SubmitButton, TextField } from "@/components/form";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">Masukkan email akun Anda. Kami akan mengirim link untuk membuat password baru (berlaku 1 jam).</p>
      <TextField name="email" label="Email" type="email" required autoComplete="email" />
      <Alert result={state} />
      <SubmitButton className="w-full">Kirim link reset</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-foreground underline decoration-brand decoration-2 underline-offset-4 hover:bg-brand-soft">
          Kembali ke login
        </Link>
      </p>
    </form>
  );
}
