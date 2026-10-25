// Logika murni antrean sinkron (tanpa IndexedDB) agar dapat diuji. Dipakai oleh src/lib/outbox.ts.

export type OutboxKind = "WO_START" | "WO_COMPLETE" | "COUNT_LINE" | "ATTACHMENT";

export interface OutboxItem {
  /** kunci unik; item yang sama ditimpa (mis. hitung ulang baris opname yang sama) */
  key: string;
  userId: string;
  kind: OutboxKind;
  /** id WO atau id sesi opname */
  ref: string;
  payload: Record<string, unknown>;
  /** hanya untuk ATTACHMENT */
  blob?: Blob;
  fileName?: string;
  createdAt: string;
  attempts: number;
  state: "PENDING" | "CONFLICT";
  error?: string;
}

export function outboxKey(kind: OutboxKind, userId: string, ref: string, extra = ""): string {
  return [userId, kind.toLowerCase(), ref, extra].filter(Boolean).join(":");
}

export type Batch =
  | { type: "COUNT"; countId: string; items: OutboxItem[] }
  | { type: "SINGLE"; item: OutboxItem };

const ORDER: Record<OutboxKind, number> = { WO_START: 0, WO_COMPLETE: 1, COUNT_LINE: 2, ATTACHMENT: 3 };

/** Item PENDING milik user, dikelompokkan: baris opname satu sesi menjadi satu panggilan; WO mulai sebelum selesai; foto terakhir. */
export function planBatches(items: OutboxItem[], userId: string): Batch[] {
  const mine = items.filter((i) => i.userId === userId && i.state === "PENDING").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const counts = new Map<string, OutboxItem[]>();
  const singles: OutboxItem[] = [];
  for (const i of mine) {
    if (i.kind === "COUNT_LINE") counts.set(i.ref, [...(counts.get(i.ref) ?? []), i]);
    else singles.push(i);
  }
  singles.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.createdAt.localeCompare(b.createdAt));
  const out: Batch[] = singles.filter((i) => i.kind !== "ATTACHMENT").map((item) => ({ type: "SINGLE", item }));
  for (const [countId, list] of counts) out.push({ type: "COUNT", countId, items: list });
  for (const item of singles.filter((i) => i.kind === "ATTACHMENT")) out.push({ type: "SINGLE", item });
  return out;
}

export type Outcome = "DONE" | "RETRY" | "AUTH" | "CONFLICT";

/**
 * Menentukan nasib item setelah server menjawab.
 * - ok → DONE
 * - sesi habis → AUTH (tahan, coba lagi setelah login)
 * - galat aturan bisnis → CONFLICT (tampil ke user, tidak diulang otomatis)
 * - status sudah sesuai tujuan (mis. WO sudah berjalan karena percobaan sebelumnya berhasil) → DONE
 */
export function classify(kind: OutboxKind, res: { ok: true } | { ok: false; error: string }): Outcome {
  if (res.ok) return "DONE";
  if (/Sesi berakhir|login kembali/i.test(res.error)) return "AUTH";
  if (kind === "WO_START" && /saat ini (IN_PROGRESS|COMPLETED)/.test(res.error)) return "DONE";
  if (kind === "WO_COMPLETE" && /saat ini COMPLETED/.test(res.error)) return "DONE";
  if (kind === "ATTACHMENT" && /sudah tersimpan|duplicate|unique/i.test(res.error)) return "DONE";
  return "CONFLICT";
}

/** Status WO setelah mempertimbangkan aksi yang masih menunggu sinkron (tampilan optimistis di hub offline). */
export function effectiveWoStatus(status: string, pending: OutboxItem[], woId: string): { status: string; pending: boolean } {
  const mine = pending.filter((i) => i.ref === woId && (i.kind === "WO_START" || i.kind === "WO_COMPLETE") && i.state === "PENDING");
  if (mine.some((i) => i.kind === "WO_COMPLETE")) return { status: "COMPLETED", pending: true };
  if (mine.some((i) => i.kind === "WO_START")) return { status: "IN_PROGRESS", pending: true };
  return { status, pending: false };
}
