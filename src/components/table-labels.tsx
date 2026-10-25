"use client";

import { useEffect } from "react";

/**
 * Di ponsel tabel `.table-cards` tampil sebagai kartu bertumpuk. Kartu butuh nama kolom di tiap sel (`data-label`),
 * jadi di sini label diambil dari header tabel untuk semua tabel yang belum memberinya, termasuk tabel yang muncul belakangan.
 */
export function TableLabels() {
  useEffect(() => {
    const label = () => {
      document.querySelectorAll<HTMLTableElement>("table.table-cards").forEach((t) => {
        const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
        t.querySelectorAll("tbody tr").forEach((tr) => {
          let i = 0;
          tr.querySelectorAll(":scope > td").forEach((td) => {
            if (!td.hasAttribute("data-label")) td.setAttribute("data-label", heads[i] ?? "");
            i += (td as HTMLTableCellElement).colSpan || 1;
          });
        });
      });
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
