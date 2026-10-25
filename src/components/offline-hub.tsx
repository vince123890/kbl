"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { OfflineEmergency } from "@/components/offline-emergency";
import { useOutbox, type OutboxState } from "@/components/outbox-sync";
import { effectiveWoStatus, enqueue, listSnapshots, removeOutbox, saveSnapshot, type OutboxItem } from "@/lib/outbox";
import { OFFLINE_USER_KEY, type CountSnap, type WoSnap } from "@/lib/offline-types";
import { PRIORITY, WO_STATUS, WO_TYPE } from "@/lib/labels";

const btn = "tap rounded-lg border border-border px-4 text-sm font-medium hover:bg-brand-soft disabled:opacity-60";
const primary = "tap rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-strong disabled:opacity-60";
const field = "tap w-full rounded-lg border border-border bg-surface px-3 text-base";

const subscribeStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const subscribeNet = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

function useSnapshots<T>(userId: string, kind: "wo" | "count") {
  const [list, setList] = useState<T[] | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    void listSnapshots<T>(userId, kind).then((l) => alive && setList(l.map((x) => x.data)));
    return () => {
      alive = false;
    };
  }, [userId, kind, version]);
  return { list, reload: () => setVersion((v) => v + 1) };
}

/** Mengecilkan foto dari kamera (maks 1600px, JPEG) agar muat di penyimpanan lokal dan cepat terkirim. */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.8));
    return blob ?? file;
  } catch {
    return file;
  }
}

const KIND_LABEL: Record<string, string> = { WO_START: "Mulai WO", WO_COMPLETE: "Selesaikan WO", COUNT_LINE: "Hasil hitung opname", ATTACHMENT: "Foto" };

