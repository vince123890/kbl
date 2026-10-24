"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DynamicField, FormDialog } from "@/components/master-form-dialog";
import { TextField } from "@/components/form";
import { saveMasterAction, toggleActiveAction, updateOdometerAction } from "@/app/(app)/master/actions";
import type { MasterDef } from "@/lib/masters";

type Row = Record<string, string | number | boolean | null> & { id: string; row_version: number; is_active: boolean };
type Branch = { id: string; name: string };

export function MasterFormButton({
  def,
  row,
  branches,
  compact,
}: {
  def: MasterDef;
  row?: Row;
  branches: Branch[];
  compact?: boolean;
}) {
  const editing = !!row;
  const action = saveMasterAction.bind(null, def.slug, row?.id ?? null, row?.row_version ?? null);
  return (
    <FormDialog
      trigger={editing ? "Ubah" : `+ ${def.singular}`}
      title={editing ? `Ubah ${def.singular}` : `Tambah ${def.singular}`}
      action={action}
      triggerClassName={
        compact
          ? "tap rounded-lg border border-border px-3 text-sm hover:bg-background"
          : "tap rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-strong"
      }
    >
      {(state) => {
        const fe = state && !state.ok ? state.fieldErrors : undefined;
        return def.fields
          .filter((f) => !(editing && f.createOnly))
          .map((f) => (
            <DynamicField key={f.name} field={f} value={row?.[f.name]} error={fe?.[f.name]} branches={branches} />
          ));
      }}
    </FormDialog>
  );
}

export function OdometerButton({ vehicleId, current }: { vehicleId: string; current: number }) {
  const action = updateOdometerAction.bind(null, vehicleId);
  return (
    <FormDialog
      trigger="Odometer"
      title="Update Odometer"
      action={action}
      triggerClassName="tap rounded-lg border border-border px-3 text-sm hover:bg-background"
    >
      {(state) => (
        <TextField
          name="odometer"
          label="Odometer baru (km)"
          required
          defaultValue={current}
          help={`Tidak boleh lebih kecil dari ${current.toLocaleString("id-ID")} km`}
          error={state && !state.ok ? state.fieldErrors?.odometer : undefined}
        />
      )}
    </FormDialog>
  );
}

export function ToggleActiveButton({ slug, row, label }: { slug: string; row: Row; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = !row.is_active;
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={`tap rounded-lg border px-3 text-sm disabled:opacity-60 ${
          next ? "border-border hover:bg-background" : "border-danger/40 text-danger hover:bg-danger-soft"
        }`}
        onClick={() => {
          if (!next && !window.confirm(`Nonaktifkan ${label}? Data riwayat tetap tersimpan.`)) return;
          setError(null);
          start(async () => {
            const res = await toggleActiveAction(slug, row.id, row.row_version, next);
            if (res.ok) router.refresh();
            else setError(res.error);
          });
        }}
      >
        {next ? "Aktifkan" : "Nonaktifkan"}
      </button>
      {error && (
        <span role="alert" className="block max-w-56 text-xs text-danger">
          {error}
        </span>
      )}
    </>
  );
}

export function DetailLink({ href }: { href: string }) {
  return (
    <Link href={href} className="tap inline-flex items-center rounded-lg border border-border px-3 text-sm hover:bg-background">
      Detail
    </Link>
  );
}
