// Aritmetika tanggal kalender (yyyy-mm-dd, minggu mulai Senin). Semua dalam UTC agar tidak terpengaruh zona waktu server.
export type CalView = "month" | "week" | "day" | "agenda";

export const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function parse(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
}

export function startOfWeek(d: string): string {
  const x = parse(d);
  const dow = (x.getUTCDay() + 6) % 7; // Senin = 0
  return addDays(d, -dow);
}

export function addMonths(d: string, n: number): string {
  const x = parse(d);
  const day = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + n);
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, last));
  return fmt(x);
}

export function monthLabel(d: string): string {
  const x = parse(d);
  return `${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}

export function dayLabel(d: string): string {
  const x = parse(d);
  return `${DAY_NAMES[(x.getUTCDay() + 6) % 7]}, ${x.getUTCDate()} ${MONTHS[x.getUTCMonth()].slice(0, 3)} ${x.getUTCFullYear()}`;
}

/** Rentang tanggal yang ditampilkan: [from, to) dan daftar hari untuk grid. */
export function visibleRange(view: CalView, date: string): { from: string; to: string; days: string[] } {
  if (view === "day") return { from: date, to: addDays(date, 1), days: [date] };
  if (view === "agenda") return { from: date, to: addDays(date, 31), days: Array.from({ length: 31 }, (_, i) => addDays(date, i)) };
  if (view === "week") {
    const from = startOfWeek(date);
    return { from, to: addDays(from, 7), days: Array.from({ length: 7 }, (_, i) => addDays(from, i)) };
  }
  const first = date.slice(0, 8) + "01";
  const from = startOfWeek(first);
  const lastOfMonth = fmt(new Date(Date.UTC(parse(first).getUTCFullYear(), parse(first).getUTCMonth() + 1, 0)));
  const to = addDays(startOfWeek(lastOfMonth), 7);
  const n = Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
  return { from, to, days: Array.from({ length: n }, (_, i) => addDays(from, i)) };
}

export function shift(view: CalView, date: string, dir: 1 | -1): string {
  if (view === "month") return addMonths(date, dir);
  if (view === "week") return addDays(date, 7 * dir);
  if (view === "day") return addDays(date, dir);
  return addDays(date, 30 * dir);
}
