// Cache langkah cepat dan kontak darurat di localStorage agar tetap tampil tanpa sinyal (halaman /offline).
export interface Guide {
  userId: string | null;
  centerPhone: string | null;
  playbooks: Record<string, { title: string; steps: string[] }>;
  contacts: { role_label: string; name: string; phone: string }[];
  vehicles: { id: string; plate: string }[];
  savedAt: string;
}

export const GUIDE_KEY = "kbl-emergency-guide";
const KEY = GUIDE_KEY;

export function saveGuide(g: Guide): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    /* penyimpanan lokal tidak tersedia */
  }
}

/** Teks mentah cache panduan (untuk useSyncExternalStore). */
export function readGuideRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function parseGuide(raw: string | null): Guide | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Guide;
  } catch {
    return null;
  }
}

/** Langganan perubahan penyimpanan (tab lain). Perubahan di tab yang sama tidak memicu; tidak diperlukan di sini. */
export function subscribeStorage(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

export function loadGuide(): Guide | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Guide) : null;
  } catch {
    return null;
  }
}

export const TYPE_BUTTONS = [
  { type: "BREAKDOWN", label: "Mogok", icon: "🔧" },
  { type: "ACCIDENT", label: "Kecelakaan", icon: "💥" },
  { type: "TIRE", label: "Ban", icon: "🛞" },
  { type: "FIRE", label: "Kebakaran", icon: "🔥" },
  { type: "MEDICAL", label: "Medis", icon: "🩺" },
  { type: "OTHER", label: "Lainnya", icon: "❓" },
] as const;
