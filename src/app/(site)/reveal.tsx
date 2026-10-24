"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Muncul saat di-scroll: sekali jalan, tegas (naik 28px + sedikit membesar), tidak mengulang.
 * Konten sudah ada di DOM tanpa JS; atribut tersembunyi baru dipasang setelah pengamat siap.
 * Hormati prefers-reduced-motion (tidak menyembunyikan apa pun).
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "article" | "section";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    // elemen yang sudah terlihat saat dimuat tidak perlu disembunyikan lalu dimunculkan
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return;
    el.setAttribute("data-reveal", "");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.setAttribute("data-visible", "true");
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Comp = Tag as "div";
  return (
    <Comp ref={ref as React.Ref<HTMLDivElement>} className={className} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Comp>
  );
}
