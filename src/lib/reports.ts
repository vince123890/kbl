import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/session";
import { cleanQuery, one } from "@/lib/lookups";
import { fmtDate, fmtDateTime, fmtQty } from "@/lib/format";
import {
  COUNT_STATUS,
  DOC_TYPE,
  INCIDENT_STATUS,
  INCIDENT_TYPE,
  SCHEDULE_STATUS,
  STOCK_STATUS,
  STOCK_TYPE,
  WO_STATUS,
  WO_TYPE,
} from "@/lib/labels";

type Kind = "text" | "date" | "datetime" | "num" | "bool";
type LabelMap = Record<string, { label: string }>;

export interface ReportColumn {
  key: string;
  label: string;
  kind?: Kind;
  map?: LabelMap;
  /** jumlahkan seluruh baris terfilter (dihitung dari record, bukan rentang sel) */
  sum?: boolean;
}

export interface ReportFilter {
  name: string;
  label: string;
  /** kolom view yang difilter dengan eq */
  column: string;
  options?: { value: string; label: string }[];
}

export interface ReportDef {
  code: string;
  slug: string;
  view: string;
  title: string;
  description: string;
  group: "Stok" | "Perawatan" | "Anomali Jadwal" | "Emergensi" | "Approval";
  columns: ReportColumn[];
  /** kolom tanggal untuk filter periode; kosong = laporan posisi saat ini */
  dateCol?: string;
  /** kolom yang dicari lewat kotak pencarian */
  searchCols: string[];
  filters?: ReportFilter[];
  roles: string[];
}

const ALL_STOCK = ["WAREHOUSE", "SUPERVISOR", "DEPT_HEAD", "HQ_ADMIN", "SYS_ADMIN"];
const MAINT = ["MECHANIC", "SUPERVISOR", "DEPT_HEAD", "HQ_ADMIN", "SYS_ADMIN"];
const CENTRAL = ["SUPERVISOR", "DEPT_HEAD", "HQ_ADMIN", "SYS_ADMIN"];

const opts = (m: LabelMap) => Object.entries(m).map(([value, d]) => ({ value, label: d.label }));

