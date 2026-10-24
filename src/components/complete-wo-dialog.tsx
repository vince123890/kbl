"use client";

import { FormDialog } from "@/components/master-form-dialog";
import { TextField } from "@/components/form";
import { completeWoAction } from "@/app/(app)/maintenance/actions";

export function CompleteWoDialog({ woId, currentOdometer }: { woId: string; currentOdometer: number }) {
  return (
    <FormDialog trigger="Selesaikan" title="Selesaikan Work Order" action={completeWoAction.bind(null, woId) as never} submitLabel="Selesaikan WO">
      {(state) => (
        <>
          <TextField
            name="odometer"
            label="Odometer akhir (km)"
            defaultValue={currentOdometer}
            help={`Tidak boleh lebih kecil dari ${currentOdometer.toLocaleString("id-ID")} km. Dipakai menghitung jatuh tempo berikutnya.`}
            error={state && !state.ok ? state.fieldErrors?.odometer : undefined}
          />
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Catatan pekerjaan</span>
            <textarea name="note" rows={3} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          </label>
        </>
      )}
    </FormDialog>
  );
}
