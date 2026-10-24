# Proposal: foundation-auth-master

## Why
Fitur ini ada untuk menyediakan **identitas pengguna, hak akses per role dan cabang, data master, dan jejak audit**, sehingga semua modul berikutnya (approval, mutasi sparepart, opname, jadwal, emergensi) dapat dibangun di atasnya dengan kontrol terpusat. Tanpa fondasi ini, tidak ada cara memastikan siapa yang boleh menyetujui apa dan data milik cabang mana.

Slice ini adalah urutan #1 dari 7 slice (lihat [../../../MENU-SUBMENU-SPESIFIKASI.md](../../../MENU-SUBMENU-SPESIFIKASI.md) "Urutan bangun").

## What Changes
- Pengguna dapat login, logout, ganti password, dan reset password lupa.
- SYS_ADMIN mengelola user, role, dan permission; 7 role bawaan tersedia.
- Data dibatasi per cabang; HQ_ADMIN dapat melintasi cabang.
- Master data tersedia: Cabang, Kendaraan, Sparepart, Lokasi/Gudang, Vendor/Bengkel, Kategori Alasan.
- Semua perubahan penting dan event login tercatat di audit log yang tidak bisa diubah.
- Parameter Sistem dapat diedit (nilai awal sesuai [../../../assumption.md](../../../assumption.md)).

## Capabilities
### New Capabilities
- `authentication`: login, sesi, ganti/reset password, penguncian akun
- `user-role-management`: user, role, permission, pembatasan cabang
- `master-data`: Cabang, Kendaraan, Sparepart, Lokasi, Vendor, Kategori Alasan, Parameter Sistem
- `audit-log`: pencatatan dan penelusuran perubahan

### Modified Capabilities
- Tidak ada (proyek baru).

## Non-Goals
- Approval engine dan alur approval (slice 2).
- Mutasi, saldo, kartu stok, opname (slice 3–4). Saldo awal tidak diisi di master Sparepart.
- Perawatan, WO, kalender, anomali, emergensi (slice 5–7).
- Dashboard dan laporan (mengikuti slice masing-masing); hanya halaman kosong/placeholder Dashboard.
- Upload Excel massal untuk master dan user (ditunda; lihat Open Question #3).
- SSO/portal induk, login sosial, MFA.
- Notifikasi WhatsApp/SMS. Reset password memakai email saja.

## Impact
- Proyek baru, tidak ada perilaku existing yang terdampak.
- Menentukan model `branch_id` dan RBAC yang dipakai semua slice berikutnya; kesalahan di sini mahal diperbaiki nanti.

## Assumptions
- Aplikasi berdiri sendiri, login/user/role dikelola sendiri (dasar: A-4, H-3; Keputusan #1 di menu spec).
- Tujuh role bawaan: DRIVER, MECHANIC, WAREHOUSE, SUPERVISOR, DEPT_HEAD, HQ_ADMIN, SYS_ADMIN (dasar: A-2).
- Satu user punya satu cabang; role boleh lebih dari satu (dasar: menu spec §8.1).
- Hanya satu cabang boleh bertanda Pusat (`is_hq`) (dasar: menu spec §2.1).
- Akun terkunci 15 menit setelah 5 kali gagal login berturut-turut; sesi berlaku 8 jam; password minimal 8 karakter berisi huruf dan angka (dasar: praktik umum, bukan dari bisnis).
- Link reset password berlaku 1 jam dan dikirim lewat email (dasar: praktik umum).
- Kategori Alasan awal sesuai E-1; Parameter awal sesuai D-3, G-5, D-4 (dasar: [../../../assumption.md](../../../assumption.md)).
- Audit log disimpan tanpa batas waktu sampai kebijakan retensi diputuskan.

## Open Questions
- [x] Tech stack: **Next.js 16 + Supabase + PWA** (diputuskan pengguna, 2026-10-24).
- [ ] [BLOCKING] Layanan email untuk reset password (SMTP apa?) — opsi: A (rekomendasi) SMTP perusahaan yang ada / B penyedia pihak ketiga / C admin reset manual dulu, tanpa email.
- [ ] Upload Excel untuk Kendaraan, Sparepart, User perlu di slice ini? — opsi: A (rekomendasi) tunda ke slice berikutnya / B masukkan sekarang.
- [ ] Apakah satu user boleh mengakses lebih dari satu cabang selain HQ_ADMIN? — opsi: A (rekomendasi) tidak, satu cabang / B ya, daftar cabang.
- [ ] Kebijakan retensi audit log (berapa tahun)?