export const REPORTS: ReportDef[] = [
  {
    code: "RPT-01", slug: "rpt-01", view: "rpt_01_mutasi", title: "Mutasi Sparepart", group: "Stok",
    description: "Seluruh baris mutasi: dokumen, tipe, sparepart, qty, kendaraan/WO, lokasi, status.",
    dateCol: "tgl", searchCols: ["doc_no", "sparepart", "kode", "kendaraan"], roles: ALL_STOCK,
    filters: [
      { name: "tipe", label: "Tipe", column: "tipe", options: opts(STOCK_TYPE) },
      { name: "status", label: "Status", column: "status", options: opts(STOCK_STATUS) },
    ],
    columns: [
      { key: "doc_no", label: "No. Dokumen" }, { key: "tgl", label: "Tanggal", kind: "date" },
      { key: "tipe", label: "Tipe", map: STOCK_TYPE }, { key: "status", label: "Status", map: STOCK_STATUS },
      { key: "kode", label: "Kode" }, { key: "sparepart", label: "Sparepart" },
      { key: "qty", label: "Qty", kind: "num" }, { key: "satuan", label: "Satuan" },
      { key: "kendaraan", label: "Kendaraan" }, { key: "wo_no", label: "No. WO" },
      { key: "dari", label: "Dari" }, { key: "ke", label: "Ke" },
    ],
  },
  {
    code: "RPT-02", slug: "rpt-02", view: "rpt_02_kartu_stok", title: "Kartu Stok", group: "Stok",
    description: "Pergerakan per sparepart dengan saldo berjalan (ledger).",
    dateCol: "tgl", searchCols: ["doc_no", "sparepart", "kode"], roles: ALL_STOCK,
    filters: [{ name: "tipe", label: "Tipe", column: "tipe", options: opts(STOCK_TYPE) }],
    columns: [
      { key: "waktu", label: "Waktu posting", kind: "datetime" }, { key: "doc_no", label: "No. Dokumen" },
      { key: "tipe", label: "Tipe", map: STOCK_TYPE }, { key: "kode", label: "Kode" }, { key: "sparepart", label: "Sparepart" },
      { key: "lokasi", label: "Lokasi" }, { key: "masuk", label: "Masuk (+)", kind: "num", sum: true },
      { key: "keluar", label: "Keluar (−)", kind: "num", sum: true }, { key: "saldo", label: "Saldo", kind: "num" },
    ],
  },
  {
    code: "RPT-03", slug: "rpt-03", view: "rpt_03_posisi_stok", title: "Posisi Stok & Stok Minimum", group: "Stok",
    description: "Saldo saat ini per sparepart dan lokasi, reservasi, ketersediaan, dan penanda di bawah minimum.",
    searchCols: ["kode", "sparepart"], roles: ALL_STOCK,
    filters: [
      { name: "kategori", label: "Kategori", column: "kategori" },
      { name: "di_bawah_min", label: "Di bawah minimum", column: "di_bawah_min", options: [{ value: "true", label: "Ya" }] },
    ],
    columns: [
      { key: "kode", label: "Kode" }, { key: "sparepart", label: "Sparepart" }, { key: "kategori", label: "Kategori" },
      { key: "lokasi", label: "Lokasi" }, { key: "on_hand", label: "On hand", kind: "num" },
      { key: "reservasi", label: "Reservasi", kind: "num" }, { key: "tersedia", label: "Tersedia", kind: "num" },
      { key: "stok_min", label: "Stok min", kind: "num" }, { key: "di_bawah_min", label: "Di bawah min", kind: "bool" },
    ],
  },
  {
    code: "RPT-04", slug: "rpt-04", view: "rpt_04_opname", title: "Hasil Stock Opname", group: "Stok",
    description: "Sistem vs fisik, selisih, alasan, dan status tiap sesi opname.",
    dateCol: "tgl", searchCols: ["count_no", "sparepart", "kode"], roles: ALL_STOCK,
    filters: [{ name: "status", label: "Status", column: "status", options: opts(COUNT_STATUS) }],
    columns: [
      { key: "tgl", label: "Tanggal", kind: "date" }, { key: "count_no", label: "No. Opname" }, { key: "lokasi", label: "Lokasi" },
      { key: "status", label: "Status", map: COUNT_STATUS }, { key: "kode", label: "Kode" }, { key: "sparepart", label: "Sparepart" },
      { key: "sistem", label: "Sistem", kind: "num" }, { key: "fisik", label: "Fisik", kind: "num" },
      { key: "selisih", label: "Selisih", kind: "num", sum: true }, { key: "alasan", label: "Alasan" }, { key: "keterangan", label: "Keterangan" },
    ],
  },
  {
    code: "RPT-05", slug: "rpt-05", view: "rpt_05_jadwal_realisasi", title: "Jadwal & Realisasi Perawatan", group: "Perawatan",
    description: "Rencana vs realisasi tiap WO beserta selisih jam mulai.",
    dateCol: "tgl", searchCols: ["wo_no", "kendaraan", "tugas"], roles: MAINT,
    filters: [
      { name: "jenis", label: "Jenis", column: "jenis", options: opts(WO_TYPE) },
      { name: "status", label: "Status", column: "status", options: opts(WO_STATUS) },
    ],
    columns: [
      { key: "wo_no", label: "No. WO" }, { key: "kendaraan", label: "Kendaraan" }, { key: "jenis", label: "Jenis", map: WO_TYPE },
      { key: "tugas", label: "Tugas" }, { key: "status", label: "Status", map: WO_STATUS },
      { key: "rencana_mulai", label: "Rencana mulai", kind: "datetime" }, { key: "realisasi_mulai", label: "Realisasi mulai", kind: "datetime" },
      { key: "realisasi_selesai", label: "Realisasi selesai", kind: "datetime" }, { key: "selisih_jam", label: "Selisih (jam)", kind: "num" },
    ],
  },
  {
    code: "RPT-06", slug: "rpt-06", view: "rpt_06_overdue", title: "Perawatan Overdue", group: "Perawatan",
    description: "WO yang melewati jatuh tempo dan belum dikerjakan.",
    dateCol: "tgl", searchCols: ["wo_no", "kendaraan", "tugas"], roles: MAINT,
    columns: [
      { key: "wo_no", label: "No. WO" }, { key: "kendaraan", label: "Kendaraan" }, { key: "tugas", label: "Tugas" },
      { key: "jatuh_tempo", label: "Jatuh tempo", kind: "datetime" }, { key: "hari_terlambat", label: "Hari terlambat", kind: "num" },
    ],
  },
  {
    code: "RPT-09", slug: "rpt-09", view: "rpt_09_riwayat_perawatan", title: "Riwayat Perawatan per Kendaraan", group: "Perawatan",
    description: "WO selesai beserta pekerjaan dan sparepart terpakai.",
    dateCol: "tgl", searchCols: ["wo_no", "kendaraan", "pekerjaan"], roles: MAINT,
    filters: [{ name: "jenis", label: "Jenis", column: "jenis", options: opts(WO_TYPE) }],
    columns: [
      { key: "tgl", label: "Tanggal", kind: "date" }, { key: "wo_no", label: "No. WO" }, { key: "kendaraan", label: "Kendaraan" },
      { key: "jenis", label: "Jenis", map: WO_TYPE }, { key: "pekerjaan", label: "Pekerjaan" }, { key: "part_terpakai", label: "Sparepart terpakai" }, { key: "catatan", label: "Catatan" },
    ],
  },
  {
    code: "RPT-10", slug: "rpt-10", view: "rpt_10_pemakaian_part", title: "Pemakaian Sparepart per Kendaraan", group: "Perawatan",
    description: "Sparepart yang keluar untuk tiap kendaraan.",
    dateCol: "tgl", searchCols: ["kendaraan", "sparepart", "kode", "doc_no"], roles: CENTRAL,
    columns: [
      { key: "tgl", label: "Tanggal", kind: "date" }, { key: "kendaraan", label: "Kendaraan" }, { key: "kode", label: "Kode" },
      { key: "sparepart", label: "Sparepart" }, { key: "qty", label: "Qty", kind: "num", sum: true }, { key: "satuan", label: "Satuan" },
      { key: "doc_no", label: "No. Dokumen" }, { key: "wo_no", label: "No. WO" },
    ],
  },
  {
    code: "RPT-07", slug: "rpt-07", view: "rpt_07_anomali", title: "Anomali Jadwal", group: "Anomali Jadwal",
    description: "Setiap percepatan dan penundaan beserta alasan, pengaju, dan keputusan.",
    dateCol: "tgl", searchCols: ["change_no", "wo_no", "kendaraan", "alasan"], roles: CENTRAL,
    filters: [
      { name: "tipe", label: "Tipe", column: "tipe", options: [{ value: "Percepatan", label: "Percepatan" }, { value: "Penundaan", label: "Penundaan" }] },
      { name: "keputusan", label: "Keputusan", column: "keputusan", options: opts(SCHEDULE_STATUS) },
    ],
    columns: [
      { key: "change_no", label: "No." }, { key: "wo_no", label: "No. WO" }, { key: "kendaraan", label: "Kendaraan" }, { key: "tipe", label: "Tipe" },
      { key: "jadwal_lama", label: "Jadwal lama", kind: "datetime" }, { key: "jadwal_baru", label: "Jadwal baru", kind: "datetime" },
      { key: "selisih_hari", label: "Selisih (hari)", kind: "num" }, { key: "alasan", label: "Alasan" }, { key: "keterangan", label: "Keterangan" },
      { key: "pengaju", label: "Pengaju" }, { key: "keputusan", label: "Keputusan", map: SCHEDULE_STATUS },
    ],
  },
  {
    code: "RPT-08", slug: "rpt-08", view: "rpt_08_rekap_alasan", title: "Rekap Alasan Anomali", group: "Anomali Jadwal",
    description: "Jumlah anomali per alasan dan bulan beserta rata-rata selisihnya.",
    dateCol: "tgl", searchCols: ["alasan"], roles: CENTRAL,
    columns: [
      { key: "tgl", label: "Bulan", kind: "date" }, { key: "alasan", label: "Alasan" }, { key: "jumlah", label: "Jumlah", kind: "num", sum: true },
      { key: "percepatan", label: "Percepatan", kind: "num", sum: true }, { key: "penundaan", label: "Penundaan", kind: "num", sum: true },
      { key: "rata_selisih_hari", label: "Rata-rata selisih (hari)", kind: "num" },
    ],
  },
  {
    code: "RPT-11", slug: "rpt-11", view: "rpt_11_insiden", title: "Insiden Emergensi", group: "Emergensi",
    description: "Insiden dengan waktu lapor, ACK, penyelesaian, dan penanganan. Laporan keliru tidak dihitung.",
    dateCol: "tgl", searchCols: ["incident_no", "kendaraan", "lokasi"], roles: CENTRAL,
    filters: [
      { name: "jenis", label: "Jenis", column: "jenis", options: opts(INCIDENT_TYPE) },
      { name: "status", label: "Status", column: "status", options: opts(INCIDENT_STATUS) },
    ],
    columns: [
      { key: "incident_no", label: "No. Insiden" }, { key: "kendaraan", label: "Kendaraan" }, { key: "jenis", label: "Jenis", map: INCIDENT_TYPE },
      { key: "lokasi", label: "Lokasi" }, { key: "status", label: "Status", map: INCIDENT_STATUS },
      { key: "waktu_lapor", label: "Waktu lapor", kind: "datetime" }, { key: "waktu_ack", label: "Waktu ACK", kind: "datetime" },
      { key: "waktu_selesai", label: "Waktu selesai", kind: "datetime" }, { key: "menit_ack", label: "Menit ke ACK", kind: "num" }, { key: "penanganan", label: "Penanganan" },
    ],
  },
  {
    code: "RPT-12", slug: "rpt-12", view: "rpt_12_waktu_respon", title: "Waktu Respon Emergensi", group: "Emergensi",
    description: "Rata-rata dan maksimum waktu ACK serta penyelesaian per bulan.",
    dateCol: "tgl", searchCols: [], roles: CENTRAL,
    columns: [
      { key: "tgl", label: "Bulan", kind: "date" }, { key: "jumlah", label: "Insiden", kind: "num", sum: true },
      { key: "rata_menit_ack", label: "Rata-rata ACK (menit)", kind: "num" }, { key: "maks_menit_ack", label: "Maks ACK (menit)", kind: "num" },
      { key: "rata_menit_selesai", label: "Rata-rata selesai (menit)", kind: "num" },
    ],
  },
  {
    code: "RPT-13", slug: "rpt-13", view: "rpt_13_kinerja_approval", title: "Kinerja Approval", group: "Approval",
    description: "Jumlah dokumen, rata-rata waktu proses, keterlambatan SLA, dan override per jenis.",
    dateCol: "tgl", searchCols: [], roles: ["DEPT_HEAD", "HQ_ADMIN", "SYS_ADMIN"],
    filters: [{ name: "jenis", label: "Jenis", column: "jenis", options: opts(DOC_TYPE) }],
    columns: [
      { key: "tgl", label: "Bulan", kind: "date" }, { key: "jenis", label: "Jenis", map: DOC_TYPE }, { key: "jumlah", label: "Jumlah", kind: "num", sum: true },
      { key: "rata_jam_proses", label: "Rata-rata proses (jam)", kind: "num" }, { key: "terlambat_sla", label: "Terlambat SLA", kind: "num", sum: true },
      { key: "override", label: "Override", kind: "num", sum: true },
    ],
  },
];

