# Project Context (sdd/config.md)

## Domain
Sistem Manajemen Perawatan & Sparepart Kendaraan (KBL). Digunakan pusat dan cabang untuk mencatat mutasi sparepart, stock opname, jadwal perawatan/perbaikan (termasuk emergensi), perubahan jadwal beserta alasan, approval berjenjang, dan penanganan emergensi di jalan.

Istilah: **WO** (Work Order) · **Mutasi** (dokumen keluar-masuk sparepart) · **Posting** (saat mutasi benar-benar mengubah stok) · **Pusat / HQ** (cabang dengan `is_hq`) · **Anomali** (percepatan/penundaan jadwal).

Sumber kebenaran bisnis: [../requirement.docx](../requirement.docx) → [../PRD.md](../PRD.md) → [../TECHNICAL_LOGIC.md](../TECHNICAL_LOGIC.md) → [../MENU-SUBMENU-SPESIFIKASI.md](../MENU-SUBMENU-SPESIFIKASI.md). Asumsi: [../assumption.md](../assumption.md).

## Tech Stack
Diputuskan 2026-10-24: **Next.js 16 (App Router, fullstack) + Supabase** (Postgres, Auth, RLS), web responsif dan **PWA** yang dapat dipasang dari browser.
- Auth: Supabase Auth (email + password); sesi lewat cookie `@supabase/ssr`; akun dibuat admin (signup publik dimatikan).
- Data: Postgres dengan RLS; aturan inti (audit, odometer, SYS_ADMIN terakhir, parameter) ada di trigger database.
- Server: Server Actions + Route Handlers; klien `service_role` hanya di server (`src/lib/supabase/admin.ts`).
- Tes: Vitest; skema SQL diuji di PGlite (tanpa Docker).

## Konvensi
- Struktur kode: `src/app` (route), `src/lib` (logika murni + klien Supabase), `src/components`, `supabase/migrations` (skema), `tests/db` (tes SQL).
- Gaya & library: dependensi baru wajib dicek keberadaan, perawatan, dan lisensinya; hindari library yang menggandakan fungsi yang sudah ada.
- Perintah: build `npm run build` · test `npm test` · lint `npm run lint` · typecheck `npm run typecheck` · run `npm run dev`

## Kekritisan & Verifikasi
- Default kekritisan: **menengah**
- Area kritis (**tinggi**): autentikasi & otorisasi, integritas stok (ledger/posting), approval & segregation of duties, laporan emergensi
- Lapisan tes wajib: unit untuk aturan bisnis · integrasi untuk batas (DB, API, RBAC per cabang) · E2E hanya jalur kritis (login, lapor darurat, mutasi → approval → posting)

## Batasan Non-Fungsional
- Keamanan: password di-hash oleh Supabase Auth, RBAC diperiksa di backend, filter `branch_id` di lapisan query, audit log append-only.
- Kinerja: halaman utama < 3 dtk; notifikasi emergensi < 10 dtk.
- Mobile: layar pengemudi/mekanik/opname dioptimalkan untuk ponsel (PWA).
- Waktu: simpan UTC, tampil zona waktu cabang.
- Data: tidak ada hapus fisik pada master dan transaksi; gunakan nonaktif/batal/reversal.
