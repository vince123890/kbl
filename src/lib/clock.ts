/** Waktu sekarang (ms). Dibungkus agar halaman server dapat memakainya tanpa memicu aturan "impure render". */
export function nowMs(): number {
  return Date.now();
}
