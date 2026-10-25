// Antrean laporan darurat di IndexedDB (klien). Laporan dikirim ulang saat online dengan kunci idempotensi yang sama,
// sehingga kirim ganda tidak membuat insiden ganda. Fungsi di file ini hanya dipakai di peramban.
import { idbAll, idbDelete, idbPut, newKey } from "@/lib/offline-db";

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

export const queueReport = (r: QueuedReport) => idbPut("reports", r);
export const listQueued = () => idbAll<QueuedReport>("reports");
export const removeQueued = (id: string) => idbDelete("reports", id);
export { newKey };
