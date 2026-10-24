// Format tampilan: tanggal/waktu disimpan UTC di basis data, ditampilkan WIB (zona satu-satunya saat ini).
const TZ = "Asia/Jakarta";

const dateFmt = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const numFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? dateFmt.format(d) : "-";
}

export function fmtDateTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? `${dateFmt.format(d)} ${timeFmt.format(d).replace(".", ":")}` : "-";
}

export function fmtTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? timeFmt.format(d).replace(".", ":") : "-";
}

/** Qty dari basis data (string desimal) menjadi teks id-ID tanpa nol yang tidak perlu. */
export function fmtQty(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  return Number.isFinite(n) ? numFmt.format(n) : String(v);
}

/** Selisih waktu manusiawi: "5 mnt", "3 jam", "2 hari". */
export function fmtAge(from: string | Date | null | undefined, to: Date = new Date()): string {
  const d = toDate(from);
  if (!d) return "-";
  const min = Math.max(0, Math.floor((to.getTime() - d.getTime()) / 60000));
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} mnt`;
  if (min < 60 * 48) return `${Math.floor(min / 60)} jam`;
  return `${Math.floor(min / 1440)} hari`;
}

/** Nilai input datetime-local (WIB) dari timestamp. */
export function toLocalInput(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "";
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return p.replace(" ", "T");
}

/** Input datetime-local (dianggap WIB) menjadi ISO UTC; kosong menjadi null. */
export function fromLocalInput(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(`${v}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Tanggal hari ini (WIB) sebagai yyyy-mm-dd. */
export function todayWib(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
}
