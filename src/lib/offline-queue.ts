// Antrean laporan darurat di IndexedDB (klien). Laporan dikirim ulang saat online dengan kunci idempotensi yang sama,
// sehingga kirim ganda tidak membuat insiden ganda. Fungsi di file ini hanya dipakai di peramban.

export interface QueuedReport {
  /** kunci idempotensi (UUID) */
  id: string;
  userId: string | null;
  vehicleId: string;
  vehicleLabel: string;
  type: string;
  lat: number | null;
  lng: number | null;
  at: string;
}

const DB = "kbl-offline";
const STORE = "reports";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    t.onerror = () => reject(t.error);
  });
}

export const queueReport = (r: QueuedReport) => tx("readwrite", (s) => s.put(r)).then(() => undefined);
export const listQueued = () => tx<QueuedReport[]>("readonly", (s) => s.getAll()).catch(() => [] as QueuedReport[]);
export const removeQueued = (id: string) => tx("readwrite", (s) => s.delete(id)).then(() => undefined);

export function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}
