"use client";

import { useState } from "react";
import { FormDialog } from "@/components/master-form-dialog";
import { TextField } from "@/components/form";
import { saveContactAction } from "@/app/(app)/emergency/actions";

export interface ContactRow {
  id: string;
  scope: string;
  branch_id: string | null;
  region: string | null;
  role_label: string;
  name: string;
  phone: string;
  priority: number;
  service_hours: string | null;
  notes: string | null;
}

const sel = "tap w-full rounded-lg border border-border bg-surface px-3 text-sm";

function Fields({ c, branches, fe }: { c?: ContactRow; branches: { id: string; name: string }[]; fe?: Record<string, string> }) {
  const [scope, setScope] = useState(c?.scope ?? "GLOBAL");
  return (
    <>
      <TextField name="role_label" label="Peran / label" required defaultValue={c?.role_label} error={fe?.role_label} placeholder="Control Tower, Derek, Bengkel, Atasan…" />
      <TextField name="name" label="Nama" required defaultValue={c?.name} error={fe?.name} />
      <TextField name="phone" label="Telepon" required type="tel" defaultValue={c?.phone} error={fe?.phone} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Cakupan *</span>
        <select name="scope" value={scope} onChange={(e) => setScope(e.target.value)} className={sel}>
          <option value="GLOBAL">Global (tampil di semua layar)</option>
          <option value="BRANCH">Cabang tertentu</option>
          <option value="REGION">Wilayah tertentu</option>
        </select>
      </label>
      {scope === "BRANCH" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Cabang *</span>
          <select name="branch_id" defaultValue={c?.branch_id ?? ""} className={sel}>
            <option value="">— pilih —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {scope === "REGION" && <TextField name="region" label="Wilayah *" defaultValue={c?.region} help="Harus sama dengan isian Wilayah pada master Cabang" />}
      <TextField name="priority" label="Urutan prioritas" defaultValue={c?.priority ?? 10} error={fe?.priority} help="Angka kecil tampil lebih dulu" />
      <TextField name="service_hours" label="Jam layanan" defaultValue={c?.service_hours} placeholder="24 jam" />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Catatan</span>
        <textarea name="notes" rows={2} defaultValue={c?.notes ?? ""} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
      </label>
    </>
  );
}

export function ContactDialog({ contact, branches, compact }: { contact?: ContactRow; branches: { id: string; name: string }[]; compact?: boolean }) {
  return (
    <FormDialog
      trigger={contact ? "Ubah" : "+ Kontak"}
      title={contact ? "Ubah kontak darurat" : "Kontak darurat baru"}
      action={saveContactAction.bind(null, contact?.id ?? null)}
      triggerClassName={
        compact
          ? "tap rounded-lg border border-border px-3 text-sm hover:bg-background"
          : "tap rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-strong"
      }
    >
      {(state) => <Fields c={contact} branches={branches} fe={state && !state.ok ? state.fieldErrors : undefined} />}
    </FormDialog>
  );
}
