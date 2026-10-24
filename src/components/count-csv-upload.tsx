"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/form";
import { uploadCountCsvAction } from "@/app/(app)/inventory/actions";

export function CountCsvUpload({ countId }: { countId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadCountCsvAction.bind(null, countId), null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <a href={`/inventory/counts/${countId}/template`} className="tap inline-flex items-center rounded-lg border border-border px-4 hover:bg-brand-soft">
        Unduh template CSV
      </a>
      <input type="file" name="file" accept=".csv,text/csv" className="max-w-full file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2" />
      <button disabled={pending} className="tap rounded-lg border border-border px-4 hover:bg-brand-soft disabled:opacity-60">
        {pending ? "Memproses…" : "Unggah hasil hitung"}
      </button>
      {state && <Alert result={state} />}
    </form>
  );
}
