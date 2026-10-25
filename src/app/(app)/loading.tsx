// Tampil seketika saat berpindah halaman (menu tetap di tempat) sementara data halaman tujuan dimuat,
// sehingga aplikasi terasa responsif walau server atau database berjarak jauh.
export default function Loading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="animate-pulse space-y-4">
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-border" />
        <div className="h-4 w-72 max-w-full rounded bg-border/70" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <div className="h-11 rounded-lg bg-border/70 sm:w-64" />
        <div className="h-11 rounded-lg bg-border/70 sm:w-36" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
