import Link from "next/link";

export const metadata = { title: "Akses ditolak" };

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Akses ditolak</h1>
      <p className="mt-2 text-sm text-muted">Anda tidak memiliki izin untuk membuka halaman ini.</p>
      <Link href="/" className="tap mt-5 inline-flex items-center rounded-lg bg-brand px-4 text-sm font-medium text-white">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
