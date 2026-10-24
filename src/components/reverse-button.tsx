"use client";

import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { reverseMovementAction } from "@/app/(app)/inventory/actions";

/** Membuat dokumen pembalik lalu membuka drafnya. */
export function ReverseButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ActionButton
      label="Buat pembalik"
      confirm="Buat dokumen pembalik berisi baris berlawanan? Dokumen asal tidak diubah; pembalik harus melewati approval."
      action={() => reverseMovementAction(id)}
      onDone={(r) => {
        if (r.ok && typeof r.data === "string") router.push(`/inventory/movements/${r.data}`);
      }}
    />
  );
}