// ---------------------------------------------------------------- WO
function WoCard({ wo, userId, outbox, open, onChanged }: { wo: WoSnap; userId: string; outbox: OutboxState; open: boolean; onChanged: () => void }) {
  const eff = effectiveWoStatus(wo.status, outbox.items, wo.id);
  const [odo, setOdo] = useState(String(wo.odometer));
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const update = (patch: Partial<WoSnap>) => saveSnapshot(userId, "wo", wo.id, { ...wo, ...patch }).then(onChanged);

  const start = async () => {
    await enqueue("WO_START", userId, wo.id, {});
    await update({ status: "IN_PROGRESS" });
  };
  const complete = async () => {
    const n = odo.trim() === "" ? null : Number(odo.replace(",", "."));
    if (n !== null && (!Number.isFinite(n) || n < wo.odometer)) return setMsg(`Odometer akhir tidak boleh lebih kecil dari ${wo.odometer.toLocaleString("id-ID")} km`);
    setMsg(null);
    await enqueue("WO_COMPLETE", userId, wo.id, { odometer: n, note: note.trim() || null });
    await update({ status: "COMPLETED" });
  };
  const photo = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMsg("Pilih berkas gambar");
    const blob = await compress(file);
    if (blob.size > 5 * 1024 * 1024) return setMsg("Foto terlalu besar (maksimal 5 MB)");
    await enqueue("ATTACHMENT", userId, wo.id, { entity: "WORK_ORDER" }, { blob, fileName: `foto-${Date.now()}.jpg` });
    setMsg("Foto disimpan di perangkat dan akan diunggah saat ada sinyal");
  };

  return (
    <details open={open} className="rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-3">
        <span>
          <b>{wo.wo_no}</b> · {wo.plate}
          <span className="block text-xs text-muted">
            {WO_TYPE[wo.type]?.label} · {PRIORITY[wo.priority]?.label}
            {wo.scheduled_start ? ` · ${new Date(wo.scheduled_start).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}` : ""}
          </span>
        </span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium">
          {WO_STATUS[eff.status]?.label ?? eff.status}
          {eff.pending && " · menunggu sinkron"}
        </span>
      </summary>
      <div className="space-y-3 border-t border-border p-3 text-sm">
        {wo.description && <p>{wo.description}</p>}
        {wo.vendor && <p className="text-muted">Bengkel: {wo.vendor}</p>}
        {wo.parts.length > 0 && (
          <div>
            <p className="mb-1 font-medium">Sparepart</p>
            <ul className="space-y-0.5">
              {wo.parts.map((p) => (
                <li key={p.code}>
                  {p.name} · rencana {Number(p.qty_planned)} {p.uom} · terpakai {Number(p.qty_used)}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted">Pemakaian sparepart dicatat lewat mutasi Keluar saat online.</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {eff.status === "SCHEDULED" && !eff.pending && (
            <button type="button" className={primary} onClick={() => void start()}>
              Mulai
            </button>
          )}
          <label className={`${btn} inline-flex cursor-pointer items-center`}>
            Tambah foto
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void photo(e.target.files?.[0])} />
          </label>
        </div>

        {eff.status === "IN_PROGRESS" && (
          <div className="space-y-2 rounded-lg bg-background p-3">
            <p className="font-medium">Selesaikan pekerjaan</p>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Odometer akhir (km)</span>
              <input value={odo} onChange={(e) => setOdo(e.target.value)} inputMode="decimal" className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Catatan pekerjaan</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${field} py-2`} />
            </label>
            <button type="button" className={primary} onClick={() => void complete()}>
              Selesaikan WO
            </button>
          </div>
        )}
        {msg && (
          <p role="status" className="rounded-lg bg-warn-soft px-3 py-2">
            {msg}
          </p>
        )}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- opname
interface Edit {
  counted: string;
  notCounted: boolean;
  reason: string;
  note: string;
}

function CountCard({ count, userId, outbox, open, onChanged }: { count: CountSnap; userId: string; outbox: OutboxState; open: boolean; onChanged: () => void }) {
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const pending = new Map<string, Record<string, unknown>>();
  for (const i of outbox.items) if (i.kind === "COUNT_LINE" && i.ref === count.id && i.state === "PENDING") pending.set(String(i.payload.sparepart_id), i.payload);

  const value = (l: CountSnap["lines"][number]): Edit => {
    const e = edits[l.sparepart_id];
    if (e) return e;
    const p = pending.get(l.sparepart_id);
    if (p) return { counted: String(p.counted_qty ?? ""), notCounted: !!p.not_counted, reason: String(p.reason_code_id ?? ""), note: String(p.reason_note ?? "") };
    return { counted: l.counted_qty === null ? "" : String(Number(l.counted_qty)), notCounted: l.not_counted, reason: l.reason_code_id ?? "", note: l.reason_note ?? "" };
  };

  const save = async (l: CountSnap["lines"][number], next: Edit) => {
    setEdits((s) => ({ ...s, [l.sparepart_id]: next }));
    const payload = {
      sparepart_id: l.sparepart_id,
      counted_qty: next.notCounted || next.counted.trim() === "" ? undefined : next.counted.trim(),
      not_counted: next.notCounted,
      reason_code_id: next.reason || undefined,
      reason_note: next.note || undefined,
    };
    await enqueue("COUNT_LINE", userId, count.id, payload, { extra: l.sparepart_id });
    const lines = count.lines.map((x) =>
      x.sparepart_id === l.sparepart_id
        ? { ...x, counted_qty: payload.counted_qty ?? null, not_counted: next.notCounted, reason_code_id: payload.reason_code_id ?? null, reason_note: payload.reason_note ?? null }
        : x,
    );
    await saveSnapshot(userId, "count", count.id, { ...count, lines });
    setEdits((s) => {
      const { [l.sparepart_id]: _gone, ...rest } = s;
      void _gone;
      return rest;
    });
    onChanged();
  };

  const done = count.lines.filter((l) => {
    const v = value(l);
    return v.notCounted || v.counted.trim() !== "";
  }).length;

  return (
    <details open={open} className="rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-3">
        <span>
          <b>{count.count_no}</b> · {count.location}
          <span className="block text-xs text-muted">Opname · {count.lines.length} item</span>
        </span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium">
          {done}/{count.lines.length} terhitung
        </span>
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {count.lines.map((l) => {
          const v = value(l);
          const diff = v.notCounted || v.counted.trim() === "" ? null : Number(v.counted.replace(",", ".")) - Number(l.system_qty);
          const need = (diff !== null && diff !== 0) || v.notCounted;
          return (
            <li key={l.sparepart_id} className="space-y-2 p-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span>
                  <b>{l.name}</b>
                  <span className="block text-xs text-muted">{l.code}</span>
                </span>
                <span className="text-xs text-muted">
                  sistem {Number(l.system_qty)} {l.uom}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="mb-1 block text-xs text-muted">Fisik</span>
                  <input
                    inputMode="decimal"
                    value={v.counted}
                    disabled={v.notCounted}
                    onChange={(e) => setEdits((s) => ({ ...s, [l.sparepart_id]: { ...v, counted: e.target.value } }))}
                    onBlur={() => void save(l, value(l))}
                    className={field}
                  />
                </label>
                <label className="flex items-end gap-2 pb-2">
                  <input type="checkbox" className="h-5 w-5" checked={v.notCounted} onChange={(e) => void save(l, { ...v, notCounted: e.target.checked, counted: e.target.checked ? "" : v.counted })} />
                  <span>Tidak dihitung</span>
                </label>
              </div>
              {need && (
                <div className="grid grid-cols-1 gap-2">
                  <select value={v.reason} onChange={(e) => void save(l, { ...v, reason: e.target.value })} className={field} aria-label="Alasan selisih">
                    <option value="">— pilih alasan selisih —</option>
                    {count.reasons.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={v.note}
                    placeholder="Keterangan"
                    onChange={(e) => setEdits((s) => ({ ...s, [l.sparepart_id]: { ...v, note: e.target.value } }))}
                    onBlur={() => void save(l, value(l))}
                    className={field}
                  />
                </div>
              )}
              {diff !== null && diff !== 0 && <p className={diff < 0 ? "text-danger" : "font-medium"}>Selisih {diff > 0 ? "+" : ""}{diff}</p>}
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border p-3 text-xs text-muted">Hasil tersimpan di perangkat dan dikirim otomatis saat ada sinyal. Pengajuan review ke supervisor dilakukan dari halaman opname saat online.</p>
    </details>
  );
}

// ---------------------------------------------------------------- hub
function QueueRow({ item, label }: { item: OutboxItem; label: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
      <span>
        <b>{KIND_LABEL[item.kind]}</b> · {label}
        {item.state === "CONFLICT" && <span className="block text-xs text-danger">{item.error}</span>}
      </span>
      {item.state === "CONFLICT" ? (
        <button type="button" className={btn} onClick={() => void removeOutbox(item.key)}>
          Buang
        </button>
      ) : (
        <span className="text-xs text-muted">menunggu</span>
      )}
    </li>
  );
}

/**
 * Hub mode offline: tampil saat tidak ada sinyal (halaman /offline). Menampilkan Tugas Saya, lembar opname, antrean sinkron,
 * dan Lapor Darurat dari salinan di perangkat. Semua perubahan masuk antrean dan dikirim otomatis ketika online.
 */
export function OfflineHub() {
  const userId = useSyncExternalStore(subscribeStorage, () => localStorage.getItem(OFFLINE_USER_KEY) ?? "", () => "");
  const online = useSyncExternalStore(subscribeNet, () => navigator.onLine, () => false);
  const path = useSyncExternalStore(
    (cb) => {
      window.addEventListener("popstate", cb);
      return () => window.removeEventListener("popstate", cb);
    },
    () => window.location.pathname,
    () => "",
  );
  const outbox = useOutbox(userId);
  const wos = useSnapshots<WoSnap>(userId, "wo");
  const counts = useSnapshots<CountSnap>(userId, "count");
  const reload = useCallback(() => {
    wos.reload();
    counts.reload();
  }, [wos, counts]);

  const woId = path.match(/\/maintenance\/work-orders\/([0-9a-f-]{36})/)?.[1];
  const countId = path.match(/\/inventory\/counts\/([0-9a-f-]{36})/)?.[1];
  const labelOf = (i: OutboxItem) => wos.list?.find((w) => w.id === i.ref)?.wo_no ?? counts.list?.find((c) => c.id === i.ref)?.count_no ?? "";

  return (
    <div className="w-full max-w-xl space-y-6 text-left">
      <p
        role="status"
        className={`rounded-lg px-3 py-2 text-sm ${online ? "bg-brand-soft" : "bg-danger-soft text-danger"}`}
      >
        {online ? "Koneksi tersedia. Antrean dikirim otomatis." : "Tidak ada sinyal. Anda tetap dapat bekerja; hasilnya dikirim saat sinyal kembali."}
        {online && (
          <>
            {" "}
            {/* tautan biasa agar memuat ulang penuh */}
            <a href="/dashboard" className="font-medium underline">
              Buka aplikasi
            </a>
          </>
        )}
      </p>

      <section id="antrean" aria-labelledby="h-antrean">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="h-antrean" className="font-heading text-xl">
            Menunggu sinkron
          </h2>
          <button type="button" className={btn} disabled={!online || outbox.flushing || !outbox.items.length} onClick={outbox.flush}>
            {outbox.flushing ? "Mengirim…" : "Kirim sekarang"}
          </button>
        </div>
        {outbox.items.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {outbox.items.map((i) => (
              <QueueRow key={i.key} item={i} label={labelOf(i)} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">Tidak ada pekerjaan yang menunggu.</p>
        )}
      </section>

      {userId && (wos.list?.length ?? 0) > 0 && (
        <section aria-labelledby="h-tugas">
          <h2 id="h-tugas" className="mb-2 font-heading text-xl">
            Tugas Saya
          </h2>
          <div className="space-y-2">
            {wos.list!.map((w) => (
              <WoCard key={w.id} wo={w} userId={userId} outbox={outbox} open={w.id === woId} onChanged={reload} />
            ))}
          </div>
        </section>
      )}

      {userId && (counts.list?.length ?? 0) > 0 && (
        <section aria-labelledby="h-opname">
          <h2 id="h-opname" className="mb-2 font-heading text-xl">
            Stock Opname
          </h2>
          <div className="space-y-2">
            {counts.list!.map((c) => (
              <CountCard key={c.id} count={c} userId={userId} outbox={outbox} open={c.id === countId} onChanged={reload} />
            ))}
          </div>
        </section>
      )}

      {!userId && (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          Tugas dan opname offline tersedia setelah Anda membuka aplikasi sekali saat ada sinyal (data disalin ke perangkat ini).
        </p>
      )}

      <OfflineEmergency />
    </div>
  );
}
