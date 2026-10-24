"use client";

import { useActionState } from "react";
import { changePasswordAction, logoutAction } from "@/lib/auth/actions";
import { Alert, SubmitButton, TextField } from "@/components/form";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action] = useActionState(changePasswordAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <div className="space-y-4">
      {forced && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">
          Demi keamanan, ganti password awal Anda sebelum melanjutkan.
        </p>
      )}
      <form action={action} className="space-y-4">
        <TextField name="current" label="Password saat ini" type="password" required autoComplete="current-password" error={fe?.current} />
        <TextField
          name="next"
          label="Password baru"
          type="password"
          required
          autoComplete="new-password"
          error={fe?.next}
          help="Minimal 8 karakter, huruf dan angka"
        />
        <TextField name="confirm" label="Ulangi password baru" type="password" required autoComplete="new-password" error={fe?.confirm} />
        <Alert result={state} />
        <SubmitButton className="w-full">Simpan password</SubmitButton>
      </form>
      {forced && (
        <form action={logoutAction}>
          <SubmitButton variant="ghost" className="w-full">
            Keluar
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
