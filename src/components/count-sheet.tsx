"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enterCountAction, type CountLineInput } from "@/app/(app)/inventory/actions";
import { fmtQty } from "@/lib/format";

export interface CountLineView {
  sparepart_id: string;
  code: string;
  name: string;
  uom: string;
  system_qty: string;
  counted_qty: string | null;
  not_counted: boolean;
  reason_code_id: string | null;
  reason_note: string | null;
}

interface RowState {
  counted: string;
  notCounted: boolean;
  reason: string;
  note: string;
  saved: "idle" | "saving" | "ok" | "error";
  error?: string;
}

const field = "tap rounded-lg border border-border bg-surface px-2 text-sm outline-none focus:ring-2 focus:ring-brand";

/** Lembar hitung opname. Setiap baris disimpan otomatis saat fokus berpindah (cocok dipakai dari ponsel di rak). */
export function CountSheet({
  countId,
  lines,
  reasons,
  editable,
}: {
  countId: string;
  lines: CountLineView[];
  reasons: { id: string; name: string; require_note: boolean }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [filter, setFilter] = useState<"all" | "todo" | "diff">("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.sparepart_id,
        {
          counted: l.counted_qty === null ? "" : String(Number(l.counted_qty)),
          notCounted: l.not_counted,
          reason: l.reason_code_id ?? "",
          note: l.reason_note ?? "",
          saved: "idle" as const,
        },
      ]),
    ),
  );

  const diffOf = (l: CountLineView, r: RowState): number | null => {
    if (r.notCounted || r.counted.trim() === "") return null;
    const n = Number(r.counted.replace(",", "."));
    return Number.isFinite(n) ? n - Number(l.system_qty) : null;
  };

  const done = lines.filter((l) => {
    const r = rows[l.sparepart_id];
    return r.notCounted || r.counted.trim() !== "";
  }).length;

  const visible = useMemo(
    () =>
      lines.filter((l) => {
        const r = rows[l.sparepart_id];
        const d = diffOf(l, r);
        if (filter === "todo" && (r.notCounted || r.counted.trim() !== "")) return false;
        if (filter === "diff" && !(d !== null && d !== 0)) return false;
        if (search && !`${l.code} ${l.name}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [lines, rows, filter, search],
  );

  const patch = (id: string, p: Partial<RowState>) => setRows((s) => ({ ...s, [id]: { ...s[id], ...p } }));

  const save = (l: CountLineView, override: Partial<RowState> = {}) => {
    const r = { ...rows[l.sparepart_id], ...override };
    const payload: CountLineInput = {
      sparepart_id: l.sparepart_id,
      counted_qty: r.notCounted ? undefined : r.counted,
      not_counted: r.notCounted,
      reason_code_id: r.reason || undefined,
      reason_note: r.note || undefined,
    };
    patch(l.sparepart_id, { ...override, saved: "saving" });
    start(async () => {
      const res = await enterCountAction(countId, [payload]);
      patch(l.sparepart_id, res.ok ? { saved: "ok", error: undefined } : { saved: "error", error: res.error });
      if (res.ok) router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kode atau nama…"
          aria-label="Cari item"
          className={`${field} w-full sm:w-60`}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter" className={field}>
          <option value="all">Semua item</option>
          <option value="todo">Belum dihitung</option>
          <option value="diff">Berselisih</option>
        </select>
        <span className="text-muted">
          Progres: <b>{done}</b>/{lines.length} terhitung
        </span>
      </div>
      <div className="table-cards-wrap overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="table-cards w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Sparepart</th>
              <th className="px-3 py-2 font-medium">Sistem</th>
              <th className="px-3 py-2 font-medium">Fisik</th>
              <th className="px-3 py-2 font-medium">Selisih</th>
              <th className="px-3 py-2 font-medium">Alasan</th>
              <th className="px-3 py-2 font-medium">Keterangan</th>
              <th className="px-3 py-2 font-medium">Tidak dihitung</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => {
              const r = rows[l.sparepart_id];
              const d = diffOf(l, r);
              const needReason = (d !== null && d !== 0) || r.notCounted;
              return (
                <tr key={l.sparepart_id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 align-top">
                    {l.name}
                    <span className="block text-xs text-muted">{l.code}</span>
                  </td>
                  <td className="px-3 py-2 align-top tabular-nums">
                    {fmtQty(l.system_qty)} <span className="text-xs text-muted">{l.uom}</span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {editable ? (
                      <input
                        inputMode="decimal"
                        aria-label={`Qty fisik ${l.name}`}
                        value={r.counted}
                        disabled={r.notCounted}
                        onChange={(e) => patch(l.sparepart_id, { counted: e.target.value })}
                        onBlur={() => save(l)}
                        className={`${field} w-24`}
                      />
                    ) : (
                      <span className="tabular-nums">{r.notCounted ? "-" : r.counted || "-"}</span>
                    )}
                    {r.saved === "saving" && <span className="ml-1 text-xs text-muted">menyimpan…</span>}
                    {r.saved === "ok" && <span className="ml-1 text-xs text-muted">✓</span>}
                    {r.saved === "error" && <span className="block text-xs text-danger">{r.error}</span>}
                  </td>
                  <td className={`px-3 py-2 align-top tabular-nums ${d ? (d < 0 ? "text-danger" : "font-medium") : "text-muted"}`}>
                    {d === null ? "—" : d > 0 ? `+${fmtQty(d)}` : fmtQty(d)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {editable ? (
                      <select
                        aria-label={`Alasan ${l.name}`}
                        value={r.reason}
                        disabled={!needReason}
                        onChange={(e) => {
                          patch(l.sparepart_id, { reason: e.target.value });
                          save(l, { reason: e.target.value });
                        }}
                        className={`${field} w-44`}
                      >
                        <option value="">{needReason ? "— pilih alasan —" : ""}</option>
                        {reasons.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      (reasons.find((x) => x.id === r.reason)?.name ?? "-")
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {editable ? (
                      <input
                        aria-label={`Keterangan ${l.name}`}
                        value={r.note}
                        disabled={!needReason}
                        onChange={(e) => patch(l.sparepart_id, { note: e.target.value })}
                        onBlur={() => needReason && save(l)}
                        className={`${field} w-44`}
                      />
                    ) : (
                      r.note || "-"
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {editable ? (
                      <input
                        type="checkbox"
                        aria-label={`Tidak dihitung ${l.name}`}
                        checked={r.notCounted}
                        onChange={(e) => save(l, { notCounted: e.target.checked, counted: e.target.checked ? "" : r.counted })}
                        className="h-5 w-5"
                      />
                    ) : (
                      r.notCounted && "Ya"
                    )}
                  </td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted">
                  Tidak ada item untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {reasons.some((x) => x.require_note) && editable && <p className="mt-2 text-xs text-muted">Alasan tertentu (mis. “Lainnya”) wajib disertai keterangan.</p>}
    </div>
  );
}
