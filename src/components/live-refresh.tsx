"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Menyegarkan data halaman server secara berkala selama tab terlihat (mis. antrean insiden 15 detik). */
export function LiveRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
