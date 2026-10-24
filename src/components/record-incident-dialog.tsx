"use client";

import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/master-form-dialog";
import { TYPE_BUTTONS } from "@/lib/emergency-guide";
import { recordIncidentAction } from "@/app/(app)/emergency/actions";

const sel = "tap w-full rounded-lg border border-border bg-surface px-3 text-sm";

/** Pusat mencatat insiden atas laporan telepon pengemudi (field sama dengan laporan pengemudi). */
export function RecordIncidentDialog({ vehicles, drivers }: { vehicles: { id: string; plate: string }[]; drivers: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <FormDialog
      trigger="+ Catat Insiden"
      title="Catat insiden dari telepon"
      submitLabel="Catat insiden"
      action={recordIncidentAction as never}
      onSuccess={(s) => {
        const id = (s as { data?: { id: string } }).data?.id;
        if (id) router.push(`/emergency/incidents/${id}`);
      }}
    >
      {() => (
        <>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Kendaraan *</span>
            <select name="vehicle_id" required className={sel}>
              <option value="">— pilih —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Jenis kejadian *</span>
            <select name="type" required className={sel}>
              {TYPE_BUTTONS.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Pengemudi yang menelepon</span>
            <select name="driver_id" className={sel}>
              <option value="">— tidak diketahui —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Lokasi (alamat / patokan)</span>
            <input name="address" className={sel} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Jumlah korban</span>
            <input name="casualties" inputMode="numeric" className={sel} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Keterangan</span>
            <textarea name="description" rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          </label>
        </>
      )}
    </FormDialog>
  );
}
