// Bentuk data yang disimpan di perangkat untuk mode offline. Diisi oleh server (offline-data.ts), dibaca oleh hub offline.

export interface WoSnap {
  id: string;
  wo_no: string;
  type: string;
  status: string;
  priority: string;
  plate: string;
  odometer: number;
  description: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  vendor: string | null;
  parts: { code: string; name: string; uom: string; qty_planned: string; qty_used: string }[];
}

export interface CountLineSnap {
  sparepart_id: string;
  code: string;
  name: string;
  uom: string;
  system_qty: string;
  counted_qty: string | null;
  not_counted: boolean;
  reason_code_id: string | null;
  reason_note: string | null;
}

export interface CountSnap {
  id: string;
  count_no: string;
  location: string;
  status: string;
  lines: CountLineSnap[];
  reasons: { id: string; name: string; require_note: boolean }[];
}

/** Kunci localStorage berisi id user yang terakhir aktif di perangkat ini (hub offline tidak punya sesi server). */
export const OFFLINE_USER_KEY = "kbl-offline-user";
