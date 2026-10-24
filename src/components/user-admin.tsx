"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/master-form-dialog";
import { TextField } from "@/components/form";
import {
  createUserAction,
  resetUserPasswordAction,
  setUserActiveAction,
  unlockUserAction,
  updateUserAction,
} from "@/app/(app)/admin/users/actions";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  branch_id: string;
  is_active: boolean;
  row_version: number;
  locked: boolean;
  roleIds: string[];
}
interface Option {
  id: string;
  name: string;
}

function RoleChecklist({ roles, selected, error }: { roles: Option[]; selected: string[]; error?: string }) {
  return (
    <fieldset className="text-sm">
      <legend className="mb-1 font-medium">
        Role<span className="text-danger"> *</span>
      </legend>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {roles.map((r) => (
          <label key={r.id} className="tap flex items-center gap-2 rounded-lg border border-border px-2">
            <input type="checkbox" name="role_ids" value={r.id} defaultChecked={selected.includes(r.id)} />
            {r.name}
          </label>
        ))}
      </div>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </fieldset>
  );
}

function BranchSelect({ branches, value, error }: { branches: Option[]; value?: string; error?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">
        Cabang<span className="text-danger"> *</span>
      </span>
      <select name="branch_id" defaultValue={value ?? ""} className="tap w-full rounded-lg border border-border bg-surface px-3">
        <option value="">— pilih —</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function IssuedPassword({ issued, onClose }: { issued: { email: string; password: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!issued) return null;
  return (
    <div role="status" className="mb-4 rounded-xl border border-brand bg-brand-soft p-4 text-sm">
      <p className="font-medium">Password sementara untuk {issued.email}</p>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-surface px-2 py-1 text-base tracking-wide">{issued.password}</code>
        <button
          type="button"
          className="tap rounded-lg border border-brand px-3 text-foreground"
          onClick={async () => {
            await navigator.clipboard.writeText(issued.password);
            setCopied(true);
          }}
        >
          {copied ? "Tersalin" : "Salin"}
        </button>
        <button type="button" className="tap rounded-lg px-3 underline" onClick={onClose}>
          Tutup
        </button>
      </p>
      <p className="mt-2 text-xs text-muted">Password hanya ditampilkan sekali. Pengguna wajib menggantinya saat login pertama.</p>
    </div>
  );
}

export function UserAdminToolbar({ branches, roles }: { branches: Option[]; roles: Option[] }) {
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  return (
    <>
      <IssuedPassword issued={issued} onClose={() => setIssued(null)} />
      <FormDialog
        trigger="+ User"
        title="Tambah User"
        action={createUserAction}
        submitLabel="Buat user"
        onSuccess={(s) => {
          const d = (s as { data?: { email: string; password: string } }).data;
          if (d) setIssued(d);
        }}
      >
        {(state) => {
          const fe = state && !state.ok ? state.fieldErrors : undefined;
          return (
            <>
              <TextField name="name" label="Nama" required error={fe?.name} />
              <TextField name="email" label="Email" type="email" required error={fe?.email} />
              <TextField name="phone" label="Telepon" type="tel" required error={fe?.phone} />
              <BranchSelect branches={branches} error={fe?.branch_id} />
              <RoleChecklist roles={roles} selected={[]} error={fe?.role_ids} />
              <p className="text-xs text-muted">Password sementara dibuat otomatis dan ditampilkan setelah user dibuat.</p>
            </>
          );
        }}
      </FormDialog>
    </>
  );
}

export function UserRowActions({
  user,
  branches,
  roles,
  selfId,
}: {
  user: UserRow;
  branches: Option[];
  roles: Option[];
  selfId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string; data?: unknown }>, after?: (d: unknown) => void) =>
    start(async () => {
      const res = await fn();
      setMessage({ ok: res.ok, text: res.ok ? (res.message ?? "") : (res.error ?? "Gagal") });
      if (res.ok) {
        after?.(res.data);
        router.refresh();
      }
    });
  const btn = "tap rounded-lg border border-border px-3 text-sm hover:bg-background disabled:opacity-60";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <FormDialog
          trigger="Ubah"
          title={`Ubah ${user.name}`}
          action={updateUserAction.bind(null, user.id, user.row_version)}
          triggerClassName={btn}
        >
          {(state) => {
            const fe = state && !state.ok ? state.fieldErrors : undefined;
            return (
              <>
                <TextField name="name" label="Nama" required defaultValue={user.name} error={fe?.name} />
                <TextField name="email" label="Email" defaultValue={user.email} readOnly help="Email tidak dapat diubah" />
                <TextField name="phone" label="Telepon" type="tel" required defaultValue={user.phone} error={fe?.phone} />
                <BranchSelect branches={branches} value={user.branch_id} error={fe?.branch_id} />
                <RoleChecklist roles={roles} selected={user.roleIds} error={fe?.role_ids} />
              </>
            );
          }}
        </FormDialog>
        {user.locked && (
          <button className={btn} disabled={pending} onClick={() => run(() => unlockUserAction(user.id))}>
            Buka kunci
          </button>
        )}
        <button
          className={btn}
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Reset password ${user.name}? Password lama tidak berlaku lagi.`)) return;
            run(
              () => resetUserPasswordAction(user.id),
              (d) => setIssued({ email: user.email, password: (d as { password: string }).password }),
            );
          }}
        >
          Reset password
        </button>
        {user.id !== selfId && (
          <button
            className={`${btn} ${user.is_active ? "border-danger/40 text-danger" : ""}`}
            disabled={pending}
            onClick={() => {
              if (user.is_active && !window.confirm(`Nonaktifkan ${user.name}? Sesi aktifnya akan diakhiri.`)) return;
              run(() => setUserActiveAction(user.id, !user.is_active));
            }}
          >
            {user.is_active ? "Nonaktifkan" : "Aktifkan"}
          </button>
        )}
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`max-w-64 text-right text-xs ${message.ok ? "text-foreground" : "text-danger"}`}>
          {message.text}
        </p>
      )}
      <IssuedPassword issued={issued} onClose={() => setIssued(null)} />
    </div>
  );
}
