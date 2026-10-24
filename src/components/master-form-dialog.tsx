"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, SubmitButton, TextField } from "@/components/form";
import type { ActionResult } from "@/lib/auth/session";
import type { FieldDef } from "@/lib/masters";

/** Dialog modal generik: tombol pemicu + isi form. Menutup dan menyegarkan data saat sukses. */
export function FormDialog({
  trigger,
  title,
  action,
  children,
  submitLabel = "Simpan",
  onSuccess,
  triggerClassName = "tap rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong",
}: {
  trigger: string;
  title: string;
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  children: (state: ActionResult | null) => ReactNode;
  submitLabel?: string;
  onSuccess?: (state: ActionResult & { ok: true }) => void;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, formAction] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.close();
      onSuccess?.(state);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/45"
      >
        <form action={formAction} className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="font-semibold">{title}</h2>
            <button type="button" aria-label="Tutup" className="tap px-2 text-xl" onClick={() => ref.current?.close()}>
              ×
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {children(state)}
            {state && !state.ok && <Alert result={state} />}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button type="button" className="tap rounded-lg border border-border px-4 text-sm" onClick={() => ref.current?.close()}>
              Batal
            </button>
            <SubmitButton>{submitLabel}</SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function DynamicField({
  field,
  value,
  error,
  branches,
}: {
  field: FieldDef;
  value?: string | number | boolean | null;
  error?: string;
  branches: { id: string; name: string }[];
}) {
  const v = value ?? field.defaultValue ?? "";
  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name={field.name} defaultChecked={v === true} className="mt-1 h-4 w-4" />
        <span>
          {field.label}
          {field.help && <span className="block text-xs text-muted">{field.help}</span>}
        </span>
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{field.label}</span>
        <textarea
          name={field.name}
          defaultValue={String(v)}
          rows={3}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
        />
        {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
      </label>
    );
  }
  if (field.type === "select" || field.type === "branch") {
    const options =
      field.type === "branch" ? branches.map((b) => ({ value: b.id, label: b.name })) : (field.options ?? []);
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          {field.label}
          {field.required && <span className="text-danger"> *</span>}
        </span>
        <select
          name={field.name}
          required={field.required}
          defaultValue={String(v)}
          className={`tap w-full rounded-lg border bg-surface px-3 ${error ? "border-danger" : "border-border"}`}
        >
          {!field.required || field.type === "branch" ? <option value="">— pilih —</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
      </label>
    );
  }
  return (
    <TextField
      name={field.name}
      label={field.label}
      type={field.type === "number" || field.type === "integer" ? "text" : "text"}
      required={field.required}
      defaultValue={typeof v === "boolean" ? "" : v}
      error={error}
      help={field.help}
    />
  );
}
