"use client";

import { useEffect, useRef, useState } from "react";

/** Banner dan bunyi singkat saat ada insiden baru yang belum dikonfirmasi muncul di daftar (penyegaran 15 detik). */
export function IncidentAlert({ unackedIds }: { unackedIds: string[] }) {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState(0);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(unackedIds);
      return;
    }
    const added = unackedIds.filter((id) => !seen.current!.has(id));
    for (const id of unackedIds) seen.current.add(id);
    if (!added.length) return;
    setFresh((n) => n + added.length);
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      [880, 660, 880].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        g.gain.value = 0.15;
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.25);
        o.stop(ctx.currentTime + i * 0.25 + 0.18);
      });
    } catch {
      /* peramban memblokir audio tanpa interaksi pengguna */
    }
  }, [unackedIds]);

  if (!fresh) return null;
  return (
    <p role="alert" className="mb-3 flex items-center justify-between rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
      {fresh} insiden baru masuk dan belum dikonfirmasi.
      <button type="button" onClick={() => setFresh(0)} className="tap px-2 underline">
        Tutup
      </button>
    </p>
  );
}
