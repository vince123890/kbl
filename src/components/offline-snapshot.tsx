"use client";

import { useEffect } from "react";
import { replaceSnapshots } from "@/lib/outbox";
import { OFFLINE_USER_KEY, type CountSnap, type WoSnap } from "@/lib/offline-types";

/**
 * Menyalin data kerja user ke perangkat setiap halaman ini dibuka saat online, supaya hub offline (/offline) dapat
 * menampilkannya tanpa sinyal. Tidak menampilkan apa pun.
 */
export function OfflineSnapshot({ userId, wos, counts }: { userId: string; wos: WoSnap[]; counts: CountSnap[] }) {
  const sig = JSON.stringify([wos, counts]);
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_USER_KEY, userId);
    } catch {
      /* penyimpanan lokal tidak tersedia */
    }
    const data = JSON.parse(sig) as [WoSnap[], CountSnap[]];
    void replaceSnapshots(userId, "wo", data[0].map((w) => ({ id: w.id, data: w })));
    void replaceSnapshots(userId, "count", data[1].map((c) => ({ id: c.id, data: c })));
  }, [userId, sig]);
  return null;
}
