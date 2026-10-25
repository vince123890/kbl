// Antrean sinkron dan salinan data baca di IndexedDB (klien saja). Logika murni ada di outbox-logic.ts.
import { idb, idbAll, idbClear, idbDelete, idbPut, newKey } from "@/lib/offline-db";
import { outboxKey, type OutboxItem, type OutboxKind } from "@/lib/outbox-logic";

export { newKey };
export * from "@/lib/outbox-logic";

const EVENT = "kbl-outbox";

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** Berlangganan perubahan antrean (tab ini dan tab lain). */
export function subscribeOutbox(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("online", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("online", cb);
  };
}

export async function enqueue(
  kind: OutboxKind,
  userId: string,
  ref: string,
  payload: Record<string, unknown>,
  opts: { extra?: string; blob?: Blob; fileName?: string } = {},
): Promise<OutboxItem> {
  const item: OutboxItem = {
    key: outboxKey(kind, userId, ref, opts.extra ?? (kind === "ATTACHMENT" ? newKey() : "")),
    userId,
    kind,
    ref,
    payload,
    blob: opts.blob,
    fileName: opts.fileName,
    createdAt: new Date().toISOString(),
    attempts: 0,
    state: "PENDING",
  };
  await idbPut("outbox", item);
  notify();
  return item;
}

export const listOutbox = (userId: string) => idbAll<OutboxItem>("outbox").then((l) => l.filter((i) => i.userId === userId));
export const removeOutbox = (key: string) => idbDelete("outbox", key).then(notify);
export const updateOutbox = (item: OutboxItem) => idbPut("outbox", item).then(notify);

// ---------------------------------------------------------------- salinan data baca
export type SnapshotKind = "wo" | "count";

interface Snapshot<T> {
  key: string;
  userId: string;
  kind: SnapshotKind;
  id: string;
  data: T;
  savedAt: string;
}

export const saveSnapshot = <T>(userId: string, kind: SnapshotKind, id: string, data: T) =>
  idbPut("snapshots", { key: `${userId}:${kind}:${id}`, userId, kind, id, data, savedAt: new Date().toISOString() } satisfies Snapshot<T>);

export const listSnapshots = <T>(userId: string, kind: SnapshotKind) =>
  idbAll<Snapshot<T>>("snapshots").then((l) => l.filter((s) => s.userId === userId && s.kind === kind));

export const loadSnapshot = <T>(userId: string, kind: SnapshotKind, id: string) =>
  idb<Snapshot<T> | undefined>("snapshots", "readonly", (s) => s.get(`${userId}:${kind}:${id}`) as IDBRequest<Snapshot<T> | undefined>).catch(() => undefined);

/** Menghapus semua salinan data baca (saat keluar). Antrean sinkron tidak dihapus agar pekerjaan offline tidak hilang. */
export const clearSnapshots = () => idbClear("snapshots");

/** Mengganti salinan satu jenis dengan daftar baru (id yang sudah tidak ada dihapus). */
export async function replaceSnapshots<T>(userId: string, kind: SnapshotKind, items: { id: string; data: T }[]): Promise<void> {
  const keep = new Set(items.map((i) => `${userId}:${kind}:${i.id}`));
  for (const s of await listSnapshots<T>(userId, kind)) if (!keep.has(s.key)) await idbDelete("snapshots", s.key);
  for (const i of items) await saveSnapshot(userId, kind, i.id, i.data);
}
