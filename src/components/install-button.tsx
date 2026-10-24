"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribeStandalone(cb: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function getStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Tombol "Pasang Aplikasi". Di iOS tidak ada prompt otomatis, jadi tampilkan petunjuk Add to Home Screen. */
export function InstallButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installedEvent, setInstalledEvent] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const standalone = useSyncExternalStore(subscribeStandalone, getStandalone, () => false);
  const isIos = useSyncExternalStore(
    () => () => {},
    () => /iphone|ipad|ipod/i.test(navigator.userAgent),
    () => false,
  );
  const installed = standalone || installedEvent;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalledEvent(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!deferred && !isIos) return null;

  return (
    <div className={className}>
      <button
        type="button"
        className="tap rounded-lg border border-brand px-3 text-sm font-medium text-brand hover:bg-brand-soft"
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
          } else {
            setShowHelp((v) => !v);
          }
        }}
      >
        Pasang Aplikasi
      </button>
      {showHelp && (
        <p className="mt-2 text-xs text-muted">
          Di iPhone/iPad: ketuk tombol Bagikan, lalu pilih <b>Tambah ke Layar Utama</b>.
        </p>
      )}
    </div>
  );
}
