import { OfflineEmergency } from "@/components/offline-emergency";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center gap-6 px-4 py-10 text-center">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Tidak ada koneksi</h1>
        <p className="text-muted">Periksa jaringan Anda lalu coba lagi. Halaman yang memerlukan data terbaru tidak tersedia saat offline.</p>
        {/* tautan biasa (bukan <Link>) agar memuat ulang penuh saat koneksi pulih */}
        <a href="/dashboard" className="tap inline-flex items-center rounded-lg bg-brand px-4 font-medium text-on-brand">
          Coba lagi
        </a>
      </div>
      <OfflineEmergency />
    </main>
  );
}
