"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/lib/auth/actions";
import { Alert, SubmitButton, TextField } from "@/components/form";

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action] = useActionState(updateProfileAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <TextField name="name" label="Nama" required defaultValue={name} error={fe?.name} />
      <TextField name="phone" label="Telepon" type="tel" defaultValue={phone} />
      <Alert result={state} />
      <SubmitButton>Simpan</SubmitButton>
    </form>
  );
}