export function getReport(code: string): ReportDef | undefined {
  return REPORTS.find((r) => r.code.toLowerCase() === code.toLowerCase() || r.slug === code.toLowerCase());
}

const BUILTIN = new Set(["DRIVER", "MECHANIC", "WAREHOUSE", "SUPERVISOR", "DEPT_HEAD", "HQ_ADMIN", "SYS_ADMIN"]);

/** Pemakai boleh melihat laporan bila rolenya terdaftar; role buatan sendiri yang punya report.view melihat semuanya. */
export function canViewReport(user: CurrentUser, def: ReportDef): boolean {
  if (!user.permissions.includes("report.view")) return false;
  if (user.roles.some((r) => !BUILTIN.has(r))) return true;
  return user.roles.some((r) => def.roles.includes(r));
}

type Sp = Record<string, string | string[] | undefined>;

function applyFilters<T extends { eq: (c: string, v: unknown) => T; gte: (c: string, v: unknown) => T; lte: (c: string, v: unknown) => T; or: (f: string) => T }>(
  query: T,
  def: ReportDef,
  sp: Sp,
): T {
  let q = query;
  if (one(sp, "branch")) q = q.eq("branch_id", one(sp, "branch"));
  if (def.dateCol) {
    if (one(sp, "from")) q = q.gte(def.dateCol, one(sp, "from"));
    if (one(sp, "to")) q = q.lte(def.dateCol, one(sp, "to"));
  }
  for (const f of def.filters ?? []) {
    const v = one(sp, f.name);
    if (!v) continue;
    q = q.eq(f.column, f.options?.some((o) => o.value === "true") && v === "true" ? true : v);
  }
  if (one(sp, "sparepart") && def.view === "rpt_02_kartu_stok") q = q.eq("sparepart_id", one(sp, "sparepart"));
  if (one(sp, "location") && def.view === "rpt_03_posisi_stok") q = q.eq("location_id", one(sp, "location"));
  if (one(sp, "category") && def.view === "rpt_03_posisi_stok") q = q.eq("kategori", one(sp, "category"));
  if (one(sp, "low") === "1" && def.view === "rpt_03_posisi_stok") q = q.eq("di_bawah_min", true);
  const text = cleanQuery(one(sp, "q"));
  if (text && def.searchCols.length) q = q.or(def.searchCols.map((c) => `${c}.ilike.%${text}%`).join(","));
  return q;
}

