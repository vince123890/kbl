"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/master-form-dialog";
import { Alert, SubmitButton, TextField } from "@/components/form";
import { createRoleAction, deleteRoleAction, savePermissionsAction } from "@/app/(app)/admin/roles/actions";

export function CreateRoleButton() {
  return (
    <FormDialog trigger="+ Role" title="Tambah Role" action={createRoleAction}>
      {(state) => (
        <>
          <TextField name="name" label="Nama role" required help="Huruf besar, angka, garis bawah. Mis. AUDITOR" error={state && !state.ok ? state.fieldErrors?.name : undefined} />
          <TextField name="description" label="Deskripsi" />
        </>
      )}
    </FormDialog>
  );
}

export function RoleEditor({
  role,
  groups,
  granted,
  userCount,
}: {
  role: { id: string; name: string; description: string | null; is_builtin: boolean };
  groups: { title: string; perms: { code: string; description: string }[] }[];
  granted: string[];
  userCount: number;
}) {
  const router = useRouter();
  const [state, action] = useActionState(savePermissionsAction.bind(null, role.id), null);
  const [pending, start] = useTransition();
  const [delError, setDelError] = useState<string | null>(null);

  return (
    <details className="rounded-xl border border-border bg-surface">
      <summary className="tap flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-2">
        <span>
          <span className="font-semibold">{role.name}</span>
          {role.is_builtin && <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs text-muted">bawaan</span>}
          <span className="block text-xs text-muted">
            {role.description ?? "-"} · {userCount} user · {granted.length} permission
          </span>
        </span>
      </summary>
      <form action={action} className="space-y-4 border-t border-border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <fieldset key={g.title}>
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</legend>
              <div className="space-y-1">
                {g.perms.map((p) => (
                  <label key={p.code} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="perm" value={p.code} defaultChecked={granted.includes(p.code)} className="mt-1" />
                    <span>
                      <code className="text-xs">{p.code}</code>
                      <span className="block text-xs text-muted">{p.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <Alert result={state} />
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton>Simpan permission</SubmitButton>
          {!role.is_builtin && (
            <button
              type="button"
              disabled={pending}
              className="tap rounded-lg border border-danger/40 px-4 text-sm text-danger hover:bg-danger-soft disabled:opacity-60"
              onClick={() => {
                if (!window.confirm(`Hapus role ${role.name}?`)) return;
                setDelError(null);
                start(async () => {
                  const res = await deleteRoleAction(role.id);
                  if (res.ok) router.refresh();
                  else setDelError(res.error);
                });
              }}
            >
              Hapus role
            </button>
          )}
        </div>
        {delError && <p role="alert" className="text-sm text-danger">{delError}</p>}
      </form>
    </details>
  );
}
