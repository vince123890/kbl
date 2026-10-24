"use client";

export function PrintButton({ label = "Cetak" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="tap rounded-lg border border-border px-4 text-sm hover:bg-brand-soft print:hidden">
      {label}
    </button>
  );
}
