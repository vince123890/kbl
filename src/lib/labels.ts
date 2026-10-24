// Label dan warna status/jenis dalam bahasa pengguna. Nilai basis data tetap kode (DRAFT, POSTED, ...).

export type Tone = "neutral" | "good" | "bad" | "warn";

interface LabelDef {
  label: string;
  tone?: Tone;
}

const defs = (m: Record<string, LabelDef>) => m;

export const STOCK_STATUS = defs({
  DRAFT: { label: "Draft" },
  SUBMITTED: { label: "Diajukan", tone: "warn" },
  APPROVED: { label: "Disetujui", tone: "good" },
  POSTED: { label: "Diposting", tone: "good" },
  REJECTED: { label: "Ditolak", tone: "bad" },
  CANCELLED: { label: "Dibatalkan", tone: "bad" },
});

export const STOCK_TYPE = defs({
  IN: { label: "Masuk" },
  OUT: { label: "Keluar" },
  RETURN: { label: "Retur" },
  TRANSFER: { label: "Transfer" },
  ADJUSTMENT: { label: "Penyesuaian" },
});

export const COUNT_STATUS = defs({
  OPEN: { label: "Terbuka" },
  COUNTING: { label: "Penghitungan", tone: "warn" },
  REVIEW: { label: "Review", tone: "warn" },
  APPROVED: { label: "Disetujui", tone: "good" },
  ADJUSTED: { label: "Disesuaikan", tone: "good" },
  CANCELLED: { label: "Dibatalkan", tone: "bad" },
});

export const COUNT_TYPE = defs({ PERIODIC: { label: "Berkala" }, AD_HOC: { label: "Ad-hoc" } });

export const WO_STATUS = defs({
  PLANNED: { label: "Planned" },
  SCHEDULED: { label: "Scheduled", tone: "warn" },
  IN_PROGRESS: { label: "In Progress", tone: "warn" },
  COMPLETED: { label: "Completed", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "bad" },
});

export const WO_TYPE = defs({
  PREVENTIVE: { label: "Preventif" },
  CORRECTIVE: { label: "Korektif", tone: "warn" },
  EMERGENCY: { label: "Emergensi", tone: "bad" },
});

export const PRIORITY = defs({
  LOW: { label: "Rendah" },
  NORMAL: { label: "Normal" },
  HIGH: { label: "Tinggi", tone: "warn" },
  URGENT: { label: "Darurat", tone: "bad" },
});

export const VALIDATION = defs({
  NONE: { label: "-" },
  PENDING: { label: "Menunggu validasi", tone: "warn" },
  VALIDATED: { label: "Tervalidasi", tone: "good" },
  REJECTED: { label: "Validasi ditolak", tone: "bad" },
  REVISION: { label: "Perlu revisi", tone: "warn" },
});

export const SCHEDULE_STATUS = defs({
  REQUESTED: { label: "Diajukan", tone: "warn" },
  APPROVED: { label: "Disetujui", tone: "good" },
  REJECTED: { label: "Ditolak", tone: "bad" },
  REVISION: { label: "Revisi", tone: "warn" },
  WITHDRAWN: { label: "Ditarik", tone: "neutral" },
});

export const CHANGE_TYPE = defs({
  ADVANCE: { label: "Percepatan" },
  POSTPONE: { label: "Penundaan", tone: "warn" },
});

export const INCIDENT_STATUS = defs({
  REPORTED: { label: "Dilaporkan", tone: "bad" },
  ACKNOWLEDGED: { label: "Dikonfirmasi pusat", tone: "warn" },
  IN_HANDLING: { label: "Ditangani", tone: "warn" },
  RESOLVED: { label: "Selesai", tone: "good" },
  CLOSED: { label: "Ditutup", tone: "neutral" },
});

export const INCIDENT_TYPE = defs({
  BREAKDOWN: { label: "Mogok" },
  ACCIDENT: { label: "Kecelakaan", tone: "bad" },
  TIRE: { label: "Ban" },
  FIRE: { label: "Kebakaran", tone: "bad" },
  MEDICAL: { label: "Medis", tone: "bad" },
  OTHER: { label: "Lainnya" },
});

export const APPROVAL_STATUS = defs({
  PENDING: { label: "Menunggu", tone: "warn" },
  APPROVED: { label: "Disetujui", tone: "good" },
  REJECTED: { label: "Ditolak", tone: "bad" },
  REVISION: { label: "Revisi", tone: "warn" },
  CANCELLED: { label: "Dibatalkan", tone: "neutral" },
});

export const APPROVAL_ACTION = defs({
  SUBMIT: { label: "Diajukan" },
  APPROVE: { label: "Disetujui", tone: "good" },
  REJECT: { label: "Ditolak", tone: "bad" },
  REVISE: { label: "Minta revisi", tone: "warn" },
  OVERRIDE: { label: "Override", tone: "warn" },
  ESCALATE: { label: "Dieskalasi", tone: "warn" },
  AUTO_APPROVE: { label: "Disetujui otomatis", tone: "good" },
  CANCEL: { label: "Dibatalkan", tone: "neutral" },
  POST_FAILED: { label: "Gagal diproses", tone: "bad" },
  REMIND: { label: "Pengingat" },
  SLA_BREACH: { label: "Lewat SLA", tone: "bad" },
});

export const DOC_TYPE = defs({
  STOCK: { label: "Mutasi" },
  COUNT: { label: "Opname" },
  SCHEDULE_CHANGE: { label: "Perubahan Jadwal" },
  EMERGENCY_WO: { label: "WO Emergensi" },
});

export const NOTIF_STATUS = defs({
  QUEUED: { label: "Antre", tone: "warn" },
  SENT: { label: "Terkirim", tone: "good" },
  FAILED: { label: "Gagal", tone: "bad" },
  READ: { label: "Dibaca", tone: "neutral" },
});

export const VEHICLE_STATUS = defs({
  ACTIVE: { label: "Aktif", tone: "good" },
  IN_MAINTENANCE: { label: "Dalam Perawatan", tone: "warn" },
  OUT_OF_SERVICE: { label: "Tidak Beroperasi", tone: "bad" },
});

export function label(map: Record<string, LabelDef>, key: string | null | undefined): string {
  if (!key) return "-";
  return map[key]?.label ?? key;
}

export function tone(map: Record<string, LabelDef>, key: string | null | undefined): Tone {
  return (key && map[key]?.tone) || "neutral";
}

/** Tautan ke dokumen asal sebuah permintaan approval. */
export function docHref(docType: string, docId: string): string {
  switch (docType) {
    case "STOCK":
      return `/inventory/movements/${docId}`;
    case "COUNT":
      return `/inventory/counts/${docId}`;
    case "SCHEDULE_CHANGE":
      return `/maintenance/schedule-changes/${docId}`;
    default:
      return `/maintenance/work-orders/${docId}`;
  }
}
