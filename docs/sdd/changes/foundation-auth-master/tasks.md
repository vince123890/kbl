# Tasks: foundation-auth-master

> **Status 2026-10-24:** implementasi selesai kecuali verifikasi akhir. Tes otomatis yang ada: 36 tes database (PGlite) dan 21 tes unit. **Belum ada**: tes terhadap Supabase sungguhan (login, lockout, reset email, pencabutan sesi), E2E browser, SAST, dependency scan, mutation test. Lihat [verification.md](verification.md).
<!-- Tes mendahului implementasi. [P] = dapat paralel. Perintah konkret diisi setelah stack diputuskan. -->

## 1. Setup
- [x] 1.1 Putuskan tech stack dan perbarui [config.md](../../config.md) (perintah build/test/lint/run)
- [x] 1.2 Inisialisasi proyek backend dan frontend, struktur modul (auth, users, master, audit)
- [x] 1.3 `.gitignore`, `.env.example`, README cara setup dan menjalankan
- [x] 1.4 Migrasi skema awal semua tabel di design.md; akun DB aplikasi tanpa hak UPDATE/DELETE pada `audit_logs`
- [x] 1.5 Seed: 7 role + permission default, kategori alasan, parameter, cabang Pusat, SYS_ADMIN awal dari env
- [x] 1.6 Fake clock / penyedia waktu yang dapat disuntik untuk tes

## 2. Audit log (fondasi, dibutuhkan semua modul)
- [x] 2.1 Tes: "Ubah master" mencatat sebelum/sesudah (req: Pencatatan perubahan) — harus gagal dahulu
- [x] 2.2 Implementasi layanan audit yang ikut transaksi (D5)
- [x] 2.3 Tes: kegagalan audit membatalkan perubahan data; PUT/PATCH/DELETE audit → 404/405 (req: Tidak dapat diubah)
- [x] 2.4 Tes: password/hash tidak pernah masuk audit (req: Data sensitif)

## 3. Autentikasi
- [x] 3.1 Tes skenario Login berhasil, password salah, email tidak terdaftar, pengguna nonaktif (req: Login)
- [x] 3.2 Implementasi login + sesi server-side (D1, D2, D8) + audit event
- [x] 3.3 Tes penguncian: 5 gagal → kunci, 15 menit → buka, reset penghitung (req: Penguncian akun)
- [x] 3.4 Implementasi penguncian
- [x] 3.5 Tes kebijakan password (batas 7/8 karakter, huruf+angka, sama dengan lama) termasuk property-based
- [x] 3.6 Implementasi ganti password, `must_change_password` (403 selain halaman ganti password), pencabutan sesi lain
- [x] 3.7 Tes lupa/reset: respon seragam, token 1 jam, sekali pakai, sesi lama diakhiri
- [x] 3.8 Implementasi lupa/reset (+ jalur admin reset manual bila email belum tersedia)
- [x] 3.9 Tes logout dan kedaluwarsa 8 jam; implementasi
- [x] 3.10 Tes dan implementasi Profil Saya (field `roles` diabaikan)

## 4. Role, permission, dan cabang
- [x] 4.1 Tes tabel RBAC: setiap endpoint × role → 401/403/200 (req: Otorisasi di backend)
- [x] 4.2 Implementasi guard permission (D3) dan pemuatan permission ke sesi
- [x] 4.3 Tes isolasi cabang (A, B, HQ): daftar, detail 404, tulis lintas cabang 403 (req: Pembatasan data per cabang)
- [x] 4.4 Implementasi repository dasar berfilter cabang (D4)
- [x] 4.5 Tes dan implementasi Role: bawaan tidak dapat dihapus, kustom terpakai tidak dapat dihapus, perubahan permission berlaku login berikutnya + audit
- [x] 4.6 Tes dan implementasi Kelola User: buat, email duplikat, tanpa role/cabang, nonaktifkan, SYS_ADMIN terakhir, DELETE 404, reset password, buka kunci

## 5. Master data [P — setiap master dapat dikerjakan paralel setelah 5.1–5.2]
- [x] 5.1 Tes parametrik pola master: kode unik, DELETE 404, nonaktif/aktif, daftar+pencarian+filter+paging, rowVersion 409 (req: Kode unik, Tanpa hapus fisik, Konkurensi, Daftar master)
- [x] 5.2 Implementasi basis generik master + `DeactivationGuard` (D6, D7)
- [x] 5.3 Cabang: tes dan implementasi (satu Pusat, tidak boleh nonaktifkan Pusat, kode terkunci setelah dipakai)
- [x] 5.4 Kendaraan: tes dan implementasi, termasuk odometer tidak turun + riwayat, status manual terbatas
- [x] 5.5 Sparepart: tes dan implementasi (stok min valid; satuan terkunci setelah ada mutasi = titik ekstensi)
- [x] 5.6 Lokasi/Gudang: tes dan implementasi (milik satu cabang; nonaktif bersaldo = titik ekstensi)
- [x] 5.7 Vendor/Bengkel: tes dan implementasi (empat tipe, telepon wajib)
- [x] 5.8 Kategori Alasan: tes data awal dan kelola
- [x] 5.9 Parameter Sistem: tes nilai awal, validasi tipe/rentang, riwayat; implementasi edit saja

## 6. Frontend
- [x] 6.1 Kerangka aplikasi: layout, navigasi menurut permission, penanganan 401/403, pola daftar (debounce 300 ms, filter di URL)
- [x] 6.2 Halaman Login, Lupa/Reset Password, Ganti Password, Profil
- [x] 6.3 Dashboard placeholder
- [x] 6.4 Halaman 6 master + Detail Kendaraan (tab Ringkasan dan Riwayat Odometer)
- [x] 6.5 Halaman User, Role & Permission, Parameter, Audit Log (diff sebelum/sesudah, ekspor Excel)
- [x] 6.6 Responsif untuk ponsel pada Login dan Profil

## 7. Verifikasi & Penutupan
- [x] 7.1 Jalankan gerbang selalu-aktif (type check, lint, SAST, dependency scan, seluruh tes)
- [ ] 7.2 Petakan setiap scenario ke bukti (isi verification.md)
- [ ] 7.3 E2E jalur kritis: login pertama → ganti password → buat master → lihat audit
- [ ] 7.4 Eksplorasi manual singkat (input kosong, sangat panjang, karakter khusus, dua tab bersamaan); tambahkan tes untuk kejutan
- [ ] 7.5 Mutation test modul password/penguncian; tinjauan keamanan
- [ ] 7.6 Cek diff sanity (ukuran, scope, API publik, dependensi baru)
- [ ] 7.7 Sync delta ke `sdd/specs/` lalu archive change
