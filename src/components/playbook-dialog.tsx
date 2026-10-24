"use client";

import { useState } from "react";
import { FormDialog } from "@/components/master-form-dialog";
import { TextField } from "@/components/form";
import { savePlaybookAction } from "@/app/(app)/emergency/actions";
import { TYPE_BUTTONS } from "@/lib/emergency-guide";

export interface PlaybookRow {
  id: string;
  incident_type: string;
  title: string;
  steps: string[];
}

function Steps({ initial }: { initial: string[] }) {
  const [steps, setSteps] = useState(initial.length ? initial : [""]);
  const move = (i: number, d: -1 | 1) =>
    setSteps((s) => {
      const j = i + d;
      if (j < 0 || j >= s.length) return s;
      const n = [...s];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <div className="space-y-2">
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />
      <p className="text-sm font-medium">Langkah (urut, kalimat perintah singkat)</p>
      {steps.map((s, i) => (
        <div key={i} className="flex gap-1">
          <span className="tap flex w-7 items-center justify-center text-sm text-muted">{i + 1}.</span>
          <input
            aria-label={`Langkah ${i + 1}`}
            value={s}
            onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
            className="tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
          />
          <button type="button" aria-label="Naik" className="tap rounded-lg border border-border px-2" onClick={() => move(i, -1)}>
            ↑
          </button>
          <button type="button" aria-label="Turun" className="tap rounded-lg border border-border px-2" onClick={() => move(i, 1)}>
            ↓
          </button>
          <button type="button" aria-label="Hapus" className="tap rounded-lg border border-border px-2" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="tap rounded-lg border border-border px-3 text-sm" onClick={() => setSteps((x) => [...x, ""])}>
        + Tambah langkah
      </button>
      <div className="rounded-xl border-2 border-brand bg-brand-soft p-3 text-sm">
        <p className="mb-1 font-semibold">Pratinjau layar pengemudi</p>
        <ol className="list-decimal space-y-1 pl-5">
          {steps.filter(Boolean).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function PlaybookDialog({ playbook, availableTypes, compact }: { playbook?: PlaybookRow; availableTypes?: string[]; compact?: boolean }) {
  return (
    <FormDialog
      trigger={playbook ? "Ubah" : "+ Langkah Cepat"}
      title={playbook ? `Ubah langkah cepat: ${playbook.title}` : "Langkah cepat baru"}
      action={savePlaybookAction.bind(null, playbook?.id ?? null)}
      triggerClassName={
        compact
          ? "tap rounded-lg border border-border px-3 text-sm hover:bg-background"
          : "tap rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-strong"
      }
    >
      {(state) => (
        <>
          {!playbook && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Jenis kejadian *</span>
              <select name="incident_type" className="tap w-full rounded-lg border border-border bg-surface px-3" required>
                {(availableTypes ?? []).map((t) => (
                  <option key={t} value={t}>
                    {t === "GENERAL" ? "Umum (cadangan)" : (TYPE_BUTTONS.find((b) => b.type === t)?.label ?? t)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <TextField name="title" label="Judul" required defaultValue={playbook?.title} error={state && !state.ok ? state.fieldErrors?.title : undefined} />
          <Steps initial={playbook?.steps ?? []} />
        </>
      )}
    </FormDialog>
  );
}
