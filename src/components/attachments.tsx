"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/form";
import { ActionButton } from "@/components/action-button";
import { deleteAttachmentAction, uploadAttachmentAction } from "@/app/(app)/attachments/actions";
import type { AttachmentEntity, AttachmentView } from "@/lib/attachments";
import { fmtDateTime } from "@/lib/format";

/** Daftar lampiran + (opsional) pengunggah dan tombol hapus. Hak diputuskan server; DB tetap menolak bila tidak boleh. */
export function AttachmentsPanel({
  entity,
  entityId,
  items,
  canAdd,
  canDelete,
  accept = "image/*,application/pdf",
  capture,
}: {
  entity: AttachmentEntity;
  entityId: string;
  items: AttachmentView[];
  canAdd: boolean;
  canDelete: boolean;
  accept?: string;
  /** "environment" membuka kamera belakang di ponsel */
  capture?: "environment" | "user";
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(uploadAttachmentAction.bind(null, entity, entityId), null);

  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="space-y-3 text-sm">
      {items.length === 0 && <p className="text-muted">Belum ada lampiran.</p>}
      {items.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
              {a.isImage && a.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.file_name} className="h-12 w-12 shrink-0 rounded object-cover" />
              ) : (
                <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded bg-background text-xs text-muted">
                  PDF
                </span>
              )}
              <div className="min-w-0 flex-1">
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="block truncate font-medium underline decoration-brand decoration-2 underline-offset-2">
                    {a.file_name}
                  </a>
                ) : (
                  <span className="block truncate">{a.file_name}</span>
                )}
                <span className="text-xs text-muted">
                  {Math.max(1, Math.round(a.size_bytes / 1024))} KB · {fmtDateTime(a.uploaded_at)}
                </span>
              </div>
              {canDelete && <ActionButton label="Hapus" tone="danger" confirm="Hapus lampiran ini?" action={() => deleteAttachmentAction(a.id)} />}
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <form ref={form} action={action} className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="files"
            multiple
            accept={accept}
            {...(capture ? { capture } : {})}
            className="max-w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2"
          />
          <button disabled={pending} className="tap rounded-lg border border-border px-4 hover:bg-brand-soft disabled:opacity-60">
            {pending ? "Mengunggah…" : "Unggah"}
          </button>
          <span className="text-xs text-muted">Gambar atau PDF, maksimal sesuai parameter sistem.</span>
        </form>
      )}
      {state && !state.ok && <Alert result={state} />}
    </div>
  );
}
