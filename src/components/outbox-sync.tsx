"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { classify, listOutbox, planBatches, removeOutbox, subscribeOutbox, updateOutbox, type OutboxItem } from "@/lib/outbox";
import { syncAttachmentAction, syncCountLinesAction, syncWoCompleteAction, syncWoStartAction, type SyncCountLine } from "@/app/(app)/sync/actions";
import { OFFLINE_USER_KEY } from "@/lib/offline-types";
import type { ActionResult } from "@/lib/auth/session";
import type { AttachmentEntity } from "@/lib/attachments";

// satu penguncian untuk seluruh tab/komponen agar kirim tidak berjalan ganda
let flushLock = false;

export interface OutboxState {
  items: OutboxItem[];
  pending: number;
  conflicts: number;
  flushing: boolean;
  flush: () => void;
}

async function send(item: OutboxItem, userId: string): Promise<ActionResult> {
  switch (item.kind) {
    case "WO_START":
      return syncWoStartAction(userId, item.ref);
    case "WO_COMPLETE":
      return syncWoCompleteAction(userId, item.ref, (item.payload.odometer as number | null) ?? null, (item.payload.note as string | null) ?? null);
    default: {
      const fd = new FormData();
      if (item.blob) fd.append("files", new File([item.blob], item.fileName ?? "foto.jpg", { type: item.blob.type }));
      fd.append("key", item.key);
      return syncAttachmentAction(userId, item.payload.entity as AttachmentEntity, item.ref, fd);
    }
  }
}

/**
 * Mengirim antrean offline ke server saat online: otomatis ketika koneksi kembali, tiap 30 detik, dan saat antrean berubah.
 * Galat jaringan = coba lagi nanti. Galat aturan bisnis (mis. WO sudah dibatalkan) ditandai konflik dan tampil ke user.
 */
export function useOutbox(userId: string): OutboxState {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(async () => setItems(await listOutbox(userId)), [userId]);

  const flush = useCallback(async () => {
    if (flushLock || !navigator.onLine) return;
    flushLock = true;
    setFlushing(true);
    try {
      for (const batch of planBatches(await listOutbox(userId), userId)) {
        try {
          const group = batch.type === "COUNT" ? batch.items : [batch.item];
          const res =
            batch.type === "COUNT"
              ? await syncCountLinesAction(userId, batch.countId, batch.items.map((i) => i.payload as unknown as SyncCountLine))
              : await send(batch.item, userId);
          const outcome = classify(group[0].kind, res.ok ? { ok: true } : { ok: false, error: res.error });
          if (outcome === "DONE") for (const i of group) await removeOutbox(i.key);
          else if (outcome === "CONFLICT" && !res.ok) for (const i of group) await updateOutbox({ ...i, state: "CONFLICT", error: res.error, attempts: i.attempts + 1 });
          else if (outcome === "AUTH") break; // login ulang dulu
        } catch {
          break; // jaringan putus di tengah jalan; sisanya dicoba lagi nanti
        }
      }
    } finally {
      flushLock = false;
      setFlushing(false);
      await refresh();
    }
  }, [userId, refresh]);

  useEffect(() => {
    const first = setTimeout(() => {
      void refresh();
      void flush();
    }, 0);
    const unsub = subscribeOutbox(() => {
      void refresh();
      void flush();
    });
    const t = setInterval(() => void flush(), 30_000);
    return () => {
      clearTimeout(first);
      unsub();
      clearInterval(t);
    };
  }, [refresh, flush]);

  const mine = items.filter((i) => i.userId === userId);
  return {
    items: mine,
    pending: mine.filter((i) => i.state === "PENDING").length,
    conflicts: mine.filter((i) => i.state === "CONFLICT").length,
    flushing,
    flush: () => void flush(),
  };
}

/** Penanda di header: jumlah pekerjaan offline yang menunggu sinkron. Tersembunyi bila antrean kosong. */
export function OutboxChip({ userId }: { userId: string }) {
  const { pending, conflicts, flushing } = useOutbox(userId);
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_USER_KEY, userId); // hub offline tidak punya sesi server; ia membaca id ini
    } catch {
      /* penyimpanan lokal tidak tersedia */
    }
  }, [userId]);
  if (!pending && !conflicts) return null;
  return (
    <Link
      href="/offline#antrean"
      className={`tap flex items-center gap-1 rounded-full border px-3 text-xs font-medium ${conflicts ? "border-danger text-danger" : "border-brand bg-brand-soft"}`}
      title="Pekerjaan yang dilakukan offline dan menunggu dikirim ke server"
    >
      <span aria-hidden className={flushing ? "animate-spin" : ""}>
        ⟳
      </span>
      {conflicts ? `${conflicts} perlu dicek` : `${pending} menunggu sinkron`}
    </Link>
  );
}
