"use client";

import { useId, useMemo, useState } from "react";

export interface SearchOpt {
  id: string;
  label: string;
}

const MAX_SHOWN = 80;

/**
 * Pilihan dengan pencarian: ketik sebagian kata (mis. "rem") dan daftar langsung menyempit.
 * Setiap kata yang diketik harus ada pada label, urutan bebas ("rem depan" = "Kampas Rem Depan").
 * Panah atas/bawah memilih, Enter mengambil, Esc menutup. Dipakai untuk daftar yang panjang seperti sparepart.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "Ketik untuk mencari…",
  className,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  options: SearchOpt[];
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState<string | null>(null); // null = tidak sedang mengetik
  const [active, setActive] = useState(0);
  const open = query !== null;

  const selected = useMemo(() => options.find((o) => o.id === value), [options, value]);
  const matches = useMemo(() => {
    const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return options.filter((o) => {
      const l = o.label.toLowerCase();
      return words.every((w) => l.includes(w));
    });
  }, [options, query]);

  const shown = matches.slice(0, MAX_SHOWN);
  const cursor = Math.min(active, Math.max(shown.length - 1, 0));

  function choose(o: SearchOpt) {
    onChange(o.id);
    setQuery(null);
  }

  function move(next: number) {
    const i = Math.max(0, Math.min(next, shown.length - 1));
    setActive(i);
    requestAnimationFrame(() => document.getElementById(`${listId}-${i}`)?.scrollIntoView({ block: "nearest" }));
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown.length ? `${listId}-${cursor}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={selected ? undefined : placeholder}
        value={open ? query : (selected?.label ?? "")}
        className={className}
        onFocus={(e) => {
          setQuery("");
          setActive(0);
          e.currentTarget.select();
        }}
        onBlur={() => setQuery(null)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) setQuery("");
            else move(cursor + 1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(cursor - 1);
          } else if (e.key === "Enter" && open) {
            e.preventDefault(); // jangan mengirim form
            if (shown[cursor]) choose(shown[cursor]);
          } else if (e.key === "Escape" && open) {
            e.preventDefault();
            setQuery(null);
          }
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-surface py-1 text-sm shadow-lg"
        >
          {shown.length === 0 && <li className="px-3 py-2 text-muted">Tidak ada yang cocok dengan “{query}”.</li>}
          {shown.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.id === value}
              // mousedown (bukan click) agar terjadi sebelum input kehilangan fokus
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseMove={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 ${i === cursor ? "bg-brand-soft" : ""} ${o.id === value ? "font-medium" : ""}`}
            >
              {o.label}
            </li>
          ))}
          {matches.length > shown.length && <li className="px-3 py-2 text-xs text-muted">+{matches.length - shown.length} lainnya. Ketik lebih spesifik untuk mempersempit.</li>}
        </ul>
      )}
    </div>
  );
}
