"use client";

import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/master-form-dialog";
import { openCountAction } from "@/app/(app)/inventory/actions";

export function OpenCountButton({ locations, categories }: { locations: { id: string; name: string }[]; categories: string[] }) {
  const router = useRouter();
  const sel = "tap w-full rounded-lg border border-border bg-surface px-3 text-sm";
  return (
    <FormDialog
      trigger="+ Buka Sesi Opname"
      title="Buka sesi stock opname"
      submitLabel="Buka sesi"
      action={openCountAction as never}
      onSuccess={(s) => {
        const id = (s as { data?: { id: string } }).data?.id;
        if (id) router.push(`/inventory/counts/${id}`);
      }}
    >
      {() => (
        <>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Lokasi *</span>
            <select name="location_id" required className={sel}>
              <option value="">— pilih lokasi —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tipe *</span>
            <select name="type" className={sel} defaultValue="PERIODIC">
              <option value="PERIODIC">Berkala</option>
              <option value="AD_HOC">Ad-hoc</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Kategori (opsional)</span>
            <select name="category" className={sel}>
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Catatan</span>
            <textarea name="notes" rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          </label>
          <p className="text-xs text-muted">Sistem mengambil snapshot stok saat sesi dibuka. Selama sesi berjalan, mutasi di lokasi ini ditahan (mode pembekuan).</p>
        </>
      )}
    </FormDialog>
  );
}
