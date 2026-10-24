export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Tidak ada koneksi</h1>
      <p className="text-muted">Periksa jaringan Anda lalu coba lagi. Halaman yang memerlukan data terbaru tidak tersedia saat offline.</p>
      {/* tautan biasa (bukan <Link>) agar memuat ulang penuh saat koneksi pulih */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="tap inline-flex items-center rounded-lg bg-brand px-4 font-medium text-white">
        Coba lagi
      </a>
    </main>
  );
}
