"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IllApproval, IllEmergency, IllSchedule, IllStock } from "./illustrations";

const SLIDES = [
  {
    word: "Tercatat",
    service: "Mutasi sparepart & kartu stok",
    text: "Setiap sparepart yang masuk dan keluar punya dokumen, nama, dan jam. Saldo tak pernah minus.",
    href: "#modul-stok",
    Art: IllStock,
  },
  {
    word: "Terjadwal",
    service: "Perawatan, jadwal & anomali",
    text: "Servis datang sebelum diminta. Jadwal yang bergeser wajib punya alasan.",
    href: "#modul-jadwal",
    Art: IllSchedule,
  },
  {
    word: "Terkontrol",
    service: "Approval berjenjang dari pusat",
    text: "Keputusan penting melewati atasan dan departemen terkait. Pusat melihat semuanya.",
    href: "#modul-approval",
    Art: IllApproval,
  },
  {
    word: "Terjaga",
    service: "Penanganan darurat di jalan",
    text: "Satu ketukan melapor. Langkah cepat dan kontak pusat langsung di layar pengemudi.",
    href: "#modul-darurat",
    Art: IllEmergency,
  },
];

const INTERVAL_MS = 6500;

export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [reduced, setReduced] = useState(false);
  const hold = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduced(mq.matches);
      if (mq.matches) setPlaying(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const go = useCallback((i: number) => setIndex((i + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (!playing || hovering || reduced) return;
    const t = setInterval(() => {
      if (!hold.current && !document.hidden) setIndex((i) => (i + 1) % SLIDES.length);
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [playing, hovering, reduced]);

  return (
    <section
      id="beranda"
      className="kb-hero"
      aria-roledescription="carousel"
      aria-label="Sorotan KBL"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => (hold.current = true)}
      onBlur={() => (hold.current = false)}
    >
      <div className="kb-hero-track">
        {SLIDES.map((s, i) => (
          <div
            key={s.word}
            className={`kb-slide kb-slide-${i} ${i === index ? "is-active" : ""}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} dari ${SLIDES.length}`}
            aria-hidden={i === index ? undefined : true}
            inert={i === index ? undefined : true}
          >
            <div className="kb-wrap kb-slide-grid">
              <div className="kb-slide-copy">
                <p className="kb-slide-tag">Sepanjang kilometer, bersama KBL</p>
                <h1 className="kb-slide-word">{s.word}</h1>
                <p className="kb-slide-service">{s.service}</p>
                <p className="kb-slide-text">{s.text}</p>
                <div className="kb-slide-actions">
                  <a className="kb-btn kb-btn-marka" href={s.href}>
                    Selengkapnya
                  </a>
                  <Link className="kb-btn kb-btn-light" href="/login">
                    Masuk
                  </Link>
                </div>
              </div>
              <div className="kb-slide-art" aria-hidden="true">
                <s.Art />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="kb-wrap kb-hero-controls">
        <div className="kb-dots" role="tablist" aria-label="Pilih slide">
          {SLIDES.map((s, i) => (
            <button
              key={s.word}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.word}`}
              className={i === index ? "is-active" : ""}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <div className="kb-arrows">
          <button type="button" aria-label="Slide sebelumnya" onClick={() => go(index - 1)}>
            ‹
          </button>
          <button type="button" aria-label={playing ? "Jeda otomatis" : "Putar otomatis"} onClick={() => setPlaying((p) => !p)}>
            {playing && !reduced ? "❙❙" : "▶"}
          </button>
          <button type="button" aria-label="Slide berikutnya" onClick={() => go(index + 1)}>
            ›
          </button>
        </div>
      </div>
      <p className="kb-sr" aria-live="polite">
        {`Slide ${index + 1} dari ${SLIDES.length}: ${SLIDES[index].word}`}
      </p>
    </section>
  );
}
