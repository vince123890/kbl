"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/auth/session";

type Tone = "primary" | "danger" | "ghost";

const TONES: Record<Tone, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-strong",
  danger: "border border-danger/40 text-danger hover:bg-danger-soft",
  ghost: "border border-border hover:bg-brand-soft",
};

/**
 * Tombol aksi server: konfirmasi opsional, atau dialog catatan (wajib) sebelum aksi dijalankan.
 * `action` menerima catatan; aksi yang tidak membutuhkannya cukup mengabaikan argumen.
 */
export function ActionButton({
  action,
  label,
  tone = "ghost",
  confirm,
  noteLabel,
  noteRequired = true,
  noteHelp,
  className = "",
  onDone,
}: {
  action: (note: string) => Promise<ActionResult>;
  label: string;
  tone?: Tone;
  confirm?: string;
  noteLabel?: string;
  noteRequired?: boolean;
  noteHelp?: string;
  className?: string;
  onDone?: (r: ActionResult) => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (n: string) =>
    start(async () => {
      const r = await action(n);
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "") : r.error });
      if (r.ok) {
        dialog.current?.close();
        setNote("");
        router.refresh();
      }
      onDone?.(r);
    });

  const click = () => {
    setMsg(null);
    if (noteLabel) {
      dialog.current?.showModal();
      return;
    }
    if (confirm && !window.confirm(confirm)) return;
    run("");
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={click}
        className={`tap rounded-lg px-4 text-sm font-medium transition disabled:opacity-60 ${TONES[tone]} ${className}`}
      >
        {pending && !noteLabel ? "Memproses…" : label}
      </button>
      {msg && !noteLabel && (
        <span role={msg.ok ? "status" : "alert"} className={`max-w-xs text-xs ${msg.ok ? "text-muted" : "text-danger"}`}>
          {msg.text}
        </span>
      )}
      {noteLabel && (
        <dialog
          ref={dialog}
          className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/45"
        >
          <form
            className="flex flex-col gap-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (noteRequired && !note.trim()) {
                setMsg({ ok: false, text: `${noteLabel} wajib diisi` });
                return;
              }
              run(note.trim());
            }}
          >
            <h2 className="font-semibold">{label}</h2>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                {noteLabel}
                {noteRequired && <span className="text-danger"> *</span>}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              />
              {noteHelp && <span className="mt-1 block text-xs text-muted">{noteHelp}</span>}
            </label>
            {msg && !msg.ok && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {msg.text}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="tap rounded-lg border border-border px-4 text-sm" onClick={() => dialog.current?.close()}>
                Batal
              </button>
              <button disabled={pending} className={`tap rounded-lg px-4 text-sm font-medium disabled:opacity-60 ${TONES[tone === "ghost" ? "primary" : tone]}`}>
                {pending ? "Memproses…" : label}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </span>
  );
}
