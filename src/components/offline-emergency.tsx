"use client";

import { useSyncExternalStore } from "react";
import { EmergencyKit } from "@/components/emergency-kit";
import { parseGuide, readGuideRaw, subscribeStorage } from "@/lib/emergency-guide";

/** Layar darurat saat tidak ada sinyal: panduan dari cache perangkat + antrean laporan. */
export function OfflineEmergency() {
  const raw = useSyncExternalStore(subscribeStorage, readGuideRaw, () => null);
  const userId = parseGuide(raw)?.userId ?? null;
  return (
    <section aria-labelledby="darurat" className="w-full max-w-xl text-left">
      <h2 id="darurat" className="mb-3 font-heading text-xl">
        Keadaan darurat?
      </h2>
      <EmergencyKit guide={null} userId={userId} offlinePage />
    </section>
  );
}
