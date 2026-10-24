"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { reportIncidentAction, type IncidentPayload } from "@/app/(app)/emergency/actions";
import { parseGuide, readGuideRaw, saveGuide, subscribeStorage, TYPE_BUTTONS, type Guide } from "@/lib/emergency-guide";
import { listQueued, newKey, queueReport, removeQueued, type QueuedReport } from "@/lib/offline-queue";

const TYPE_LABEL = Object.fromEntries(TYPE_BUTTONS.map((t) => [t.type, t.label]));

type Contact = Guide["contacts"][number];

function Steps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <section aria-label={`Langkah cepat: ${title}`} className="rounded-xl border-2 border-brand bg-brand-soft p-4">
      <h3 className="mb-2 font-semibold">LANGKAH CEPAT: {title}</h3>
      <ol className="list-decimal space-y-1.5 pl-5 text-base">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </section>
  );
}

function Contacts({ contacts, smsText }: { contacts: Contact[]; smsText?: string }) {
  if (!contacts.length) return null;
  return (
    <section aria-label="Kontak darurat" className="space-y-2">
      <h3 className="font-semibold">KONTAK</h3>
      {contacts.map((c, i) => (
        <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{c.role_label}</p>
            <p className="truncate text-sm text-muted">
              {c.name} · {c.phone}
            </p>
          </div>
          <a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`} className="tap inline-flex min-w-24 items-center justify-center rounded-lg bg-brand px-4 font-medium text-on-brand">
            Telepon
          </a>
          {smsText && (
            <a href={`sms:${c.phone.replace(/[^+\d]/g, "")}?body=${encodeURIComponent(smsText)}`} className="tap inline-flex items-center rounded-lg border border-border px-3 text-sm">
              SMS
            </a>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * Lapor Darurat: satu ketukan pada jenis kejadian = laporan terkirim. Tanpa sinyal, laporan masuk antrean lokal
 * dan dikirim ulang otomatis dengan kunci idempoten yang sama. Langkah cepat dan kontak tampil dari cache.
 */
export function EmergencyKit({
  guide: serverGuide,
  userId,
  defaultVehicleId,
  offlinePage,
}: {
  guide: Guide | null;
  userId: string | null;
  defaultVehicleId?: string;
  /** true di halaman /offline: selalu antre, kecuali koneksi kembali */
  offlinePage?: boolean;
}) {
  // di halaman /offline panduan dibaca dari cache perangkat (tidak memakai efek + setState)
  const cachedRaw = useSyncExternalStore(subscribeStorage, readGuideRaw, () => null);
  const guide = useMemo(() => serverGuide ?? parseGuide(cachedRaw), [serverGuide, cachedRaw]);
  const [vehicleSel, setVehicleId] = useState(defaultVehicleId ?? "");
  const vehicleId = vehicleSel || guide?.vehicles[0]?.id || "";
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<"wait" | "ok" | "off">("wait");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<IncidentPayload | null>(null);
  const [queued, setQueued] = useState<QueuedReport[]>([]);
  const [justQueued, setJustQueued] = useState<{ type: string; plate: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const flushing = useRef(false);

  // simpan panduan untuk dipakai offline; di halaman /offline, muat dari cache
  useEffect(() => {
    if (serverGuide) saveGuide(serverGuide);
  }, [serverGuide]);

  // lokasi otomatis
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      const t = setTimeout(() => setGeo("off"), 0);
      return () => clearTimeout(t);
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) });
        setGeo("ok");
      },
      () => setGeo("off"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const refreshQueue = useCallback(async () => setQueued((await listQueued()).filter((q) => !userId || !q.userId || q.userId === userId)), [userId]);

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    flushing.current = true;
    try {
      for (const q of (await listQueued()).filter((x) => !userId || !x.userId || x.userId === userId)) {
        try {
          const r = await reportIncidentAction({ vehicleId: q.vehicleId, type: q.type, lat: q.lat, lng: q.lng, idem: q.id });
          if (r.ok) {
            await removeQueued(q.id);
            setBanner(`Laporan tertunda (${TYPE_LABEL[q.type]}, ${q.vehicleLabel}) terkirim: ${r.data?.incident.incident_no}`);
          } else if (!/Sesi berakhir/.test(r.error)) {
            await removeQueued(q.id); // ditolak server (mis. kendaraan tidak sah); jangan diulang selamanya
            setBanner(`Laporan tertunda ditolak server: ${r.error}`);
          }
        } catch {
          break; // masih tanpa jaringan
        }
      }
    } finally {
      flushing.current = false;
      refreshQueue();
    }
  }, [userId, refreshQueue]);

  useEffect(() => {
    const first = setTimeout(() => {
      void refreshQueue();
      void flush();
    }, 0);
    const on = () => void flush();
    window.addEventListener("online", on);
    const t = setInterval(() => void flush(), 30_000);
    return () => {
      clearTimeout(first);
      window.removeEventListener("online", on);
      clearInterval(t);
    };
  }, [flush, refreshQueue]);

  const plate = guide?.vehicles.find((v) => v.id === vehicleId)?.plate ?? "";

  const report = async (type: string) => {
    if (!vehicleId) return setError("Pilih kendaraan terlebih dahulu");
    setError(null);
    setBusy(true);
    const idem = newKey();
    const item: QueuedReport = { id: idem, userId, vehicleId, vehicleLabel: plate, type, lat: coords?.lat ?? null, lng: coords?.lng ?? null, at: new Date().toISOString() };
    try {
      if (!navigator.onLine) throw new Error("offline");
      const r = await reportIncidentAction({ vehicleId, type, lat: item.lat, lng: item.lng, idem });
      if (r.ok && r.data) {
        setSent(r.data);
      } else if (!r.ok) {
        if (/Sesi berakhir/.test(r.error)) throw new Error("session");
        setError(r.error);
      }
    } catch {
      await queueReport(item); // jaringan putus atau sesi habis: simpan lokal, kirim ulang otomatis
      setJustQueued({ type, plate });
      refreshQueue();
    } finally {
      setBusy(false);
    }
  };

  const centerPhone = guide?.centerPhone ?? guide?.contacts[0]?.phone ?? null;

  // ---- layar setelah laporan terkirim
  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-brand bg-surface p-4">
          <p className="text-sm text-muted">Laporan terkirim</p>
          <p className="font-heading text-2xl">{sent.incident.incident_no}</p>
          <p className="text-sm">Pusat sedang diberi tahu. Tetap tenang dan ikuti langkah di bawah.</p>
        </div>
        <Steps title={sent.playbook.title} steps={sent.playbook.steps} />
        <Contacts contacts={sent.contacts} />
        <div className="flex flex-wrap gap-2">
          <Link href={`/emergency/incidents/${sent.incident.id}`} className="tap inline-flex items-center rounded-lg bg-brand px-4 font-medium text-on-brand">
            Tambah foto dan keterangan
          </Link>
          <button type="button" className="tap rounded-lg border border-border px-4" onClick={() => setSent(null)}>
            Selesai
          </button>
        </div>
      </div>
    );
  }

  // ---- layar setelah laporan diantre (offline)
  if (justQueued) {
    const pb = guide?.playbooks[justQueued.type] ?? guide?.playbooks.GENERAL;
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-danger bg-danger-soft p-4">
          <p className="font-semibold">Tidak ada sinyal. Laporan disimpan di perangkat ini.</p>
          <p className="text-sm">
            {TYPE_LABEL[justQueued.type]} · {justQueued.plate}. Akan terkirim otomatis begitu sinyal kembali. Sambil menunggu, hubungi pusat lewat telepon atau SMS.
          </p>
        </div>
        {pb && <Steps title={pb.title} steps={pb.steps} />}
        <Contacts contacts={guide?.contacts ?? []} smsText={`DARURAT ${TYPE_LABEL[justQueued.type]} ${justQueued.plate}${coords ? ` lokasi ${coords.lat},${coords.lng}` : ""}`} />
        <button type="button" className="tap rounded-lg border border-border px-4" onClick={() => setJustQueued(null)}>
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {banner && (
        <p role="status" className="rounded-lg bg-brand-soft px-3 py-2 text-sm">
          {banner}
        </p>
      )}
      {queued.length > 0 && (
        <p role="status" className="rounded-lg bg-warn-soft px-3 py-2 text-sm">
          {queued.length} laporan menunggu terkirim ({queued.map((q) => TYPE_LABEL[q.type]).join(", ")}). Akan dikirim otomatis saat ada sinyal.
        </p>
      )}
      {offlinePage && !guide && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">Panduan belum tersimpan di perangkat ini. Buka halaman Lapor Darurat sekali saat ada sinyal agar tersedia offline.</p>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Kendaraan</span>
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="tap w-full rounded-lg border border-border bg-surface px-3 text-base">
          {!guide?.vehicles.length && <option value="">— tidak ada kendaraan —</option>}
          {guide?.vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        {TYPE_BUTTONS.map((t) => (
          <button
            key={t.type}
            type="button"
            disabled={busy || !vehicleId}
            onClick={() => report(t.type)}
            className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-foreground bg-surface text-lg font-semibold active:bg-brand disabled:opacity-50"
          >
            <span aria-hidden className="text-3xl">
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        📍 {geo === "ok" && coords ? `Lokasi terdeteksi (${coords.lat}, ${coords.lng})` : geo === "wait" ? "Mencari lokasi…" : "Lokasi tidak tersedia; pusat akan menanyakan posisi Anda."}
      </p>
      {busy && <p role="status">Mengirim laporan…</p>}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {centerPhone && (
        <a href={`tel:${centerPhone.replace(/[^+\d]/g, "")}`} className="tap flex w-full items-center justify-center rounded-xl border border-border bg-surface px-4 font-medium">
          Telepon pusat langsung: {centerPhone}
        </a>
      )}
      <Contacts contacts={guide?.contacts ?? []} />
    </div>
  );
}
