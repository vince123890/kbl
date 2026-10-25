// IndexedDB bersama untuk mode offline (klien saja). Tiga penyimpanan:
//  - reports   : antrean Lapor Darurat (kunci idempotensi sebagai id)
//  - snapshots : salinan data baca (Tugas Saya, lembar opname) milik user yang login
//  - outbox    : aksi yang dilakukan saat offline dan menunggu disinkronkan ke server

const DB_NAME = "kbl-offline";
const DB_VERSION = 2;

export type StoreName = "reports" | "snapshots" | "outbox";

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("reports")) db.createObjectStore("reports", { keyPath: "id" });
      if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots", { keyPath: "key" });
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idb<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const idbAll = <T>(store: StoreName) => idb<T[]>(store, "readonly", (s) => s.getAll()).catch(() => [] as T[]);
export const idbPut = (store: StoreName, value: unknown) => idb(store, "readwrite", (s) => s.put(value)).then(() => undefined);
export const idbDelete = (store: StoreName, key: string) => idb(store, "readwrite", (s) => s.delete(key)).then(() => undefined);
export const idbClear = (store: StoreName) => idb(store, "readwrite", (s) => s.clear()).then(() => undefined);

export function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}
