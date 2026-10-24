"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Mengubah query string URL (filter tersimpan di URL; halaman kembali ke 1). */
function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return {
    params,
    set(updates: Record<string, string | null>) {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
  };
}

export function SearchBox({ placeholder = "Cari…" }: { placeholder?: string }) {
  const { params, set } = useUrlParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => set({ q: value.trim() || null }), 300); // debounce 300 ms
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      aria-label="Pencarian"
      className="tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-brand sm:w-64"
    />
  );
}

export function FilterSelect({
  name,
  label,
  options,
  allLabel = "Semua",
  defaultValue = "",
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  defaultValue?: string;
}) {
  const { params, set } = useUrlParams();
  return (
    <select
      aria-label={label}
      value={params.get(name) ?? defaultValue}
      onChange={(e) => set({ [name]: e.target.value || null })}
      className="tap rounded-lg border border-border bg-surface px-2 text-sm"
    >
      <option value="">{allLabel} {label.toLowerCase()}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
