import { OfflineHub } from "@/components/offline-hub";

export const metadata = { title: "Mode offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center gap-6 px-4 py-8">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Mode offline</h1>
        <p className="text-sm text-muted">Data kerja Anda disalin ke perangkat ini saat online. Hasil kerja offline disinkronkan otomatis.</p>
      </div>
      <OfflineHub />
    </main>
  );
}
