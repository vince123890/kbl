"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const padded = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Mengaktifkan atau mematikan notifikasi push di perangkat ini. */
export function PushToggle() {
  const supported = useSyncExternalStore(
    () => () => undefined,
    () => !!PUBLIC_KEY && "serviceWorker" in navigator && "PushManager" in window,
    () => false,
  );
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setOn(!!sub))
      .catch(() => undefined);
  }, [supported]);

  if (!supported) return <p className="text-sm text-muted">Notifikasi push belum tersedia di perangkat atau konfigurasi ini.</p>;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: existing.endpoint }) });
        await existing.unsubscribe();
        setOn(false);
        return;
      }
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Izin notifikasi ditolak di peramban");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY!) });
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!r.ok) throw new Error("Server menolak langganan");
      setOn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah notifikasi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="tap rounded-lg border border-border px-4 text-sm hover:bg-brand-soft disabled:opacity-60"
      >
        {on ? "Matikan notifikasi di perangkat ini" : "Aktifkan notifikasi di perangkat ini"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