export async function runReport(supabase: SupabaseClient, def: ReportDef, sp: Sp, range?: [number, number]) {
  let q = supabase.from(def.view).select("*", { count: "exact" });
  q = applyFilters(q, def, sp);
  const order = def.dateCol ?? def.columns[0].key;
  q = q.order(order, { ascending: !def.dateCol });
  if (range) q = q.range(range[0], range[1]);
  const { data, count, error } = await q;
  return { rows: (data ?? []) as Record<string, unknown>[], count: count ?? 0, error };
}

/** Jumlah per kolom bertanda sum, dihitung dari seluruh record terfilter (maks 50.000 baris). */
export async function reportTotals(supabase: SupabaseClient, def: ReportDef, sp: Sp): Promise<Record<string, number>> {
  const sumCols = def.columns.filter((c) => c.sum).map((c) => c.key);
  if (!sumCols.length) return {};
  let q = supabase.from(def.view).select(sumCols.join(","));
  q = applyFilters(q, def, sp).limit(50_000);
  const { data } = await q;
  const out: Record<string, number> = Object.fromEntries(sumCols.map((c) => [c, 0]));
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) for (const c of sumCols) out[c] += Number(row[c] ?? 0);
  return out;
}

/** Nilai sel sebagai teks tampilan. */
export function cellText(col: ReportColumn, v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  if (col.map) return col.map[String(v)]?.label ?? String(v);
  switch (col.kind) {
    case "date":
      return fmtDate(String(v));
    case "datetime":
      return fmtDateTime(String(v));
    case "num":
      return fmtQty(v as string | number);
    case "bool":
      return v ? "Ya" : "Tidak";
    default:
      return String(v);
  }
}

export const EXPORT_LIMIT = 50_000;
